# Footwear and accessories

Not built yet. Shoes and belts are needed before an outfit image is complete,
and they go on the same mannequin as everything else
(`08-standardize.md`).

## Categories

The enum only splits things that measure, layer or dress for weather
differently. Everything finer goes in `subcategory`, as for clothes.

- **Footwear:** `shoe` (sneakers, loafers, derbies) and `boot`, which differ
  for weather.
- **Accessories:** `belt` first. `hat` exists; `bag`, `scarf` and `gloves`
  follow when needed.

The group (top, bottom, footwear, accessory) is derived from the category,
never stored.

## Shoes

### The A3 sheet

A shoe is photographed top-down on the single A3 sheet, which is required for
that shot. It fits: the sheet is 297 × 420 mm with 40 mm markers in the
corners, and the strip between them is 187 mm wide and the full 420 mm long.
A large boot, about 320 × 120 mm, lies lengthwise inside it without covering
a marker.

**Version 2 of the sheet prints its own IDs (4 to 7).** Version 1 prints IDs
0 to 3, the same as the taped rig, so capture would solve an A3 photo with the
rig's spans and every shoe would be wildly out. With its own IDs, capture
knows which layout is in frame and picks the spans itself: the A3's are fixed
by the print and checked once against the black square, the rig's come from
Settings. Nothing is switched by hand. Version 2 also carries the grey and
white patches, which version 1 cannot fit.

### Scale is approximate

The homography is exact only on the paper, and a shoe stands above it: the
welt, toe cap and heel counter sit 20 to 80 mm up. From a phone about 40 cm
away, something 30 mm up reads about 8% large. Shooting from about 1 m on the
2× or 3× lens halves that.

That is good enough to draw the shoe at the right size on the mannequin, and
not good enough for fit. Fit uses the labelled size from a close-up of the
tongue label, plus an insole length taken with a tape if wanted.

### One shoe, every side

Photograph one shoe, not the pair. Side by side, each shoe hides its inner
face, which often differs from the outer: a boot's zip, a different logo
panel, a shorter tongue. Left and right are mirror images, so the model
mirrors one fully seen shoe into a pair, which is far more reliable than
guessing a hidden side.

| Shot | Rig | Why |
|---|---|---|
| Top-down | A3, required | Scale, and the view into the opening |
| Outer side, near floor level | none | The main profile: sole shape, heel height |
| Inner side, near floor level | none | What a pair hides |
| Front, about 45° down | none | Toe shape, the lining and tongue |
| Back, about 45° down | none | Heel counter, pull tab, the lining at the collar |
| Close-ups, optional | none | Size label, tread, hardware |

The sides are shot near floor level rather than angled down, because the
profile is what the model most needs for shape and heel height.

### Measured

From the top-down shot: outsole length and width. For boots: shaft height,
with a tape. Always: the labelled size and its system (US, UK, EU), never
converted between systems.

## Belts

The taped rig as it is, with no new layout. A belt is 1,000 to 1,200 mm long
and does not need to lie straight: laid in a U, about 550 mm across, it fits
inside the rig flat on the paper plane, where it measures to the millimetre.
A long strip of pages would mean re-taping and re-entering the spans for
every belt.

- **Shots:** the belt in a U on the rig, and a buckle close-up.
- **Measured:** buckle to the hole in use, hole spacing, and width. Buckle to
  hole follows the curve, so the measure screen gains a **pin line**: a chain
  of pins whose segments add up.

## Off-rig cutouts

The worker gates a cutout to the rig, which picks the garment out of the
mask. The shoe's angled shots have no markers, so they are cut out ungated:
the largest central piece, which suits one object on a plain floor. They are
references for the model and are never measured.
