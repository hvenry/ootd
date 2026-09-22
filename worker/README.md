# Worker

Polls the `job` table with `FOR UPDATE SKIP LOCKED` and writes cutouts.

**Phase 0 is segmentation only.** BiRefNet decides which existing pixels are
garment; it generates nothing. Try-on generation is Phase 4 and is a hosted
HTTPS call. No generative model ever runs here.

## Run

```bash
python3.12 -m venv .venv
./.venv/bin/pip install -e .            # base: chroma provider, no download
./.venv/bin/pip install -e '.[local]'   # adds BiRefNet (~3.5GB on first job)
./.venv/bin/python -m worker.main
```

`GET http://localhost:8000/health` reports the provider and the job counters.

## Providers — `CUTOUT_PROVIDER`

| Value | What it is | Cost |
|---|---|---|
| `local` | BiRefNet (MIT). GPU optional; CPU works. | free, ~3.5GB once |
| `chroma` | Chroma key + border flood fill. No model. | free, instant |
| `replicate` | `851-labs/background-remover`. Needs `REPLICATE_API_TOKEN`. | ~$0.0004/image |

Never swap in rembg's default session — that is `bria-rmbg`, CC BY-NC, and this
repo is MIT. Pass `-m birefnet-general` if rembg is ever used at all.
