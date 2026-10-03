# Model licensing

Which models, weights and datasets the repo may use, and which are forbidden.

## Why

The repo is MIT, with contributions under a DCO, so a paid service stays possible.
One non-commercial or copyleft dependency would poison that, and model licences are easy to miss: many popular segmentation and try-on weights are CC BY-NC.

## How it works

Before adding any model, weight, dataset or library that ships weights, check it against these lists.

### Forbidden: non-commercial or copyleft

- **CC BY-NC:** CatVTON, IDM-VTON, OOTDiffusion, Voost, Mobile-VTON, OmniVTON++, RMBG-2.0, and rembg's default `bria-rmbg` session.
- **FLUX non-commercial weights:** every FLUX *dev* checkpoint, and FLUX.2 klein **9B**.
- **Qwen-Image-2.1 weights,** reported as non-commercial.
- **NVIDIA NC:** SegFormer-B2-clothes, any `nvidia/mit-b*` derivative, FASHN's self-hosted human parser.
- **AGPL:** `@imgly/background-removal`, Ultralytics YOLO.
- **DeepFashion2,** which has no licence.

### Allowed

- BiRefNet and Lucida (MIT).
- FLUX.2 klein 4B (Apache-2.0), Qwen-Image-Edit-2511 (Apache-2.0), DWPose (Apache-2.0).
- The Fashionpedia ontology (CC BY 4.0, taxonomy only).
- Hosted image APIs under commercial terms: fal, Google, OpenAI, BFL, BytePlus.

## Key files

- `worker/worker/providers/birefnet.py` - the one local model in use, pinned to a reviewed revision
- `worker/pyproject.toml` - the worker's model dependencies

## Decisions and gotchas

- A paid API under commercial terms is fine; a non-commercial *weight* licence is not, even when it is only called through a host.
- Licences differ between releases of the same family: check every Qwen release individually, and FLUX.2 klein 4B is allowed while 9B is not.
- The cutout model is BiRefNet rather than RMBG-2.0 or rembg's default session for this reason alone.

## Related

- [Cutout](cutout.md)
