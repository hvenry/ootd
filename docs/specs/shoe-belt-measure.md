# Shoe and belt measuring

**Status:** draft

Measuring templates for shoes and belts, so they join the measure queue like clothes.

## Goal

Shoes and belts are captured (see [footwear and accessories](../footwear-accessories.md)) but have no templates, so they stay out of the queue and offer no Measure.
It worked when both can be measured from the item page and the queue.

## Scope

- In: shoe and belt templates, the pin line, `size_label` and `size_system`.
- Out: hats, which are sized, not measured.

## Design

### Shoes

The homography is exact only on the paper and a shoe stands above it, so the top-down shot is good for drawing, not for fit.
- From the top-down shot: outsole length and width.
- Boots: shaft height, with a tape.
- Always: the labelled size and its system (US, UK, EU), from a close-up of the tongue label, never converted between systems. An insole length by tape is optional.

### Belts

The belt lies in a U on the rig, flat on the paper plane, where it measures to the millimetre.
- Measured: buckle to the hole in use, hole spacing, width.
- Buckle to hole follows the curve, so the measure screen gains a **pin line**: a chain of pins whose segments add up.

### Schema

`garment.size_label` and `size_system`.

## Tasks

- [ ] `size_label`, `size_system` columns and their entry
- [ ] Shoe template on the top-down shot
- [ ] Pin line in the measure screen
- [ ] Belt template
- [ ] Include shoes and belts in the queue and item page

## Done when

- [ ] A shoe and a belt can each be measured and saved
- [ ] `docs/measure.md` and `docs/footwear-accessories.md` updated; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Related

- [Measure](../measure.md)
- [Footwear and accessories](../footwear-accessories.md)
