# Colour

**Status:** draft

Each garment's real colours extracted from its cutout, and a colour score for combinations of garments.

## Goal

`declared_colour` (the owner's word) covers filtering today but cannot rank outfits.
It worked when outfit ideas and the daily outfit rank by a score Henry agrees with.

## Scope

- In: extraction in the worker, `garment_colour`, the score components.
- Out: learning Henry's taste (later, from the wear log).

## Design

### Extraction

Runs in the worker on the cutout.
1. Keep alpha above 0.9, and erode about 10 px.
2. White-balance from the grey patch.
3. Drop the top and bottom 5% by lightness.
4. Cluster in OKLab (k-means, k of 3 to 5). Store every cluster with its fraction in `garment_colour`, the largest as representative.

### Score

Stored as components, never a bare total. Lightness predicts compatibility and hue templates do not (O'Donovan 2011, and a 2025 clothing study agreed).
- `valueContrast`, penalising |ΔL| below 0.06: the navy-and-black near miss.
- `nearMiss`, `chromaBudget`, `hueCount`.
- `hueRelation`, only as a tiebreaker.
- `neutralBonus` and `patternTie`.
- Each garment weighted by its surface area.

## Tasks

- [ ] `garment_colour` table
- [ ] `colour` job kind in the worker
- [ ] Score components as a pure function
- [ ] Backfill the closet

## Done when

- [ ] Every garment has clusters and a representative colour
- [ ] The score returns components for any garment set
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Open questions

- Learning taste: once the wear log has about 150 rows, fit a logistic regression on the same components.

## Related

- [Cutout](../cutout.md)
- [Outfits](outfits.md)
- [Daily outfit](daily-outfit.md)
