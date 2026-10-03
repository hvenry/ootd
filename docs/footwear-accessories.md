# Footwear and accessories

Capture for shoes, boots and belts: their categories, the A3 shoe sheet, and per-kind shot lists.

## Why

Shoes and belts belong in the closet like everything else, but a shoe is a solid, not a flat garment.
It needs its own sheet and shots, and a belt is too long to lie straight on the rig.

## How it works

### Categories

- **Footwear:** `shoe` (sneakers, loafers, derbies) and `boot`, which differ for weather.
- **Accessories:** `belt`. `hat` exists in the enum but is not offered.
- Both sit under one add-form group, "Footwear & Accessories". Finer distinctions go in `subcategory`.
- The group (top, bottom, outerwear, accessories) is derived from the category, never stored.

### Shoes

Photograph **one shoe, not the pair**: a pair hides each shoe's inner face, while one shoe seen from every side can be mirrored into a pair.

| Shot | Markers | Why |
|---|---|---|
| Top-down | A3, required | Scale, and the view into the opening |
| Outer side, near floor level | none | The main profile; the closet's cover |
| Inner side, near floor level | none | What a pair hides |
| Front, about 45° down | none | Toe shape, lining, tongue |
| Back, about 45° down | none | Heel counter, pull tab |
| Close-ups, optional | none | Size label, tread, hardware |

**The A3 sheet** is 297 x 420 mm with 40 mm corner markers; the 187 mm strip between them fits a large boot lengthwise.
Version 2 prints IDs 4 to 7, so capture tells it from the rig (0 to 3) and uses its fixed spans; it also carries the grey and white patches.
Its black square should read 32 mm; a different reading goes in Settings and the spans scale with it.

### Belts

The taped rig as it is: a belt laid in a U, about 550 mm across, lies flat on the paper plane.
Shots: the belt on the rig, and a buckle close-up (the close-ups step opens on Hardware).

## Tech

Same pipeline as clothes: `js-aruco2`, the homography, BiRefNet with central gating for off-marker shots.

## Key files

- `src/lib/capture-shots.ts` - shot list per kind and the cover view
- `src/lib/homography/sheet.ts` - rig and A3 layouts, chosen by marker IDs
- `src/lib/homography/sheet-pdf.ts` - the printable A3 sheet
- `src/lib/measure/templates.ts` - categories and photo views

## Decisions and gotchas

- Version 1 of the A3 sheet printed IDs 0 to 3, the rig's own, so every shoe was solved with the rig's spans; reprint it.
- Scale is exact only on the paper. Something 30 mm up reads about 8% large from 40 cm; shooting from about 1 m on the 2x or 3x lens halves that. Good for drawing, not for fit.
- Sides are shot near floor level, because the profile carries shape and heel height.
- Tile canvases: shoes 300 x 400 mm, belts 700 x 933 mm (see [Media storage](media-storage.md)).
- Until measuring exists, shoes and belts stay out of the measure queue and their item page offers no Measure.

## Related

- [Capture](capture.md)
- [Rig and scale](rig-and-scale.md)
- [Cutout](cutout.md)
- [Shoe and belt measuring spec](specs/shoe-belt-measure.md)
