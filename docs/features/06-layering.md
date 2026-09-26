# Layering

Not built yet, though the schema is in place (`layer_slot`, `layer_index`).

**The validator** is a pure function that runs before any outfit is shown. It
asks whether the outer layer physically clears the inner one, comparing outer
chest and sleeve ease with the inner garment's widths. The output is
`wearable`, `tight` or `won't close`, naming the binding point.

Only this app can do that, because only it stores the measurements.

**Outfit images** compose standard garment images in layer order (see
`09-outfits.md`). Never chain try-on passes: whole-outfit generation handles
layering far better than garments applied one at a time.
