# OOTD

A self-hosted wardrobe app where every garment is photographed on a marker rig, cut out, and measured to the millimetre.

<!-- TODO: screenshot of the closet grid and the measure screen -->

## Features

* Capture garments with a grid and automatically have measurments, cutouts and a beautiful view of your items.
* OOTD stores a number you can subtract: each photo is solved through ArUco markers into a homography, so pins placed on a garment become integer millimetres.
- Fit is arithmetic against your body and brand charts instead of a guess.

## Quick start

```bash
cp .env.example .env
docker compose up -d --build      # app on http://localhost:3000, no GPU needed
```

On a box with an NVIDIA GPU, add `-f docker-compose.yml -f docker-compose.gpu.yml` for CUDA cutouts.
Enter your rig's marker spans in Settings before the first capture.
Full setup, dev mode and backups: [docs/setup.md](docs/setup.md).

## Docs

- [Architecture](docs/architecture.md) - the app, Postgres and the Python worker, and how they share work
- [Capture](docs/capture.md) - the add flow and shot lists
- [Rig and scale](docs/rig-and-scale.md) - how a phone photo becomes millimetres
- [Measure](docs/measure.md) - pins, templates and the measure screen
- [Model licensing](docs/model-licensing.md) - why only commercially licensed models are used
- [Roadmap](docs/specs/roadmap.md) - planned work in build order

## Status

Active, single user, run on a homelab over the LAN or Tailscale.
Capture, cutout and measuring for clothes work; fit, outfits and the wear log are planned.
