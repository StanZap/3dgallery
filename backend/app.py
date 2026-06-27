from __future__ import annotations

import os

# Allow the duplicate OpenMP runtimes that DA3's dependencies bring in (see
# da3_runner for details). Must be set before torch/DA3 are imported.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import argparse
import hashlib
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

import numpy as np
import trimesh
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel

from backend.da3_runner import DepthAnything3Runner

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp", ".tif", ".tiff"}
PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_IMAGES_DIR = PROJECT_ROOT / "images"
DEFAULT_PROCESSED_DIR = PROJECT_ROOT / "processed"


class Settings(BaseModel):
    images_dir: Path
    processed_dir: Path
    model: str
    device: str
    dev_depth_fallback: bool


class ImageItem(BaseModel):
    id: str
    name: str
    width: int
    height: int
    image_url: str
    processed: bool
    mesh_url: str | None = None
    depth_url: str | None = None


class ProcessResponse(BaseModel):
    image: ImageItem
    depth_url: str
    mesh_url: str
    metadata_url: str


def load_settings() -> Settings:
    images_dir = Path(os.environ.get("GALLERY_IMAGES_DIR", DEFAULT_IMAGES_DIR))
    processed_dir = Path(os.environ.get("GALLERY_PROCESSED_DIR", DEFAULT_PROCESSED_DIR))
    model = os.environ.get("GALLERY_DA3_MODEL", "depth-anything/DA3-SMALL")
    device = os.environ.get("GALLERY_DA3_DEVICE", "auto")
    dev_depth_fallback = os.environ.get("GALLERY_DEV_DEPTH_FALLBACK", "").lower() in {
        "1",
        "true",
        "yes",
    }
    return Settings(
        images_dir=images_dir.expanduser().resolve(),
        processed_dir=processed_dir.expanduser().resolve(),
        model=model,
        device=device,
        dev_depth_fallback=dev_depth_fallback,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images-dir", type=Path)
    parser.add_argument("--processed-dir", type=Path)
    parser.add_argument("--model")
    parser.add_argument("--device", choices=["auto", "cuda", "mps", "cpu"])
    parser.add_argument("--dev-depth-fallback", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    return parser.parse_args()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    settings.images_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    app.state.settings = settings
    app.state.depth_runner = DepthAnything3Runner(
        settings.model,
        device=settings.device,
        dev_depth_fallback=settings.dev_depth_fallback,
    )
    yield


app = FastAPI(title="3D Gallery Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/images", response_model=list[ImageItem])
def list_images(request: Request) -> list[ImageItem]:
    settings: Settings = request.app.state.settings
    return [build_image_item(path, request) for path in discover_images(settings.images_dir)]


@app.get("/api/images/{image_id}/file")
def get_image_file(image_id: str, request: Request) -> FileResponse:
    image_path = find_image_by_id(image_id, request.app.state.settings.images_dir)
    return FileResponse(image_path)


@app.post("/api/images/{image_id}/process", response_model=ProcessResponse)
def process_image(
    image_id: str,
    request: Request,
    max_size: Annotated[int, Query(ge=64, le=1024)] = 512,
    depth_scale: Annotated[float, Query(gt=0.01, le=2.0)] = 0.5,
    discontinuity: Annotated[float, Query(gt=0.0, le=1.0)] = 0.06,
) -> ProcessResponse:
    settings: Settings = request.app.state.settings
    image_path = find_image_by_id(image_id, settings.images_dir)
    output_dir = settings.processed_dir / image_id
    output_dir.mkdir(parents=True, exist_ok=True)

    original_path = output_dir / "original.jpg"
    depth_path = output_dir / "depth.png"
    mesh_path = output_dir / "mesh.glb"
    metadata_path = output_dir / "metadata.json"

    try:
        normalized_original = normalize_original(image_path, original_path)
        depth_result = request.app.state.depth_runner.estimate_depth(normalized_original)
        depth_result.depth.save(depth_path)
        create_depth_mesh(
            normalized_original,
            depth_path,
            mesh_path,
            max_size=max_size,
            depth_scale=depth_scale,
            discontinuity=discontinuity,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    metadata = {
        "id": image_id,
        "source_name": image_path.name,
        "model": depth_result.model_name,
        "device": depth_result.device,
        "used_fallback": depth_result.used_fallback,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "depth_scale": depth_scale,
        "mesh_max_size": max_size,
        "discontinuity": discontinuity,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    item = build_image_item(image_path, request)
    return ProcessResponse(
        image=item,
        depth_url=f"/api/processed/{image_id}/depth.png",
        mesh_url=f"/api/processed/{image_id}/mesh.glb",
        metadata_url=f"/api/processed/{image_id}/metadata.json",
    )


@app.get("/api/processed/{image_id}/{filename}")
def get_processed_file(image_id: str, filename: str, request: Request) -> FileResponse:
    if filename not in {"original.jpg", "depth.png", "mesh.glb", "metadata.json"}:
        raise HTTPException(status_code=404, detail="Unsupported processed asset.")
    path = request.app.state.settings.processed_dir / image_id / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Processed asset not found.")
    media_type = "model/gltf-binary" if filename.endswith(".glb") else None
    return FileResponse(path, media_type=media_type)


def discover_images(images_dir: Path) -> list[Path]:
    return sorted(
        [path for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS],
        key=lambda path: path.name.casefold(),
    )


def image_id_for(path: Path) -> str:
    key = f"{path.name}:{path.stat().st_size}:{int(path.stat().st_mtime)}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def find_image_by_id(image_id: str, images_dir: Path) -> Path:
    for path in discover_images(images_dir):
        if image_id_for(path) == image_id:
            return path
    raise HTTPException(status_code=404, detail="Image not found.")


def build_image_item(path: Path, request: Request) -> ImageItem:
    image_id = image_id_for(path)
    processed_dir = request.app.state.settings.processed_dir / image_id
    with Image.open(path) as image:
        width, height = image.size
    processed = (processed_dir / "mesh.glb").exists() and (processed_dir / "depth.png").exists()
    return ImageItem(
        id=image_id,
        name=path.name,
        width=width,
        height=height,
        image_url=f"/api/images/{image_id}/file",
        processed=processed,
        mesh_url=f"/api/processed/{image_id}/mesh.glb" if processed else None,
        depth_url=f"/api/processed/{image_id}/depth.png" if processed else None,
    )


def normalize_original(source: Path, destination: Path) -> Path:
    with Image.open(source) as image:
        image.convert("RGB").save(destination, quality=95)
    return destination


def create_depth_mesh(
    image_path: Path,
    depth_path: Path,
    output_path: Path,
    *,
    max_size: int,
    depth_scale: float,
    discontinuity: float,
) -> None:
    color = Image.open(image_path).convert("RGB")
    depth = Image.open(depth_path).convert("L")
    color.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    depth = depth.resize(color.size, Image.Resampling.BICUBIC)

    width, height = color.size
    depth01 = np.asarray(depth, dtype=np.float32) / 255.0
    depth_z = (depth01 - 0.5) * depth_scale

    aspect = width / height
    xs = np.linspace(-aspect, aspect, width, dtype=np.float32)
    ys = np.linspace(1.0, -1.0, height, dtype=np.float32)
    grid_x, grid_y = np.meshgrid(xs, ys)

    vertices = np.column_stack([grid_x.ravel(), grid_y.ravel(), depth_z.ravel()])

    # Build the two triangles of every grid quad, vectorized. Corner layout:
    #   a b
    #   c d
    rows, cols = np.mgrid[0 : height - 1, 0 : width - 1]
    a = (rows * width + cols).ravel()
    b = a + 1
    c = a + width
    d = c + 1

    # Tear the sheet at depth discontinuities: if a quad straddles a large depth
    # jump (foreground vs. background), its triangles would stretch into a
    # "rubber sheet" smear. Drop those quads so layers separate cleanly. The
    # threshold is in normalized 0..1 depth, independent of depth_scale.
    depth_flat = depth01.ravel()
    quad = np.stack([depth_flat[a], depth_flat[b], depth_flat[c], depth_flat[d]], axis=1)
    keep = (quad.max(axis=1) - quad.min(axis=1)) <= discontinuity

    faces = np.concatenate(
        [
            np.stack([a[keep], c[keep], b[keep]], axis=1),
            np.stack([b[keep], c[keep], d[keep]], axis=1),
        ],
        axis=0,
    )

    colors = np.asarray(color, dtype=np.uint8).reshape((-1, 3))
    alpha = np.full((colors.shape[0], 1), 255, dtype=np.uint8)
    vertex_colors = np.concatenate([colors, alpha], axis=1)

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, vertex_colors=vertex_colors, process=False)
    scene = trimesh.Scene(mesh)
    exported = scene.export(file_type="glb")
    output_path.write_bytes(exported)


def main() -> None:
    args = parse_args()
    if args.images_dir is not None:
        os.environ["GALLERY_IMAGES_DIR"] = str(args.images_dir.expanduser().resolve())
    if args.processed_dir is not None:
        os.environ["GALLERY_PROCESSED_DIR"] = str(args.processed_dir.expanduser().resolve())
    if args.model is not None:
        os.environ["GALLERY_DA3_MODEL"] = args.model
    if args.device is not None:
        os.environ["GALLERY_DA3_DEVICE"] = args.device
    if args.dev_depth_fallback:
        os.environ["GALLERY_DEV_DEPTH_FALLBACK"] = "1"

    import uvicorn

    uvicorn.run("backend.app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
