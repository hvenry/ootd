# Layering

**Status:** draft

A validator that says whether an outer layer physically clears the one beneath it.

## Goal

Only this app can answer it, because only it stores the measurements.
It worked when every outfit shown is checked first, and an impossible combination is labelled with its binding point.

## Scope

- In: the validator, using `layer_slot` and `layer_index` (already in the schema).
- Out: outfit images ([outfits](outfits.md)).

## Design

A pure function run before any outfit is shown.
It compares outer chest and sleeve ease with the inner garment's widths and returns `wearable`, `tight` or `won't close`, naming the binding point.

## Tasks

- [ ] Assign `layer_slot` and `layer_index` per category
- [ ] Validator with unit tests

## Done when

- [ ] Outfits and ideas call the validator before display
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Related

- [Outfits](outfits.md)
- [Fit](fit.md)
