# Fit

**Status:** draft

A one-line fit read for each garment against Henry's body, computed from stored millimetres and shown beside any image.

## Goal

This is the differentiator: fit is arithmetic, never read from an image.
It worked when a garment Henry already has opinions about gets the bucket he would give it.

## Scope

- In: ease per point, buckets, "fits like" comparisons, the fit line.
- Out: body entry ([custom mannequin](custom-mannequin.md)), brand charts.

## Design

- **Ease** is garment minus body, point by point, using the latest `body_measurement` per key.
- **Circumference points:** for wovens, circumference is about `value_mm × (is_doubled ? 1 : 2)`. For knits flat width does not map to worn girth, so tolerance widens with `stretch`.
- **Linear points** (shoulder, sleeve, inseam, rise) are a direct difference.
- **Buckets:** `snug`, `regular` or `loose` per point.
- **Fits like:** deltas against a reference garment ("2 cm slimmer in the chest than your favourite oxford"). Computed, never stored.
- **UI:** one line, `fit: chest regular · shoulder snug`, no colour coding.

## Tasks

- [ ] Ease calculation in a pure module, with unit tests
- [ ] Bucket thresholds, calibrated on known garments
- [ ] Fits-like against a chosen reference garment
- [ ] Fit line on the item page

## Done when

- [ ] Every measured garment shows a fit line once body readings exist
- [ ] Calibration garments land in the expected buckets
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Open questions

- Knit tolerance per `stretch` value. Default: widen by a fixed share until calibrated.

## Related

- [Measure](../measure.md)
- [Custom mannequin](custom-mannequin.md)
