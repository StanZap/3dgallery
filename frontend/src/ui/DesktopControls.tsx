import type { Dispatch, SetStateAction } from "react";
import type { XRStore } from "@react-three/xr";
import type { Gallery } from "../state/useGallery";
import { assetUrl, imageThumbnailUrl } from "../state/useGallery";

const MIN_IMAGE_SCALE = 0.5;
const MAX_IMAGE_SCALE = 2.5;
const IMAGE_SCALE_STEP = 0.1;

function clampImageScale(value: number) {
  return Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, value));
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
  const selectedIndex = images.findIndex((image) => image.id === selectedId);
  const canNavigate = images.length > 1;

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

        <div className="thumb-grid" aria-label="Images">
          {images.map((image) => (
            <button
              key={image.id}
              className={`flat-thumb ${image.id === selectedId ? "is-selected" : ""}`}
              onClick={() => setSelectedId(image.id)}
              title={`Show ${image.name}`}
            >
              <img src={imageThumbnailUrl(image)} alt="" />
              <span>{image.name}</span>
              <b>{image.processed ? "3D" : "2D"}</b>
            </button>
          ))}
        </div>
      </aside>

      <main className="flat-viewer" aria-live="polite">
        <div className="flat-toolbar">
          <div className="title-block">
            <p>Selected image</p>
            <h1>{selected?.name ?? "No image selected"}</h1>
          </div>
          <div className="actions">
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
            <button
              className="primary-button"
              disabled={busy || !selected}
              onClick={() => selected && process(selected.id)}
            >
              {label}
            </button>
          </div>
        </div>

        {status ? <p className="status-line">{status}</p> : null}

        <section className="image-stage">
          {selected ? (
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
              Size {Math.round(imageScale * 100)}%
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
