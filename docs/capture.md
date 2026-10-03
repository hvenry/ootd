# Capture

The add flow that turns an item into metric photographs, optional close-ups, and a closet entry.

## Why

Every number the app stores comes from these photos.
Making capture a fixed shot list per kind means nothing downstream has to guess which photos exist.

## How it works

1. **Details:** group, then category, colour, brand and name.
   Brand suggests the closet's own spellings first, then a starter list, ignoring case and punctuation.
2. **Required shots,** from `src/lib/capture-shots.ts` for the item's kind:
   - **Clothes:** front, then back, flat inside the four markers, shot straight down.
   - **Footwear and belts:** see [Footwear and accessories](footwear-accessories.md).

   For a marker shot, the client detects the markers, solves the homography (see [Rig and scale](rig-and-scale.md)) and reads the grey patch.
   Each upload creates a `photo` and a `cutout` job.
3. **Close-ups (optional):** pick a kind (care label, fabric, print, hardware, other), shoot, repeat.
   They are taken off the markers, with no cutout and no measuring, as detail references.
4. **Add to closet** or **Measure now.**
   Every required shot is the gate.
   The item is in the closet immediately, cutouts carry on in the background, and the closet prompts "N to measure".

## Tech

`js-aruco2` in the browser, multipart upload to route handlers, a cutout job per required shot.

## Key files

- `src/components/capture-screen.tsx` - the flow
- `src/components/garment-form.tsx` - details step
- `src/lib/capture-shots.ts` - shots per kind: views, order, markers needed, the cover
- `src/lib/capture.ts` - parses an upload's calibration and fields on the server
- `src/lib/search/brands.ts`, `src/lib/search/starter-brands.ts` - brand suggestions
- `src/components/unfinished-captures.tsx` - the Unfinished list

## Decisions and gotchas

- Reshooting a face replaces it and its measurements.
- A capture missing a shot stays under Unfinished until finished or discarded; one with every shot but never added offers Add.
- Adding never waits on cutouts or measuring: a cutout should not hold up adding.
- An item's category can change only within its kind, since its photographs depend on the kind.

## Related

- [Rig and scale](rig-and-scale.md)
- [Cutout](cutout.md)
- [Measure](measure.md)
- [Footwear and accessories](footwear-accessories.md)
