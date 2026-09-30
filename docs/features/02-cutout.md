# Cutout

Background removal. It is an internal step: the standard image is what the
closet shows, and the cutouts sit behind the raw view. The cutout feeds standardisation, crops the measure view and seeds
the pins.

## Providers

Chosen by `CUTOUT_PROVIDER` in `worker/providers/`.

- **`local` (default): BiRefNet (MIT).** A trained segmentation model that
  judges shape and texture, so dark-on-dark garments, shadows and frayed
  edges come out right. The rig picks which of the mask's pieces are the
  garment, which drops feet or bags at the edge of the frame. It never cuts a
  kept piece, so a sleeve laid wider than the markers survives whole. The
  model is pinned to a revision.
- **`chroma`:** a colour key against the floor sampled inside the rig. It is
  instant and needs no model, but fails on garments close to the floor's
  colour, and says so.
- **`replicate`:** hosted, needs a token, and is not enabled.

## Speed

BiRefNet takes well under a second on the homelab's CUDA and about 35 s on a
CPU. Either way it is a background job with a progress bar.

## Re-cutting

There is no UI for it, since BiRefNet is good enough. The worker still honours
a `provider` in a job's payload, which is how a bulk re-cut would run.

A re-cut writes a new file, because media is served as immutable. It keeps the
old cut until the new one lands, then deletes it. Measurements are untouched,
since the pins live in the homography's canvas and not in the mask.

## Output

`cutouts/<owner>/<photo>[-<run>].png` keeps the full frame, for measuring.
Beside it are two pictures drawn from it, both WebP with alpha:

- `_tile3.webp`, a 3:4 tile for the closet grid.
- `_large1.webp`, the garment alone for the item page: straight down, cropped
  to it, at the photo's own resolution (about 1.7 px/mm on a 12 MP shot,
  capped at 3000 px). The tile is at a shared, smaller scale, and blown up to
  fill the item page it was visibly soft.

The photo records the path, provider and bounds.

The tile is drawn through the homography, so it is seen straight down and
upright, at a scale every tile shares: one canvas for tops and outerwear
(1300×1733 mm, which nine in ten tops fit spread out) and one for bottoms
(1000×1333 mm), both at 1.2 px/mm. A blazer laid with its sleeves down
therefore reads smaller than a hoodie with its arms out, instead of both being
zoomed to fill the tile. The job's `tileScale` names the canvas. A garment
larger than its canvas is shrunk to fit and logged. The bounds also record
where the garment sits in its tile.

Neither picture is an input to anything: they are for looking at. Generation
works from the full-resolution cutout, never from these.

Both can be redrawn from the cutouts at any time with
`python -m worker.retile`, which also rewrites the bounds and deletes the
older pictures. Media is immutable, so a change to how either is drawn needs a
new name: bump `TILE_SUFFIX` or `LARGE_SUFFIX` in the worker and
`tilePathFor` or `largePathFor` in `src/lib/storage.ts` together.

## Off the rig

Planned for the shoe's angled shots, which have no markers: an ungated cut
that keeps the largest central piece. See `11-footwear-accessories.md`.

## Never

rembg's default `bria-rmbg` session (CC BY-NC). SAM is the wrong tool for this.
