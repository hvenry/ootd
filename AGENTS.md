# OOTD

A wardrobe app for hvenry's closet. Every garment is photographed front
and back on a marker rig, cut out, and **measured to the millimetre**.

The measurements make fit arithmetic instead of a guess. The photos feed a
hosted image model that produces one clean, standardised catalogue image per
face. Those images build outfits, a gallery of outfit ideas, and a daily
outfit chosen against the real forecast, with a wear calendar closing the loop.

**Thesis:** other wardrobe apps catalogue clothes, but none store a number you
can subtract. This one does, and everything else follows.

Working name is OOTD. It lives in `src/config/brand.ts`: never hard-code it.

## Read before writing code

- `docs/IMPLEMENTATION-PLAN.md`: what is done and what is next, in order
- `docs/ARCHITECTURE.md`: services, the job queue, request flows
- `docs/DATA-MODEL.md`: schema intent and the fields that prevent silent bugs
- `docs/DESIGN-SYSTEM.md`: UI rules, **binding**
- `docs/DECISIONS.md`: what was chosen, what is forbidden, and why
- `docs/features/*.md`: one short spec per feature
- `docs/SETUP.md`: running it on the Mac and on the homelab

## Non-negotiables

1. **Lengths are integer millimetres in the database.** Display units resolve
   at render time, and only in `src/lib/units/`.
2. **Every measurement row carries `is_doubled` and `convention`.** Brands
   disagree on both, and without them every brand-chart comparison is
   silently wrong.
3. **Every table has `owner_id`.** Single user today, multi-tenant later.
4. **Never use a non-commercially licensed model.** The forbidden list is in
   `docs/DECISIONS.md`. The repo is MIT and may become a paid service.
5. **Images never carry the fit claim.** Fit comes from the numbers and is
   shown beside the image. A generated image is re-measured against the
   garment's stored measurements, never trusted on its own.
6. **No component library** (shadcn/ui, DaisyUI, MUI). Write the components.

## Stack

| Layer      | Choice                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| App        | Next.js 16 App Router, TypeScript, Tailwind (tokens only), pnpm              |
| DB         | PostgreSQL 17, Drizzle `0.45.2`                                              |
| Queue      | Postgres `job` table with `FOR UPDATE SKIP LOCKED`. No Redis                 |
| Worker     | Python, FastAPI. Cutouts with BiRefNet (CUDA on the homelab, CPU on a Mac)   |
| Generation | Hosted models through fal.ai, behind a provider interface                    |
| Run        | Docker Compose: `db`, `migrate`, `app`, `worker`                             |
| Later      | Better Auth (passkeys) and Zero sync, only if it serves more than one person |

## Commands

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build  # homelab
docker compose up -d --build   # a machine without an NVIDIA GPU
docker compose up -d db        # postgres only, for `pnpm dev`
pnpm dev | build | lint | typecheck
pnpm db:generate | db:migrate | db:studio
```

Run `pnpm typecheck && pnpm lint` before calling a task done. After code
changes, rebuild so the running containers match the code.

## Layout

```
src/app/               routes; api/ is the only backend
src/components/        hand-written, no library
src/lib/units/         mm <-> display. The ONLY place this happens
src/lib/homography/    ArUco detection and perspective solve (classical CV)
src/lib/measure/       templates, mask seeding
src/lib/providers/     swappable services, selected by env var
src/db/                schema.ts, migrations/
worker/                Python: job poller, cutout providers
docs/                  plan, architecture, model, design, decisions, features
```

## Conventions

- Server Components by default; `"use client"` only for interaction.
- External services sit behind `src/lib/providers/` or `worker/providers/`,
  chosen by env var. Never call a vendor SDK from a component.
- Long-running work is a job row, never a blocking request. The UI follows
  jobs through `ActivityProvider`: toasts, `/status`, progress bars.
- Generated results are cached by content hash and never recomputed.
- Comments explain _why_, never _what_.

## Gotchas

- Apply the homography to **tap coordinates**, never to a re-rendered image.
- The cutout keeps the photo's full frame, because the pins live in it. The
  measure screen crops only the _view_, using `photo.cutout_bounds`.
- Media is served `immutable`, so a new cutout must be a new path.
- Erode the mask about 10px before sampling colour.
- `next/image` is not used: sharp balloons memory on glibc.
- A phone reaches `next dev` over the LAN. `allowedDevOrigins` in
  `next.config.ts` must cover it, or the client bundle silently never runs.
- `NEXT_PUBLIC_*` rig spans are baked in at build time. Rebuild the app image
  after changing them.
- The app and worker containers both run as UID 1000 and share `./storage`.
  On Linux that ownership is enforced.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
