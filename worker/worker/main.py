"""
The worker: a FastAPI app for health and diagnostics, plus a thread polling
the Postgres job table.

Phase 0 handles one kind of job — `cutout`, which is background removal.
colour_extract arrives in Phase 1 and render in Phase 4, hosted.
"""

from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from PIL import Image

from . import config, db
from .providers import get_provider

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
log = logging.getLogger("worker")

_stop = threading.Event()
_state: dict[str, object] = {"processed": 0, "failed": 0, "last_error": None}


def handle_cutout(conn, job: db.Job) -> dict[str, object]:
    payload = job.payload
    original_relative = payload["originalPath"]
    original = _resolve(original_relative)
    if not original.exists():
        raise FileNotFoundError(f"original missing: {original}")

    view = payload.get("view", "front")
    relative = f"cutouts/{job.owner_id}/{payload['photoId']}.png"
    destination = _resolve(relative)

    provider = get_provider()
    started = time.monotonic()
    provider.cut(
        original,
        destination,
        payload.get("sheetQuad"),
        payload.get("homography"),
        payload.get("pxPerMm"),
    )
    write_tile(destination)
    elapsed = time.monotonic() - started

    if not db.set_cutout_path(
        conn, job.owner_id, payload["garmentId"], payload["photoId"], view, relative
    ):
        # The capture was deleted while this was running. Nothing points at
        # the file now, so take it and its tile back out rather than leaving
        # them on disk.
        destination.unlink(missing_ok=True)
        tile_path_for(destination).unlink(missing_ok=True)
        log.info("discarded cutout for deleted photo %s", payload["photoId"])
        return {"cutoutPath": None, "view": view, "discarded": True}

    log.info(
        "cut %s (%s) with %s in %.2fs",
        payload["garmentId"],
        view,
        provider.name,
        elapsed,
    )

    return {
        "cutoutPath": relative,
        "view": view,
        "provider": provider.name,
        "seconds": round(elapsed, 3),
    }


# Air around the garment in the tile, as a fraction of its longer side.
TILE_PADDING = 0.04
TILE_MAX_HEIGHT = 1600


def tile_path_for(cutout: Path) -> Path:
    return cutout.with_name(cutout.stem + "_tile.png")


def write_tile(cutout: Path) -> Path | None:
    """
    The cutout cropped to the garment, on a 3:4 transparent canvas.

    The cutout itself keeps the whole photograph's frame, because measuring
    reads the mask off those exact pixels and the stored handle coordinates
    live in that frame. But a 12MP frame that is nine-tenths transparent
    floor renders a garment as a thumbnail in the middle of a tile. This is
    the picture the closet and the item page show: the garment fills
    whichever axis it is long on, and every tile is the same shape, so the
    names under a row of them sit on one line.
    """
    image = Image.open(cutout).convert("RGBA")
    alpha = np.asarray(image.split()[-1]) > 127
    ys, xs = np.where(alpha)
    if len(ys) == 0:
        return None
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    pad = int(TILE_PADDING * max(x1 - x0, y1 - y0))
    crop = image.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(image.width, x1 + pad),
            min(image.height, y1 + pad),
        )
    )
    cw, ch = crop.size
    tw = max(cw, round(ch * 3 / 4))
    th = max(ch, round(cw * 4 / 3))
    tile = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    tile.paste(crop, ((tw - cw) // 2, (th - ch) // 2))
    if th > TILE_MAX_HEIGHT:
        scale = TILE_MAX_HEIGHT / th
        tile = tile.resize(
            (max(1, round(tw * scale)), TILE_MAX_HEIGHT), Image.Resampling.LANCZOS
        )
    destination = tile_path_for(cutout)
    tile.save(destination, "PNG")
    return destination


def _resolve(relative: str) -> Path:
    """Keep every path inside the storage volume."""
    resolved = (config.STORAGE_ROOT / relative).resolve()
    if not str(resolved).startswith(str(config.STORAGE_ROOT)):
        raise ValueError("path escapes the storage root")
    return resolved


HANDLERS = {"cutout": handle_cutout}


def poll_forever() -> None:
    while not _stop.is_set():
        try:
            with db.connect() as conn:
                while not _stop.is_set():
                    job = db.claim(conn, config.HANDLED_KINDS)
                    if job is None:
                        break
                    _run(conn, job)
        except Exception as exc:  # the database may simply not be up yet
            log.warning("poll loop: %s", exc)
            _state["last_error"] = str(exc)

        _stop.wait(config.POLL_INTERVAL_SECONDS)


def _run(conn, job: db.Job) -> None:
    handler = HANDLERS.get(job.kind)
    if handler is None:
        db.fail(conn, job, f"no handler for kind {job.kind}")
        return
    try:
        result = handler(conn, job)
        db.finish(conn, job, result)
        _state["processed"] = int(_state["processed"]) + 1  # type: ignore[arg-type]
    except Exception as exc:
        db.fail(conn, job, f"{type(exc).__name__}: {exc}")
        _state["failed"] = int(_state["failed"]) + 1  # type: ignore[arg-type]
        _state["last_error"] = str(exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info(
        "worker up · provider=%s · storage=%s · kinds=%s",
        config.CUTOUT_PROVIDER,
        config.STORAGE_ROOT,
        ",".join(config.HANDLED_KINDS),
    )
    thread = threading.Thread(target=poll_forever, name="job-poller", daemon=True)
    thread.start()
    yield
    _stop.set()
    thread.join(timeout=5)


app = FastAPI(title="OOTD worker", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "provider": config.CUTOUT_PROVIDER,
        "kinds": list(config.HANDLED_KINDS),
        **_state,
    }


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


if __name__ == "__main__":
    main()
