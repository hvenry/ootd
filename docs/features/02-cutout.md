# Cutout

Background removal. It is an internal step: the standard image is what the
user sees. The cutout feeds standardisation, crops the measure view and seeds
the pins.

## Providers

Chosen by `CUTOUT_PROVIDER` in `worker/providers/`.

- **`local` (default): BiRefNet (MIT).** A trained segmentation model that
  judges shape and texture, so dark-on-dark garments, shadows and frayed
  edges come out right. It is gated to the rig area and to the garment's own
  pieces, which drops feet or bags at the edge of the frame. The model is
  pinned to a revision.
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

`cutouts/<owner>/<photo>[-<run>].png` keeps the full frame, and
`_tile.png` beside it is a 3:4 crop. The photo records the path, provider and
bounds.

## Never

rembg's default `bria-rmbg` session (CC BY-NC). SAM is the wrong tool for this.
