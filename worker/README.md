# Worker

Polls the Postgres `job` table (`FOR UPDATE SKIP LOCKED`) and runs cutouts.
Normally started by `docker compose up`; see `docs/SETUP.md`.

| `CUTOUT_PROVIDER` | What | Cost |
|---|---|---|
| `local` | BiRefNet (MIT), CPU, gated to the rig. The default | free, ~30–40 s |
| `chroma` | Chroma key inside the rig. No model | free, instant |
| `replicate` | `851-labs/background-remover`, needs a token | ~$0.0004 |

A job's payload may name a `provider` (a bulk re-cut); otherwise the default
runs. With a GPU (`docker-compose.gpu.yml`), BiRefNet runs on CUDA in half
precision.
Each provider is built once per process. Every cut records its path, provider
and garment bounds on the photo, and writes a 3:4 tile beside it.

`GET :8000/health` reports the default provider and counters; the app's
`/status` page reads it.

Never use rembg's default `bria-rmbg` session (CC BY-NC).
