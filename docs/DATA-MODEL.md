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
- **Cover, denormalised for the grid:** `photo_id` and `cutout_path`. The
  front, or a shoe's outer side.
- **For later:** `fabric`, `stretch`, `clo`, `windproof`, `waterproof`,
  `layer_slot`, `layer_index`.

`completed_at` means the garment was added to the closet, which happens once
every shot its kind needs is taken (`lib/capture-shots.ts`). Null means a face is missing or Add was never
pressed, and the closet lists those as Unfinished. "To measure" means
completed with no measurement rows.

### photo
`view` is `front`, `back` or `detail` for clothes and belts, and `top`,
`outer`, `inner`, `toe` and `heel` for footwear. Each non-detail view is
unique per garment (a partial unique index). `front`, `back` and `top` are
shot on markers and must carry a `homography` (a check constraint): the
matrix, px/mm, the marker quad, and `source` (`sheet` for the rig, `a3` for
the shoe sheet). The shoe's other views have none. A detail has none either,
and has a `detail_kind`: `label`, `fabric`, `print`, `hardware` or `other`.

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

### rig
One row per owner: the marker rig as built, saved from Settings. Four sides
and the ID 0 to ID 2 diagonal in integer millimetres, an optional second
diagonal that only checks the others, and the printed black square (null for
a perfect print), and the A3 shoe sheet's black square likewise. Capture
solves each new photo's homography from it, and the
photo stores that homography, so editing the rig never moves an existing
measurement. With no row, the `NEXT_PUBLIC_SHEET_*` environment is used.

## Planned

| Table or column | Purpose |
|---|---|
| `photo.standard_path`, `standard_status`, `standard_model`, `standard_plate` | The standard image per face, what made it, and which plate version it was rendered on |
| `mannequin` | Plate versions: front and back image paths, mm per pixel, landmarks in mm, and the body readings it was built from |
| `outfit` | `garment_ids[]` in layer order, `image_path`, `source` (`picked`, `idea`, `daily`), colour score components |
| `wear_log` | `worn_on`, `garment_ids[]`, optional `outfit_id`, `comfort_vote`; unique per owner and day |
| `body_measurement` | Append-only readings. Natural and trouser waist stay separate |
| `garment_colour` | OKLCH clusters with fractions, one of them representative |
| `garment.size_label`, `size_system` | Labelled size and its system (US, UK, EU) for footwear and hats, never converted between systems |

Bake-off results are files under `storage/bakeoff/`, not database rows.
