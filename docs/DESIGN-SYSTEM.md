# Design system

## Tokens

Defined in `globals.css`. Never hard-code a value.

```
--bg #FFF   --fg #000   --fg2 #000   --fg3 #8C8C8C   --rule #EBEBEB
--danger #C0271B   outline and text only, only on Remove from closet
--gutter 12px / 20px (md)       --header-h 62px / 86px (lg)
--main-pb 6rem   --screen-gap 1.5rem   --sheet-duration 300ms
--item-aside-top 38vh   --measure-photo-h 60dvh
```

There is no dark mode, no accent and no semantic green. The two exceptions to
"tokens only" are the printable sheet (ink and paper) and the declared colour
swatches, which are the clothes.

## Type

- **Inter** 400 and 500 for all UI.
- **Newsreader** serif for editorial moments only.
- **IBM Plex Mono** with tabular numerals for every number and ID.

The scale is 10, 11, 12, 15, 19 and 24px, then display, and body text is
13px. Text fields are 16px on touch screens, because iOS zooms into anything
smaller. `.label` is 12px uppercase with no tracking, and `.wordmark` (26px, 600) is the one bold element.

## Layout

- One gutter from every viewport edge, and no rule under the header.
- Content widths are capped per screen and centred.
- The closet grid is 2, 3 or 4 up, and every tile is the same 3:4 box.
- Under each garment: `BRAND` as a label, the name, then `014` in mono.

## Rules

- **Radius 0** everywhere except `.colour-dot`.
- **No shadows, cards, fills, gradients or shimmer.** Images sit unframed.
- Borders are 1px `--rule`, and `.rule-top` tops sections and lists.
- The only boxed things are `.chip`, `.split-bar`, toasts and outlined
  buttons.
- `.btn-primary` is black with white uppercase text, and turns into a grey
  outline when disabled. There is one per screen. `.btn-secondary` is the same
  button unfilled, for the move that undoes it.
- `.action-row` pairs the filled button with its dismissal. On a phone it is
  a 50/50 grid with the second control outlined. From `sm` the button fills
  its column and the text sits beside it.
- `.link-text` lifts to `--fg` and underlines on hover, and `.tab` keeps the
  underline when chosen. Never add `underline-offset-*`.
- Motion is opacity and position only, 120 to 200 ms, with no bounce or scale.
  The sheet is the one long move. Respect reduced motion.
- Hover styles that could stick on touch screens go under `(hover: hover)`.

## Components

- **Header:** fixed, with no bar on desktop. Below `lg` it shows the menu and
  search icons, the wordmark, "N processing" while jobs run, and Add.
- **To measure:** one ruled line above the closet grid with a count and
  Start. Unmeasured tiles add "· to measure" after the id.
- **Sheet:** the full-screen panel from the left. It says "Close" on the menu
  and "Cancel" where a choice is being made.
- **Toast:** top right under the header, in a hairline box. A label, one quiet
  line and an optional link, gone after 4 s (8 s for errors).
- **Progress:** a 2px `--fg` bar on a `--rule` track. It stops at 95%, because
  it is an estimate.
- **Measure:** the photo is cropped to the garment, up to 60dvh on a phone.
  While a pin is held, the loupe and locator replace the reading, never
  covering the photo.
- **Diagram:** hairline strokes and mono figures. The viewBox grows to fit the
  figures instead of clipping them, and selection inverts a figure.

## Never

Rounded corners, shadows, cards, fills, gradients, coloured buttons, icon-only
navigation on desktop, emoji, proportional numerals in data, an accent colour,
a raw hex outside the two exceptions, or a component library.
