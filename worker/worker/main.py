"""
The worker: a FastAPI app for health and diagnostics, plus a thread polling
the Postgres job table.

One kind of job so far, `cutout`: background removal. Standardisation is
next; see docs/features/08-standardize.md.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from PIL import Image

from . import config, db
from .providers import get_provider, release_idle

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
    # A re-cut names its provider and writes a new file rather than over the
    # old one. Media is served as immutable, so a cutout reusing its path
    # would never reach a browser that had seen the first; and the old cut
    # stays good until this one has actually landed. The suffix is fresh per
    # run because a re-cut job row is reused when a provider is tried twice.
    requested = payload.get("provider")
    stem = (
        payload["photoId"]
        if requested is None
        else f"{payload['photoId']}-{uuid.uuid4().hex[:8]}"
    )
    relative = f"cutouts/{job.owner_id}/{stem}.png"
    destination = _resolve(relative)

    provider = get_provider(requested)
    started = time.monotonic()
    provider.cut(
        original,
        destination,
        payload.get("sheetQuad"),
        payload.get("homography"),
        payload.get("pxPerMm"),
    )
    _, bounds = write_tile(
        destination,
        payload.get("homography"),
        payload.get("pxPerMm"),
        payload.get("tileScale"),
    )
    elapsed = time.monotonic() - started

    replaced = db.set_cutout_path(
        conn,
        job.owner_id,
        payload["garmentId"],
        payload["photoId"],
        view,
        relative,
        provider.name,
        bounds,
    )
    if replaced is False:
        # The capture was deleted while this was running. Nothing points at
        # the file now, so take it and its tile back out rather than leaving
        # them on disk.
        destination.unlink(missing_ok=True)
        tile_path_for(destination).unlink(missing_ok=True)
        log.info("discarded cutout for deleted photo %s", payload["photoId"])
        return {"cutoutPath": None, "view": view, "discarded": True}

    if replaced and replaced != relative:
        previous = _resolve(replaced)
        previous.unlink(missing_ok=True)
        tile_path_for(previous).unlink(missing_ok=True)

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

# Tiles share a scale: every top on one canvas and every bottom on another,
# both 3:4 and in millimetres, so a blazer laid with its sleeves down reads
# smaller than a hoodie with its arms out instead of being zoomed to fill
# the same box. Sized from the closet as shot: 95% of tops span under
# 1550 mm and bottoms run to 1200 mm long. Sizing tops for the one hoodie
# at 1780 mm with its arms spread shrank every other top by a sixth to make
# room, so that one is shrunk instead: a garment larger than its canvas is
# scaled down to fit rather than cut, and says so in the log.
TILE_CANVAS_MM = {"top": (1600, 2133), "bottom": (1000, 1333)}
TILE_PX_PER_MM = 0.8
# Around the garment when a page shows it alone, cropped out of its tile.
ALONE_PADDING = 0.04


def tile_path_for(cutout: Path) -> Path:
    return cutout.with_name(cutout.stem + "_tile.png")


def write_tile(
    cutout: Path,
    homography: list[float] | None = None,
    px_per_mm: float | None = None,
    scale: str | None = None,
) -> tuple[Path | None, dict[str, object] | None]:
    """
    The garment on a 3:4 transparent tile, for the closet and the item page.

    The cutout itself keeps the whole photograph's frame, because measuring
    reads the mask off those exact pixels and the stored handle coordinates
    live in that frame. The tile is only a picture, so it is drawn through
    the homography: seen straight down, upright, and at the shared scale of
    its canvas. Every tile is the same shape, so the names under a row of
    them sit on one line.

    Returns the garment's box in the cutout's own pixels, which the measure
    screen crops to, with `tile`: where the garment sits in the tile, as
    fractions, for a page that shows it alone and large.
    """
    image = Image.open(cutout).convert("RGBA")
    alpha = np.asarray(image.split()[-1]) > 127
    ys, xs = np.where(alpha)
    if len(ys) == 0:
        return None, None
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    bounds: dict[str, object] = {
        "x": x0,
        "y": y0,
        "w": x1 - x0,
        "h": y1 - y0,
        "imageW": image.width,
        "imageH": image.height,
    }
    if homography and px_per_mm:
        tile, bounds["tile"] = _metric_tile(
            image, (x0, y0, x1, y1), homography, px_per_mm, scale or "top"
        )
    else:
        tile, bounds["tile"] = _fitted_tile(image, (x0, y0, x1, y1))
    destination = tile_path_for(cutout)
    tile.save(destination, "PNG")
    return destination, bounds


def _metric_tile(
    image: Image.Image,
    box: tuple[int, int, int, int],
    homography: list[float],
    px_per_mm: float,
    scale: str,
) -> tuple[Image.Image, dict[str, float]]:
    x0, y0, x1, y1 = box
    to_canvas = np.asarray(homography, dtype=float).reshape(3, 3)

    # The garment's extent in millimetres, from its box's corners. Under a
    # perspective map the box of the mapped corners holds the whole garment.
    corners = np.array([[x0, y0, 1], [x1, y0, 1], [x1, y1, 1], [x0, y1, 1]], float)
    mapped = corners @ to_canvas.T
    mm = mapped[:, :2] / mapped[:, 2:] / px_per_mm
    mx0, my0 = mm.min(axis=0)
    mx1, my1 = mm.max(axis=0)
    gw, gh = mx1 - mx0, my1 - my0

    canvas_w, canvas_h = TILE_CANVAS_MM.get(scale, TILE_CANVAS_MM["top"])
    fit = min(1.0, 0.98 * canvas_w / gw, 0.98 * canvas_h / gh)
    if fit < 1.0:
        log.warning(
            "garment %.0f x %.0f mm is larger than the %s tile; shrunk to %.0f%%",
            gw, gh, scale, fit * 100,
        )
    tile_ppm = TILE_PX_PER_MM * fit
    tw, th = round(canvas_w * TILE_PX_PER_MM), round(canvas_h * TILE_PX_PER_MM)
    origin_x = (mx0 + mx1) / 2 - tw / 2 / tile_ppm
    origin_y = (my0 + my1) / 2 - th / 2 / tile_ppm

    # Resampling a 12MP photo straight down to the tile's scale would alias,
    # since a perspective transform samples rather than averages. So crop to
    # the garment and box-filter it close to size first, carrying both steps
    # into the map. Premultiplied, so the floor left under transparent pixels
    # does not bleed into the edge.
    source = image.crop(box).convert("RGBa")
    photo_ppm = (x1 - x0) / max(gw, 1.0)
    factor = max(1, int(photo_ppm / tile_ppm))
    if factor > 1:
        source = source.reduce(factor)
    from_source = to_canvas @ np.array(
        [[factor, 0, x0], [0, factor, y0], [0, 0, 1]], float
    )
    from_tile = np.array(
        [
            [px_per_mm / tile_ppm, 0, px_per_mm * origin_x],
            [0, px_per_mm / tile_ppm, px_per_mm * origin_y],
            [0, 0, 1],
        ]
    )
    # PIL asks for the map from each output pixel back to the source.
    back = np.linalg.inv(from_source) @ from_tile
    back /= back[2, 2]
    tile = source.transform(
        (tw, th),
        Image.Transform.PERSPECTIVE,
        tuple(back.flatten()[:8]),
        Image.Resampling.BILINEAR,
    ).convert("RGBA")

    pad = ALONE_PADDING * max(gw, gh)
    left = max(0.0, (mx0 - pad - origin_x) * tile_ppm / tw)
    top = max(0.0, (my0 - pad - origin_y) * tile_ppm / th)
    right = min(1.0, (mx1 + pad - origin_x) * tile_ppm / tw)
    bottom = min(1.0, (my1 + pad - origin_y) * tile_ppm / th)
    return tile, {"x": left, "y": top, "w": right - left, "h": bottom - top}


def _fitted_tile(
    image: Image.Image, box: tuple[int, int, int, int]
) -> tuple[Image.Image, dict[str, float]]:
    """A photo with no homography: the garment fitted to its own tile."""
    x0, y0, x1, y1 = box
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
    where = {
        "x": ((tw - cw) // 2) / tw,
        "y": ((th - ch) // 2) / th,
        "w": cw / tw,
        "h": ch / th,
    }
    if th > TILE_MAX_HEIGHT:
        shrink = TILE_MAX_HEIGHT / th
        tile = tile.resize(
            (max(1, round(tw * shrink)), TILE_MAX_HEIGHT), Image.Resampling.LANCZOS
        )
    return tile, where


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

        # On this thread, between jobs, so a model is never unloaded mid-cut.
        release_idle()

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
