"""
AgentPool — dispatches coding sessions to the locally-running Omnara agent
via the Omnara REST API.

Assumes `omnara` is already running on this machine (which self-registers it
as a machine at api.omnara.com). No Docker involved.
"""

import json
from pathlib import Path

import requests

BASE_URL = "https://api.omnara.com/api/v1"
CREDS_FILE = Path.home() / ".omnara" / "creds.json"


# ── Auth ───────────────────────────────────────────────────────────────────────

def get_pat() -> str:
    if not CREDS_FILE.exists():
        raise RuntimeError(
            f"{CREDS_FILE} not found. Start Omnara first: omnara"
        )
    data = json.loads(CREDS_FILE.read_text())
    pat = data.get("pat")
    if not pat:
        raise RuntimeError("No 'pat' field found in ~/.omnara/creds.json")
    return pat


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {get_pat()}",
        "Content-Type": "application/json",
    }


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _get(path: str) -> dict | list:
    resp = requests.get(f"{BASE_URL}{path}", headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict | None = None) -> dict:
    resp = requests.post(
        f"{BASE_URL}{path}", headers=_headers(), json=body or {}, timeout=30
    )
    resp.raise_for_status()
    return resp.json()


# ── Machine helpers ────────────────────────────────────────────────────────────

def list_machines() -> list[dict]:
    data = _get("/machines")
    return data if isinstance(data, list) else data.get("machines", [])


def _active_machine_ids() -> set[str]:
    """Return machine_ids that currently have an active (non-terminal) session."""
    sessions = list_sessions()
    active = set()
    for s in sessions:
        mid = s.get("machine_id")
        status = (s.get("status") or "").upper()
        if mid and status not in ("STOPPED", "DONE", "ERROR", "COMPLETED", "FAILED"):
            active.add(mid)
    return active


def ensure_machine() -> str:
    """
    Return the machine_id of the local Omnara instance.
    Picks the first ONLINE machine that isn't already busy.
    Raises RuntimeError if no machine is available.
    """
    machines = list_machines()
    if not machines:
        raise RuntimeError(
            "No Omnara machines registered. Make sure Omnara is running: omnara"
        )

    active_ids = _active_machine_ids()

    # Prefer an idle online machine
    for m in machines:
        if m.get("status", "").upper() == "ONLINE" and m["id"] not in active_ids:
            return m["id"]

    # All online machines busy — use the first online one anyway
    for m in machines:
        if m.get("status", "").upper() == "ONLINE":
            return m["id"]

    raise RuntimeError(
        "No ONLINE Omnara machines found. Make sure Omnara is running: omnara"
    )


# ── Session helpers ────────────────────────────────────────────────────────────

def list_sessions() -> list[dict]:
    data = _get("/user-sessions")
    sessions = data if isinstance(data, list) else data.get("sessions", [])
    return [s.get("session", s) for s in sessions]


def start_session(machine_id: str, workspace_id: str, prompt: str) -> str:
    """
    Launch an Omnara coding session on the local machine.
    Returns the user_session_id.
    Response shape: {"status":"ok","payload":{"user_session_id":"...","launch_id":"...","workspace_id":"..."}}
    """
    body = {
        "machine_id": machine_id,
        "initial_prompt": prompt,
    }
    data = _post(f"/workspaces/{workspace_id}/sessions", body)
    session_id = (
        data.get("payload", {}).get("user_session_id")
        or data.get("user_session_id")
        or data.get("session_id")
        or data.get("id")
    )
    if not session_id:
        raise RuntimeError(f"Could not extract session_id from response: {data}")
    return session_id


def stop_session(session_id: str) -> None:
    """Stop a running session."""
    requests.post(
        f"{BASE_URL}/user-sessions/{session_id}/stop",
        headers=_headers(),
        timeout=30,
    )  # ignore errors — session may already be stopped or not yet active


def get_messages(session_id: str) -> list[dict]:
    """
    Fetch and normalize messages from all agent sub-sessions.

    Raw message shape:
      { payload: { content: { text, channel } }, metadata: { role } }

    Normalized output:
      { role, content, channel, created_at }
    """
    data = _get(f"/user-sessions/{session_id}")
    agent_sessions = data.get("agent_sessions", [])
    all_messages = []
    for agent in agent_sessions:
        agent_id = agent.get("session_id") or agent.get("agent_session_id") or agent.get("id")
        if not agent_id:
            continue
        try:
            msgs = _get(f"/user-sessions/{session_id}/agent-sessions/{agent_id}/messages")
            raw = msgs if isinstance(msgs, list) else msgs.get("messages", [])
            for m in raw:
                text = (m.get("payload") or {}).get("content", {}).get("text", "")
                channel = (m.get("payload") or {}).get("content", {}).get("channel", "")
                role = (m.get("metadata") or {}).get("role", "assistant")
                if text:
                    all_messages.append({
                        "role": role,
                        "content": text,
                        "channel": channel,
                        "created_at": m.get("created_at", ""),
                    })
        except Exception:
            pass
    return all_messages


def get_session_status(session_id: str) -> str:
    """Return the current status string of a session (uppercased)."""
    try:
        data = _get(f"/user-sessions/{session_id}")
        session = data.get("session", data)
        return session.get("status", "UNKNOWN").upper()
    except Exception:
        return "UNKNOWN"
