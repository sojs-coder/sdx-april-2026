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
LOCAL_CODEX_AUTH = Path.home() / ".codex" / "auth.json"



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
    if not LOCAL_CREDS.exists():
        print(f"Error: {LOCAL_CREDS} not found. Log in to Omnara locally first: omnara")
        sys.exit(1)

    if not LOCAL_CODEX_AUTH.exists():
        print(f"Error: {LOCAL_CODEX_AUTH} not found. Log in to Codex locally first: codex")
        sys.exit(1)

    name = f"{CONTAINER_PREFIX}-{int(time.time())}"

    result = run(
        [
            "docker", "run",
            "--name", name,
            "--detach",
            # Mount Omnara creds (read-only)
            "--volume", f"{LOCAL_CREDS}:/root/.omnara/creds.json:ro",
            # Mount Codex auth tokens (read-only) — no login prompt
            "--volume", f"{LOCAL_CODEX_AUTH}:/root/.codex/auth.json:ro",
            IMAGE_NAME,
            "omnara",
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
