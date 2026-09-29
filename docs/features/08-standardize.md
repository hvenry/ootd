# Standardise

Next to build. Each face is re-rendered onto one fixed mannequin, and that
image is what the closet shows. Every garment sits on the same body, at the
same scale, pose and framing, so the grid reads like a shop's: a tee shows the
torso and some leg, trousers show the legs and some torso, and the tile never
changes shape.

It runs in the background. The closet shows the cutout tile until the standard
image lands.

## The mannequin plate

The plate is one image of a matte grey, headless mannequin with arms, legs and
feet, standing square to a long lens on a white ground. It is generated once,
checked, and frozen. Every garment is an **edit of that same image**, which is
what keeps pose, scale and framing identical: consistency comes from the
input, not from the prompt.

- **Front and back plates,** for the two faces.
- **Known scale.** The plate is drawn at a fixed mm per pixel, and its
  landmarks (shoulder line, chest, waist, hip, crotch, knee, wrist, ankle) are
  stored in mm. That is what turns measurements into instructions and results
  back into measurements.
- **Versioned.** A new plate is a new version, and every standard image names
  the plate it was made on.
- **v1 is generic,** sized from standard proportions at Henry's height. v2 is
  built from his body measurements (see Custom mannequin).

## Framing

Every tile is a fixed crop of the full-body render, computed rather than
generated:

- **Tops and outerwear:** from just above the shoulders to mid-thigh.
- **Bottoms:** from the lower ribs to the floor.
- **Footwear:** from the knee down, closer in, so a shoe is not a speck.
- **Belts:** a window around the waist.

Tops and bottoms share one scale and show the same share of the body, about
two thirds, so a cropped jacket reads shorter than a parka. Footwear and
belts each have their own closer window, the same for every item in the
group. Exact windows are fixed once the v1 plate exists.

## Pipeline

A `standardize` job, queued once a garment has its cutouts and measurements.

1. **Normalise by arithmetic.** The homography gives exact px/mm, so the
   cutout is scaled, centred and turned upright on a metric canvas before any
   model sees it.
2. **Translate the measurements.** Models do not honour millimetres, so the
   garment's numbers are compared with the plate's landmarks and written as
   positions: "the hem sits 40 mm below the hip line", "the sleeve ends at the
   wrist". The bake-off also tries a guide image: the cutout scaled roughly
   onto the plate, showing where each edge should land.
3. **Generate.** The model edits the plate, given:
   - the normalised front cutout as the main reference, and the back cutout;
   - the close-ups (fabric, print, label, hardware), which carry text,
     stitching and texture;
   - the category's brief, the garment's details (subcategory, fabric, colour
     word, brand) and the placements from step 2.

   Two candidates per face; the better-scoring one is kept.
4. **Re-measure.** The plate is known, so the garment is the difference
   between the result and the plate. Lengths are measured at the plate's
   scale: body length, where the sleeve ends against the wrist, where the hem
   and legs end, rise. Widths wrap around a form, so they are checked loosely.
   Colour drift is checked against the cutout in OKLab. Past tolerance it
   retries, and after a few failures it is flagged for review.
5. **Store** `standard_path`, cached by a hash of every input: cutouts,
   close-ups, plate version, brief, measurements, model and prompt version.

## The briefs

- **All:** the plate's pose unchanged, the garment worn naturally with no
  added creases, nothing invented, white ground, no shadow beyond the plate's.
- **Tops:** buttoned or zipped as photographed, collar and hem squared.
- **Bottoms:** worn at the natural rise, hems as measured, legs straight.
- **Footwear:** on the plate's feet as a pair, mirrored from the one shoe
  photographed (`11-footwear-accessories.md`).
- **Belts:** through the belt line at the waist, buckle centred.

## Views

- **Polished,** the standard images in the fixed grid. It becomes the
  closet's default once standardisation covers the closet.
- **Raw,** for checking the real thing: the cutouts, back face, close-ups and
  originals, with the measurement pins. Kept out of the way: a "Closet shows:
  Standard / Raw" choice in Settings, and a quiet "Source photos" link on each
  item page.

## Custom mannequin

Later, after the generic plate works. A body page takes height, shoulder
width, torso length, arm length, waist and inseam, which are the same
`body_measurement` readings Fit uses (`04-fit.md`). They draw a simple
outline, which is rendered into a new plate, measured, and frozen. A new plate
regenerates the closet, about $15 at current prices.

A garment shown on Henry's own proportions looks like a fit claim, and
images never carry one. The standard image stays illustrative, and fit stays
the numbers beside it.

## The bake-off

Runs before the pipeline is wired, to choose the model and confirm the
mannequin.

### Candidates

All through fal.ai, one key (`FAL_KEY`). Prices checked 2026-09-26. Every
candidate takes several reference images.

| Model | Approximate price per image |
|---|---|
| GPT Image 2 (OpenAI) | $0.05 medium to $0.21 high, at 1K |
| Nano Banana Pro (`gemini-3-pro-image`) | $0.134 at 1K or 2K |
| Nano Banana 2 (`gemini-3.1-flash-image`) | $0.067 at 1K, $0.101 at 2K |
| FLUX.2 [pro] (BFL) | $0.045 per MP for edits |
| Seedream 5.0 Pro (ByteDance) | $0.045 up to 2.36 MP |

FLUX.2 klein 4B (about $0.014 per MP) is an optional cheap baseline. A hosted
try-on API with the plate as the "person" is an optional extra candidate.

### Briefs compared

- **Mannequin:** the plate edit above, with and without the guide image.
- **Flat-lay:** the earlier brief, top-down on white, as the control.

### Garments

About ten, measured, chosen to hit each failure mode:

- **Baselines:** a plain tee and a hoodie.
- **Print and text:** a graphic tee.
- **Pattern:** a striped or checked shirt.
- **Dark and textured:** a dark knit.
- **Hardware and stitching:** a denim jacket.
- **Bottoms:** jeans, trousers and shorts.
- **Wrinkles:** something badly creased, such as linen.
- **Footwear:** one pair, once shoe capture exists.

Each face runs twice per model per brief, about 400 images for $30 to $50.

### Scored automatically

- **Measurement error:** re-measured lengths against stored mm. Does the
  garment stay the same garment?
- **Colour drift:** the dominant OKLab colours of the output against the
  cutout's.
- **Plate drift:** how far the mannequin itself moved outside the garment.
  Any movement breaks the grid.
- **Cost and time,** per image.

### Judged by eye

- **Detail:** printed text, logos, stripes, pockets, buttons, stitching.
- **Cleanliness:** creases gone, nothing invented, clean edges.
- **Repeatability:** whether the two runs agree.

### Output

A contact sheet with garments as rows and model and brief as columns, each
image with its scores beneath. Files live under `storage/bakeoff/`. The
winner becomes the default provider and the runner-up the fallback.

## Production

If a Gemini model wins, calling Google's API directly halves the cost in
batch mode, which suits a background job. A re-shot face, a new prompt
version or a new plate regenerates only what it touches.
