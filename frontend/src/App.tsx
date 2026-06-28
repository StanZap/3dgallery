import { Canvas } from "@react-three/fiber";
import { createXRStore, useXR, XR } from "@react-three/xr";
import { SpatialPhoto } from "./scene/SpatialPhoto";
import { ControlPanel } from "./xr/ControlPanel";
import { DesktopControls } from "./ui/DesktopControls";
import { useGallery, type Gallery } from "./state/useGallery";

const store = createXRStore();

// The floating panel only exists inside an active XR session.
function PanelGate({ gallery }: { gallery: Gallery }) {
  const session = useXR((state) => state.session);
  if (!session) return null;
  return <ControlPanel gallery={gallery} />;
}

export function App() {
  const gallery = useGallery();

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas camera={{ position: [0, 0, 3.2], fov: 45 }}>
        <color attach="background" args={["#101114"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 2, 3]} intensity={1.8} />
        <XR store={store}>
          {gallery.selected ? <SpatialPhoto image={gallery.selected} /> : null}
          <PanelGate gallery={gallery} />
        </XR>
      </Canvas>
      <DesktopControls gallery={gallery} store={store} />
    </div>
  );
}
