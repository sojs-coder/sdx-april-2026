#!/usr/bin/env python3
"""
Omnara API client for controlling multiple Docker instances.

Your PAT is read automatically from ~/.omnara/creds.json.

Commands:
  machines                        List all registered machines (your Docker containers)
  sessions                        List all active user sessions
  session <session_id>            Get details of a specific session
  messages <session_id>           Get messages from a session
  start <workspace_id>            Launch a new session on a workspace
    --machine <machine_id>        Target a specific machine (Docker container)
    --prompt "your prompt"        Send an initial prompt to the agent
  stop <session_id>               Stop a running session

Usage:
  python docker/api.py machines
  python docker/api.py sessions
  python docker/api.py start <workspace_id> --machine <machine_id> --prompt "refactor main.py"
  python docker/api.py messages <session_id>
  python docker/api.py stop <session_id>
"""

import json
import sys
from pathlib import Path

BASE_URL = "https://api.omnara.com/api/v1"
CREDS_FILE = Path.home() / ".omnara" / "creds.json"


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_pat():
    if not CREDS_FILE.exists():
        print(f"Error: {CREDS_FILE} not found. Log in to Omnara first: omnara")
        sys.exit(1)
    data = json.loads(CREDS_FILE.read_text())
    pat = data.get("pat")
    if not pat:
        print("Error: no 'pat' field in creds.json")
        sys.exit(1)
    return pat


def headers():
    return {
        "Authorization": f"Bearer {get_pat()}",
        "Content-Type": "application/json",
    }


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def get(path):
    import requests as _r
    resp = _r.get(f"{BASE_URL}{path}", headers=headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def post(path, body=None):
    import requests as _r
    resp = _r.post(f"{BASE_URL}{path}", headers=headers(), json=body or {}, timeout=30)
    if resp.status_code == 204:
        return {}
    resp.raise_for_status()
    return resp.json()


def delete(path):
    import requests as _r
    resp = _r.delete(f"{BASE_URL}{path}", headers=headers(), timeout=30)
    if resp.status_code == 204:
        return {}
    resp.raise_for_status()
    return resp.json()


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_machines():
    data = get("/machines")
    machines = data if isinstance(data, list) else data.get("machines", [data])
    if not machines:
        print("No registered machines.")
        return
    print(f"{'ID':<38} {'NAME':<25} {'STATUS':<12} {'PLATFORM'}")
    print("─" * 90)
    for m in machines:
        print(
            f"{m.get('id',''):<38} "
            f"{m.get('machine_name',''):<25} "
            f"{m.get('status',''):<12} "
            f"{m.get('platform','')}"
        )


def cmd_sessions():
    data = get("/user-sessions")
    sessions = data if isinstance(data, list) else data.get("sessions", [data])
    if not sessions:
        print("No active sessions.")
        return
    print(f"{'SESSION ID':<38} {'NAME':<30} {'STATUS'}")
    print("─" * 85)
    for s in sessions:
        sess = s.get("session", s)
        print(
            f"{str(sess.get('session_id') or ''):<38} "
            f"{str(sess.get('name') or '(unnamed)'):<30} "
            f"{str(sess.get('status') or '')}"
        )


def cmd_session(session_id):
    data = get(f"/user-sessions/{session_id}")
    print(json.dumps(data, indent=2))


def cmd_messages(session_id):
    # Get agent sessions first, then fetch their messages
    data = get(f"/user-sessions/{session_id}")
    agent_sessions = data.get("agent_sessions", [])
    if not agent_sessions:
        print("No agent sessions found.")
        return
    for agent in agent_sessions:
        agent_id = agent.get("session_id") or agent.get("agent_session_id") or agent.get("id")
        print(f"\n── Agent session: {agent_id} ──")
        msgs = get(f"/user-sessions/{session_id}/agent-sessions/{agent_id}/messages")
        messages = msgs if isinstance(msgs, list) else msgs.get("messages", [])
        for msg in messages:
            text = (msg.get("payload") or {}).get("content", {}).get("text", "")
            role = (msg.get("metadata") or {}).get("role", "?").upper()
            if text:
                print(f"[{role}] {text[:200]}")


def cmd_start(workspace_id, machine_id=None, prompt=None):
    body = {}
    if machine_id:
        body["machine_id"] = machine_id
    if prompt:
        body["initial_prompt"] = prompt
    data = post(f"/workspaces/{workspace_id}/sessions", body)
    print("Session launched:")
    print(json.dumps(data, indent=2))


def cmd_stop(session_id):
    data = post(f"/user-sessions/{session_id}/stop")
    print(f"Stopped session {session_id}")
    print(json.dumps(data, indent=2))


# ── Arg parsing ───────────────────────────────────────────────────────────────

def parse_flag(args, flag):
    try:
        i = args.index(flag)
        return args[i + 1]
    except (ValueError, IndexError):
        return None


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    cmd = args[0]

    try:
        if cmd == "machines":
            cmd_machines()
        elif cmd == "sessions":
            cmd_sessions()
        elif cmd == "session":
            cmd_session(args[1])
        elif cmd == "messages":
            cmd_messages(args[1])
        elif cmd == "start":
            workspace_id = args[1]
            machine_id = parse_flag(args, "--machine")
            prompt = parse_flag(args, "--prompt")
            cmd_start(workspace_id, machine_id, prompt)
        elif cmd == "stop":
            cmd_stop(args[1])
        else:
            print(__doc__)
            sys.exit(1)
    except IndexError:
        print("Missing required argument. Run with no args to see usage.")
        sys.exit(1)
    except Exception as e:
        print(f"API error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
