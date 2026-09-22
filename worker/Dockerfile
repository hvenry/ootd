FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY worker ./worker

# Base install only. `local` (BiRefNet) pulls torch, so build with
#   docker compose build --build-arg EXTRAS='[local]' worker
# or leave it out and run CUTOUT_PROVIDER=chroma.
ARG EXTRAS=""
RUN pip install --no-cache-dir -e ".${EXTRAS}"

EXPOSE 8000
CMD ["python", "-m", "worker.main"]
