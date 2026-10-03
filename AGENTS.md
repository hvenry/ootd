# OOTD

A wardrobe app for hvenry's closet: every garment is photographed on a marker rig, cut out, and measured to the millimetre.
Other wardrobe apps catalogue clothes; this one stores a number you can subtract, so fit is arithmetic instead of a guess.
The working name lives in `src/config/brand.ts`.
Stack: Next.js App Router, TypeScript, Tailwind, pnpm, Postgres with Drizzle, a Python FastAPI worker (BiRefNet), Docker Compose.

## Commands
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build  # whole stack on the homelab (CUDA)
docker compose up -d --build      # whole stack without an NVIDIA GPU
docker compose up -d db           # Postgres only (host port 5433), for pnpm dev
pnpm dev                          # Next dev server with hot reload
pnpm build                        # production build
pnpm typecheck                    # tsc, no emit
pnpm lint                         # eslint
pnpm db:generate                  # SQL migration from src/db/schema.ts into src/db/migrations/
pnpm db:migrate                   # apply migrations (the app container does this on start)
pnpm db:studio                    # browse the database
pnpm worker                       # worker natively; needs worker/.venv with `pip install -e 'worker[local]'`
```
No test suite yet, a known gap: [docs/specs/test-suite.md](docs/specs/test-suite.md) adds Vitest and the single-test command.
Until then, run `pnpm typecheck && pnpm lint` and drive the real app.

## Repo map
```
src/app/              routes; api/ is the only backend
src/components/       hand-written UI components
src/lib/units/        mm <-> display units
src/lib/homography/   ArUco detection, homography solve, printable sheets
src/lib/measure/      pin templates, mask seeding
src/lib/providers/    swappable vendors, chosen by env var
src/db/               schema.ts and generated migrations/
worker/worker/        Python job poller, cutout providers, retile
docs/                 what is built; docs/specs/ is what is planned
```

## Conventions
- **Lengths are integer mm in the database; display units resolve only in `src/lib/units/`.** Mixed units or floats give plausible, silently wrong fit arithmetic.
- **Every measurement row carries `is_doubled` and `convention`.** Brands disagree on both; without them every brand-chart comparison is wrong.
- **Every table has `owner_id`.** Single user today; adding it later means migrating every row.
- **Never use a non-commercially licensed model** (`docs/model-licensing.md`). The repo is MIT and may become a paid service.
- **Images never carry the fit claim.** Fit is computed from stored mm; a generated image is illustration and is re-measured, never trusted.
- **Server Components by default; `"use client"` only for interaction.** Less JavaScript ships to the phone doing the capture.
- **No component library.** The design system's rules (square, monochrome, no shadows) fight every library's defaults.
- **Never hard-code the app name;** read `src/config/brand.ts`. It is a working name.
- **Long-running work is a job row, never a blocking request.** A CPU cutout takes about 35 s; a request that waits times out on the phone.
- **Vendors sit behind `src/lib/providers/` or `worker/worker/providers/`.** Swapping a vendor stays a config change.
- **Comments explain why, never what.** The what is in the code.

## Docs
- Capture and measuring:
  - Before changing the add flow or shot lists, read `docs/capture.md` (and `docs/footwear-accessories.md` for shoes and belts).
  - Before changing markers, the rig or anything measured in mm, read `docs/rig-and-scale.md`.
  - Before changing cutout providers or masks, read `docs/cutout.md`.
  - Before changing pins, templates or the measure screen, read `docs/measure.md`.
- Platform:
  - Before adding a job kind or changing the worker loop or activity UI, read `docs/job-queue.md`.
  - Before changing media paths, tiles or file serving, read `docs/media-storage.md`.
  - Before changing the schema, read `docs/data-model.md`.
  - Before touching services, compose or request flows, read `docs/architecture.md`.
  - Before running or deploying, read `docs/setup.md`.
- Before any UI work, read `docs/design-system.md` (binding).
- Before proposing a model, weight or dataset, read `docs/model-licensing.md`.

## Planned
Build order: `docs/specs/roadmap.md`.
- Before implementing colour extraction or scoring, read `docs/specs/colour.md`.
- Before implementing body measurements or the v2 plate, read `docs/specs/custom-mannequin.md`.
- Before implementing the daily outfit or weather, read `docs/specs/daily-outfit.md`.
- Before implementing fit, read `docs/specs/fit.md`.
- Before implementing the layer validator, read `docs/specs/layering.md`.
- Before implementing outfits or the ideas gallery, read `docs/specs/outfits.md`.
- Before implementing shoe or belt measuring, read `docs/specs/shoe-belt-measure.md`.
- Before implementing standard images, the polished grid or the raw view, read `docs/specs/standardize.md`.
- Before running the model bake-off, read `docs/specs/standardize-bakeoff.md`.
- Before implementing the test suite, read `docs/specs/test-suite.md`.
- Before implementing the wear log, read `docs/specs/wear-log.md`.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
