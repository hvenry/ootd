# Measure

One layout of shared pins per garment, each point placed once by a person:
seven on a sleeved top, six on a sleeveless one and on trousers and shorts.
Automatic landmarking is about ±2 cm, which is useless for fit.

## Flow

- The front photo is shown cropped to `cutout_bounds` plus 6%, up to 60dvh
  tall on a phone.
- Every pin is on the photo at once, numbered, with every dimension's line
  between its two. The list and the diagram pick which one the reading shows;
  grabbing a pin shows one it ends.
- Pins are seeded from the mask, then placed freely. There is no snapping,
  because the right point is often a seam inside the outline.
- While a pin is held, the loupe (2x) and a locator thumbnail replace the
  reading at the top. Nothing covers the photo.
- One Done writes every dimension in one transaction, except those whose
  pins are both exactly as stored.

The layouts are `PinLayout` in `templates.ts`. Rows are still stored one per
dimension, with both ends, so nothing downstream knows the pins are shared.
The diagram numbers the pins as the photo does, and its lines are drawn
between them. `seedPins` in `mask.ts` places them from the cutout.

### Trousers and shorts: six pins

| Pin | Where                                   |
| --- | --------------------------------------- |
| 1   | Top of the waistband, left edge         |
| 2   | Top of the waistband, right edge        |
| 3   | Bottom of the left leg, outside edge    |
| 4   | Bottom of the left leg, inside edge     |
| 5   | The crotch seam                         |
| 6   | Top of the front waistband, at the fly  |

Waist is 1–2, outseam 1–3, leg opening 3–4, inseam 4–5, front rise 5–6. The
hem is seeded along the left leg only, not across both.

### Tops: seven pins

| Pin | Where                                                 |
| --- | ----------------------------------------------------- |
| 1   | Left armpit, at the bottom of the armhole             |
| 2   | Right armpit                                          |
| 3   | Left shoulder point, where the seam meets the sleeve  |
| 4   | Right shoulder point                                  |
| 5   | End of the left sleeve, on its top edge               |
| 6   | High point of the shoulder, beside the collar         |
| 7   | The bottom hem, straight below 6                      |

Pit to pit is 1–2, shoulder 3–4, sleeve 3–5, body length 6–7. A vest or tank
drops pin 5 and numbers the rest on. Pin 7 is held on the line through 6
square to the shoulders (3–4), worked in the rig's millimetres: it slides
only up and down, and follows 6 and the shoulders when they move, so body
length cannot turn into a diagonal on a garment laid crooked.

The pits are seeded from the outline read upward from the hem, where the
body's edge leaps out as the sleeve joins it. The shoulder seam and the
collar are not edges of the outline, so those seeds are only where they
usually sit relative to the pits and the top.

Measuring starts from three places. The closet's "N to measure, Start" walks
every unmeasured garment oldest first (`?next=queue`). There is also Measure
now at capture, and the item page.

## Templates

Defined in `lib/measure/templates.ts`.

- **Tops:** chest (pit to pit), shoulder, sleeve, body length.
- **Bottoms:** waist, outseam, leg opening, inseam, front rise.

Each dimension's guide sentence defines its convention. `is_doubled` and
`convention` are recorded from it and never asked.

## The convention trap

Standard & Strange double pit-to-pit and measure edge to edge. 3sixteen do
neither, and measure 1" below the pit. Without the two fields on every row,
each brand-chart comparison is silently wrong.

## Later

- Copy pins from a similar garment.
- Back-only dimensions, such as back rise, placed on the back photo.
