# Standardise

**Status:** draft

Every face in the closet is re-rendered onto one fixed mannequin, so the grid reads like a shop's: same body, scale, pose and framing.

## Goal

Cutouts show each garment at its true shape but as a different silhouette per tile.
On one frozen mannequin plate every tile shows the same body, and an outfit becomes the same plate wearing several pieces.
It worked when the closet's default view is standard images, each within tolerance of its garment's stored measurements.

## Scope

- In: the `standardize` job, the v1 plate in production, framing windows, the polished grid, the raw view.
- Out: choosing the model ([bake-off](standardize-bakeoff.md)), the custom plate ([custom mannequin](custom-mannequin.md)), outfits.

## Design

### The plate

One image of a matte grey, headless mannequin with arms, legs and feet, square to a long lens on a white ground.
Generated once, checked, frozen. Every garment is an **edit of that same image**: consistency comes from the input, not the prompt.
- Front and back plates, for the two faces.
- **Known scale:** a fixed mm per pixel, and landmarks (shoulder line, chest, waist, hip, crotch, knee, wrist, ankle) stored in mm.
- **Versioned:** every standard image names its plate. v1 is generic, sized from standard proportions at Henry's height.

### Framing

Every tile is a fixed crop of the full-body render, computed, not generated:
- Tops and outerwear: just above the shoulders to mid-thigh.
- Bottoms: the lower ribs to the floor.
- Footwear: the knee down, closer in. Belts: a window around the waist.

Tops and bottoms share one scale and about two thirds of the body, so a cropped jacket reads shorter than a parka.
Exact windows are fixed once the v1 plate exists.

### Pipeline

A `standardize` job, queued once a garment has its cutouts and measurements.
1. **Normalise by arithmetic:** the homography gives exact px/mm, so the cutout is scaled, centred and turned upright on a metric canvas.
2. **Translate measurements into positions** against the plate's landmarks ("the hem sits 40 mm below the hip line"), since models do not honour millimetres. Optionally a guide image.
3. **Generate:** the model edits the plate given the normalised front and back cutouts, the close-ups, the category brief, the garment's details and the placements. Two candidates per face; the better-scoring is kept.
4. **Re-measure:** the garment is the difference between result and plate. Lengths are checked at the plate's scale, widths loosely; colour drift in OKLab. Past tolerance it retries, then flags for review.
5. **Store** `standard_path`, cached by a hash of every input: cutouts, close-ups, plate version, brief, measurements, model, prompt version.

### Briefs

- **All:** plate pose unchanged, worn naturally, no added creases, nothing invented, white ground.
- **Tops:** buttoned or zipped as photographed, collar and hem squared.
- **Bottoms:** natural rise, hems as measured, legs straight.
- **Footwear:** on the plate's feet as a pair, mirrored from the one shoe photographed.
- **Belts:** through the belt line at the waist, buckle centred.

### Schema

`photo.standard_path`, `standard_status`, `standard_model`, `standard_plate`; a `mannequin` table of plate versions (image paths, mm per pixel, landmarks in mm).

### Views

- **Polished:** standard images in the fixed grid, the default once standardisation covers the closet; the cutout tile shows until a standard image lands.
- **Raw:** cutouts, back face, close-ups, originals and pins, behind a "Closet shows: Standard / Raw" Settings choice and a "Source photos" link on each item page.

### Decisions

- Hosted generation: the 3070's 8 GB cannot run the licence-clean editing models (about 12 GB quantised).
- An editing model over a try-on model: try-on models take one person photo and one garment; editing models take the plate plus both faces and close-ups.
- If a Gemini model wins, Google's batch API directly halves the cost.

## Tasks

- [ ] `mannequin` table and `photo.standard_*` columns
- [ ] Freeze the v1 plate and fix the framing windows
- [ ] `standardize` job kind in the worker, behind a provider interface
- [ ] Re-measurement, colour check, retries and the review flag
- [ ] Polished grid with cutout fallback
- [ ] Raw view: Settings choice and "Source photos"

## Done when

- [ ] A newly measured garment gets a standard image per face without intervention
- [ ] A re-shot face, new prompt version or new plate regenerates only what it touches
- [ ] Images past tolerance are flagged, not shown
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Open questions

- Which model: decided by the [bake-off](standardize-bakeoff.md).

## Related

- [Standardise bake-off](standardize-bakeoff.md)
- [Custom mannequin](custom-mannequin.md)
- [Cutout](../cutout.md)
- [Rig and scale](../rig-and-scale.md)
