# Custom mannequin

**Status:** draft

Body measurements taken with a tape, and a v2 mannequin plate built from them that the closet is re-rendered on.

## Goal

The v1 plate is generic; garments should be shown on Henry's proportions.
The same body readings feed [fit](fit.md).
It worked when the closet regenerates on a v2 plate whose landmarks match the entered measurements.

## Scope

- In: `body_measurement`, a body page, the v2 plate, regenerating the closet.
- Out: the fit calculation itself ([fit](fit.md)).

## Design

- **`body_measurement`:** append-only readings in integer mm; the latest per key wins. Natural and trouser waist stay separate.
- **Body page:** height, shoulder width, torso length, arm length, waist, inseam.
- **Plate:** the readings draw a simple outline, rendered into a new plate, measured, and frozen as a new `mannequin` version.
- **Regeneration:** a new plate re-renders the closet, about $15 at current prices.

A garment shown on Henry's own proportions looks like a fit claim, and images never carry one.
The standard image stays illustrative; fit stays the numbers beside it.

## Tasks

- [ ] `body_measurement` table
- [ ] Body page
- [ ] Outline to plate, measure, freeze as v2
- [ ] Batch regenerate the closet on v2

## Done when

- [ ] Entering readings and building a plate produces a v2 whose landmarks match within tolerance
- [ ] Every standard image names v2 after regeneration
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Related

- [Standardise](standardize.md)
- [Fit](fit.md)
