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
# PyTorch's default Linux wheel carries the whole CUDA stack, several GB of
# libraries that do nothing in a container with no NVIDIA GPU, which is every
# container on a Mac. Take the CPU build first so the extras find it already
# satisfied. On a box with a GPU, build with TORCH_INDEX set to a CUDA index.
ARG TORCH_INDEX="https://download.pytorch.org/whl/cpu"
RUN case "$EXTRAS" in *local*) \
      pip install --no-cache-dir torch torchvision --index-url "$TORCH_INDEX" ;; \
    esac \
 && pip install --no-cache-dir -e ".${EXTRAS}"

EXPOSE 8000
CMD ["python", "-m", "worker.main"]
