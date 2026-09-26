# Outfits

Comes after standardisation. Flat-lay catalogue images first, with try-on on
Henry's photo as a later experiment.

## Picked outfits

Select garments from the closet, run them through the layer validator
(`06-layering.md`), and show a flat-lay of their standard images arranged by
layer slot on the white ground.

A deterministic composite is free and instant. A generated editorial flat-lay
is an optional upgrade behind the same `outfit` row.

## Ideas

A background job builds a gallery of outfit ideas from the wardrobe using the
colour score, layering and weather ranges. It regenerates as garments are
added, and each idea saves as an `outfit` with `source = idea`.

## Rules

- Fit and warmth lines come from the numbers and sit beside the image.
- Every generated image is cached by a hash of its inputs.
- Try-on models (FLUX VTO, Pruna, FASHN) belong to the later experiment, not
  to flat-lays.
