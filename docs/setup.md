# Setup

Running the stack on the homelab, on a dev machine, and backing it up.

## Why

The homelab holds the live closet; a dev machine has its own data.
Postgres cannot reconcile two separately growing databases, so never plan to merge them later.

## How it works

### Homelab (primary)

Needs Docker, the NVIDIA driver (525 or newer) and `nvidia-container-toolkit`.

```bash
cp .env.example .env     # the rig goes in Settings
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

Open `http://<homelab-ip>:3000` on the phone.
On the first cut the worker logs `model ready on cuda`, and `/status` shows each cut's duration.
Tailscale on the homelab and phone makes the same address work away from home.

### Developing

Whole stack without a GPU: `docker compose up -d --build`.
For hot reload, run Postgres and the worker in Docker and the app natively:

```bash
docker compose stop app
docker compose up -d db worker
pnpm install && pnpm dev
```

### Backups

The data is the `pgdata` volume plus `./storage`.

```bash
D=~/ootd-backup-$(date +%F-%H%M); mkdir -p "$D"
docker compose exec -T db pg_dump -U ootd -d ootd -Fc > "$D/ootd.dump"
cp -R storage "$D/storage"
```

Restore with `pg_restore -U ootd -d ootd --no-owner --clean --if-exists` and copy `storage` back.

## Tech

Docker Compose, Postgres, the NVIDIA container toolkit, optionally Tailscale.

## Key files

- `.env.example` - `CUTOUT_PROVIDER`, `NEXT_PUBLIC_SHEET_*` fallback spans
- `docker-compose.yml`, `docker-compose.gpu.yml` - services and the CUDA overlay

## Decisions and gotchas

- **Rig spans:** measure the four sides and a diagonal centre to centre and enter them in Settings; they apply from the next photo, no rebuild.
  A "Rig check" warning on capture means a span is wrong.
- **Keys** go in `.env` only, which is gitignored.
- **Postgres** is on host port 5433.
- **BiRefNet weights** (about 425 MB) download on the first cut into the `hfcache` volume.
- **File ownership:** see [Media storage](media-storage.md).
- **Missing data:** check `docker context show` first; another runtime (Colima vs Docker Desktop) has its own volumes.
- **Phone on `next dev`:** `allowedDevOrigins` in `next.config.ts` must cover its origin, or the client bundle silently never runs.

## Related

- [Architecture](architecture.md)
- [Media storage](media-storage.md)
