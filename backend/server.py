"""
BullishForge backend — PRD dispatch service.

Receives PRDs from the frontend, spawns local Omnara Docker agents,
and streams back real-time progress via SSE.

Start with:
    uvicorn server:app --reload --port 8000
"""

import asyncio
import json
import os
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

app = FastAPI(title="BullishForge Agent Dispatch")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ──────────────────────────────────────────────────

class SubmitJobRequest(BaseModel):
    prd: dict


class JobSummary(BaseModel):
    job_id: str
    status: str
    created_at: str
    prd_name: str
    session_id: str
    machine_id: str


# ── PRD → prompt formatter ─────────────────────────────────────────────────────

def format_prompt(prd: dict) -> str:
    name = prd.get("name", "Unknown Project")
    overview = prd.get("overview", {})
    backend = prd.get("backend", {})
    frontend = prd.get("frontend", {})
    design = prd.get("design", {})

    def section(title: str, data: dict) -> str:
        if not data:
            return ""
        lines = [f"## {title}"]
        for k, v in data.items():
            label = k.replace("_", " ").title()
            if isinstance(v, list):
                lines.append(f"**{label}:**")
                for item in v:
                    lines.append(f"  - {item}")
            else:
                lines.append(f"**{label}:** {v}")
        return "\n".join(lines)

    parts = [
        f"Build the following product according to the PRD below. Use Claude Code.\n",
        f"# PRD: {name}\n",
        section("Overview", overview),
        section("Backend", backend),
        section("Frontend", frontend),
        section("Design", design),
        "\nStart with the backend setup, then the frontend, then wire them together.",
        "Commit your work incrementally as you complete each layer.",
    ]
    return "\n\n".join(p for p in parts if p)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/api/jobs", status_code=201)
async def submit_job(body: SubmitJobRequest):
    """
    Accept a PRD from the frontend, dispatch it to an Omnara agent,
    and return the job_id for polling.
    """
    if not WORKSPACE_ID:
        raise HTTPException(
            status_code=500,
            detail="OMNARA_WORKSPACE_ID is not set in backend/.env",
        )

    prd = body.prd
    prompt = format_prompt(prd)

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

    job = store.create(session_id=session_id, machine_id=machine_id, prd=prd)
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
    """Get full job details including all messages fetched so far."""
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Refresh messages from Omnara
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
    SSE endpoint — streams new agent messages as they arrive.
    The client receives newline-delimited `data: <json>` events.
    The stream closes when the session reaches a terminal state.
    """
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        seen = len(job.messages)
        terminal_statuses = {"done", "stopped", "error", "completed", "failed"}

        while True:
            # Fetch current messages
            try:
                all_messages = await asyncio.to_thread(
                    agent_pool.get_messages, job.session_id
                )
                new_messages = all_messages[seen:]
                if new_messages:
                    store.append_messages(job_id, new_messages)
                    seen += len(new_messages)
                    for msg in new_messages:
                        payload = json.dumps(
                            {"role": msg.get("role", ""), "content": msg.get("content", "")}
                        )
                        yield f"data: {payload}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"

            # Check session status
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
    """Stop the Omnara session and remove the job from the store."""
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
