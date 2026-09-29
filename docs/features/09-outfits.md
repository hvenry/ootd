# Outfits

Comes after standardisation. Outfits are worn on the same mannequin plate as
the standard images (`08-standardize.md`), with try-on on Henry's photo as a
later experiment. An outfit image needs footwear, so it waits on
`11-footwear-accessories.md`.

## Picked outfits

Select garments from the closet, run them through the layer validator
(`06-layering.md`), and generate the plate wearing them all: the standard
images as references, in layer order, from base to outer, with shoes and belt.
The pieces already share the plate's body and scale, which is what makes one
pass reliable.

Until it lands, the outfit shows its pieces' standard tiles side by side,
which is free and instant.

## Ideas

A background job builds a gallery of outfit ideas from the wardrobe using the
colour score, layering and weather ranges. It regenerates as garments are
added, and each idea saves as an `outfit` with `source = idea`.

## Rules

- Fit and warmth lines come from the numbers and sit beside the image.
- Every generated image is cached by a hash of its inputs.
- Try-on models (FLUX VTO, Pruna, FASHN) belong to the later experiment on
  Henry's photo.
