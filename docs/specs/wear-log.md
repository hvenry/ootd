# Wear log

**Status:** draft

A calendar where each day is tagged with what was worn.

## Goal

Close the loop: the log feeds the daily outfit, the colour score and analytics.
It worked when tagging a day takes a few taps and the analytics read from it.

## Scope

- In: the calendar, `wear_log`, comfort vote, analytics.
- Out: a generated preview of the day's outfit (later).

## Design

- Tap a day, then tap the garments worn.
- `wear_log`: `worn_on`, `garment_ids[]`, optional `outfit_id`, `comfort_vote`; unique per owner and day.
- Tagging today replaces the daily suggestion.
- Optional comfort vote: `too cold`, `right` or `too warm`.
- **Analytics:** most and least worn, days since last worn, overused combinations, cost per wear once prices are recorded, colour spread worn against owned.

## Tasks

- [ ] `wear_log` table
- [ ] Calendar and tagging
- [ ] Analytics page

## Done when

- [ ] A day can be tagged and edited
- [ ] Analytics render from the log
- [ ] Docs written for what was built; this spec deleted and removed from `roadmap.md` and `AGENTS.md`

## Related

- [Daily outfit](daily-outfit.md)
- [Colour](colour.md)
