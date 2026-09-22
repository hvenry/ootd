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

log = logging.getLogger(__name__)

MODEL_ID = "ZhengPeng7/BiRefNet"
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
            MODEL_ID, trust_remote_code=True
        )
        if device == "cuda":
            model.half()
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
        # The model segments the garment wherever it lies; it does not need
        # to be told where the paper is.
        del sheet_quad, homography, px_per_mm

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

        out = image.convert("RGBA")
        out.putalpha(alpha)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out.save(destination, "PNG")
        return destination
