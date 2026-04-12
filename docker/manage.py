#!/usr/bin/env python3
"""
Manage local Omnara Docker containers.

Commands:
  build              Build the omnara-agent Docker image
  start              Start a new Omnara container
  list               List all running Omnara containers
  attach <id>        Attach to a running container's terminal
  logs <id>          Tail logs from a container
  kill <id>          Kill a specific container
  kill --all         Kill all Omnara containers

Usage:
  python docker/manage.py build
  python docker/manage.py start
  python docker/manage.py list
  python docker/manage.py attach <id>
  python docker/manage.py logs <id>
  python docker/manage.py kill <id>
  python docker/manage.py kill --all
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

IMAGE_NAME = "omnara-agent"
CONTAINER_PREFIX = "omnara-agent"
LOCAL_CREDS = Path.home() / ".omnara" / "creds.json"

# Load .env from project root if present
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


def run(cmd, **kwargs):
    return subprocess.run(cmd, **kwargs)


def check(cmd, **kwargs):
    return subprocess.run(cmd, check=True, **kwargs)


def build():
    dockerfile = Path(__file__).parent / "Dockerfile"
    print(f"Building image '{IMAGE_NAME}' from {dockerfile} ...")
    check(["docker", "build", "-t", IMAGE_NAME, "-f", str(dockerfile), str(dockerfile.parent)])
    print(f"Image '{IMAGE_NAME}' built successfully.")


def start():
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY is not set. Add it to .env or export it.")
        sys.exit(1)

    if not LOCAL_CREDS.exists():
        print(f"Error: {LOCAL_CREDS} not found. Log in to Omnara locally first: omnara")
        sys.exit(1)

    name = f"{CONTAINER_PREFIX}-{int(time.time())}"

    result = run(
        [
            "docker", "run",
            "--name", name,
            "--detach",
            "--interactive",
            "--tty",
            # Mount Omnara creds (read-only)
            "--volume", f"{LOCAL_CREDS}:/root/.omnara/creds.json:ro",
            # Inject OpenAI API key
            "--env", f"OPENAI_API_KEY={OPENAI_API_KEY}",
            # Write Codex config on startup, then run omnara
            IMAGE_NAME,
            "bash", "-c",
            'mkdir -p /root/.codex && '
            'echo \'{"apiKey":"\'$OPENAI_API_KEY\'"}\' > /root/.codex/config.json && '
            'omnara',
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"Error starting container:\n{result.stderr}")
        sys.exit(1)

    container_id = result.stdout.strip()[:12]
    print(f"Started container: {name}")
    print(f"ID: {container_id}")
    print()
    print(f"Attach:  python docker/manage.py attach {container_id}")
    print(f"Logs:    python docker/manage.py logs {container_id}")
    print(f"Kill:    python docker/manage.py kill {container_id}")


def list_containers():
    result = run(
        ["docker", "ps", "--filter", f"name={CONTAINER_PREFIX}", "--format",
         "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.CreatedAt}}"],
        capture_output=True,
        text=True,
    )
    if result.stdout.strip() == "CONTAINER ID   NAMES   STATUS   CREATED AT" or not result.stdout.strip():
        print("No running Omnara containers.")
    else:
        print(result.stdout)


def attach(container_id):
    print(f"Attaching to {container_id} (Ctrl+P Ctrl+Q to detach without killing)...")
    run(["docker", "attach", container_id])


def logs(container_id):
    run(["docker", "logs", "--follow", container_id])


def kill_container(container_id):
    check(["docker", "rm", "--force", container_id])
    print(f"Killed {container_id}")


def kill_all():
    result = run(
        ["docker", "ps", "--filter", f"name={CONTAINER_PREFIX}", "--format", "{{.ID}}"],
        capture_output=True,
        text=True,
    )
    ids = result.stdout.strip().splitlines()
    if not ids:
        print("No running Omnara containers.")
        return
    for cid in ids:
        check(["docker", "rm", "--force", cid])
        print(f"Killed {cid}")


def usage():
    print(__doc__)
    sys.exit(1)


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        usage()

    cmd = args[0]

    if cmd == "build":
        build()
    elif cmd == "start":
        start()
    elif cmd == "list":
        list_containers()
    elif cmd == "attach":
        if len(args) < 2:
            print("Usage: python docker/manage.py attach <id>")
            sys.exit(1)
        attach(args[1])
    elif cmd == "logs":
        if len(args) < 2:
            print("Usage: python docker/manage.py logs <id>")
            sys.exit(1)
        logs(args[1])
    elif cmd == "kill":
        if len(args) < 2:
            print("Usage: python docker/manage.py kill <id|--all>")
            sys.exit(1)
        if args[1] == "--all":
            kill_all()
        else:
            kill_container(args[1])
    else:
        usage()
