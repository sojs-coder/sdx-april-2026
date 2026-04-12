# Docker Omnara Instances — Usage Guide

## Setup (once)

Build the Docker image with Node.js, Codex, and Omnara pre-installed:

```bash
python docker/manage.py build
```

Make sure your `.env` file in the project root has your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

And that you are logged in to Omnara locally (so `~/.omnara/creds.json` exists):

```bash
omnara   # complete the browser login once
```

---

## Spinning Up Instances

Start as many containers as you want — each one is a separate Omnara agent:

```bash
python docker/manage.py start
python docker/manage.py start
python docker/manage.py start
```

Each container automatically receives your Omnara credentials and Codex API key.

---

## Managing Containers

```bash
# See all running containers
python docker/manage.py list

# Attach to a container's terminal (Ctrl+P Ctrl+Q to detach without killing)
python docker/manage.py attach <id>

# Tail logs from a container
python docker/manage.py logs <id>

# Kill a specific container
python docker/manage.py kill <id>

# Kill all containers
python docker/manage.py kill --all
```

---

## Controlling Instances via the Omnara API

Each container registers itself as a machine when Omnara starts. Use `api.py` to
control them programmatically without SSHing in.

### See all registered machines (your Docker containers)
```bash
python docker/api.py machines
```

### See all active sessions
```bash
python docker/api.py sessions
```

### Launch a coding session on a specific machine
```bash
python docker/api.py start <workspace_id> --machine <machine_id> --prompt "refactor auth.py"
```

### Read messages from a session
```bash
python docker/api.py messages <session_id>
```

### Stop a session
```bash
python docker/api.py stop <session_id>
```

---

## Typical Workflow

1. `python docker/manage.py build` — build image once
2. `python docker/manage.py start` — spin up N containers
3. `python docker/api.py machines` — get machine IDs
4. `python docker/api.py start <workspace_id> --machine <id> --prompt "..."` — kick off work
5. `python docker/api.py messages <session_id>` — check progress
6. `python docker/manage.py kill --all` — tear down when done
