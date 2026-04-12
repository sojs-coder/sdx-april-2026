"""
AgentPool — manages local Docker containers running Omnara agents and
dispatches coding sessions to them via the Omnara REST API.

Reuses the auth + HTTP helpers from docker/api.py and the container
lifecycle logic from docker/manage.py.
"""

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://api.omnara.com/api/v1"
CREDS_FILE = Path.home() / ".omnara" / "creds.json"
CODEX_AUTH_FILE = Path.home() / ".codex" / "auth.json"
IMAGE_NAME = "omnara-agent"
CONTAINER_PREFIX = "omnara-agent"


# ── Auth ───────────────────────────────────────────────────────────────────────

def get_pat() -> str:
    if not CREDS_FILE.exists():
        raise RuntimeError(
            f"{CREDS_FILE} not found. Log in to Omnara first by running: omnara"
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


def _delete(path: str) -> dict:
    req = urllib.request.Request(
        f"{BASE_URL}{path}", headers=_headers(), method="DELETE"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# ── Machine helpers ────────────────────────────────────────────────────────────

def list_machines() -> list[dict]:
    """Return all machines registered with Omnara."""
    data = _get("/machines")
    return data if isinstance(data, list) else data.get("machines", [])


def _running_container_names() -> set[str]:
    """Return names of all running omnara-agent Docker containers."""
    result = subprocess.run(
        [
            "docker", "ps",
            "--filter", f"name={CONTAINER_PREFIX}",
            "--format", "{{.Names}}",
        ],
        capture_output=True,
        text=True,
    )
    return set(result.stdout.strip().splitlines())


def _start_container() -> str:
    """
    Spin up a new Docker container running `omnara`.
    Returns the container name.
    Raises RuntimeError if creds files are missing.
    """
    if not CREDS_FILE.exists():
        raise RuntimeError(
            f"{CREDS_FILE} not found. Log in to Omnara first: omnara"
        )
    if not CODEX_AUTH_FILE.exists():
        raise RuntimeError(
            f"{CODEX_AUTH_FILE} not found. Log in to Codex first: codex"
        )

    name = f"{CONTAINER_PREFIX}-{int(time.time())}"
    result = subprocess.run(
        [
            "docker", "run",
            "--name", name,
            "--detach",
            "--volume", f"{CREDS_FILE}:/root/.omnara/creds.json:ro",
            "--volume", f"{CODEX_AUTH_FILE}:/root/.codex/auth.json:ro",
            IMAGE_NAME,
            "omnara",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"docker run failed: {result.stderr.strip()}")
    return name


def _wait_for_machine(container_name: str, timeout: int = 30) -> str:
    """
    Poll the Omnara API until the new container appears as a registered machine.
    Returns the machine_id once found.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        machines = list_machines()
        for m in machines:
            if container_name in (m.get("machine_name", "") or ""):
                return m["id"]
        time.sleep(2)
    raise TimeoutError(
        f"Container '{container_name}' did not register as an Omnara machine within {timeout}s"
    )


# ── Session helpers ────────────────────────────────────────────────────────────

def list_sessions() -> list[dict]:
    data = _get("/user-sessions")
    sessions = data if isinstance(data, list) else data.get("sessions", [])
    return [s.get("session", s) for s in sessions]


def _active_machine_ids() -> set[str]:
    """Return machine_ids that currently have an active session."""
    sessions = list_sessions()
    active = set()
    for s in sessions:
        mid = s.get("machine_id")
        status = s.get("status", "")
        if mid and status not in ("stopped", "done", "error", "completed"):
            active.add(mid)
    return active


def ensure_machine() -> str:
    """
    Return a machine_id that is ready to accept a new session.
    Prefers an idle (registered but not busy) machine.
    Falls back to spinning up a new container.
    """
    machines = list_machines()
    active_ids = _active_machine_ids()

    for m in machines:
        if m.get("status") == "online" and m["id"] not in active_ids:
            return m["id"]

    # No idle machine — start a new container and wait for it to register
    container_name = _start_container()
    machine_id = _wait_for_machine(container_name)
    return machine_id


def start_session(machine_id: str, workspace_id: str, prompt: str) -> str:
    """
    Launch an Omnara coding session on the given machine.
    Returns the session_id.
    """
    body = {
        "machine_id": machine_id,
        "initial_prompt": prompt,
    }
    data = _post(f"/workspaces/{workspace_id}/sessions", body)
    # Response may nest the session under a key
    session = data.get("session", data)
    session_id = session.get("session_id") or session.get("id")
    if not session_id:
        raise RuntimeError(f"Could not extract session_id from response: {data}")
    return session_id


def stop_session(session_id: str) -> dict:
    return _post(f"/user-sessions/{session_id}/stop")


def get_messages(session_id: str) -> list[dict]:
    """
    Fetch all messages from all agent sub-sessions for a given user session.
    """
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
