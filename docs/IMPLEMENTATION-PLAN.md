# Implementation plan

One user, cost is acceptable, and quality is the bar. The app should be
useful at the end of every step. Updated 2026-09-27.

## The product

1. **Capture:** front and back on the rig, plus optional close-ups. Done for
   clothes; shoes and belts next.
2. **Measure:** pins on the front, stored as integer mm. Done.
3. **Standardise:** each face is re-rendered onto one fixed mannequin, with
   the same scale, pose and framing across the closet and wrinkles gone. It
   is the polished feed; the cutouts stay behind a raw view.
4. **Outfits:** pick garments and see them worn together on the mannequin,
   plus a gallery of outfit ideas generated from the wardrobe.
5. **OOTD:** the home screen, with today's outfit from weather, recency and
   wear history.
6. **Wear log:** a calendar where each day is tagged with what was worn. It
   feeds OOTD and the analytics.

## Done

- **Capture:** details, front, back, close-ups, then Add to closet. ArUco rig,
  4 px/mm homography, brand suggestions. Measuring is prompted for later.
- **Cutouts:** BiRefNet by default (CUDA through `docker-compose.gpu.yml`,
  CPU otherwise), gated to the rig. Chroma key remains for workers without the
  model. Bounds are recorded so the measure view can crop.
- **Measure:** free pins, a view cropped to the garment, loupe and locator,
  live mm, diagram review, one-transaction save. A "N to measure" queue sits
  on the closet.
- **Item page:** faces and close-ups in one pager, edit details, remove.
- **Activity:** toasts for add, update, remove and cutouts. `/status` shows
  worker health, the queue and progress estimates.
- **Running:** Docker Compose for the whole stack, with a GPU override. The
  homelab is the primary instance.

## Next, in order

Footwear capture goes first because it is unblocked and keeps scanning going,
while the bake-off waits on a key and measured tops. The feed ships without
shoes and belts; the outfit image does not.

1. **Footwear and belt capture** (`features/11-footwear-accessories.md`).
   - The A3 sheet, version 2: IDs 4 to 7 and the colour patches, with capture
     choosing the spans from the IDs it sees.
   - Categories `shoe`, `boot` and `belt`, and per-group capture steps: the
     six shoe shots, the belt in a U.
   - Ungated cutouts for the shoe's off-rig shots.
2. **The bake-off** (`features/08-standardize.md`).
   - Henry: `FAL_KEY` in the homelab `.env`, about $50 of fal credit, and
     about eight tops measured to go with the bottoms.
   - A generic v1 mannequin plate, front and back, frozen with its landmarks.
   - The harness: normalisation, measurement placements, one request per
     model per brief per face, re-measurement, colour and plate drift, a
     contact sheet.
   - Mannequin against flat-lay, and a winner and runner-up by eye with the
     scores beside each image.
3. **Standardise in production.**
   - The `standardize` job and `photo.standard_path`, with two candidates,
     retries and a review flag.
   - The fixed framing windows and the polished grid, falling back to the
     cutout tile.
   - The raw view: the Settings choice and "Source photos" on the item page.
4. **Shoe and belt measuring.** Their templates, and the pin line for a
   belt's curve. After the measure flow changes in progress settle.
5. **Body and the custom mannequin.** `body_measurement`, a body page, and a
   v2 plate built from it, then the closet regenerated. Fit
   (`features/04-fit.md`) reads the same readings.
6. **Outfits** (`features/09-outfits.md`): garments worn together on the
   plate, and the ideas gallery, both checked by the layering validator
   (`features/06-layering.md`).
7. **OOTD** (`features/07-daily.md`), then the **wear log**
   (`features/10-wear-log.md`).

## Then

- **Colour** (`features/05-colour.md`): OKLab extraction and the value
  contrast score.
- **More accessories:** hats, bags, scarves and gloves, on the same pattern
  as belts.

## Later, maybe

- Outfits rendered on Henry's own photo (try-on), as an experiment.
- Auth, sync and billing, if it ever serves more than one person.
