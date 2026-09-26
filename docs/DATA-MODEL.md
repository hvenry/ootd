# Data model

Postgres, with every length stored as **integer mm** and `owner_id` on every
table. IDs are UUID v7. `src/db/schema.ts` is the source of truth for types,
and this file is the source of truth for intent.

## Built

### garment
One row per physical item, holding the fields below.

- **Identity:** `category` (enum, which drives the measurement template),
  `subcategory`, `brand`, `name`.
- **Declared colour:** `declared_colour`, the owner's own word from
  `lib/colour/declared`.
- **Handle:** `short_id`, per owner, shown as `014`.
- **Front, denormalised for the grid:** `photo_id` and `cutout_path`.
- **For later:** `fabric`, `stretch`, `clo`, `windproof`, `waterproof`,
  `layer_slot`, `layer_index`.

`completed_at` means the garment was added to the closet, which happens once
both faces are photographed. Null means a face is missing or Add was never
pressed, and the closet lists those as Unfinished. "To measure" means
completed with no measurement rows.

### photo
`view` is `front`, `back` or `detail`. Front and back are unique per garment
(a partial unique index) and each carries a `homography`: the matrix, px/mm
and the marker quad. A detail has no homography (a check constraint enforces
it) and has a `detail_kind`: `label`, `fabric`, `print`, `hardware` or `other`.

`original_path` is kept forever. `cutout_path`, `cutout_provider` and
`cutout_bounds` (`{x, y, w, h, imageW, imageH}` in original pixels) describe
the current cut. Reshooting a face replaces it along with its measurements.

### measurement
One row per dimension per garment. `photo_id` is the face the pins were
placed on, which is always the front today.

- **The value:** `key`, `value_mm`.
- **How it was measured:** `is_doubled` and `convention`, recorded from the
  template's guide and never asked.
- **Where it came from:** `source`: `measured`, `brand_spec` or `estimated`.
- **The pins:** coordinates in that photo's metric canvas.

Derived values such as circumference, ease and "fits like" are computed, never
stored.

### job
`kind` (`cutout` today), `payload`, and `status`: `pending`, `running`, `done`
or `failed`. `result` holds `cutoutPath`, `provider` and `seconds`, or an
`error`. `content_hash` is unique per kind, and a job gets three attempts
before it is parked as failed.

## Planned

| Table or column | Purpose |
|---|---|
| `photo.standard_path`, `standard_status`, `standard_model` | The standard catalogue image per face and what made it |
| `outfit` | `garment_ids[]` in layer order, `image_path`, `source` (`picked`, `idea`, `daily`), colour score components |
| `wear_log` | `worn_on`, `garment_ids[]`, optional `outfit_id`, `comfort_vote`; unique per owner and day |
| `body_measurement` | Append-only readings. Natural and trouser waist stay separate |
| `garment_colour` | OKLCH clusters with fractions, one of them representative |
| `shoe`, `hat` | Labelled size and size system, never normalised across systems |

Bake-off results are files under `storage/bakeoff/`, not database rows.
