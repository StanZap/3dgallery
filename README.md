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

### Frontend

```bash
cd frontend
pnpm install
```

### Backend (UI development, any platform)

The base install runs the API plus a deterministic gradient depth fallback, which
is enough to develop the gallery and 3D viewer without a GPU or model weights:

```bash
uv sync
```

Then run the backend with `--dev-depth-fallback` (see [Run](#run)).

### Backend with real depth (Depth Anything 3)

Real depth estimation needs the DA3 support libraries plus the DA3 package itself.
DA3 is **not** on PyPI, so it is installed separately from the
[ByteDance-Seed/depth-anything-3](https://github.com/ByteDance-Seed/depth-anything-3)
repo. Install the support libraries via the `da3` extra, then install DA3 with
`--no-deps` so it does not pull in CUDA-only build dependencies:

```bash
uv sync --extra da3
uv pip install --no-deps "git+https://github.com/ByteDance-Seed/depth-anything-3"
```

**macOS (Apple Silicon).** The above is all you need — DA3 runs on the Metal (MPS)
backend. `DA3-SMALL` loads in ~25 s on first run (it downloads weights from the
Hugging Face Hub) and then estimates depth in a few seconds per image. The backend
sets `KMP_DUPLICATE_LIB_OK=TRUE` automatically to avoid the macOS OpenMP clash from
DA3's native dependencies. `xformers` and `gsplat` are not available/needed here and
are skipped automatically.

**Linux with CUDA.** Install a CUDA build of PyTorch first (match your driver), then
the support extras and DA3, and optionally `xformers` for faster attention:

```bash
uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
uv sync --extra da3
uv pip install --no-deps "git+https://github.com/ByteDance-Seed/depth-anything-3"
uv pip install xformers   # optional: faster attention on CUDA
```

The backend auto-detects the device (CUDA → MPS → CPU). Override it with
`--device {auto,cuda,mps,cpu}` or `GALLERY_DA3_DEVICE`.

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

The backend defaults to `depth-anything/DA3-SMALL`. You can change the model and
force a device:

```bash
uv run python -m backend.app --images-dir /path/to/photos \
  --model depth-anything/DA3-LARGE --device cuda --reload
```

Available models include `DA3-SMALL`, `DA3-BASE`, `DA3-LARGE`, and `DA3-GIANT`
(see the DA3 repo for the full list). DA3 produces metric-style depth where nearer
surfaces are closer; the backend inverts and normalizes it so the brightest pixels
become the closest geometry in the generated mesh.

Processing creates:

```text
backend/processed/<image-id>/
  original.jpg
  depth.png
  mesh.glb
  metadata.json
```

The `metadata.json` records which `model` and `device` were used. If DA3 or one of
its dependencies is missing, the backend returns a clear processing error naming the
missing piece. There is also a deterministic gradient fallback for development:

```bash
uv run python -m backend.app --images-dir /path/to/photos --dev-depth-fallback --reload
```
