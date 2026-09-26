# Measure

Two pins per dimension, placed by a person. Automatic landmarking is about
±2 cm, which is useless for fit.

## Flow

- The front photo is shown cropped to `cutout_bounds` plus 6%, up to 60dvh
  tall on a phone.
- One dimension at a time, with Back and Next. The live mm reading sits under
  the name, and the list and diagram sit below.
- Pins are seeded from the mask, then placed freely. There is no snapping,
  because the right point is often a seam inside the outline.
- While a pin is held, the loupe (2x) and a locator thumbnail replace the
  reading at the top. Nothing covers the photo.
- The last Next writes every accepted dimension in one transaction.

Measuring starts from three places. The closet's "N to measure, Start" walks
every unmeasured garment oldest first (`?next=queue`). There is also Measure
now at capture, and the item page.

## Templates

Defined in `lib/measure/templates.ts`.

- **Tops:** chest (pit to pit), shoulder, sleeve, body length.
- **Bottoms:** waist, outseam, inseam, front rise, leg opening.

Each dimension's guide sentence defines its convention. `is_doubled` and
`convention` are recorded from it and never asked.

## The convention trap

Standard & Strange double pit-to-pit and measure edge to edge. 3sixteen do
neither, and measure 1" below the pit. Without the two fields on every row,
each brand-chart comparison is silently wrong.

## Later

- Copy pins from a similar garment.
- Back-only dimensions, such as back rise, placed on the back photo.
