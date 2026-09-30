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
        large_path_for(destination).unlink(missing_ok=True)
        log.info("discarded cutout for deleted photo %s", payload["photoId"])
        return {"cutoutPath": None, "view": view, "discarded": True}

    if replaced and replaced != relative:
        previous = _resolve(replaced)
        previous.unlink(missing_ok=True)
        tile_path_for(previous).unlink(missing_ok=True)
        large_path_for(previous).unlink(missing_ok=True)

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
# the same box. A garment larger than its canvas is scaled down to fit
# rather than cut, and says so in the log.
#
# Tops are sized for the typical top, not the widest. At 1600 mm, room for
# every hoodie with its arms spread, a tee filled two thirds of its tile's
# width and a third of its height, and the closet read as thumbnails. As
# shot, the median top spans 1060 mm and nine in ten under 1270 mm, so at
# 1300 mm a tee fills four fifths and only the widest few are shrunk.
TILE_CANVAS_MM = {"top": (1300, 1733), "bottom": (1000, 1333)}
# Enough for a tile three across on a retina screen. At 0.8 a tee came out
# 660 px wide, and the item page, which blew the tile up to show the garment
# alone, was visibly soft.
TILE_PX_PER_MM = 1.2
# The large picture is the garment alone at the photo's own resolution, for
# the item page. Capped so a phone never decodes something absurd; a 12 MP
# photo of a tee is about 1800 px across, well under it.
LARGE_MAX_PX = 3000
# WebP keeps the alpha at a fraction of a PNG's size: the cutout PNG is
# about 10 MB, its large picture well under one.
TILE_QUALITY = 85
LARGE_QUALITY = 90
# Around the garment when a page shows it alone, cropped out of its tile.
ALONE_PADDING = 0.04


# Media is served immutable, so pictures drawn differently need a new name,
# or browsers keep the old ones. Bump these with any change to how they are
# drawn, and run `python -m worker.retile` to redraw them;
# src/lib/storage.ts must agree.
TILE_SUFFIX = "_tile3.webp"
LARGE_SUFFIX = "_large1.webp"


def tile_path_for(cutout: Path) -> Path:
    return cutout.with_name(cutout.stem + TILE_SUFFIX)


def large_path_for(cutout: Path) -> Path:
    return cutout.with_name(cutout.stem + LARGE_SUFFIX)


def write_tile(
    cutout: Path,
    homography: list[float] | None = None,
    px_per_mm: float | None = None,
    scale: str | None = None,
) -> tuple[Path | None, dict[str, object] | None]:
    """
    The garment on a 3:4 transparent tile, for the closet, and alone at full
    resolution, for the item page.

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
    box = (x0, y0, x1, y1)
    if homography and px_per_mm:
        tile, bounds["tile"] = _metric_tile(
            image, box, homography, px_per_mm, scale or "top"
        )
        large = _metric_large(image, box, homography, px_per_mm)
    else:
        tile, bounds["tile"] = _fitted_tile(image, box)
        large = _fitted_large(image, box)
    destination = tile_path_for(cutout)
    tile.save(destination, "WEBP", quality=TILE_QUALITY, method=5)
    large.save(large_path_for(cutout), "WEBP", quality=LARGE_QUALITY, method=5)
    return destination, bounds


def _extent_mm(
    box: tuple[int, int, int, int], to_canvas: np.ndarray, px_per_mm: float
) -> tuple[float, float, float, float]:
    """
    The garment's extent in millimetres, from its box's corners. Under a
    perspective map the box of the mapped corners holds the whole garment.
    """
    x0, y0, x1, y1 = box
    corners = np.array([[x0, y0, 1], [x1, y0, 1], [x1, y1, 1], [x0, y1, 1]], float)
    mapped = corners @ to_canvas.T
    mm = mapped[:, :2] / mapped[:, 2:] / px_per_mm
    mx0, my0 = mm.min(axis=0)
    mx1, my1 = mm.max(axis=0)
    return float(mx0), float(my0), float(mx1), float(my1)


def _rectify(
    image: Image.Image,
    box: tuple[int, int, int, int],
    to_canvas: np.ndarray,
    px_per_mm: float,
    origin: tuple[float, float],
    out_ppm: float,
    size: tuple[int, int],
) -> Image.Image:
    """
    The photo seen straight down: `size` pixels at `out_ppm` pixels per mm,
    whose top-left corner is `origin` in millimetres on the rig.

    Resampling a 12MP photo straight down to a small scale would alias, since
    a perspective transform samples rather than averages. So crop to the
    garment and box-filter it close to size first, carrying both steps into
    the map. Premultiplied, so the floor left under transparent pixels does
    not bleed into the edge.
    """
    x0, y0, x1, y1 = box
    mx0, _, mx1, _ = _extent_mm(box, to_canvas, px_per_mm)
    source = image.crop(box).convert("RGBa")
    photo_ppm = (x1 - x0) / max(mx1 - mx0, 1.0)
    factor = max(1, int(photo_ppm / out_ppm))
    if factor > 1:
        source = source.reduce(factor)
    from_source = to_canvas @ np.array(
        [[factor, 0, x0], [0, factor, y0], [0, 0, 1]], float
    )
    from_out = np.array(
        [
            [px_per_mm / out_ppm, 0, px_per_mm * origin[0]],
            [0, px_per_mm / out_ppm, px_per_mm * origin[1]],
            [0, 0, 1],
        ]
    )
    # PIL asks for the map from each output pixel back to the source.
    back = np.linalg.inv(from_source) @ from_out
    back /= back[2, 2]
    return source.transform(
        size,
        Image.Transform.PERSPECTIVE,
        tuple(back.flatten()[:8]),
        Image.Resampling.BICUBIC,
    ).convert("RGBA")


def _metric_large(
    image: Image.Image,
    box: tuple[int, int, int, int],
    homography: list[float],
    px_per_mm: float,
) -> Image.Image:
    """
    The garment alone, straight down and upright like its tile, but cropped
    to it and at the photo's own resolution rather than the shared scale.
    """
    x0, _, x1, _ = box
    to_canvas = np.asarray(homography, dtype=float).reshape(3, 3)
    mx0, my0, mx1, my1 = _extent_mm(box, to_canvas, px_per_mm)
    pad = ALONE_PADDING * max(mx1 - mx0, my1 - my0)
    w_mm = mx1 - mx0 + 2 * pad
    h_mm = my1 - my0 + 2 * pad
    photo_ppm = (x1 - x0) / max(mx1 - mx0, 1.0)
    out_ppm = min(photo_ppm, LARGE_MAX_PX / max(w_mm, h_mm))
    size = (max(1, round(w_mm * out_ppm)), max(1, round(h_mm * out_ppm)))
    return _rectify(
        image, box, to_canvas, px_per_mm, (mx0 - pad, my0 - pad), out_ppm, size
    )


def _fitted_large(
    image: Image.Image, box: tuple[int, int, int, int]
) -> Image.Image:
    """A photo with no homography: the garment cropped out as it was shot."""
    x0, y0, x1, y1 = box
    pad = int(ALONE_PADDING * max(x1 - x0, y1 - y0))
    crop = image.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(image.width, x1 + pad),
            min(image.height, y1 + pad),
        )
    )
    longest = max(crop.size)
    if longest > LARGE_MAX_PX:
        shrink = LARGE_MAX_PX / longest
        crop = crop.resize(
            (max(1, round(crop.width * shrink)), max(1, round(crop.height * shrink))),
            Image.Resampling.LANCZOS,
        )
    return crop


def _metric_tile(
    image: Image.Image,
    box: tuple[int, int, int, int],
    homography: list[float],
    px_per_mm: float,
    scale: str,
) -> tuple[Image.Image, dict[str, float]]:
    to_canvas = np.asarray(homography, dtype=float).reshape(3, 3)
    mx0, my0, mx1, my1 = _extent_mm(box, to_canvas, px_per_mm)
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
    tile = _rectify(
        image, box, to_canvas, px_per_mm, (origin_x, origin_y), tile_ppm, (tw, th)
    )

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
