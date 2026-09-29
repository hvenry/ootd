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
| Main image | Each face re-rendered onto one fixed mannequin plate, cropped to a fixed window per group | One body, scale and framing across the closet, like a shop's grid. Re-measured against the stored numbers, since the plate's scale is known |
| Generation | Hosted, through fal.ai for the bake-off | One key covers every candidate. Production may go direct to the winner's API |
| Outfit images | The same mannequin wearing every piece | Follows from the plate: the pieces already share a body. Try-on on Henry's photo is a later experiment |
| Views | Polished (standard images) by default, raw (cutouts, originals, pins) behind a Settings choice | The standard image is nicer to browse; the raw one is how to check it |
| Shoe scale | The single A3 sheet, version 2 with its own IDs (4 to 7) | A shoe fits it, and distinct IDs let capture pick the right spans without a switch |
| Shoe shots | One shoe, from every side | A pair hides each shoe's inner face; mirroring one seen shoe beats guessing |
| Belts | Laid in a U inside the existing rig, measured with a pin line | Fits flat on the paper plane, with no re-taping |
| Wear log | A calendar, garments tapped per day | Simple. A generated preview can come later |
| Daily outfit | clo constraint solve (pythermalcomfort), recency, wear history | Thermal comfort is standardised (ISO 7730) |
| Cost | Accepted | One user, and quality matters more |
| Weather | Open-Meteo, MET Norway as the alternate | Open-Meteo's hosted API is non-commercial; self-host it if this ever sells |

## Why not local generation

The 3070 has 8 GB of VRAM. The licence-clean editing models (FLUX.2 klein
4B, Qwen-Image-Edit-2511) need about 12 GB even quantised. The GPU stays on
cutouts, which it does in well under a second.

## Why a mannequin rather than a flat-lay

A flat-lay keeps true scale but leaves every garment a different shape in the
grid, and an outfit needs a separate composite. On one frozen mannequin plate,
every tile shows the same body at the same scale, and an outfit is the same
plate wearing several pieces. The flat-lay brief stays in the bake-off as the
control.

## Why an editing model, not a try-on model

FLUX VTO, Pruna P-Image-Try-On and FASHN put a garment on a photo of a
person, and are tuned for that. The editing models take the plate plus
several references (both faces and the close-ups), which try-on models do
not. A hosted try-on API may join the bake-off as an extra candidate with the
plate as the person.

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

- Which model standardises best, and whether the mannequin beats the flat-lay
  in practice. The bake-off decides.
- Setup friction of the rig. A single ChArUco mat would remove the "all four
  corners in frame" rule.
