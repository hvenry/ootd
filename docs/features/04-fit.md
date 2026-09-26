# Fit (ease)

Not built yet. This is the differentiator: fit is arithmetic shown beside any
image, and never read from one.

- **Ease** is garment minus body, point by point.
- **Circumference points:** for wovens, garment circumference is about
  `value_mm × (is_doubled ? 1 : 2)`. For knits the flat width does not map to
  worn girth, so the tolerance widens with `stretch`.
- **Linear points** (shoulder, sleeve, inseam, rise) are a direct difference.
- **Buckets:** `snug`, `regular` or `loose` per point, calibrated on garments
  Henry already has opinions about.
- **Fits like:** deltas against a reference garment, such as "2 cm slimmer in
  the chest than your favourite oxford". Computed, never stored.
- **Body data** comes from `body_measurement`, taken with a tape, using the
  latest reading per key.
- **UI:** one line, `fit: chest regular · shoulder snug`, with no colour coding.
