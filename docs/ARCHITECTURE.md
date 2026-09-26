# Architecture

One box running Docker Compose: the homelab, with an RTX 3070. The phone
reaches the app over the LAN (or Tailscale).

```
phone / browser --> app (Next.js 16)     route handlers are the whole API.
                      |                  Writes rows, enqueues jobs, serves
                      | SQL              media from ./storage
                      v
                    db (Postgres 17)     all data, and the job queue
                      ^
                      | FOR UPDATE SKIP LOCKED
                    worker (Python)      cutouts on the GPU today;
                      |                  standardisation next
                      +--> fal.ai        hosted image models over HTTPS

./storage (bind mount): originals (kept forever), cutouts, tiles, and later
standard images and outfits. migrate: a one-shot service that runs first.
```

## Why this shape

- **The queue is a table.** TypeScript and Python share it without a client
  library. Every long task is a `job` row, so the UI never waits on a request.
- **Providers are chosen by env var.** `CUTOUT_PROVIDER` today, and the
  standardisation provider next. Swapping a vendor is config, not code.
- **Segmentation is local, generation is hosted.** BiRefNet runs in the
  worker for free. No model good enough to be the only image fits in the
  3070's 8 GB, so generation goes to fal.
- **Originals are never modified.** Every derived image can be regenerated
  with a better model as a batch job.

## Flows

**Capture.** The client detects the markers and solves the homography, then
uploads the original with its matrix. That creates a `photo` row and a
`cutout` job. Close-ups upload without markers or jobs, and Add to closet
sets `completed_at`.

**Cutout.** The worker claims the job, runs the provider, and writes
`cutouts/<owner>/<photo>[-<run>].png` plus a 3:4 tile. It records the path,
provider and garment bounds on the photo. A job that names a `provider` writes
a new file and deletes the old one only once the new one has landed.

**Activity.** `ActivityProvider` polls `/api/jobs` every 2 s while anything is
running and every 15 s otherwise, pausing while the tab is hidden. It drives
the toasts, the header count, `/status` and the progress bars. Progress is an
estimate: elapsed time against the provider's recent average.

**Next: standardise.** A finished cutout on a measured garment queues a
`standardize` job. The worker normalises scale and orientation, calls the
model, re-measures the result, and stores `standard_path` if it passes.
