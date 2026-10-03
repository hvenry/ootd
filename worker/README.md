# Worker

Polls the Postgres `job` table with `FOR UPDATE SKIP LOCKED` and runs cutouts.
Docker Compose normally starts it; see `docs/setup.md`.

| `CUTOUT_PROVIDER` | What | Cost |
|---|---|---|
| `local` | BiRefNet (MIT), gated to the rig. The default | Free. Under a second on CUDA, about 35 s on CPU |
| `chroma` | Chroma key inside the rig, no model | Free, instant |
| `replicate` | `851-labs/background-remover`, needs a token | About $0.0004 |

A job's payload may name a `provider`, which is how a bulk re-cut runs.
Otherwise the default runs. Each provider is built once per process.

Every cut records its path, provider and garment bounds on the photo, and
writes a 3:4 tile beside it, drawn at a scale shared by every top or every
bottom (`docs/media-storage.md`). With a GPU (`docker-compose.gpu.yml`),
BiRefNet runs on CUDA in half precision. `CUTOUT_DEVICE=cuda` (set by the GPU
overlay) makes the GPU required rather than preferred, and
`MODEL_KEEP_ALIVE_SECONDS` unloads the model after that long idle, for a GPU
shared with other work.

`GET :8000/health` reports the default provider and counters, and the app's
`/status` page reads it.

Never use rembg's default `bria-rmbg` session (CC BY-NC).
