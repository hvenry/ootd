"""
BiRefNet (MIT) — the default local cutout.

This is *segmentation*: it decides which of the photograph's existing pixels
are garment. It generates nothing. Weights are ~450MB from HuggingFace on the
first job — free, no token, no gate — and a GPU is optional; CPU is slow but
entirely workable for one garment at a time.

Never substitute rembg's default session: that is `bria-rmbg`, which is
CC BY-NC, and this repo is MIT and may host a paid service. See
docs/model-licensing.md for the full forbidden list.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

from .. import config
from .chroma import OVERHANG_X, OVERHANG_Y, _sheet_mask

log = logging.getLogger(__name__)

# Work at this resolution when deciding which pixels are the garment; the
# decision is applied to the full-resolution alpha afterwards.
KEEP_MAX_DIMENSION = 1500
# A second piece is kept only if it is at least this share of the largest
# and centred on the rig: a sleeve cut off by a fold, not a foot.
KEEP_MIN_SHARE = 0.2

MODEL_ID = "ZhengPeng7/BiRefNet"
# Loading runs the repo's own Python (trust_remote_code), so it is pinned to a
# commit rather than whatever `main` is today. Bump deliberately, after
# reading the diff.
MODEL_REVISION = "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4"
INPUT_SIZE = (1024, 1024)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class BiRefNetProvider:
    name = "local"

    def __init__(self) -> None:
        # Loaded on first use, not at import: the worker must start, answer
        # its health check and claim jobs without waiting on 450MB.
        self._model = None
        self._device = None
        self._transform = None
        self._last_used = 0.0

    def _load(self) -> None:
        if self._model is not None:
            return

        try:
            import torch
            from torchvision import transforms
            from transformers import AutoModelForImageSegmentation
        except ImportError as exc:  # pragma: no cover - depends on install extras
            raise RuntimeError(
                "CUTOUT_PROVIDER=local needs the model extras: "
                "`pip install -e '.[local]'`. To start without them, set "
                "CUTOUT_PROVIDER=chroma (no download) or replicate."
            ) from exc

        # No cudnn.benchmark, though the input size is fixed. Measured on a
        # 3070: it made the first cut after a load 28 s and peak at 5.9 GB
        # while trying algorithms, for no gain after (0.86 s either way,
        # 1.7 GB peak without it). On a GPU shared with an LLM that spike is
        # an out-of-memory.
        device = _pick_device(torch)

        log.info("loading %s on %s (first run downloads ~450MB)", MODEL_ID, device)
        model = AutoModelForImageSegmentation.from_pretrained(
            MODEL_ID, revision=MODEL_REVISION, trust_remote_code=True
        )
        # Set the precision outright either way. transformers 5 loads weights
        # in the dtype they were saved in, which for this checkpoint is half,
        # and a half model fed a float tensor fails on the CPU with "Input
        # type (float) and bias type (c10::Half) should be the same".
        if device == "cuda":
            model.half()
        else:
            model.float()
        model.to(device)
        model.eval()

        self._model = model
        self._device = device
        self._transform = transforms.Compose(
            [
                transforms.Resize(INPUT_SIZE),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )
        if device == "cuda":
            log.info(
                "model ready on cuda: %s, torch %s, CUDA %s, %.2f GB allocated",
                torch.cuda.get_device_name(0),
                torch.__version__,
                torch.version.cuda,
                torch.cuda.memory_allocated() / 1e9,
            )
        else:
            log.info("model ready on %s", device)

    def release_if_idle(self) -> None:
        """
        Give the GPU back after MODEL_KEEP_ALIVE_SECONDS without a cut.

        On a GPU shared with an LLM and a transcoder, a model held resident
        for a closet photographed a few times a week is VRAM nobody else can
        use. Reloading from the local cache costs seconds, not the download.
        """
        keep_alive = config.MODEL_KEEP_ALIVE_SECONDS
        if self._model is None or keep_alive <= 0:
            return
        if time.monotonic() - self._last_used < keep_alive:
            return

        import torch

        device = self._device
        self._model = None
        self._device = None
        if device == "cuda":
            torch.cuda.empty_cache()
        log.info("unloaded %s after %ds idle", MODEL_ID, keep_alive)

    def cut(
        self,
        original: Path,
        destination: Path,
        sheet_quad: Sequence[Any] | None = None,
        homography: Sequence[float] | None = None,
        px_per_mm: float | None = None,
    ) -> Path:
        del homography, px_per_mm

        import torch

        self._load()
        assert self._model is not None and self._transform is not None

        # Same frame as the client's homography; see chroma.py.
        image = ImageOps.exif_transpose(Image.open(original)).convert("RGB")
        tensor = self._transform(image).unsqueeze(0).to(self._device)
        if self._device == "cuda":
            tensor = tensor.half()

        with torch.inference_mode():
            prediction = self._model(tensor)[-1].sigmoid().float().cpu()
        del tensor
        if self._device == "cuda":
            # PyTorch keeps freed activations cached for its own reuse, which
            # to Ollama and Jellyfin looks the same as memory still in use.
            torch.cuda.empty_cache()
        self._last_used = time.monotonic()

        mask = prediction[0].squeeze().numpy()
        alpha = Image.fromarray((mask * 255).astype(np.uint8), mode="L").resize(
            image.size, Image.Resampling.BILINEAR
        )
        alpha = _keep_garment(alpha, sheet_quad)

        out = image.convert("RGBA")
        out.putalpha(alpha)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out.save(destination, "PNG")
        return destination


def _pick_device(torch) -> str:
    """
    CUTOUT_DEVICE=auto takes the best available; naming one makes it required.

    Auto is right on a laptop. On a server given a GPU it is a trap: when the
    driver breaks (a host upgrade not yet followed by a reboot does it),
    CUDA quietly reports unavailable and every cut takes 35 s on the CPU
    instead of under one. Naming cuda turns that into a failed job that
    says why.
    """
    wanted = config.CUTOUT_DEVICE
    if wanted == "auto":
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    if wanted == "cuda" and not torch.cuda.is_available():
        if torch.version.cuda is None:
            reason = "this torch build is CPU-only; rebuild with a CUDA TORCH_INDEX"
        else:
            reason = (
                "no usable GPU; check the container was given one and that "
                "`nvidia-smi` works on the host"
            )
        raise RuntimeError(f"CUTOUT_DEVICE=cuda but {reason}")
    return wanted


# With no markers, the middle of the frame, as a fraction of each side.
CENTRAL_MARGIN = 0.2


def _central_region(shape: tuple[int, int]) -> np.ndarray:
    h, w = shape
    region = np.zeros((h, w), dtype=bool)
    region[
        int(h * CENTRAL_MARGIN) : int(h * (1 - CENTRAL_MARGIN)),
        int(w * CENTRAL_MARGIN) : int(w * (1 - CENTRAL_MARGIN)),
    ] = True
    return region


def _keep_garment(alpha: Image.Image, sheet_quad: Sequence[Any] | None) -> Image.Image:
    """
    Keep the garment, and only the garment.

    BiRefNet cuts out whatever in the frame looks like the subject, and it
    does not know about the rig. Shot standing over the garment, the
    photographer's own feet at the bottom of the frame came back as part of
    the cutout. The garment is laid inside the four markers, so the rig
    decides which pieces are the garment: the one with the most of itself
    inside the rig (with the same overhang the chroma key allows), plus any
    other substantial piece centred on the rig.

    The rig only chooses pieces; it never cuts them. Clipping to it
    guillotined a denim jacket's cuff, laid with its sleeves wider than the
    markers, in a straight line at the side margin. A kept piece is kept
    whole, and the feet, a separate piece off the rig, are still dropped.

    A shoe's side and angled shots have no markers. There the middle of the
    frame stands in for the rig: the shoe is what the photo was pointed at,
    and the other shoe of the pair or a chair leg at the edge is not.
    """
    scale = min(1.0, KEEP_MAX_DIMENSION / max(alpha.size))
    size = (max(1, round(alpha.width * scale)), max(1, round(alpha.height * scale)))
    small = np.asarray(alpha.resize(size, Image.Resampling.BILINEAR)) > 127
    h, w = small.shape

    if sheet_quad:
        allowed = _sheet_mask(sheet_quad, scale, (h, w), 0, OVERHANG_X, OVERHANG_Y)
        rig = _sheet_mask(sheet_quad, scale, (h, w), 0)
    else:
        allowed = rig = _central_region((h, w))
    labels, count = ndimage.label(small)
    if count == 0:
        return alpha

    index = range(1, count + 1)
    inside = ndimage.sum(allowed, labels, index)
    if inside.max() == 0:
        return alpha
    primary = int(np.argmax(inside)) + 1
    areas = ndimage.sum(np.ones_like(labels), labels, index)
    centres = ndimage.center_of_mass(np.ones_like(labels), labels, index)
    keep = np.zeros(count + 1, dtype=bool)
    for i, (area, (cy, cx)) in enumerate(zip(areas, centres), start=1):
        on_rig = rig[min(h - 1, int(cy)), min(w - 1, int(cx))]
        keep[i] = i == primary or (area >= KEEP_MIN_SHARE * areas[primary - 1] and on_rig)

    kept = keep[labels]
    # Grown a little before it is applied, so the model's soft edge survives
    # instead of being cut to the binary outline.
    kept = ndimage.binary_dilation(kept, iterations=2)
    gate = Image.fromarray((kept * 255).astype(np.uint8), mode="L").resize(
        alpha.size, Image.Resampling.NEAREST
    )
    return Image.fromarray(
        np.minimum(np.asarray(alpha), np.asarray(gate)), mode="L"
    )
