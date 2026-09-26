# OOTD (the home screen)

Not built yet. One outfit for today, full bleed, with the reasons beside it.

## Inputs

- The forecast from `WEATHER_PROVIDER` (Open-Meteo), cached for about an hour.
- Each garment's `clo`, `windproof` and `waterproof`.
- The layer validator and the colour score.
- Recency: recently added garments get a nudge.
- The wear log: nothing worn in the last few days, and overused pieces
  weighted down.

## Solve

Search garment sets whose summed clo puts the `pythermalcomfort` PMV near
neutral for the forecast. Rain makes a waterproof outer layer mandatory. Rank
by colour score, recency and rotation, show the best as a flat-lay, and swipe
for the next.

**clo seeds:** tee 0.08, shorts 0.08, dress shirt 0.25, flannel 0.34, thin
sweater 0.25, thick sweater 0.36, thin trousers 0.15, thick trousers 0.24,
thin jacket 0.36, thick jacket 0.44. The ordering between Henry's own
garments matters more than the absolute values.

## Feedback

Tagging a day in the wear log replaces the suggestion with what was actually
worn. A one-tap `too cold`, `right` or `too warm` vote calibrates a personal
offset.
