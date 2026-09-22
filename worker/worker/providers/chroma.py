"""
Chroma key plus a flood fill inward from the sheet edge.

On an evenly lit sheet this gets most garments in milliseconds with no model
and no download, which is why it is worth having: it is the provider that lets
you start archiving before 3.5GB of weights have finished arriving.

The background to remove is the *sheet*, not whatever surrounds the photo, and
capture already knows exactly where the sheet is — the four marker centres come
through in the job payload. Without them this would key the tabletop and hand
back a cutout of the paper.

It fails where you would expect — fuzzy knits, dark on dark, fringe — and that
is what BiRefNet is for.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy import ndimage

# Colour distance, 0-255 per channel, below which a pixel counts as background.
#
# Fixed numbers do not survive contact with a real floor. Light laminate has
# grain, planks have seams, and each plank is a slightly different shade: on
# the floor this was calibrated against, background pixels run up to 54 away
# from the floor's median while the garment sits 150 away. A tolerance of 42
# therefore keeps whichever streak happens to differ most, and a streak that
# touches the garment is kept as part of it.
#
# So the floor states its own spread and this is only the range that answer is
# allowed to fall in. The ceiling is where a pale garment on a pale floor
# starts being at risk; past it, that is BiRefNet's job, not this one's.
TOLERANCE_FLOOR = 42
TOLERANCE_CEILING = 72
TOLERANCE_HEADROOM = 1.15
# Share of the sampling ring assumed to be background. On this rig the ring
# runs straight through the four marker pages, so nearly half of it is paper
# and print rather than floor; the spread has to be measured on the half that
# actually agrees with the median.
BACKGROUND_TRIM = 50.0
# Work at this resolution, then scale the alpha back up. The mask is smooth;
# resolving it at 12MP buys nothing.
MASK_MAX_DIMENSION = 1500
FEATHER_RADIUS = 1.5
# How much of the rig a real garment fills. Measured across tees, shorts and
# caps on wood, carpet and slate: every good cutout came out at 5.8% or more
# and every failure at 1.7% or less, so 3% separates them with margin either
# way. A failure here is a garment too close in colour to what it is lying
# on — the key eats the garment and leaves a fragment, which would still
# produce a cutout, still snap handles, and still measure confidently wrong.
MIN_PLAUSIBLE_COVERAGE = 0.03
# The other direction: nothing separated at all, so the whole rig survives.
MAX_PLAUSIBLE_COVERAGE = 0.90
# Pull in off the paper edge before sampling it, so the printed markers and the
# paper's own shadow do not end up defining "background".
EDGE_INSET_FRACTION = 0.035
# How far outside the marker quad a garment is allowed to lie, as a fraction
# of the quad's own size.
#
# The four marker centres bound the *measurement* frame, not the garment. The
# homography is a plane-to-plane map and stays valid past the corners, so a
# waistband sitting above the top pair of markers or a cuff reaching below the
# bottom pair measures perfectly well — but treating everything outside the
# quad as background by definition guillotined it out of the cutout. Jeans
# came back with their hem and their waistband sliced off in a straight line.
#
# 0.15 was not enough. On a 700 x 1300 mm rig a pair of jeans laid with its
# waistband above the top markers overhung by about 16% at the top and 25% at
# the bottom, so both ends still came back cut straight across. 0.4 covers it
# with room, and only vertically: garments run long, not wide, and the floor
# beside the rig is planks the ring never sampled, so a generous side margin
# came back as slabs of floor welded to the legs. The page exclusion below
# keeps the vertical generosity from admitting the marker pages themselves.
OVERHANG_X = float(os.environ.get("CUTOUT_OVERHANG_X", "0.05"))
OVERHANG_Y = float(os.environ.get("CUTOUT_OVERHANG_Y", "0.4"))
# The marker pages are background by definition, whatever colour they are.
# Paper is far from any floor colour, so once the allowed region reaches the
# pages a cuff that touches one is joined to it and the page comes back as
# part of the garment.
#
# Each page is found from its marker, through the homography. A box could
# not do it: an A4 sheet reaches its long side from the marker in whichever
# direction it happened to be laid, and a box that wide eats the garment.
# Instead the paper is what it looks like, brighter than the floor and
# uncoloured, and it is contiguous with the marker printed on it. So: seed
# at each marker centre, take the paper-like pixels connected to it within
# PAGE_REACH_MM, and that is the page. A page the floor's own colour is not
# found this way, and does not need to be, because it is already background.
PAGE_REACH_MM = float(os.environ.get("CUTOUT_PAGE_REACH_MM", "320"))
# The seed has to clear the printed marker and its quiet zone to touch the
# open paper around it; at 32 mm it caught only slivers, at 45 mm the page.
PAGE_SEED_MM = float(os.environ.get("CUTOUT_PAGE_SEED_MM", "45"))
# Bridges printed text and rules, which otherwise cut the paper into islands.
PAGE_CLOSE_PX = 2
# Paper against floor. Print stock is uncoloured and a beige or wood floor is
# not, so chroma (max channel minus min) tells them apart even where a shadow
# pulls the paper down to the floor's brightness: on the rig this was tuned
# on, shadowed paper read 18 against the floor's 35. The brightness floor is
# what keeps a grey selvedge cuff, also uncoloured but far darker, out of it.
PAGE_LUMINANCE_SLACK = 10
PAGE_CHROMA_MARGIN = 8
# The route for a floor that is itself grey: then paper is simply brighter.
PAGE_BRIGHTER_BY = 20
PAGE_MAX_CHROMA = 24
PAGE_GROW_PX = 4
# Fallback for jobs queued before the homography travelled in the payload.
PAGE_EXCLUSION = float(os.environ.get("CUTOUT_PAGE_EXCLUSION", "0.1"))


class ChromaKeyProvider:
    name = "chroma"

    def cut(
        self,
        original: Path,
        destination: Path,
        sheet_quad: Sequence[Any] | None = None,
        homography: Sequence[float] | None = None,
        px_per_mm: float | None = None,
    ) -> Path:
        # exif_transpose, or a phone photo comes out rotated — and rotated
        # differently from the client, whose homography was solved on the
        # upright frame. The mask would then be cut in the wrong orientation
        # from the coordinates measured against it.
        image = ImageOps.exif_transpose(Image.open(original)).convert("RGB")

        scale = min(1.0, MASK_MAX_DIMENSION / max(image.size))
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        small = (
            image.resize(size, Image.Resampling.BILINEAR) if scale < 1.0 else image
        )
        pixels = np.asarray(small, dtype=np.int16)
        h, w, _ = pixels.shape

        inset = max(2, int(EDGE_INSET_FRACTION * min(h, w)))
        # Two regions, and the difference between them is the point. `rig` is
        # the quad pulled in off the marker pages, and it is what the floor
        # colour is sampled from and what coverage is judged against. `allowed`
        # is the same quad pushed out, and it is the only thing that bounds
        # what may survive as garment.
        rig = _sheet_mask(sheet_quad, scale, (h, w), inset)
        allowed = _sheet_mask(sheet_quad, scale, (h, w), 0, OVERHANG_X, OVERHANG_Y)
        # Keep the outer margin before the pages are punched out of it. Those
        # holes have boundaries of their own, in the middle of the rig, and a
        # leg passing beside a page would otherwise read as "clipped".
        margin = allowed.copy()
        background, tolerance = _estimate_background(pixels, rig, inset)
        background, tolerance = _refine_background(pixels, rig, background)
        markers = _marker_centres(sheet_quad, scale, (h, w))
        allowed &= ~_page_mask(
            sheet_quad, scale, (h, w), PAGE_EXCLUSION, homography, px_per_mm, pixels, background
        )

        distance = np.abs(pixels - background).max(axis=2)
        # Past the overhang margin it is background by definition — that far
        # out is the room, not the rig.
        background_like = (distance < tolerance) | ~allowed

        # Only background *reachable from the border* is background. An ecru
        # patch in the middle of a shirt is not the sheet showing through.
        labels, count = ndimage.label(background_like)
        if count > 0:
            border = np.concatenate(
                [labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]
            )
            outside = np.unique(border[border > 0])
            reachable = np.isin(labels, outside)
        else:
            reachable = np.zeros_like(background_like)

        foreground = ~reachable

        foreground = ndimage.binary_opening(foreground, np.ones((3, 3)))
        foreground = _pick_garment(foreground, rig, markers)
        foreground = ndimage.binary_fill_holes(foreground)

        # Judged against the rig, not the expanded region, so the thresholds
        # below keep the meaning they were measured with.
        coverage = foreground.sum() / max(1, rig.sum())
        clipped = _touches_edge(foreground, margin)
        if clipped:
            # The cut is bounded by the margin rather than by the garment —
            # the silent failure the margin exists to avoid, and the one that
            # is invisible unless something says so. Verified absent at the
            # defaults: extents are identical at 0.4, 0.9 and 1.5 vertical.
            print(
                f"warning: cutout for {original.name} reaches the overhang "
                f"boundary and may be clipped; raise CUTOUT_OVERHANG_Y",
                flush=True,
            )
        if os.environ.get("CHROMA_DEBUG"):
            print(
                "background %s tolerance %d coverage %.4f clipped %s"
                % (background.tolist(), tolerance, coverage, clipped),
                flush=True,
            )
        if not MIN_PLAUSIBLE_COVERAGE <= coverage <= MAX_PLAUSIBLE_COVERAGE:
            raise ValueError(
                f"chroma key failed: the cutout is {coverage:.1%} of the rig, "
                f"which is not a garment. The usual cause is a garment too "
                f"close in colour to what it is lying on. Lay something "
                f"plainly contrasting underneath, or set CUTOUT_PROVIDER=local "
                f"for BiRefNet, which does not care about the background."
            )

        alpha = Image.fromarray((foreground * 255).astype(np.uint8), mode="L")
        if scale < 1.0:
            alpha = alpha.resize(image.size, Image.Resampling.BILINEAR)
        alpha = alpha.filter(ImageFilter.GaussianBlur(FEATHER_RADIUS))

        out = image.convert("RGBA")
        out.putalpha(alpha)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out.save(destination, "PNG")
        return destination


def _as_xy(point: Any) -> tuple[float, float]:
    """The app's Point is {x, y}; a bare pair is accepted too."""
    if isinstance(point, dict):
        return float(point["x"]), float(point["y"])
    return float(point[0]), float(point[1])


def _marker_centres(
    quad: Sequence[Any] | None, scale: float, shape: tuple[int, int]
) -> list[tuple[int, int]]:
    """The four marker centres in mask coordinates, where they are in frame."""
    h, w = shape
    if not quad or len(quad) != 4:
        return []
    out = []
    for point in quad:
        x, y = _as_xy(point)
        ix, iy = int(round(x * scale)), int(round(y * scale))
        if 0 <= ix < w and 0 <= iy < h:
            out.append((ix, iy))
    return out


def _pick_garment(
    foreground: np.ndarray,
    rig: np.ndarray,
    markers: Sequence[tuple[int, int]],
) -> np.ndarray:
    """
    Of everything the key left standing, which blob is the garment.

    The largest blob is not good enough. A pale garment on a pale floor gets
    eaten, and then the biggest thing still standing is a sheet of A4 — which
    sails past the coverage guard, because a marker page is a perfectly
    plausible 10% of the rig, and lands in the closet as a photograph of
    paper.

    So the garment is the largest blob that lies across the rig and does not
    have a marker sitting on it. Capture already tells you to keep the
    garment off the markers, which is what makes the second half exact
    rather than a heuristic.
    """
    labels, count = ndimage.label(foreground)
    if count <= 1:
        return foreground

    on_marker = {
        int(labels[y, x]) for x, y in markers if labels[y, x] > 0
    }
    sizes = ndimage.sum(foreground, labels, range(1, count + 1))
    ranked = sorted(range(1, count + 1), key=lambda i: sizes[i - 1], reverse=True)

    for label in ranked:
        if label in on_marker:
            continue
        if not (rig & (labels == label)).any():
            continue
        return labels == label

    # Nothing qualifies: hand back the largest and let the coverage guard
    # have its say, rather than returning an empty mask with no explanation.
    return labels == ranked[0]


def _touches_edge(mask: np.ndarray, region: np.ndarray) -> bool:
    """Whether `mask` runs right up against the boundary of `region`."""
    if not mask.any():
        return False
    boundary = region & ~ndimage.binary_erosion(region, np.ones((3, 3)), iterations=3)
    return bool((mask & boundary).any())


def _sheet_mask(
    quad: Sequence[Any] | None,
    scale: float,
    shape: tuple[int, int],
    inset: int,
    expand_x: float = 0.0,
    expand_y: float = 0.0,
) -> np.ndarray:
    """
    The marker quad in mask coordinates, pulled in by `inset` pixels or pushed
    out by `expand_x` / `expand_y` as fractions of its size about its own
    centroid.
    """
    h, w = shape
    if not quad or len(quad) != 4:
        return np.ones((h, w), dtype=bool)

    points = [_as_xy(p) for p in quad]
    if expand_x or expand_y:
        cx = sum(x for x, _ in points) / 4
        cy = sum(y for _, y in points) / 4
        points = [
            (cx + (x - cx) * (1.0 + expand_x), cy + (y - cy) * (1.0 + expand_y))
            for x, y in points
        ]

    canvas = Image.new("L", (w, h), 0)
    ImageDraw.Draw(canvas).polygon(
        [(x * scale, y * scale) for x, y in points], fill=255
    )
    mask = np.asarray(canvas) > 127
    if inset <= 0:
        return mask
    return ndimage.binary_erosion(mask, np.ones((3, 3)), iterations=max(1, inset // 3))


def _page_mask(
    quad: Sequence[Any] | None,
    scale: float,
    shape: tuple[int, int],
    fraction: float,
    homography: Sequence[float] | None = None,
    px_per_mm: float | None = None,
    pixels: np.ndarray | None = None,
    background: np.ndarray | None = None,
) -> np.ndarray:
    """The marker pages: paper connected to each marker, or a box without the map."""
    h, w = shape
    mask = np.zeros((h, w), dtype=bool)
    if not quad or len(quad) != 4:
        return mask
    points = [_as_xy(p) for p in quad]

    if (
        homography is not None
        and len(homography) == 9
        and px_per_mm
        and pixels is not None
        and background is not None
    ):
        m = np.asarray(homography, dtype=np.float64).reshape(3, 3)
        inv = np.linalg.inv(m)
        luminance = pixels.mean(axis=2)
        chroma = pixels.max(axis=2) - pixels.min(axis=2)
        floor_luminance = float(background.mean())
        floor_chroma = int(background.max() - background.min())
        paper_like = (
            (luminance > floor_luminance - PAGE_LUMINANCE_SLACK)
            & (chroma < floor_chroma - PAGE_CHROMA_MARGIN)
        ) | (
            (luminance > floor_luminance + PAGE_BRIGHTER_BY)
            & (chroma < PAGE_MAX_CHROMA)
        )
        for x, y in points:
            reach = _disc(m, inv, x, y, PAGE_REACH_MM * px_per_mm, scale, (h, w))
            seed = _disc(m, inv, x, y, PAGE_SEED_MM * px_per_mm, scale, (h, w))
            on_page = paper_like & reach
            if PAGE_CLOSE_PX > 0:
                on_page = ndimage.binary_closing(on_page, iterations=PAGE_CLOSE_PX) & reach
            labels, count = ndimage.label(on_page)
            if count:
                hit = np.unique(labels[seed & (labels > 0)])
                mask |= np.isin(labels, hit)
            # The marker itself is black and sits on the page.
            mask |= seed
        if PAGE_GROW_PX > 0:
            mask = ndimage.binary_dilation(mask, iterations=PAGE_GROW_PX)
        return mask

    if fraction <= 0:
        return mask
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    half_w = fraction * (max(xs) - min(xs)) * scale
    half_h = fraction * (max(ys) - min(ys)) * scale
    for x, y in points:
        x0 = max(0, int((x * scale) - half_w))
        x1 = min(w, int((x * scale) + half_w) + 1)
        y0 = max(0, int((y * scale) - half_h))
        y1 = min(h, int((y * scale) + half_h) + 1)
        mask[y0:y1, x0:x1] = True
    return mask


def _disc(
    m: np.ndarray,
    inv: np.ndarray,
    x: float,
    y: float,
    radius_canvas_px: float,
    scale: float,
    shape: tuple[int, int],
) -> np.ndarray:
    """A circle of metric radius about an image point, drawn back in the image."""
    h, w = shape
    cx, cy = _project(m, x, y)
    ring = [
        _project(inv, cx + radius_canvas_px * np.cos(t), cy + radius_canvas_px * np.sin(t))
        for t in np.linspace(0, 2 * np.pi, 48, endpoint=False)
    ]
    canvas = Image.new("L", (w, h), 0)
    ImageDraw.Draw(canvas).polygon([(px * scale, py * scale) for px, py in ring], fill=255)
    return np.asarray(canvas) > 127


def _project(m: np.ndarray, x: float, y: float) -> tuple[float, float]:
    v = m @ np.array([x, y, 1.0])
    return float(v[0] / v[2]), float(v[1] / v[2])


def _refine_background(
    pixels: np.ndarray, rig: np.ndarray, first: np.ndarray
) -> tuple[np.ndarray, int]:
    """
    Measure the floor's spread on the floor, and nothing but the floor.

    The ring `_estimate_background` samples runs just inside the marker quad,
    and a garment longer than the rig crosses it — which is most trousers.
    Denim in the floor sample inflates the spread, the spread sets the
    tolerance, and the tolerance then eats the garment's palest edges. The
    circle closes on exactly the garments that overhang: measured across this
    closet, every pair of trousers drove the tolerance to 67-72 while the
    shorts, which do not reach the ring, sat at the 42 floor.

    So the first estimate is used only to say which pixels are floor, and the
    tolerance is measured again on those. The median is robust enough to
    survive the contamination; the 99.5th percentile of the spread is not,
    which is why it cannot be read off the ring directly.
    """
    rough = np.abs(pixels - first).max(axis=2) < TOLERANCE_FLOOR
    floor = rig & rough
    if floor.sum() < 256:
        return first, _tolerance_from(np.abs(pixels[rig] - first).max(axis=1))
    sample = pixels[floor]
    median = np.median(sample, axis=0)
    spread = np.abs(sample - median).max(axis=1)
    return median.astype(np.int16), _tolerance_from(spread)


def _tolerance_from(spread: np.ndarray) -> int:
    """How far from the background is too far, given how much it varies."""
    return int(
        round(
            min(
                TOLERANCE_CEILING,
                max(
                    TOLERANCE_FLOOR,
                    TOLERANCE_HEADROOM * float(np.percentile(spread, 99.5)),
                ),
            )
        )
    )


def _estimate_background(
    pixels: np.ndarray, on_sheet: np.ndarray, inset: int
) -> tuple[np.ndarray, int]:
    """
    What the background actually photographed as, and how much it varies.

    The colour is the median of a ring just inside the rig edge — whatever the
    floor came out as under this light, at this white balance. The tolerance
    is that ring's own spread, because "how different from the background is
    too different" is a property of the background and of nothing else.
    """
    inner = ndimage.binary_erosion(on_sheet, np.ones((3, 3)), iterations=inset)
    ring = on_sheet & ~inner
    if ring.sum() < 64:
        ring = on_sheet
    if ring.sum() < 64:
        # No sheet quad and a tiny frame: fall back to the image corners.
        h, w, _ = pixels.shape
        patch = max(8, min(h, w) // 25)
        sample = np.concatenate(
            [
                pixels[:patch, :patch].reshape(-1, 3),
                pixels[:patch, -patch:].reshape(-1, 3),
                pixels[-patch:, :patch].reshape(-1, 3),
                pixels[-patch:, -patch:].reshape(-1, 3),
            ]
        )
    else:
        sample = pixels[ring]

    median = np.median(sample, axis=0)
    # Re-estimate on the half of the ring that agrees with itself, so the
    # marker pages the ring crosses do not get a say in either answer.
    spread = np.abs(sample - median).max(axis=1)
    agreeing = sample[spread <= np.percentile(spread, BACKGROUND_TRIM)]
    if len(agreeing) >= 64:
        median = np.median(agreeing, axis=0)
        spread = np.abs(agreeing - median).max(axis=1)

    return median.astype(np.int16), _tolerance_from(spread)
