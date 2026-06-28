import type { CSSProperties } from "react";
import type { XRStore } from "@react-three/xr";
import type { Gallery } from "../state/useGallery";
import { assetUrl } from "../state/useGallery";

// Plain DOM controls for the laptop. The headset gets the in-scene ControlPanel
// instead; this overlay is not visible inside an immersive session.
export function DesktopControls({ gallery, store }: { gallery: Gallery; store: XRStore }) {
  const { images, selected, selectedId, setSelectedId, busy, status, error, process } = gallery;
  const label = busy ? "Working…" : selected?.processed ? "Remake 3D" : "Make 3D";

  return (
    <aside style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>3D gallery</strong>
        <button style={buttonStyle} onClick={() => store.enterVR()}>
          Enter VR
        </button>
      </div>

      {error ? <p style={{ color: "#ff8585" }}>{error}</p> : null}

      <div style={gridStyle}>
        {images.map((image) => (
          <button
            key={image.id}
            onClick={() => setSelectedId(image.id)}
            title={image.name}
            style={{
              ...thumbStyle,
              outline: image.id === selectedId ? "2px solid #3b82f6" : "none",
            }}
          >
            <img src={assetUrl(image.image_url)} alt="" style={thumbImgStyle} />
            <span style={badgeStyle}>{image.processed ? "3D" : "2D"}</span>
          </button>
        ))}
      </div>

      <button
        style={{ ...buttonStyle, width: "100%", opacity: busy ? 0.6 : 1 }}
        disabled={busy || !selected}
        onClick={() => selected && process(selected.id)}
      >
        {label}
      </button>

      {status ? <p style={{ color: "#9aa0aa", margin: 0, fontSize: 13 }}>{status}</p> : null}
    </aside>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  width: 280,
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  borderRadius: 14,
  background: "rgba(21,23,28,0.92)",
  color: "#f3f4f6",
  font: "14px system-ui, sans-serif",
};
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 };
const thumbStyle: CSSProperties = {
  position: "relative",
  padding: 0,
  border: "none",
  borderRadius: 8,
  overflow: "hidden",
  cursor: "pointer",
  aspectRatio: "1",
  background: "#2a2d34",
};
const thumbImgStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const badgeStyle: CSSProperties = {
  position: "absolute",
  bottom: 4,
  left: 4,
  fontSize: 10,
  padding: "1px 5px",
  borderRadius: 4,
  background: "rgba(0,0,0,0.6)",
};
const buttonStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#1b6cff",
  color: "#fff",
  cursor: "pointer",
};
