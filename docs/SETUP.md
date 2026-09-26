# Setup

## The homelab (primary)

The homelab runs the live closet. It needs Docker, the NVIDIA driver (525 or
newer) and `nvidia-container-toolkit`.

```bash
git clone <repo> ootd && cd ootd
cp .env.example .env     # set the rig spans, and FAL_KEY for generation
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

Open `http://<homelab-ip>:3000` on the phone. On the first cut the worker log
says `model ready on cuda`, and `/status` shows each cut's duration.

- **Rig spans:** measure the four sides and a diagonal, centre to centre, into
  `.env`. They are baked into the app at build time, so rebuild after changing
  them. A "Rig check" warning on the capture screen means a span is wrong.
- **File ownership:** the app and worker both run as UID 1000 and share
  `./storage`. If the owner of `storage/` is another user, build with
  `--build-arg UID=$(id -u) --build-arg GID=$(id -g)`.
- **Postgres** is on host port 5433.
- **BiRefNet weights** (about 3.5 GB) download on the first cut into the
  `hfcache` volume.
- **Away from home:** Tailscale on the homelab and the phone makes the same
  address work anywhere, without opening a port.

## Keys

| Variable | For | Where |
|---|---|---|
| `FAL_KEY` | Standardisation bake-off, then generation | fal.ai dashboard, Keys. Prepay about $25 |

Keys go in `.env` only. `.env` is gitignored and must never be committed.

## Developing

On any machine, the whole stack without a GPU:

```bash
docker compose up -d --build
```

For hot reload, run Postgres and the worker in Docker and the app natively:

```bash
docker compose stop app
docker compose up -d db worker
pnpm install && pnpm dev
```

A development machine has its own data. Do not point two stacks at separately
growing databases and try to merge them later: Postgres cannot reconcile them.

## Backups

The data is the `pgdata` volume plus `./storage`.

```bash
D=~/ootd-backup-$(date +%F-%H%M); mkdir -p "$D"
docker compose exec -T db pg_dump -U ootd -d ootd -Fc > "$D/ootd.dump"
cp -R storage "$D/storage"
```

To restore, run `pg_restore -U ootd -d ootd --no-owner --clean --if-exists`
from the dump and copy `storage` back. If data looks missing, check `docker
context show` first: another Docker runtime, such as Colima instead of Docker
Desktop, has its own volumes.
