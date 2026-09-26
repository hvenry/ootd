"""
BiRefNet (MIT) — the default local cutout.

This is *segmentation*: it decides which of the photograph's existing pixels
are garment. It generates nothing. Weights are ~3.5GB from HuggingFace on the
first job — free, no token, no gate — and a GPU is optional; CPU is slow but
entirely workable for one garment at a time.

Never substitute rembg's default session: that is `bria-rmbg`, which is
CC BY-NC, and this repo is MIT and may host a paid service. See
docs/DECISIONS.md for the full forbidden list.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

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
        # its health check and claim jobs without waiting on 3.5GB.
        self._model = None
        self._device = None
        self._transform = None

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

        if torch.cuda.is_available():
            device = "cuda"
        elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        log.info("loading %s on %s (first run downloads ~3.5GB)", MODEL_ID, device)
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
        log.info("model ready on %s", device)

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

        with torch.no_grad():
            prediction = self._model(tensor)[-1].sigmoid().cpu()

        mask = prediction[0].squeeze().float().numpy()
        alpha = Image.fromarray((mask * 255).astype(np.uint8), mode="L").resize(
            image.size, Image.Resampling.BILINEAR
        )
        alpha = _keep_garment(alpha, sheet_quad)

        out = image.convert("RGBA")
        out.putalpha(alpha)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out.save(destination, "PNG")
        return destination


def _keep_garment(alpha: Image.Image, sheet_quad: Sequence[Any] | None) -> Image.Image:
    """
    Keep the garment, and only the garment.

    BiRefNet cuts out whatever in the frame looks like the subject, and it
    does not know about the rig. Shot standing over the garment, the
    photographer's own feet at the bottom of the frame came back as part of
    the cutout. The garment is laid inside the four markers, so: nothing
    outside the rig (with the same overhang the chroma key allows, since
    hems and waistbands run past the markers), then the largest piece, plus
    any other substantial piece centred on the rig.
    """
    scale = min(1.0, KEEP_MAX_DIMENSION / max(alpha.size))
    size = (max(1, round(alpha.width * scale)), max(1, round(alpha.height * scale)))
    small = np.asarray(alpha.resize(size, Image.Resampling.BILINEAR)) > 127
    h, w = small.shape

    allowed = _sheet_mask(sheet_quad, scale, (h, w), 0, OVERHANG_X, OVERHANG_Y)
    rig = _sheet_mask(sheet_quad, scale, (h, w), 0)
    labels, count = ndimage.label(small & allowed)
    if count == 0:
        return alpha

    areas = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    largest = float(areas.max())
    centres = ndimage.center_of_mass(np.ones_like(labels), labels, range(1, count + 1))
    keep = np.zeros(count + 1, dtype=bool)
    for i, (area, (cy, cx)) in enumerate(zip(areas, centres), start=1):
        on_rig = rig[min(h - 1, int(cy)), min(w - 1, int(cx))]
        keep[i] = area == largest or (area >= KEEP_MIN_SHARE * largest and on_rig)

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
