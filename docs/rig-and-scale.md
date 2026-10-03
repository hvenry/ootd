# Rig and scale

How a phone photo becomes millimetres: ArUco markers at known spans, solved into a homography per photo.

## Why

Measurements are the product, and fit arithmetic is only as good as the scale.
Four markers about 800 mm apart give sub-pixel accuracy over the whole garment; a credit card would be 11 mm out on a chest.

## How it works

1. The client detects markers with `js-aruco2` and picks the layout from the IDs in frame:
   IDs 0 to 3 are the taped rig, IDs 4 to 7 the A3 shoe sheet (version 2).
2. It solves a plane-to-plane homography to a 4 px/mm metric canvas, using the layout's spans.
3. The photo is uploaded with its homography (matrix, px/mm, marker quad, `source`: `sheet` or `a3`).
4. Measuring pushes **tap coordinates** through that homography.

The rig spans live in the `rig` table, saved from Settings and read per request.
Until one is saved, `NEXT_PUBLIC_SHEET_*` from `.env` is the fallback.
The A3 sheet's spans are fixed by the print and scale with its measured black square.

## Tech

`js-aruco2` (classical CV, no model), a hand-written homography solve, `pdf-lib` for the printable sheets.

## Key files

- `src/lib/homography/aruco.ts` - marker detection
- `src/lib/homography/solve.ts` - homography and its inverse
- `src/lib/homography/sheet.ts` - layouts, spans, env fallback
- `src/lib/homography/sheet-pdf.ts` - printable rig and A3 sheet
- `src/lib/rig.ts` - load the saved rig per request
- `src/lib/capture-shots.ts` - which shots each kind needs, and which need markers

## Decisions and gotchas

- Apply the homography to tap coordinates, never to a re-rendered image: warping then measuring resamples twice.
  `warp.ts` renders a preview only.
- A photo keeps the homography it was solved with, so editing the rig never moves an existing measurement.
- The `NEXT_PUBLIC_SHEET_*` fallback is baked in at build time; the saved rig is not.
- The measure screen crops only the view, using `photo.cutout_bounds`; the cutout keeps the full frame.
- A shoe stands above the paper, so its scale is about 8% large from 40 cm: good for drawing, not for fit.
- Accuracy is about 1 to 3 mm over 50 cm, limited by how flat the garment lies.
- **Four taped ArUco pages, not a credit card:** an 85.6 mm card scaling a 530 mm chest is 11 mm out on a perfect tap; markers about 800 mm apart are larger than the garment.
- The rig needs all four markers in frame; a single ChArUco mat would remove that rule.

## Related

- [Capture](capture.md)
- [Measure](measure.md)
- [Footwear and accessories](footwear-accessories.md)
- [Data model](data-model.md)
