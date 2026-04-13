"""
In-memory job store. Each job corresponds to one Omnara agent session
working on a PRD.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
import uuid


JobStatus = Literal["queued", "running", "done", "error"]


@dataclass
class Job:
    job_id: str
    session_id: str
    machine_id: str
    prd: dict
    status: JobStatus
    created_at: datetime
    messages: list = field(default_factory=list)
    error: str | None = None


class JobStore:
    def __init__(self):
        self._jobs: dict[str, Job] = {}

    def create(self, session_id: str, machine_id: str, prd: dict) -> Job:
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            session_id=session_id,
            machine_id=machine_id,
            prd=prd,
            status="running",
            created_at=datetime.utcnow(),
        )
        self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def all(self) -> list[Job]:
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    def update_status(self, job_id: str, status: JobStatus, error: str | None = None):
        job = self._jobs.get(job_id)
        if job:
            job.status = status
            if error:
                job.error = error

    def append_messages(self, job_id: str, messages: list[dict]):
        job = self._jobs.get(job_id)
        if job:
            job.messages.extend(messages)

    def delete(self, job_id: str):
        self._jobs.pop(job_id, None)


# Singleton
store = JobStore()
