# Outfits

**Status:** draft

Pick garments and see them worn together on the mannequin, plus a gallery of generated outfit ideas.

## Goal

See an outfit before wearing it.
It worked when a picked outfit renders on the plate in one pass, in layer order, with fit and warmth lines beside it.

## Scope

- In: picked outfits, the ideas gallery, the `outfit` table.
- Out: try-on on Henry's own photo (a later experiment, with FLUX VTO, Pruna or FASHN).

## Design

- **Picked:** select garments, run the [layer validator](layering.md), and generate the plate wearing them all, using the standard images as references, base to outer, with shoes and belt.
  The pieces already share the plate's body and scale, which makes one pass reliable.
  Until it lands, the pieces' standard tiles show side by side.
- **Ideas:** a background job builds outfits from the wardrobe using the colour score, layering and weather ranges, regenerating as garments are added.
- **`outfit`:** `garment_ids[]` in layer order, `image_path`, `source` (`picked`, `idea`, `daily`), colour score components.
- Never chain try-on passes: whole-outfit generation handles layering far better.
- Fit and warmth come from the numbers, beside the image. Every image is cached by a hash of its inputs.

## Tasks

- [ ] `outfit` table
- [ ] Picker and side-by-side preview
- [ ] `outfit` job kind: plate wearing every piece
- [ ] Ideas job and gallery

## Done when

- [ ] A picked outfit renders on the plate and is saved
- [ ] The ideas gallery fills from the wardrobe
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Related

- [Standardise](standardize.md)
- [Layering](layering.md)
- [Colour](colour.md)
