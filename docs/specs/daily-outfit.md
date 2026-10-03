# Daily outfit

**Status:** draft

The home screen: one outfit for today, full bleed, with the reasons beside it.

## Goal

Pick what to wear against the real forecast, recency and wear history.
It worked when the suggestion is worn on most days, and comfort votes trend to `right`.

## Scope

- In: weather provider, clo solve, ranking, the home screen, comfort votes.
- Out: the calendar ([wear log](wear-log.md)).

## Design

### Inputs

- The forecast from `WEATHER_PROVIDER` (Open-Meteo; MET Norway as the alternate), cached about an hour.
- Each garment's `clo`, `windproof` and `waterproof`.
- The layer validator and the colour score.
- Recency: recently added garments get a nudge.
- The wear log: nothing worn in the last few days; overused pieces weighted down.

### Solve

Search garment sets whose summed clo puts the `pythermalcomfort` PMV near neutral (ISO 7730).
Rain makes a waterproof outer layer mandatory.
Rank by colour score, recency and rotation; show the best on the mannequin; swipe for the next.

**clo seeds:** tee 0.08, shorts 0.08, dress shirt 0.25, flannel 0.34, thin sweater 0.25, thick sweater 0.36, thin trousers 0.15, thick trousers 0.24, thin jacket 0.36, thick jacket 0.44.
The ordering between Henry's garments matters more than absolute values.

### Feedback

Tagging today in the wear log replaces the suggestion.
A one-tap `too cold`, `right` or `too warm` vote calibrates a personal offset.

### Decisions

Open-Meteo's hosted API is non-commercial; self-host it if this ever sells.

## Tasks

- [ ] Weather provider behind `src/lib/providers/`
- [ ] clo seeding per category
- [ ] Solve and ranking
- [ ] Home screen with swipe
- [ ] Comfort vote and offset

## Done when

- [ ] The home screen shows a ranked outfit for today's forecast
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Related

- [Wear log](wear-log.md)
- [Layering](layering.md)
- [Colour](colour.md)
