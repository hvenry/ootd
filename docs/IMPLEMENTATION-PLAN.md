# Implementation plan

One user, cost is acceptable, and quality is the bar. The app should be
useful at the end of every step. Updated 2026-09-26.

## The product

1. **Capture:** front and back on the rig, plus optional close-ups. Done.
2. **Measure:** pins on the front, stored as integer mm. Done.
3. **Standardise:** each face goes through an image model and comes back as
   one clean catalogue image, with the same scale, pose and orientation across
   the closet and wrinkles gone. It becomes the only image the user sees.
4. **Outfits:** pick garments and get a flat-lay of them together, plus a
   gallery of outfit ideas generated from the wardrobe.
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

## Next: the standardisation bake-off

Spec: `features/08-standardize.md`.

1. Henry: `FAL_KEY` in the homelab `.env`, about $25 of fal credit, and
   around ten measured garments covering the difficulty list.
2. Build the harness: deterministic normalisation, one request per model per
   face, re-measurement, colour drift, a contact sheet.
3. Pick a winner and a runner-up by eye with the scores beside each image.
4. Wire the `standardize` job kind and `photo.standard_path`, and show the
   standard image in the closet and on the item page.

## Then

- **Outfits** (`features/09-outfits.md`): flat-lay composites and the ideas
  gallery.
- **Wear log** (`features/10-wear-log.md`): calendar tagging and analytics.
- **OOTD** (`features/07-daily.md`): forecast, clo, recency, wear history.
- **Fit** (`features/04-fit.md`): body measurements and ease buckets.
- **Colour** (`features/05-colour.md`): OKLab extraction and the value
  contrast score.
- **Layering** (`features/06-layering.md`): the physical clearance validator.

## Later, maybe

- Outfits rendered on Henry's own photo (try-on), as an experiment.
- Shoes and hats, recorded by labelled size only.
- Auth, sync and billing, if it ever serves more than one person.
