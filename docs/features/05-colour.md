# Colour

Not built yet. Until then, `declared_colour` (the owner's word) covers
filtering.

## Extraction

Runs in the worker, on the cutout.

1. Keep alpha above 0.9, and erode about 10 px.
2. White-balance from the grey patch.
3. Drop the top and bottom 5% by lightness.
4. Cluster in OKLab (k-means, k of 3 to 5). Store every cluster with its
   fraction, and mark the largest as representative.

## Score

Stored as components, never as a bare total. Lightness predicts compatibility
and hue templates do not (O'Donovan 2011, and a 2025 clothing study agreed).

- `valueContrast`, penalising |ΔL| below 0.06: the navy-and-black near miss.
- `nearMiss`, `chromaBudget`, `hueCount`.
- `hueRelation`, only as a tiebreaker.
- `neutralBonus` and `patternTie`.
- Each garment is weighted by its surface area.

Once the wear log has about 150 rows, fit a logistic regression on the same
components to learn Henry's taste.
