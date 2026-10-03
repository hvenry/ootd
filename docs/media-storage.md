# Media storage

Photos and every image derived from them live as files under `./storage`, served by the app with immutable caching.

## Why

Originals are the only irreplaceable data besides the database.
Everything derived from them (cutouts, tiles) must be regenerable and cacheable forever.

## How it works

- `originals/` is written once at upload and never modified.
- `cutouts/<owner>/<photo>[-<run>].png` keeps the photo's full frame, because the measurement pins live in it.
- Beside each cutout, the worker writes two WebP pictures for looking at, never as model input:
  - `_tile3.webp`, a 3:4 closet tile at a shared scale per group (1.2 px/mm).
  - `_large1.webp`, the garment alone at the photo's resolution, capped at 3000 px, for the item page.
- `src/app/api/media/[...path]` serves files with `Cache-Control: immutable`.
- `python -m worker.retile` redraws every tile and large picture from the cutouts and rewrites the bounds.

## Tech

Pillow and numpy in the worker; a Node route handler on the app.
`next/image` is not used, because sharp balloons memory on glibc.

## Key files

- `src/lib/storage.ts` - `STORAGE_ROOT`, path safety, `tilePathFor`, `largePathFor`
- `worker/worker/main.py` - `TILE_SUFFIX`, `LARGE_SUFFIX`, tile canvases per group
- `worker/worker/retile.py` - bulk redraw
- `src/app/api/media/[...path]/route.ts` - serving

## Decisions and gotchas

- Media is immutable, so a changed file needs a new path.
  A re-cut writes a new `-<run>` file and deletes the old one only after the new one lands.
  A change to how tiles are drawn means bumping `TILE_SUFFIX` or `LARGE_SUFFIX` and `tilePathFor` or `largePathFor` together.
- Tile canvases: tops 1300 x 1733 mm, bottoms 1000 x 1333 mm, shoes 300 x 400 mm, belts 700 x 933 mm.
  A garment larger than its canvas is shrunk and logged.
- The app and worker containers both run as UID 1000 and share `./storage`.
  On Linux that ownership is enforced; build with `--build-arg UID=$(id -u)` if `storage/` belongs to someone else.

## Related

- [Architecture](architecture.md)
- [Cutout](cutout.md)
- [Setup](setup.md)
