# Capture

Turns a garment into two metric photographs and any number of close-ups.

## Flow

1. **Details:** group, then sleeve (tops only), category, colour, brand and
   name. Brand suggests the closet's own spellings first, then a starter list
   in `lib/search/starter-brands.ts`, ignoring case and punctuation.
2. **Front, then back:** flat, inside the four markers, shot straight down.
   The client detects the markers with `js-aruco2` (classical CV), solves a
   homography to a 4 px/mm canvas and reads the grey patch. The upload creates
   a `photo` and a `cutout` job.
3. **Close-ups (optional):** choose a kind (care label, fabric, print,
   hardware, other), shoot, and repeat. They are taken off the rig with no
   markers, no cutout and no measuring, to give the image model detail.
4. **Add to closet,** or **Measure now.** Both faces are the gate. The garment
   is in the closet immediately, its cutouts carry on in the background, and
   the closet prompts "N to measure".

## Rig

Four 110 mm markers, one per A4 page, taped at the corners of a rectangle
larger than the garment. Use about 800×1000 mm for tops and 700×1300 mm for
trousers.

Measure the spans centre to centre into `.env`, and the diagonals cross-check
them. Accuracy is about ±1 to 3 mm over 50 cm, limited by how flat the garment
lies.

## Rules

- Reshooting a face replaces it and its measurements.
- A capture missing a face stays under Unfinished until finished or
  discarded. One with both faces but never added offers Add.
