# Cutout

Background removal on each marker or reference photo, run by the worker as a job.

## Why

The cutout crops the measure view, seeds the pins, and draws the closet tile and item-page picture.
A flat garment photographed on the floor needs a clean edge for all three.

## How it works

The worker runs the provider named by the job's payload, or `CUTOUT_PROVIDER`.

- **`local` (default): BiRefNet (MIT).**
  A segmentation model that judges shape and texture, so dark-on-dark garments, shadows and frayed edges come out right.
  The rig picks which of the mask's pieces are the garment, dropping feet or bags at the frame's edge.
  It never cuts a kept piece, so a sleeve laid wider than the markers survives whole.
- **`chroma`:** a colour key against the floor sampled inside the rig.
  Instant and model-free, but fails on garments close to the floor's colour, and says so.
- **`replicate`:** hosted, needs a token, not enabled.

The cutout keeps the full frame; the tile and large picture are drawn from it (see [Media storage](media-storage.md)).
The photo records `cutout_path`, `cutout_provider` and `cutout_bounds`, including where the garment sits in its tile.

### Off the markers

A shoe's side and angled shots have no markers, so the middle of the frame (inside a 20% margin) stands in for the rig.
The piece with the most of itself there is kept, which drops the other shoe or a chair leg at the edge.
Their tiles are fitted, not metric.

## Tech

BiRefNet through transformers, torch on CUDA in half precision or on the CPU, Pillow, numpy and scipy.

## Key files

- `worker/worker/providers/__init__.py` - provider selection
- `worker/worker/providers/birefnet.py` - BiRefNet, rig and central gating
- `worker/worker/providers/chroma.py` - colour key
- `worker/worker/main.py` - job handling, tile and large picture
- `worker/worker/retile.py` - redraw every tile from the cutouts

## Decisions and gotchas

- Under a second on the homelab's CUDA, about 35 s on a CPU; a background job either way.
- There is no re-cut UI, since BiRefNet is good enough; a payload `provider` is how a bulk re-cut would run.
- A re-cut writes a new file and deletes the old only once the new one lands. Measurements are untouched, since pins live in the homography's canvas.
- The tile and large picture are for looking at; anything that processes the garment reads the full-resolution cutout.
- **BiRefNet, local, as the default:** far better edges than chroma key, free, and MIT (see [Model licensing](model-licensing.md)).
- The model is pinned to a revision because loading runs the repo's own Python (`trust_remote_code`).
- Never use rembg's default `bria-rmbg` session (CC BY-NC). SAM is the wrong tool for this.

## Related

- [Job queue](job-queue.md)
- [Media storage](media-storage.md)
- [Measure](measure.md)
