"""
Redraw every tile from its cutout, after the tile canvas or naming changes.

    python -m worker.retile

Tiles are only pictures of the cutouts, so they can be redrawn at any time
without re-cutting anything. Each photo's `cutout_bounds` is rewritten too,
since it records where the garment sits in its tile. Pictures under any
older name beside a cutout are deleted once the new ones are written:
nothing links to them any more.
"""

from __future__ import annotations

import json
import logging

from . import db
from .main import LARGE_SUFFIX, TILE_SUFFIX, _resolve, write_tile

log = logging.getLogger(__name__)

# Mirrors tileScaleFor in src/lib/measure/templates.ts.
BOTTOMS = {"pants", "jeans", "sweatpants", "shorts"}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.cutout_path, p.homography, g.category
            FROM photo p JOIN garment g ON g.id = p.garment_id
            WHERE p.cutout_path IS NOT NULL
            ORDER BY p.id
            """
        ).fetchall()
        redrawn = removed = 0
        for row in rows:
            cutout = _resolve(row["cutout_path"])
            if not cutout.is_file():
                log.warning("missing cutout for photo %s: %s", row["id"], cutout)
                continue
            homography = row["homography"] or {}
            tile, bounds = write_tile(
                cutout,
                homography.get("m"),
                homography.get("pxPerMm"),
                "bottom" if row["category"] in BOTTOMS else "top",
            )
            if tile is None or bounds is None:
                log.warning("empty cutout for photo %s", row["id"])
                continue
            conn.execute(
                "UPDATE photo SET cutout_bounds = %s WHERE id = %s",
                (json.dumps(bounds), row["id"]),
            )
            conn.commit()
            redrawn += 1
            current = {cutout.stem + TILE_SUFFIX, cutout.stem + LARGE_SUFFIX}
            for stale in cutout.parent.glob(cutout.stem + "_*"):
                if stale.name not in current:
                    stale.unlink()
                    removed += 1
        log.info("redrew %d photos, removed %d stale pictures", redrawn, removed)


if __name__ == "__main__":
    main()
