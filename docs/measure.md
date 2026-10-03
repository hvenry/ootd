# Measure

Human-placed pins on the front photo, turned into integer-mm dimensions through the photo's homography.

## Why

Automatic landmarking is about ±2 cm, useless for fit.
A person places each point once; the homography makes it exact to a millimetre or two.

## How it works

- The front photo is shown cropped to `cutout_bounds` plus 6%, up to 60dvh tall on a phone.
- One layout of shared pins per garment: seven on a sleeved top, six on a sleeveless top and on trousers and shorts.
  Every pin is on the photo at once, numbered, with each dimension's line between its two.
- Pins are seeded from the mask, then placed freely; there is no snapping, because the right point is often a seam inside the outline.
- While a pin is held, the loupe (2x) and a locator thumbnail replace the reading. Nothing covers the photo.
- One Done writes every changed dimension in one transaction. Rows are stored one per dimension with both ends, so nothing downstream knows pins are shared.
- Entry points: the closet's "N to measure, Start" (oldest first, `?next=queue`), Measure now at capture, and the item page.

### Trousers and shorts: six pins

1-2 top of the waistband, left and right edge; 3-4 bottom of the left leg, outside and inside edge; 5 the crotch seam; 6 top of the front waistband at the fly.
Waist 1-2, outseam 1-3, leg opening 3-4, inseam 4-5, front rise 5-6.

### Tops: seven pins

1-2 left and right armpit; 3-4 left and right shoulder point; 5 end of the left sleeve on its top edge; 6 high point of the shoulder beside the collar; 7 the hem straight below 6.
Pit to pit 1-2, shoulder 3-4, sleeve 3-5, body length 6-7.
A vest or tank drops pin 5.

## Tech

React client component on a canvas, the homography from [Rig and scale](rig-and-scale.md), mask seeding in TypeScript.

## Key files

- `src/lib/measure/templates.ts` - categories, `PinLayout`, dimensions and their guide sentences
- `src/lib/measure/mask.ts` - `seedPins` from the cutout
- `src/components/measure-screen.tsx` - pins, loupe, locator, save
- `src/components/garment-schematic.tsx` - the numbered diagram
- `src/lib/measure-queue.ts` - the "to measure" queue

## Decisions and gotchas

- **Human pins, front face only:** automatic landmarking is about ±2 cm. Fit is computed from these numbers, never read from an image.
- Each dimension's guide sentence defines its convention; `is_doubled` and `convention` are recorded from it and never asked.
  Standard & Strange double pit-to-pit edge to edge; 3sixteen do neither and measure 1" below the pit.
- Pin 7 is held on the line through 6 square to the shoulders, in the rig's millimetres, so body length cannot turn diagonal on a crooked garment.
- The pits are seeded where the outline, read upward from the hem, leaps out at the sleeve; shoulder and collar seeds are only typical positions.
- Trouser hem pins are seeded along the left leg only.
- Shoes and belts have no templates yet, so they stay out of the queue (`specs/shoe-belt-measure.md`).

## Related

- [Rig and scale](rig-and-scale.md)
- [Data model](data-model.md)
- [Fit spec](specs/fit.md)
