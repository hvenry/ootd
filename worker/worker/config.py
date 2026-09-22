"""Worker configuration. Everything is an environment variable; nothing is a code path."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv(path: Path) -> None:
    """
    Read the repo's .env so the worker and the app cannot disagree.

    Without this, changing CUTOUT_PROVIDER in .env silently does nothing here
    and the worker keeps running whatever was exported in its shell — which
    looks exactly like the app ignoring your configuration. A real environment
    variable still wins, so `CUTOUT_PROVIDER=chroma python -m worker.main`
    behaves as expected.
    """
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("\'")


_load_dotenv(REPO_ROOT / ".env")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgres://ootd:ootd@localhost:5433/ootd"
)

def _storage_root() -> Path:
    """
    Resolve STORAGE_ROOT against the repo, not the process's directory.

    The app and the worker share one .env, and its `./storage` is written from
    the repo root. The worker is usually started from `worker/`, so resolving
    against the cwd silently points it at worker/storage and every job fails
    with "original missing".
    """
    raw = os.environ.get("STORAGE_ROOT")
    if not raw:
        return (REPO_ROOT / "storage").resolve()
    path = Path(raw)
    return path.resolve() if path.is_absolute() else (REPO_ROOT / path).resolve()


STORAGE_ROOT = _storage_root()

# chroma | local | replicate. See worker/providers/__init__.py.
# chroma is the default because it needs no model and no download.
CUTOUT_PROVIDER = os.environ.get("CUTOUT_PROVIDER", "chroma")

POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL_SECONDS", "2"))
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "3"))

# Phase 0 does cutouts and nothing else. colour_extract is Phase 1, render is
# Phase 4 and is a hosted HTTPS call — no generative model ever runs here.
HANDLED_KINDS = ("cutout",)
