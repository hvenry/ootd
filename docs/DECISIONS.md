# Decisions

Read this before proposing an alternative.

## Settled

| Decision | Choice | Why |
|---|---|---|
| Licence | MIT, contributions under a DCO | Keeps a paid service possible |
| Framework | Next.js 16, route handlers as the API | Known well, and one deployable |
| Queue | A Postgres table | Shared by TypeScript and Python with no library |
| Hosting | Docker Compose on the homelab (RTX 3070) | One command, reachable from the phone |
| Scale reference | Four taped ArUco pages, about 800 mm apart | Sub-pixel, and larger than the garment. A credit card was rejected: 85.6 mm scaling a 530 mm chest is 11 mm out on a perfect tap |
| Measuring | Human-placed pins, front face only | Automatic landmarking is about ±2 cm, useless for fit |
| Fit | Arithmetic, never an image | No model accepts measurements |
| Cutout | BiRefNet (MIT), local, on CUDA | Far better edges than chroma key, and free. No per-photo re-cut UI |
| Adding | Add once both faces are shot, measure later from a queue | A cutout should not hold up adding. Standardisation requires measurements |
| Main image | A standardised catalogue image per face | Consistent pose and scale across the closet, re-measured against the stored numbers |
| Generation | Hosted, through fal.ai for the bake-off | One key covers every candidate. Production may go direct to the winner's API |
| Outfit images | Flat-lay first | Better as a gallery. Try-on on Henry's photo is a later experiment |
| Wear log | A calendar, garments tapped per day | Simple. A generated preview can come later |
| Daily outfit | clo constraint solve (pythermalcomfort), recency, wear history | Thermal comfort is standardised (ISO 7730) |
| Cost | Accepted | One user, and quality matters more |
| Weather | Open-Meteo, MET Norway as the alternate | Open-Meteo's hosted API is non-commercial; self-host it if this ever sells |

## Why not local generation

The 3070 has 8 GB of VRAM. The licence-clean editing models (FLUX.2 klein
4B, Qwen-Image-Edit-2511) need about 12 GB even quantised. The GPU stays on
cutouts, which it does in well under a second.

## Why not try-on models for standardisation

FLUX VTO, Pruna P-Image-Try-On and FASHN put a garment on a person. The
standard image is the garment alone, re-posed, so they are parked for the
try-on experiment.

## Forbidden: non-commercial or copyleft

- **CC BY-NC:** CatVTON, IDM-VTON, OOTDiffusion, Voost, Mobile-VTON,
  OmniVTON++, RMBG-2.0, and rembg's default `bria-rmbg` session.
- **FLUX non-commercial weights:** every FLUX *dev* checkpoint, and FLUX.2
  klein **9B**.
- **Qwen-Image-2.1 weights,** reported as non-commercial. Check the licence of
  any Qwen release before use; Qwen-Image-Edit-2511 is Apache-2.0.
- **NVIDIA NC:** SegFormer-B2-clothes, any `nvidia/mit-b*` derivative, and
  FASHN's self-hosted human parser.
- **AGPL:** `@imgly/background-removal`, Ultralytics YOLO.
- **DeepFashion2,** which has no licence.

A paid API under commercial terms is fine. A non-commercial *weight* licence
is not.

## Allowed

BiRefNet and Lucida (MIT), FLUX.2 klein 4B (Apache-2.0), Qwen-Image-Edit-2511
(Apache-2.0), DWPose (Apache-2.0), the Fashionpedia ontology (CC BY 4.0,
taxonomy only), and hosted image APIs: fal, Google, OpenAI, BFL, BytePlus.

## Open

- Which model standardises best. The bake-off decides.
- Setup friction of the rig. A single ChArUco mat would remove the "all four
  corners in frame" rule.
