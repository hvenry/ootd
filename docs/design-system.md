# Design system

The binding UI rules: monochrome tokens, square corners, hand-written components.

## Why

The garments are the only colour on screen, and the numbers are the product.
A consistent, quiet system keeps both legible, and no component library means no foreign defaults creep in.

## How it works

### Tokens

Defined in `src/app/globals.css`; never hard-code a value.

```
--bg #FFF   --fg #000   --fg2 #000   --fg3 #8C8C8C   --rule #EBEBEB
--danger #C0271B   outline and text only, only on Remove from closet
--gutter 12px / 20px (md)       --header-h 62px / 64px (lg)
--main-pb 6rem   --screen-gap 1.5rem   --sheet-duration 300ms   --strip-duration 180ms
--item-aside-top 38vh   --measure-photo-h 60dvh
```

No dark mode, no accent, no semantic green.
The two exceptions to "tokens only" are the printable sheet (ink and paper) and the declared colour swatches, which are the clothes.

### Type

- **Inter** 400 and 500 for all UI; **Newsreader** serif for editorial moments only; **IBM Plex Mono** with tabular numerals for every number and ID.
- Scale: 10, 11, 12, 15, 19, 24px, then display (64px). Body text is 13px.
- Text fields are 16px on touch screens, because iOS zooms into anything smaller.
- `.label` is 12px uppercase with no tracking; the desktop header and closet filter columns set it at 11px.
- `.wordmark` (26px, 600) is the one bold element.

### Layout

- One gutter from every viewport edge, and no rule under the header.
- Content widths are capped per screen and centred.
- The closet grid is 2, 3 or 4 up, every tile the same 3:4 box.
- Under each garment: `BRAND` as a label, the name, then `014` in mono.

### Rules

- **Radius 0** everywhere except `.colour-dot`.
- **No shadows, cards, fills, gradients or shimmer.** Images sit unframed.
- Borders are 1px `--rule`; `.rule-top` tops sections and lists.
- Only `.chip`, `.split-bar`, toasts, outlined buttons and the Settings rig form are boxed.
- One `.btn-primary` per screen (black, white uppercase, grey outline when disabled), except Settings.
  `.btn-secondary` is the same button unfilled, for the move that undoes it.
- `.action-row` pairs the filled button with its dismissal: 50/50, capped at 24rem.
- `.link-text` underlines on hover; `.tab` keeps the underline when chosen. Never add `underline-offset-*`.
- Motion is opacity and position only, 120 to 200 ms, no bounce or scale; the sheet is the one long move. Respect reduced motion.
- Hover styles that could stick on touch go under `(hover: hover)`.

### Components

- **Header:** fixed, no bar on desktop. Below `lg`: menu and search icons, wordmark, "N processing", Add.
- **To measure:** one ruled line atop the grid with a count and a compact Start; each unmeasured tile carries an outlined To measure.
- **Sheet:** full-screen panel from the left; "Close" on the menu, "Cancel" where a choice is being made.
- **Toast:** top right under the header, hairline box, gone after 4 s (8 s for errors).
- **Progress:** a 2px `--fg` bar on a `--rule` track, stopping at 95%.
- **Measure:** photo cropped to the garment, up to 60dvh on a phone; the loupe and locator replace the reading while a pin is held. In the queue, a status line shows `3 / 12` and a progress bar.
- **Diagram:** hairline strokes, mono figures; the viewBox grows to fit, and selection inverts a figure.

## Tech

Tailwind with tokens mapped in `@theme`; Phosphor icons. No component library.

## Key files

- `src/app/globals.css` - tokens and shared classes
- `src/components/` - every component, hand-written
- `src/config/brand.ts` - the app name; never hard-code it

## Decisions and gotchas

Never: rounded corners, shadows, cards, fills, gradients, coloured buttons, icon-only navigation on desktop, emoji, proportional numerals in data, an accent colour, a raw hex outside the two exceptions, or a component library.

## Related

- [Measure](measure.md)
