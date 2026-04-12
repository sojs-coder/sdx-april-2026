"""
AgentPool — dispatches coding sessions to the locally-running Omnara agent
via the Omnara REST API.

Assumes `omnara` is already running on this machine (which self-registers it
as a machine at api.omnara.com). No Docker involved.
"""

import json
import urllib.error
import urllib.request
from pathlib import Path

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
    req = urllib.request.Request(f"{BASE_URL}{path}", headers=_headers())
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def _post(path: str, body: dict | None = None) -> dict:
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{path}", data=data, headers=_headers(), method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


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
        status = s.get("status", "")
        if mid and status not in ("stopped", "done", "error", "completed", "failed"):
            active.add(mid)
    return active


def ensure_machine() -> str:
    """
    Return the machine_id of the local Omnara instance.
    Picks the first online machine that isn't already busy.
    Raises RuntimeError if no machine is available.
    """
    machines = list_machines()
    if not machines:
        raise RuntimeError(
            "No Omnara machines registered. Make sure Omnara is running: omnara"
        )

    active_ids = _active_machine_ids()
    for m in machines:
        if m.get("status") == "online" and m["id"] not in active_ids:
            return m["id"]

    # All machines busy — use the first one anyway (Omnara queues internally)
    return machines[0]["id"]


# ── Session helpers ────────────────────────────────────────────────────────────

def list_sessions() -> list[dict]:
    data = _get("/user-sessions")
    sessions = data if isinstance(data, list) else data.get("sessions", [])
    return [s.get("session", s) for s in sessions]


def start_session(machine_id: str, workspace_id: str, prompt: str) -> str:
    """
    Launch an Omnara coding session on the local machine.
    Returns the session_id.
    """
    body = {
        "machine_id": machine_id,
        "initial_prompt": prompt,
    }
    data = _post(f"/workspaces/{workspace_id}/sessions", body)
    session = data.get("session", data)
    session_id = session.get("session_id") or session.get("id")
    if not session_id:
        raise RuntimeError(f"Could not extract session_id from response: {data}")
    return session_id


def stop_session(session_id: str) -> dict:
    return _post(f"/user-sessions/{session_id}/stop")


def get_messages(session_id: str) -> list[dict]:
    """Fetch all messages from all agent sub-sessions for a given user session."""
    data = _get(f"/user-sessions/{session_id}")
    agent_sessions = data.get("agent_sessions", [])
    all_messages = []
    for agent in agent_sessions:
        agent_id = agent.get("agent_session_id") or agent.get("id")
        try:
            msgs = _get(f"/user-sessions/{session_id}/agent-sessions/{agent_id}/messages")
            messages = msgs if isinstance(msgs, list) else msgs.get("messages", [])
            all_messages.extend(messages)
        except Exception:
            pass
    return all_messages


def get_session_status(session_id: str) -> str:
    """Return the current status string of a session."""
    try:
        data = _get(f"/user-sessions/{session_id}")
        session = data.get("session", data)
        return session.get("status", "unknown")
    except Exception:
        return "unknown"
