import { useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  noEvents,
  PointerEvents,
  createXRStore,
  useXR,
  XR,
} from "@react-three/xr";
import type { Group } from "three";
import { SpatialPhoto } from "./scene/SpatialPhoto";
import {
  ControlPanel,
  ControlPanelLite,
  type PhotoControls,
} from "./xr/ControlPanel";
import { DesktopControls } from "./ui/DesktopControls";
import { useGallery, type Gallery } from "./state/useGallery";

const store = createXRStore({
  // Quest supports immersive-ar, and @react-three/xr's default auto-offer prefers
  // AR when available. This gallery is a VR scene, so only enter VR explicitly.
  offerSession: false,
  enterGrantedSession: ["immersive-vr"],
});

// The floating panel only exists inside an active XR session.
function PanelGate({
  gallery,
  photoControls,
  xrPanel,
  xrPanelLite,
}: {
  gallery: Gallery;
  photoControls: PhotoControls;
  xrPanel: boolean;
  xrPanelLite: boolean;
}) {
  const session = useXR((state) => state.session);
  if (!session) return null;
  if (xrPanelLite)
    return <ControlPanelLite gallery={gallery} photoControls={photoControls} />;
  if (xrPanel)
    return <ControlPanel gallery={gallery} photoControls={photoControls} />;
  return null;
}

function XRBeacon({ gallery }: { gallery: Gallery }) {
  const session = useXR((state) => state.session);
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    if (!session || !group.current) return;
    group.current.position.set(0, -0.08, -1.1).applyMatrix4(camera.matrixWorld);
    group.current.quaternion.copy(camera.quaternion);
  });

  if (!session) return null;

  return (
    <>
      <group ref={group}>
        <mesh position={[-0.18, 0, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshBasicMaterial
            color={
              gallery.error
                ? "#ff4d4d"
                : gallery.selected
                  ? "#38bdf8"
                  : "#facc15"
            }
          />
        </mesh>
        <mesh position={[0.02, 0, -0.02]}>
          <planeGeometry args={[0.36, 0.14]} />
          <meshBasicMaterial color="#164e63" />
        </mesh>
      </group>

      <group position={[0, 1.45, -1.8]}>
        <mesh>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh position={[0, -0.5, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.38, 48]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>
    </>
  );
}

function XRSafeBoot({ enabled }: { enabled: boolean }) {
  const session = useXR((state) => state.session);
  if (!session || !enabled) return null;

  return (
    <group position={[0, 1.45, -1.35]}>
      <mesh>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshBasicMaterial color="#00ff66" />
      </mesh>
      <mesh position={[0, -0.34, 0]}>
        <planeGeometry args={[0.8, 0.08]} />
        <meshBasicMaterial color="#1d4ed8" />
      </mesh>
    </group>
  );
}

function XRButton({
  position,
  color,
  onClick,
  children,
}: {
  position: [number, number, number];
  color: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <planeGeometry args={[0.22, 0.16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {children}
    </group>
  );
}

function XRPrimitiveControls({
  gallery,
  photoControls,
}: {
  gallery: Gallery;
  photoControls: PhotoControls;
}) {
  const session = useXR((state) => state.session);
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    if (!session || !group.current) return;
    group.current.position.set(0, -0.42, -1.2).applyMatrix4(camera.matrixWorld);
    group.current.quaternion.copy(camera.quaternion);
  });

  if (!session) return null;

  const selectedIndex = gallery.images.findIndex(
    (image) => image.id === gallery.selectedId,
  );
  const selectOffset = (offset: number) => {
    if (gallery.images.length === 0) return;
    const current = selectedIndex < 0 ? 0 : selectedIndex;
    const next =
      (current + offset + gallery.images.length) % gallery.images.length;
    gallery.setSelectedId(gallery.images[next].id);
    photoControls.recenter();
  };

  return (
    <group ref={group}>
      <XRButton
        position={[-0.5, 0, 0]}
        color="#2563eb"
        onClick={() => selectOffset(-1)}
      >
        <mesh position={[0, 0, 0.002]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.04, 0.08, 3]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </XRButton>
      <XRButton
        position={[-0.25, 0, 0]}
        color="#2563eb"
        onClick={() => selectOffset(1)}
      >
        <mesh position={[0, 0, 0.002]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.04, 0.08, 3]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </XRButton>
      <XRButton
        position={[0, 0, 0]}
        color="#475569"
        onClick={() =>
          photoControls.setScale((scale) => Math.max(0.45, scale - 0.15))
        }
      >
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[0.09, 0.018]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </XRButton>
      <XRButton
        position={[0.25, 0, 0]}
        color="#475569"
        onClick={() =>
          photoControls.setScale((scale) => Math.min(2.5, scale + 0.15))
        }
      >
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[0.09, 0.018]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.003]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[0.09, 0.018]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </XRButton>
      <XRButton
        position={[0.5, 0, 0]}
        color="#16a34a"
        onClick={photoControls.recenter}
      >
        <mesh position={[0, 0, 0.002]}>
          <ringGeometry args={[0.035, 0.045, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </XRButton>
    </group>
  );
}

function XRExitButton() {
  const session = useXR((state) => state.session);
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    if (!session || !group.current) return;
    group.current.position
      .set(0.42, -0.28, -1.05)
      .applyMatrix4(camera.matrixWorld);
    group.current.quaternion.copy(camera.quaternion);
  });

  if (!session) return null;

  const exit = () => void session.end();

  return (
    <group ref={group} onClick={exit} onPointerDown={exit}>
      <mesh>
        <planeGeometry args={[0.22, 0.22]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.002]}>
        <planeGeometry args={[0.16, 0.025]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]} position={[0, 0, 0.003]}>
        <planeGeometry args={[0.16, 0.025]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export function App() {
  const gallery = useGallery();
  const [photoScale, setPhotoScale] = useState(1);
  const [imageScale, setImageScale] = useState(1);
  const [photoRecenterKey, setPhotoRecenterKey] = useState(0);
  const [xrUseMesh, setXrUseMesh] = useState(false);
  const [safeXr, setSafeXr] = useState(true);
  const [xrPanel, setXrPanel] = useState(false);
  const [xrPanelLite, setXrPanelLite] = useState(false);
  const [xrHandles, setXrHandles] = useState(false);
  const photoControls: PhotoControls = {
    scale: photoScale,
    setScale: setPhotoScale,
    recenter: () => {
      setPhotoScale(1);
      setXrUseMesh(false);
      setPhotoRecenterKey((key) => key + 1);
    },
    useMesh: xrUseMesh,
    toggleMesh: () => setXrUseMesh((current) => !current),
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        events={noEvents}
        gl={{ alpha: false }}
        camera={{ position: [0, 0, 3.2], fov: 45 }}
      >
        <color attach="background" args={["#101114"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 2, 3]} intensity={1.8} />
        <XR store={store}>
          <PointerEvents />
          <XRExitButton />
          <XRSafeBoot enabled={safeXr} />
          {!safeXr ? <XRBeacon gallery={gallery} /> : null}
          {!safeXr ? (
            <XRPrimitiveControls
              gallery={gallery}
              photoControls={photoControls}
            />
          ) : null}
          {!safeXr && gallery.selected ? (
            <SpatialPhoto
              key={`${gallery.selected.id}-${photoRecenterKey}-${xrHandles ? "handles" : "plain"}`}
              image={gallery.selected}
              xrScale={photoScale}
              xrUseMesh={xrUseMesh}
              xrInteractive={xrHandles}
            />
          ) : null}
          {!safeXr && (xrPanel || xrPanelLite) ? (
            <PanelGate
              gallery={gallery}
              photoControls={photoControls}
              xrPanel={xrPanel}
              xrPanelLite={xrPanelLite}
            />
          ) : null}
        </XR>
      </Canvas>
      <DesktopControls
        gallery={gallery}
        store={store}
        safeXr={safeXr}
        setSafeXr={setSafeXr}
        xrPanel={xrPanel}
        setXrPanel={setXrPanel}
        xrPanelLite={xrPanelLite}
        setXrPanelLite={setXrPanelLite}
        xrHandles={xrHandles}
        setXrHandles={setXrHandles}
        imageScale={imageScale}
        setImageScale={setImageScale}
      />
    </div>
  );
}
