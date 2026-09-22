"""
Hosted cutout, ~$0.0004 an image.

The escape hatch for a machine with no usable GPU and no patience for CPU
inference. 851-labs/background-remover is a commercial API call, which is
fine; a non-commercial *weight* licence would not be.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Sequence

MODEL = "851-labs/background-remover"


class ReplicateProvider:
    name = "replicate"

    def __init__(self) -> None:
        if not os.environ.get("REPLICATE_API_TOKEN"):
            raise RuntimeError(
                "CUTOUT_PROVIDER=replicate needs REPLICATE_API_TOKEN in the environment."
            )

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

        try:
            import replicate
        except ImportError as exc:  # pragma: no cover - depends on install extras
            raise RuntimeError(
                "CUTOUT_PROVIDER=replicate needs `pip install -e '.[replicate]'`."
            ) from exc

        with original.open("rb") as handle:
            output = replicate.run(MODEL, input={"image": handle})

        destination.parent.mkdir(parents=True, exist_ok=True)
        data = output.read() if hasattr(output, "read") else output
        destination.write_bytes(data)
        return destination
