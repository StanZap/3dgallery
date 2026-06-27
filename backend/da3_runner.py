from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps


@dataclass(frozen=True)
class DepthResult:
    depth: Image.Image
    model_name: str
    used_fallback: bool


class DepthAnything3Runner:
    def __init__(self, model_name: str, *, dev_depth_fallback: bool = False) -> None:
        self.model_name = model_name
        self.dev_depth_fallback = dev_depth_fallback
        self._model: Any | None = None

    def estimate_depth(self, image_path: Path) -> DepthResult:
        image = Image.open(image_path).convert("RGB")
        if self.dev_depth_fallback:
            return DepthResult(
                depth=self._fallback_depth(image),
                model_name="development-gradient",
                used_fallback=True,
            )

        model = self._load_model()
        raw_depth = self._infer_with_model(model, image)
        depth = self._normalize_depth(raw_depth, image.size)
        return DepthResult(depth=depth, model_name=self.model_name, used_fallback=False)

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        try:
            from depth_anything_3.api import DepthAnything3
        except ImportError:
            try:
                from depth_anything_3 import DepthAnything3
            except ImportError as exc:
                raise RuntimeError(
                    "Depth Anything 3 is not installed. Install the DA3 package and PyTorch, "
                    "or start the backend with --dev-depth-fallback for UI development."
                ) from exc

        self._model = DepthAnything3.from_pretrained(self.model_name)
        return self._model

    def _infer_with_model(self, model: Any, image: Image.Image) -> np.ndarray:
        if hasattr(model, "infer_image"):
            return np.asarray(model.infer_image(image))
        if hasattr(model, "predict"):
            return np.asarray(model.predict(image))
        if callable(model):
            return np.asarray(model(image))
        raise RuntimeError("The loaded DA3 model does not expose infer_image, predict, or __call__.")

    def _normalize_depth(self, depth: np.ndarray, size: tuple[int, int]) -> Image.Image:
        if depth.ndim == 3:
            depth = depth.squeeze()
        depth = depth.astype(np.float32)
        depth = np.nan_to_num(depth, nan=0.0, posinf=0.0, neginf=0.0)
        min_value = float(depth.min())
        max_value = float(depth.max())
        if max_value - min_value < 1e-6:
            normalized = np.zeros_like(depth, dtype=np.uint8)
        else:
            normalized = ((depth - min_value) / (max_value - min_value) * 255.0).astype(np.uint8)
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

