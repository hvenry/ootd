# Standardise

Next to build. Each face becomes one clean catalogue image, and that image is
the only one the user sees. Every garment ends up at the same scale and
orientation, with sleeves and legs in the same pose and wrinkles gone.

It runs in the background. The closet shows the cutout tile until the standard
image lands.

## Pipeline

A `standardize` job, queued once a garment has its cutouts and measurements.

1. **Normalise by arithmetic.** The homography gives exact px/mm, so scale,
   centring and rotation to upright are computed rather than left to a model.
   Every garment is placed on the same canvas at the same mm per pixel.
2. **Generate.** The model gets the normalised cutout, the close-ups as
   references, the category's pose brief and the measurements as text.
3. **Re-measure.** Cut the result out with BiRefNet and measure it at the
   known scale, which is a check only this app can make. Past tolerance it
   retries, and after a few failures it is flagged for review.
4. **Store** `standard_path`, cached by a hash of every input: cutout, close-ups,
   brief, measurements, model and prompt version.

## The pose brief

The default, until Henry supplies reference images:

- **All:** top-down flat-lay on pure white, no shadow, true relative scale
  (a tee looks smaller than a coat).
- **Tops:** sleeves angled down about 30° from the body, symmetric, collar
  and hem squared.
- **Bottoms:** legs parallel with a small even gap, waistband straight.

## The bake-off

Runs before the pipeline is wired, to choose the model.

### Candidates

All through fal.ai, one key (`FAL_KEY`). Prices checked 2026-09-26.

| Model | Approximate price per image |
|---|---|
| GPT Image 2 (OpenAI) | $0.05 medium to $0.21 high, at 1K |
| Nano Banana Pro (`gemini-3-pro-image`) | $0.134 at 1K or 2K |
| Nano Banana 2 (`gemini-3.1-flash-image`) | $0.067 at 1K, $0.101 at 2K |
| FLUX.2 [pro] (BFL) | $0.045 per MP for edits |
| Seedream 5.0 Pro (ByteDance) | $0.045 up to 2.36 MP |

FLUX.2 klein 4B (about $0.014 per MP) is an optional cheap baseline.

### Garments

About ten, measured, chosen to hit each failure mode:

- **Baselines:** a plain tee and a hoodie.
- **Print and text:** a graphic tee.
- **Pattern:** a striped or checked shirt.
- **Dark and textured:** a dark knit.
- **Hardware and stitching:** a denim jacket.
- **Bottoms:** jeans, trousers and shorts.
- **Wrinkles:** something badly creased, such as linen.

Each face runs twice per model: 10 garments, 2 faces, 5 models and 2 runs
make 200 images, for roughly $15 to $25.

### Scored automatically

- **Measurement error:** re-measured mm against stored mm. Does the garment
  stay the same garment?
- **Colour drift:** the dominant OKLab colours of the output against the
  cutout's.
- **Pose consistency:** sleeve angle and leg gap across every garment in a
  category.
- **Cost and time,** per image.

### Judged by eye

- **Detail:** printed text, logos, stripes, pockets, buttons, stitching.
- **Cleanliness:** creases gone, nothing invented, clean edges.
- **Repeatability:** whether the two runs agree.

### Output

A contact sheet with garments as rows and models as columns, each image with
its scores beneath. Files live under `storage/bakeoff/`. The winner becomes
the default provider and the runner-up the fallback.

## Production

If a Gemini model wins, calling Google's API directly halves the cost in
batch mode, which suits a background job. A re-shot face or a new prompt
version regenerates that face only.
