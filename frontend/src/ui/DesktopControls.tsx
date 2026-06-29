import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { XRStore } from "@react-three/xr";
import type { ImageItem } from "../types";
import type { Gallery } from "../state/useGallery";
import { assetUrl, imageThumbnailUrl } from "../state/useGallery";

const MIN_IMAGE_SCALE = 0.5;
const MAX_IMAGE_SCALE = 2.5;
const IMAGE_SCALE_STEP = 0.1;
const DEFAULT_PAGE_SIZE = 60;
const PAGE_SIZE_OPTIONS = [30, 60, 120] as const;
const MAIN_NAME_MAX_LENGTH = 48;
const THUMB_NAME_MAX_LENGTH = 22;

function clampImageScale(value: number) {
  return Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, value));
}

function clampPage(value: number, totalPages: number) {
  return Math.min(Math.max(value, 0), Math.max(totalPages - 1, 0));
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength))}...`;
}

function DesktopMesh({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.05 * scale} />;
}

function Desktop3DPreview({
  image,
  scale,
}: {
  image: ImageItem;
  scale: number;
}) {
  if (!image.mesh_url) return null;

  return (
    <Canvas
      className="mesh-preview"
      camera={{ position: [0, 0, 3.2], fov: 45 }}
    >
      <color attach="background" args={["#08090d"]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[1, 2, 3]} intensity={1.8} />
      <Suspense fallback={null}>
        <DesktopMesh url={assetUrl(image.mesh_url)} scale={scale} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={1.3} maxDistance={6} />
    </Canvas>
  );
}

// Plain DOM controls for browsers before entering an immersive session. These are
// intentionally touch-friendly because VR browsers often start in a 2D page.
export function DesktopControls({
  gallery,
  store,
  safeXr,
  setSafeXr,
  xrPanel,
  setXrPanel,
  xrPanelLite,
  setXrPanelLite,
  xrHandles,
  setXrHandles,
  imageScale,
  setImageScale,
}: {
  gallery: Gallery;
  store: XRStore;
  safeXr: boolean;
  setSafeXr: (safe: boolean) => void;
  xrPanel: boolean;
  setXrPanel: (enabled: boolean) => void;
  xrPanelLite: boolean;
  setXrPanelLite: (enabled: boolean) => void;
  xrHandles: boolean;
  setXrHandles: (enabled: boolean) => void;
  imageScale: number;
  setImageScale: Dispatch<SetStateAction<number>>;
}) {
  const {
    images,
    selected,
    selectedId,
    setSelectedId,
    busy,
    status,
    error,
    process,
  } = gallery;
  const label = busy
    ? "Working…"
    : selected?.processed
      ? "Remake 3D"
      : "Make 3D";
  const [thumbnailPage, setThumbnailPage] = useState(0);
  const [thumbnailPageSize, setThumbnailPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [previewMode, setPreviewMode] = useState<"2d" | "3d">("2d");
  const selectedIndex = images.findIndex((image) => image.id === selectedId);
  const canNavigate = images.length > 1;
  const selectedStatus = status?.imageId === selectedId ? status.message : "";
  const canShow3d = Boolean(selected?.mesh_url);
  const totalPages = Math.max(1, Math.ceil(images.length / thumbnailPageSize));
  const currentPage = clampPage(thumbnailPage, totalPages);
  const pageStart = currentPage * thumbnailPageSize;
  const pageEnd = Math.min(pageStart + thumbnailPageSize, images.length);
  const visibleImages = useMemo(
    () => images.slice(pageStart, pageEnd),
    [images, pageStart, pageEnd],
  );

  useEffect(() => {
    setThumbnailPage((page) => clampPage(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    setThumbnailPage(Math.floor(selectedIndex / thumbnailPageSize));
  }, [selectedIndex, thumbnailPageSize]);

  useEffect(() => {
    if (!canShow3d) setPreviewMode("2d");
  }, [canShow3d, selectedId]);

  const selectOffset = (offset: number) => {
    if (images.length === 0) return;
    const current = selectedIndex < 0 ? 0 : selectedIndex;
    const next = (current + offset + images.length) % images.length;
    setSelectedId(images[next].id);
  };

  const adjustImageScale = (delta: number) => {
    setImageScale((scale) => clampImageScale(scale + delta));
  };

  return (
    <div className="flat-mode" aria-label="Flat 2D gallery mode">
      <aside className="browser-panel">
        <div className="panel-header">
          <div>
            <strong>3D gallery</strong>
            <span>Flat 2D mode</span>
          </div>
          <button className="primary-button" onClick={() => store.enterVR()}>
            Enter VR
          </button>
        </div>

        <div className="control-group compact">
          <label>
            <input
              type="checkbox"
              checked={safeXr}
              onChange={(event) => setSafeXr(event.currentTarget.checked)}
            />
            Safe XR boot
          </label>
          <label className={safeXr ? "is-disabled" : undefined}>
            <input
              type="checkbox"
              checked={xrPanel}
              disabled={safeXr}
              onChange={(event) => setXrPanel(event.currentTarget.checked)}
            />
            XR panel
          </label>
          <label className={safeXr ? "is-disabled" : undefined}>
            <input
              type="checkbox"
              checked={xrPanelLite}
              disabled={safeXr}
              onChange={(event) => setXrPanelLite(event.currentTarget.checked)}
            />
            Lite panel
          </label>
          <label className={safeXr ? "is-disabled" : undefined}>
            <input
              type="checkbox"
              checked={xrHandles}
              disabled={safeXr}
              onChange={(event) => setXrHandles(event.currentTarget.checked)}
            />
            Grab handles
          </label>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="pagination-bar" aria-label="Image pagination">
          <div>
            <strong>
              {images.length === 0 ? 0 : pageStart + 1}–{pageEnd}
            </strong>
            <span> of {images.length}</span>
          </div>
          <div className="pagination-actions">
            <button
              className="mini-command"
              disabled={currentPage === 0}
              onClick={() =>
                setThumbnailPage((page) => clampPage(page - 1, totalPages))
              }
            >
              Prev
            </button>
            <span aria-live="polite">
              Page {currentPage + 1}/{totalPages}
            </span>
            <button
              className="mini-command"
              disabled={currentPage >= totalPages - 1}
              onClick={() =>
                setThumbnailPage((page) => clampPage(page + 1, totalPages))
              }
            >
              Next
            </button>
          </div>
          <label>
            Show
            <select
              value={thumbnailPageSize}
              onChange={(event) => {
                setThumbnailPageSize(Number(event.currentTarget.value));
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="thumb-grid" aria-label="Images">
          {visibleImages.map((image) => (
            <button
              key={image.id}
              className={`flat-thumb ${image.id === selectedId ? "is-selected" : ""}`}
              onClick={() => setSelectedId(image.id)}
              title={`Show ${image.name}`}
            >
              <img src={imageThumbnailUrl(image)} alt="" />
              <span>{truncateText(image.name, THUMB_NAME_MAX_LENGTH)}</span>
              <b>{image.processed ? "3D" : "2D"}</b>
            </button>
          ))}
        </div>
      </aside>

      <main className="flat-viewer" aria-live="polite">
        <div className="flat-toolbar">
          <div className="title-block">
            <p>Selected image</p>
            <h1 title={selected?.name}>
              {selected
                ? truncateText(selected.name, MAIN_NAME_MAX_LENGTH)
                : "No image selected"}
            </h1>
            {selected ? (
              <span className="image-meta">
                {selectedIndex + 1} of {images.length} · {selected.width} ×{" "}
                {selected.height} ·{" "}
                {selected.processed ? "3D ready" : "2D only"}
              </span>
            ) : null}
          </div>

          <div className="top-controls" aria-label="Image controls">
            <div className="control-cluster">
              <button
                className="command"
                disabled={!canNavigate}
                onClick={() => selectOffset(-1)}
              >
                Previous
              </button>
              <button
                className="command"
                disabled={!canNavigate}
                onClick={() => selectOffset(1)}
              >
                Next
              </button>
              <button
                className="command"
                disabled={!selected}
                onClick={() => setImageScale(1)}
              >
                Fit
              </button>
              {canShow3d ? (
                <button
                  className="command mode-toggle"
                  aria-pressed={previewMode === "3d"}
                  onClick={() =>
                    setPreviewMode((mode) => (mode === "2d" ? "3d" : "2d"))
                  }
                >
                  {previewMode === "3d" ? "View 2D" : "View 3D"}
                </button>
              ) : null}
            </div>

            <div className="control-cluster size-cluster">
              <button
                className="command size-command"
                disabled={!selected}
                onClick={() => adjustImageScale(-IMAGE_SCALE_STEP)}
              >
                −
              </button>
              <input
                className="size-slider"
                type="range"
                min={MIN_IMAGE_SCALE}
                max={MAX_IMAGE_SCALE}
                step={0.05}
                value={imageScale}
                disabled={!selected}
                aria-label="Image size"
                onChange={(event) =>
                  setImageScale(Number(event.currentTarget.value))
                }
              />
              <button
                className="command size-command"
                disabled={!selected}
                onClick={() => adjustImageScale(IMAGE_SCALE_STEP)}
              >
                +
              </button>
            </div>

            <button
              className="primary-button make-button"
              disabled={busy || !selected}
              onClick={() => selected && process(selected.id)}
            >
              {label}
            </button>
          </div>
        </div>

        {selectedStatus ? (
          <p className="status-line">{selectedStatus}</p>
        ) : null}

        <section className="image-stage">
          {selected && previewMode === "3d" && selected.mesh_url ? (
            <Desktop3DPreview image={selected} scale={imageScale} />
          ) : selected ? (
            <img
              className="flat-image"
              src={assetUrl(selected.image_url)}
              alt={selected.name}
              style={{ transform: `scale(${imageScale})` }}
            />
          ) : (
            <div className="empty-state">
              <p>Choose an image from the left to view it here.</p>
            </div>
          )}
          {selected ? (
            <div className="size-readout">
              {previewMode === "3d" && selected.mesh_url ? "3D" : "2D"} · Size{" "}
              {Math.round(imageScale * 100)}%
            </div>
          ) : null}

          <nav className="viewer-nav-island" aria-label="Gallery navigation">
            <button
              className="island-button page-button"
              disabled={currentPage === 0}
              title="Previous thumbnail page"
              aria-label="Previous thumbnail page"
              onClick={() =>
                setThumbnailPage((page) => clampPage(page - 1, totalPages))
              }
            >
              <span aria-hidden="true">⇤</span>
            </button>
            <button
              className="island-button primary-island-button"
              disabled={!canNavigate}
              title="Previous image"
              aria-label="Previous image"
              onClick={() => selectOffset(-1)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span className="island-status" aria-live="polite">
              <strong>
                {images.length === 0
                  ? "No images"
                  : `Image ${selectedIndex + 1} of ${images.length}`}
              </strong>
              <small>
                Page {currentPage + 1} of {totalPages}
              </small>
            </span>
            <button
              className="island-button primary-island-button"
              disabled={!canNavigate}
              title="Next image"
              aria-label="Next image"
              onClick={() => selectOffset(1)}
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              className="island-button page-button"
              disabled={currentPage >= totalPages - 1}
              title="Next thumbnail page"
              aria-label="Next thumbnail page"
              onClick={() =>
                setThumbnailPage((page) => clampPage(page + 1, totalPages))
              }
            >
              <span aria-hidden="true">⇥</span>
            </button>
          </nav>
        </section>
      </main>
    </div>
  );
}
