# Job queue

Every long-running task is a row in the Postgres `job` table, claimed by the worker and followed by the UI.

## Why

A cutout takes under a second on CUDA but about 35 s on a CPU.
None of that may block a request.
A table is shared by TypeScript and Python with no client library and no Redis.

## How it works

1. The app inserts a `job` row: `kind` (`cutout` today), `payload`, `content_hash`, `status = pending`.
2. The worker claims one with `UPDATE ... FOR UPDATE SKIP LOCKED`, setting `running` and incrementing `attempts`.
3. On success it writes `result` (`cutoutPath`, `provider`, `seconds`) and sets `done`.
4. On error it returns the row to `pending` until `MAX_ATTEMPTS` (3), then parks it as `failed` with the `error`.
5. `ActivityProvider` polls `/api/jobs` every 2 s while anything runs and every 15 s otherwise, pausing while the tab is hidden.
   It drives the toasts, the header's "N processing", `/status`, and progress bars.

Progress is an estimate: elapsed time against the provider's recent average, capped at 95%.

## Tech

Postgres row locking, psycopg on the worker, Drizzle on the app.

## Key files

- `worker/worker/db.py` - claim, complete, retry
- `worker/worker/config.py` - env: `CUTOUT_PROVIDER`, `CUTOUT_DEVICE`, `MAX_ATTEMPTS`, `MODEL_KEEP_ALIVE_SECONDS`
- `src/app/api/jobs/` - the jobs feed the UI polls
- `src/components/activity.tsx` - `ActivityProvider` and its poll intervals
- `src/lib/providers/cutout.ts` - provider names and labels on the app side

## Decisions and gotchas

- **A Postgres table, not Redis or a broker:** TypeScript and Python share it with no client library, and one less service runs.
- `content_hash` is unique per kind: generated results are cached by content and never recomputed.
- A job's payload may name a `provider`, which overrides the default; that is how a bulk re-cut runs.
- `CUTOUT_PROVIDER` defaults to `local` on both sides; a worker installed without the `local` extras needs `CUTOUT_PROVIDER=chroma`.
- `CUTOUT_DEVICE=cuda` (set by the GPU overlay) makes the GPU required, so a broken driver fails loudly instead of cutting on the CPU.

## Related

- [Architecture](architecture.md)
- [Media storage](media-storage.md)
- [Cutout](cutout.md)
