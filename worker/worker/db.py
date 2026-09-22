"""
The queue is a Postgres table, not Redis.

The app is TypeScript and this worker is Python; `FOR UPDATE SKIP LOCKED` is a
contract both speak natively, with no client library and no third service to
keep alive. That is the whole reason for the choice.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Sequence

import psycopg
from psycopg.rows import dict_row

from . import config

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Job:
    id: str
    owner_id: str
    kind: str
    payload: dict[str, Any]
    content_hash: str
    attempts: int


CLAIM = """
UPDATE job
SET status = 'running', attempts = attempts + 1, updated_at = now()
WHERE id = (
    SELECT id FROM job
    WHERE status = 'pending' AND kind = ANY(%(kinds)s)
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id::text, owner_id::text, kind, payload, content_hash, attempts;
"""


def connect() -> psycopg.Connection:
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


def claim(conn: psycopg.Connection, kinds: Sequence[str]) -> Job | None:
    """Take one job, or return None. Two workers never take the same row."""
    with conn.cursor() as cur:
        cur.execute(CLAIM, {"kinds": list(kinds)})
        row = cur.fetchone()
    conn.commit()
    if row is None:
        return None
    return Job(
        id=row["id"],
        owner_id=row["owner_id"],
        kind=row["kind"],
        payload=row["payload"],
        content_hash=row["content_hash"],
        attempts=row["attempts"],
    )


def finish(conn: psycopg.Connection, job: Job, result: dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE job SET status = 'done', result = %s, updated_at = now() WHERE id = %s",
            (json.dumps(result), job.id),
        )
    conn.commit()


def fail(conn: psycopg.Connection, job: Job, error: str) -> None:
    """
    Retry until MAX_ATTEMPTS, then park the row as failed. A failed row keeps
    its error so the closet can show why an item never got a cutout.
    """
    status = "pending" if job.attempts < config.MAX_ATTEMPTS else "failed"
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE job SET status = %s, result = %s, updated_at = now() WHERE id = %s",
            (status, json.dumps({"error": error}), job.id),
        )
    conn.commit()
    log.warning("job %s %s (attempt %d): %s", job.id, status, job.attempts, error)


def set_cutout_path(
    conn: psycopg.Connection,
    owner_id: str,
    garment_id: str,
    photo_id: str,
    view: str,
    path: str,
) -> bool:
    """
    The cutout belongs to the photo. The garment also carries the *front*
    cutout, denormalised, so the closet grid stays one query.

    Returns whether the photo was still there. It may not be: a capture can
    be deleted while its cutout is mid-flight, and the delete can only unlink
    files the row knew about — which does not include a cutout that had not
    been written yet. The caller is expected to clean up after itself when
    this comes back false, or that PNG is on disk forever with nothing
    pointing at it.
    """
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE photo SET cutout_path = %s WHERE id = %s AND owner_id = %s",
            (path, photo_id, owner_id),
        )
        still_there = cur.rowcount > 0
        if still_there and view == "front":
            cur.execute(
                "UPDATE garment SET cutout_path = %s WHERE id = %s AND owner_id = %s",
                (path, garment_id, owner_id),
            )
    conn.commit()
    return still_there
