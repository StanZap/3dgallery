from __future__ import annotations

import os

# Depth Anything 3 pulls in libraries (pycolmap, OpenCV, PyTorch) that each ship
# their own OpenMP runtime. On macOS that triggers a hard "libomp already
# initialized" abort. Allowing the duplicate runtime is the documented, safe-enough
# workaround for inference workloads. Set before torch/DA3 are imported.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps


@dataclass(frozen=True)
class DepthResult:
    depth: Image.Image
    model_name: str
    device: str
    used_fallback: bool


def resolve_device(preference: str = "auto") -> str:
    """Resolve a torch device string from a preference (auto/cuda/mps/cpu)."""
    preference = (preference or "auto").lower()
    if preference != "auto":
        return preference

    try:
        import torch
    except ImportError:
        return "cpu"

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class DepthAnything3Runner:
    def __init__(
        self,
        model_name: str,
        *,
        device: str = "auto",
        dev_depth_fallback: bool = False,
    ) -> None:
        self.model_name = model_name
        self.device_preference = device
        self.dev_depth_fallback = dev_depth_fallback
        self._model: Any | None = None
        self._device: str | None = None

    def estimate_depth(self, image_path: Path) -> DepthResult:
        image = Image.open(image_path).convert("RGB")
        if self.dev_depth_fallback:
            return DepthResult(
                depth=self._fallback_depth(image),
                model_name="development-gradient",
                device="cpu",
                used_fallback=True,
            )

        model = self._load_model()
        raw_depth = self._infer_with_model(model, image_path)
        # DA3 returns metric-style depth where smaller values are nearer. Invert it
        # so the brightest pixels (255) are the closest surfaces, which is what the
        # mesh builder treats as "popping toward the viewer".
        depth = self._normalize_depth(raw_depth, image.size, invert=True)
        return DepthResult(
            depth=depth,
            model_name=self.model_name,
            device=self._device or "cpu",
            used_fallback=False,
        )

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        try:
            from depth_anything_3.api import DepthAnything3
        except ModuleNotFoundError as exc:
            top = (exc.name or "").split(".")[0]
            if top == "depth_anything_3":
                raise RuntimeError(
                    "Depth Anything 3 is not installed. Install the DA3 package (see README), "
                    "or start the backend with --dev-depth-fallback for UI development."
                ) from exc
            raise RuntimeError(
                f"A Depth Anything 3 dependency is missing: '{exc.name}'. Install the DA3 "
                "support extras with `uv sync --extra da3`, or start the backend with "
                "--dev-depth-fallback for UI development."
            ) from exc

        device = resolve_device(self.device_preference)
        model = DepthAnything3.from_pretrained(self.model_name)
        model = model.to(device)
        self._model = model
        self._device = device
        return model

    def _infer_with_model(self, model: Any, image_path: Path) -> np.ndarray:
        # inference() accepts file paths / PIL images and returns a Prediction whose
        # .depth has shape (N, H, W). We process a single image, so take view 0.
        prediction = model.inference([str(image_path)])
        depth = np.asarray(prediction.depth)
        if depth.ndim == 3:
            depth = depth[0]
        return depth

    def _normalize_depth(
        self,
        depth: np.ndarray,
        size: tuple[int, int],
        *,
        invert: bool = False,
    ) -> Image.Image:
        if depth.ndim == 3:
            depth = depth.squeeze()
        depth = depth.astype(np.float32)
        depth = np.nan_to_num(depth, nan=0.0, posinf=0.0, neginf=0.0)
        min_value = float(depth.min())
        max_value = float(depth.max())
        if max_value - min_value < 1e-6:
            normalized = np.zeros_like(depth, dtype=np.uint8)
        else:
            scaled = (depth - min_value) / (max_value - min_value)
            if invert:
                scaled = 1.0 - scaled
            normalized = (scaled * 255.0).astype(np.uint8)
        return Image.fromarray(normalized, mode="L").resize(size, Image.Resampling.BICUBIC)

    def _fallback_depth(self, image: Image.Image) -> Image.Image:
        gray = ImageOps.grayscale(image)
        width, height = gray.size
        y = np.linspace(255, 48, height, dtype=np.float32)[:, None]
        vignette_x = np.linspace(-1.0, 1.0, width, dtype=np.float32)[None, :]
        vignette = (1.0 - np.clip(np.abs(vignette_x), 0.0, 1.0)) * 64.0
        luminance = np.asarray(gray, dtype=np.float32) * 0.25
        depth = np.clip(y + vignette + luminance, 0, 255).astype(np.uint8)
        return Image.fromarray(depth, mode="L")
