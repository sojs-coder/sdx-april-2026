"""
BullishForge backend — PRD dispatch service.

Receives ideas (with full_prd) from the frontend, spawns local Omnara Docker
agents, and streams back real-time progress via SSE.

The twitter-pulling Express service (default http://localhost:3001) handles
trend fetching and PRD generation; this service orchestrates agent execution.

Start with:
    uvicorn server:app --reload --port 8000
"""

import asyncio
import json
import os
import urllib.error
import urllib.request
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import agent_pool
from job_store import store

load_dotenv()

WORKSPACE_ID = os.getenv("OMNARA_WORKSPACE_ID", "")
TWITTER_SERVICE_URL = os.getenv("TWITTER_SERVICE_URL", "http://localhost:3001").rstrip("/")

app = FastAPI(title="BullishForge Agent Dispatch")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ──────────────────────────────────────────────────

class SubmitJobRequest(BaseModel):
    # Accepts a full idea object (as returned by GET /api/ideas),
    # which contains the nested full_prd.
    idea: dict


# ── PRD → Claude Code prompt formatter ────────────────────────────────────────

def _lines(*parts: str) -> str:
    return "\n".join(p for p in parts if p)


def _json_block(obj) -> str:
    return "```json\n" + json.dumps(obj, indent=2) + "\n```"


def format_prompt(idea: dict) -> str:
    """
    Convert a full idea object (as produced by ideaAgent.generateIdeas) into a
    detailed Claude Code prompt.

    Idea shape:
      { name, tagline, problem, solution, target_customer, revenue_model,
        mvp_features, why_now, related_trend,
        full_prd: { overview, backend, frontend, design } }
    """
    name = idea.get("name", "Unknown Product")
    prd = idea.get("full_prd") or {}
    overview = prd.get("overview") or {}
    backend = prd.get("backend") or {}
    frontend = prd.get("frontend") or {}
    design = prd.get("design") or {}

    sections = []

    # ── Header ────────────────────────────────────────────────────────────────
    sections.append(f"# Build task: {name}\n")
    sections.append(
        "You are an expert full-stack engineer. Build this product using Claude Code.\n\n"
        "**Critical rules before you read anything else:**\n"
        "- Use SQLite or flat JSON files for storage — no external databases\n"
        "- No API keys, no paid services, no OAuth providers\n"
        "- Must run with `npm install && npm run dev` — nothing else\n"
        "- Simple single-repo structure, no monorepos\n"
        "- A working simple app is better than a broken complex one\n"
    )

    # ── Product context ───────────────────────────────────────────────────────
    ctx_lines = ["## Product"]
    for key in ("tagline", "problem", "solution", "target_customer", "revenue_model"):
        val = idea.get(key)
        if val:
            ctx_lines.append(f"- **{key.replace('_', ' ').title()}:** {val}")
    features = idea.get("mvp_features") or []
    if features:
        ctx_lines.append("- **MVP features:**")
        ctx_lines.extend(f"  - {f}" for f in features)
    why_now = idea.get("why_now")
    if why_now:
        ctx_lines.append(f"- **Why now:** {why_now}")
    sections.append("\n".join(ctx_lines))

    # ── Overview: auth flow + billing + build order ───────────────────────────
    overview_lines = ["## Overview & Roadmap"]

    auth_flow = overview.get("auth_flow") or []
    if auth_flow:
        overview_lines.append("\n### Auth Flow")
        overview_lines.extend(f"{i+1}. {step}" for i, step in enumerate(auth_flow))

    billing = overview.get("billing_integration") or {}
    if billing:
        overview_lines.append(f"\n### Billing — {billing.get('provider', 'Stripe')}")
        plans = billing.get("plans") or []
        if plans:
            overview_lines.append("| Plan | $/mo | Features |")
            overview_lines.append("|------|------|----------|")
            for p in plans:
                feats = ", ".join(p.get("features") or [])
                overview_lines.append(f"| {p.get('name','')} | ${p.get('price_monthly',0)} | {feats} |")
        webhooks = billing.get("webhook_events") or []
        if webhooks:
            overview_lines.append("\nWebhook events to handle:")
            overview_lines.extend(f"- `{e}`" for e in webhooks)
        if billing.get("notes"):
            overview_lines.append(f"\nNotes: {billing['notes']}")

    build_order = overview.get("mvp_build_order") or []
    if build_order:
        overview_lines.append("\n### MVP Build Order")
        overview_lines.extend(f"{i+1}. {day}" for i, day in enumerate(build_order))

    if len(overview_lines) > 1:
        sections.append("\n".join(overview_lines))

    # ── Backend spec ──────────────────────────────────────────────────────────
    if backend:
        be_lines = ["## Backend"]

        ts = backend.get("tech_stack") or {}
        if ts:
            be_lines.append("\n### Tech Stack")
            for key in ("runtime", "framework", "database", "auth_library", "hosting"):
                val = ts.get(key)
                if val:
                    be_lines.append(f"- **{key.replace('_', ' ').title()}:** {val}")
            apis = ts.get("third_party_apis") or []
            if apis:
                be_lines.append("- **Third-party APIs:**")
                be_lines.extend(f"  - {a}" for a in apis)

        file_structure = backend.get("file_structure") or []
        if file_structure:
            be_lines.append("\n### File Structure")
            be_lines.append("```")
            be_lines.extend(file_structure)
            be_lines.append("```")

        db_schema = backend.get("database_schema") or []
        if db_schema:
            be_lines.append("\n### Database Schema")
            for table in db_schema:
                be_lines.append(f"\n#### `{table.get('table', '')}`")
                if table.get("notes"):
                    be_lines.append(table["notes"])
                cols = table.get("columns") or []
                if cols:
                    be_lines.append("| Column | Type | Constraints | Notes |")
                    be_lines.append("|--------|------|-------------|-------|")
                    for c in cols:
                        be_lines.append(
                            f"| `{c.get('name','')}` | `{c.get('type','')}` "
                            f"| {c.get('constraints','')} | {c.get('notes','')} |"
                        )
                indexes = table.get("indexes") or []
                if indexes:
                    be_lines.append("\nIndexes: " + ", ".join(f"`{i}`" for i in indexes))

        api_contracts = backend.get("api_contracts") or []
        if api_contracts:
            be_lines.append("\n### API Contracts")
            for ep in api_contracts:
                lock = " 🔒" if ep.get("auth_required") else ""
                be_lines.append(f"\n#### `{ep.get('method','')} {ep.get('path','')}`{lock}")
                if ep.get("notes"):
                    be_lines.append(ep["notes"])
                if ep.get("request_body"):
                    be_lines.append("Request body:")
                    be_lines.append(_json_block(ep["request_body"]))
                if ep.get("response_200"):
                    be_lines.append("Response 200:")
                    be_lines.append(_json_block(ep["response_200"]))
                errors = ep.get("response_errors") or []
                if errors:
                    be_lines.append("Errors: " + " | ".join(errors))

        bg_jobs = backend.get("background_jobs") or []
        if bg_jobs:
            be_lines.append("\n### Background Jobs")
            be_lines.append("| Job | Trigger | Runtime | Description |")
            be_lines.append("|-----|---------|---------|-------------|")
            for j in bg_jobs:
                be_lines.append(
                    f"| {j.get('name','')} | `{j.get('trigger','')}` "
                    f"| {j.get('estimated_runtime','')} | {j.get('description','')} |"
                )

        env_vars = backend.get("environment_variables") or []
        if env_vars:
            be_lines.append("\n### Environment Variables")
            be_lines.append("| Variable | Description | Example |")
            be_lines.append("|----------|-------------|---------|")
            for v in env_vars:
                be_lines.append(
                    f"| `{v.get('key','')}` | {v.get('description','')} | `{v.get('example','')}` |"
                )

        sections.append("\n".join(be_lines))

    # ── Frontend spec ─────────────────────────────────────────────────────────
    if frontend:
        fe_lines = ["## Frontend"]

        ts = frontend.get("tech_stack") or {}
        if ts:
            fe_lines.append("\n### Tech Stack")
            for key in ("framework", "styling", "state_management", "data_fetching"):
                val = ts.get(key)
                if val:
                    fe_lines.append(f"- **{key.replace('_', ' ').title()}:** {val}")
            libs = ts.get("key_libraries") or []
            if libs:
                fe_lines.append("- **Key libraries:**")
                fe_lines.extend(f"  - {l}" for l in libs)

        pages = frontend.get("pages") or []
        if pages:
            fe_lines.append("\n### Pages")
            for page in pages:
                lock = " 🔒" if page.get("auth_required") else ""
                fe_lines.append(f"\n#### `{page.get('route','')}` — {page.get('name','')}{lock}")
                if page.get("description"):
                    fe_lines.append(page["description"])
                components = page.get("components") or []
                if components:
                    fe_lines.append("Components:")
                    fe_lines.extend(f"- {c}" for c in components)
                api_calls = page.get("api_calls") or []
                if api_calls:
                    fe_lines.append("API calls:")
                    fe_lines.extend(f"- {c}" for c in api_calls)

        sections.append("\n".join(fe_lines))

    # ── Design spec ───────────────────────────────────────────────────────────
    if design:
        d_lines = ["## Design"]

        if design.get("component_library"):
            d_lines.append(f"**Component library:** {design['component_library']}")
        if design.get("vibe"):
            d_lines.append(f"**Vibe:** {design['vibe']}")

        tokens = design.get("design_tokens") or {}
        if tokens:
            d_lines.append("\n### Design Tokens")
            d_lines.append("| Token | Value |")
            d_lines.append("|-------|-------|")
            for k, v in tokens.items():
                d_lines.append(f"| `{k}` | `{v}` |")

        patterns = design.get("ux_patterns") or []
        if patterns:
            d_lines.append("\n### UX Patterns")
            d_lines.extend(f"- {p}" for p in patterns)

        screens = design.get("key_screens") or []
        if screens:
            d_lines.append("\n### Key Screens")
            for s in screens:
                d_lines.append(f"\n#### {s.get('screen','')}")
                if s.get("layout"):
                    d_lines.append(f"Layout: {s['layout']}")
                interactions = s.get("key_interactions") or []
                if interactions:
                    d_lines.extend(f"- {i}" for i in interactions)

        sections.append("\n".join(d_lines))

    # ── Closing instructions ──────────────────────────────────────────────────
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    workspace_root = "/home/vkommera/Documents/Projects/omnaraw_ws"
    project_dir = f"{workspace_root}/{slug}"

    sections.append(
        f"## Constraints — read these first, they override the PRD\n"
        f"- **No external databases.** Use SQLite (via better-sqlite3 or similar) or JSON files on disk. No Postgres, MySQL, Supabase, MongoDB, Redis, or any hosted DB.\n"
        f"- **No paid API keys.** Do not use Stripe, SendGrid, Resend, Twilio, OpenAI, or any service that requires signing up or paying. If the PRD calls for email, stub it with a console.log. If it calls for payments, show a static pricing page.\n"
        f"- **No auth services.** No Auth0, Clerk, NextAuth with OAuth providers. If login is needed, use a simple hardcoded demo user or localStorage.\n"
        f"- **Keep it runnable with one command.** The app must start with `npm run dev` (or equivalent) after `npm install`. No Docker, no environment setup beyond copying a `.env.example`.\n"
        f"- **Simple stack only.** Next.js or plain HTML/CSS/JS for frontend. If a backend is needed, use a single Express or Fastify file with SQLite. No microservices, no monorepos.\n"
        f"- The PRD is a reference for features and design — adapt it to meet these constraints. A simpler working app beats a complex broken one.\n\n"
        f"## Build instructions\n"
        f"First, create and enter a new directory for this project:\n"
        f"```\nmkdir -p {project_dir}\ncd {project_dir}\n```\n"
        f"All code must be written inside `{project_dir}`.\n\n"
        f"Then build in this order:\n"
        f"1. Scaffold the repo and initialise git.\n"
        f"2. Build the frontend pages with hardcoded/mock data first so it renders.\n"
        f"3. Add a lightweight backend (SQLite) only if the app genuinely needs persistence.\n"
        f"4. Wire frontend to backend.\n"
        f"5. Ensure `npm install && npm run dev` works from the project root.\n"
        f"6. Commit after each section."
    )

    return "\n\n---\n\n".join(sections)


# ── Ideas proxy endpoints (forward to twitter-pulling Express service) ─────────

def _proxy_get(path: str):
    """Make a GET request to the twitter-pulling service."""
    url = f"{TWITTER_SERVICE_URL}{path}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach twitter-pulling service at {TWITTER_SERVICE_URL}: {exc}",
        )


@app.get("/api/ideas")
async def get_ideas():
    """
    Proxy to the twitter-pulling service's /ideas endpoint.
    Fetches current Twitter trends, groups them, and returns 3 PRDs.
    This is an expensive call (multiple LLM calls); it has a 30-min cache
    on the Express side.
    """
    return await asyncio.to_thread(_proxy_get, "/ideas")


@app.get("/api/ideas/history")
async def get_ideas_history():
    """List all previously generated PRD runs saved to disk by the twitter-pulling service."""
    return await asyncio.to_thread(_proxy_get, "/ideas/history")


# ── Job endpoints ──────────────────────────────────────────────────────────────

@app.post("/api/jobs", status_code=201)
async def submit_job(body: SubmitJobRequest):
    """
    Accept a full idea object (as returned by GET /api/ideas), dispatch it to
    an Omnara agent, and return the job_id for polling.

    The idea object should include full_prd for the richest possible prompt.
    """
    if not WORKSPACE_ID:
        raise HTTPException(
            status_code=500,
            detail="OMNARA_WORKSPACE_ID is not set in backend/.env",
        )

    idea = body.idea
    prompt = format_prompt(idea)

    try:
        machine_id = await asyncio.to_thread(agent_pool.ensure_machine)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not acquire agent: {exc}")

    try:
        session_id = await asyncio.to_thread(
            agent_pool.start_session, machine_id, WORKSPACE_ID, prompt
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {exc}")

    job = store.create(session_id=session_id, machine_id=machine_id, prd=idea)
    return {"job_id": job.job_id, "session_id": session_id}


@app.get("/api/jobs")
async def list_jobs():
    """List all jobs (most recent first)."""
    jobs = store.all()
    return {
        "count": len(jobs),
        "jobs": [
            {
                "job_id": j.job_id,
                "status": j.status,
                "created_at": j.created_at.isoformat(),
                "prd_name": j.prd.get("name", ""),
                "session_id": j.session_id,
                "machine_id": j.machine_id,
            }
            for j in jobs
        ],
    }


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Get full job details including messages fetched so far."""
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        fresh = await asyncio.to_thread(agent_pool.get_messages, job.session_id)
        store.append_messages(job_id, fresh[len(job.messages):])
    except Exception:
        pass

    return {
        "job_id": job.job_id,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "prd_name": job.prd.get("name", ""),
        "session_id": job.session_id,
        "machine_id": job.machine_id,
        "messages": job.messages,
        "error": job.error,
    }


@app.get("/api/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """
    SSE endpoint — streams new agent messages in real time.
    Each event is a newline-delimited `data: <json>` line.
    The stream closes when the session reaches a terminal state.
    """
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        seen = len(job.messages)
        terminal_statuses = {"DONE", "STOPPED", "ERROR", "COMPLETED", "FAILED", "CANCELLED"}

        while True:
            try:
                all_messages = await asyncio.to_thread(
                    agent_pool.get_messages, job.session_id
                )
                new_messages = all_messages[seen:]
                if new_messages:
                    store.append_messages(job_id, new_messages)
                    seen += len(new_messages)
                    for msg in new_messages:
                        payload = json.dumps({
                            "role": msg.get("role", ""),
                            "content": msg.get("content", ""),
                        })
                        yield f"data: {payload}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"

            try:
                status = await asyncio.to_thread(
                    agent_pool.get_session_status, job.session_id
                )
                if status in terminal_statuses:
                    store.update_status(job_id, "done" if status != "error" else "error")
                    yield f"data: {json.dumps({'status': status})}\n\n"
                    break
            except Exception:
                pass

            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.delete("/api/jobs/{job_id}", status_code=204)
async def cancel_job(job_id: str):
    """Stop the Omnara session and mark the job cancelled."""
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        await asyncio.to_thread(agent_pool.stop_session, job.session_id)
    except Exception:
        pass

    store.update_status(job_id, "error", error="Cancelled by user")


@app.get("/api/agents")
async def list_agents():
    """List all registered Omnara machines and their idle/busy state."""
    try:
        machines = await asyncio.to_thread(agent_pool.list_machines)
        active_ids = await asyncio.to_thread(agent_pool._active_machine_ids)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "count": len(machines),
        "machines": [
            {
                "id": m.get("id"),
                "name": m.get("machine_name"),
                "status": m.get("status"),
                "busy": m.get("id") in active_ids,
                "platform": m.get("platform"),
            }
            for m in machines
        ],
    }
