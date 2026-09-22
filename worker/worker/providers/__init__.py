"""
Cutout providers, selected by CUTOUT_PROVIDER.

Phase 0 is **background removal only**. BiRefNet is a segmentation model: it
decides which existing pixels are garment, it does not invent any. Try-on
generation is Phase 4, it is hosted, and nothing generative ever runs here.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol, Sequence

from .. import config


class CutoutProvider(Protocol):
    name: str

    def cut(
        self,
        original: Path,
        destination: Path,
        sheet_quad: Sequence[Any] | None = None,
        homography: Sequence[float] | None = None,
        px_per_mm: float | None = None,
    ) -> Path:
        """
        Write a background-removed PNG to `destination` and return it.

        `sheet_quad` is the four marker centres in image coordinates. The
        chroma provider needs it to know which surface is the background;
        the model-based providers may ignore it.
        """
        ...


def get_provider(name: str | None = None) -> CutoutProvider:
    chosen = (name or config.CUTOUT_PROVIDER).lower()

    if chosen == "chroma":
        from .chroma import ChromaKeyProvider

        return ChromaKeyProvider()

    if chosen == "replicate":
        from .replicate_provider import ReplicateProvider

        return ReplicateProvider()

    if chosen == "local":
        from .birefnet import BiRefNetProvider

        return BiRefNetProvider()

    raise ValueError(
        f"Unknown CUTOUT_PROVIDER {chosen!r}. Use local, chroma or replicate."
    )
