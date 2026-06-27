# 3D Gallery

A local WebXR gallery for viewing a folder of images, generating depth-based 3D assets with Depth Anything 3, and opening the result in an immersive Quest browser session.

Single-image 3D here is depth-based parallax, not full scene reconstruction. The generated mesh works best for portraits, art, generated images, and photos with clear foreground/background separation.

## Project Layout

```text
backend/
  app.py
  da3_runner.py
  images/
  processed/
frontend/
  index.html
  src/
    gallery.ts
    main.ts
    viewer2d.ts
    viewer3d.ts
```

## Setup

Install dependencies when you are ready:

```bash
uv sync
cd frontend
pnpm install
```

## Run

Point the backend at any photo folder:

```bash
uv run python -m backend.app --images-dir /path/to/photos --reload
```

In another terminal:

```bash
cd frontend
pnpm dev
```

Open the frontend from your Quest browser. If testing from a headset, expose both dev servers on your LAN and set `VITE_API_BASE` if the backend is not at `http://localhost:8000`:

```bash
VITE_API_BASE=http://YOUR_MAC_LAN_IP:8000 pnpm dev --host 0.0.0.0
```

You can still use FastAPI's CLI by configuring the app with environment variables:

```bash
GALLERY_IMAGES_DIR=/path/to/photos uv run fastapi dev backend/app.py
```

## Processing Models

The backend defaults to `depth-anything/DA3-SMALL`. You can change it:

```bash
uv run python -m backend.app --images-dir /path/to/photos --model depth-anything/DA3-BASE --reload
```

Processing creates:

```text
backend/processed/<image-id>/
  original.jpg
  depth.png
  mesh.glb
  metadata.json
```

If DA3 or PyTorch is not installed yet, the backend returns a clear processing error. There is also a deterministic gradient fallback for development:

```bash
uv run python -m backend.app --images-dir /path/to/photos --dev-depth-fallback --reload
```
