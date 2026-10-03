# Standardise bake-off

**Status:** ready

Chooses the image model and confirms the mannequin approach before the standardise pipeline is wired.

## Goal

Pick a winning model and a runner-up for [standardise](standardize.md), with evidence.
It worked when a contact sheet shows every candidate on the same garments, with automatic scores beside each image, and a winner is chosen by eye.

## Scope

- In: the v1 mannequin plate, a one-off harness, about 400 images across five models and two briefs, a contact sheet.
- Out: the production `standardize` job, schema changes, UI.

## Design

### Candidates

All through fal.ai with one key (`FAL_KEY`). Prices checked 2026-09-26; every candidate takes several reference images.

| Model | Approximate price per image |
|---|---|
| GPT Image 2 (OpenAI) | $0.05 medium to $0.21 high, at 1K |
| Nano Banana Pro (`gemini-3-pro-image`) | $0.134 at 1K or 2K |
| Nano Banana 2 (`gemini-3.1-flash-image`) | $0.067 at 1K, $0.101 at 2K |
| FLUX.2 [pro] (BFL) | $0.045 per MP for edits |
| Seedream 5.0 Pro (ByteDance) | $0.045 up to 2.36 MP |

FLUX.2 klein 4B (about $0.014 per MP) is an optional cheap baseline.
A hosted try-on API with the plate as the "person" is an optional extra candidate.

### Briefs compared

- **Mannequin:** the plate edit from [standardise](standardize.md), with and without the guide image.
- **Flat-lay:** top-down on white, as the control. A flat-lay keeps true scale but leaves every garment a different shape in the grid, and an outfit would need a separate composite.

### Garments

About ten, measured, chosen to hit each failure mode:
- Baselines: a plain tee and a hoodie.
- Print and text: a graphic tee. Pattern: a striped or checked shirt.
- Dark and textured: a dark knit. Hardware and stitching: a denim jacket.
- Bottoms: jeans, trousers and shorts. Wrinkles: something badly creased, such as linen.
- Footwear: one pair.

Each face runs twice per model per brief: about 400 images for $30 to $50.

### Scored automatically

- **Measurement error:** re-measured lengths against stored mm.
- **Colour drift:** dominant OKLab colours of the output against the cutout's.
- **Plate drift:** how far the mannequin itself moved outside the garment; any movement breaks the grid.
- **Cost and time** per image.

### Judged by eye

Detail (text, logos, stripes, pockets, buttons, stitching), cleanliness (creases gone, nothing invented, clean edges), and repeatability (whether the two runs agree).

### Output

A contact sheet with garments as rows and model and brief as columns, scores under each image.
Results are files under `storage/bakeoff/`, not database rows.

## Tasks

- [ ] Henry: `FAL_KEY` in the homelab `.env` and about $50 of fal credit
- [ ] Henry: about eight tops measured to go with the bottoms
- [ ] Generate, check and freeze the v1 plate, front and back, with landmarks in mm
- [ ] Harness: normalisation, measurement placements, one request per model per brief per face
- [ ] Scoring: re-measurement, colour drift, plate drift, cost and time
- [ ] Contact sheet
- [ ] Pick winner and runner-up; record the choice and its scores in the [standardise](standardize.md) spec's Design

## Done when

- [ ] Every candidate has run on every garment, both briefs, twice
- [ ] The contact sheet exists under `storage/bakeoff/` with scores beside each image
- [ ] Winner and runner-up, and mannequin versus flat-lay, are recorded in the [standardise](standardize.md) spec
- [ ] This spec is deleted and removed from `roadmap.md` and `AGENTS.md`

## Open questions

- Whether the mannequin beats the flat-lay in practice. Default: mannequin, unless its scores are clearly worse.

## Related

- [Standardise](standardize.md)
- [Model licensing](../model-licensing.md)
