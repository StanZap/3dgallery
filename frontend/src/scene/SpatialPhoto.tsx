import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { useXR } from "@react-three/xr";
import { Handle, HandleTarget } from "@react-three/handle";
import { SRGBColorSpace, type Group } from "three";
import type { ImageItem } from "../types";
import { assetUrl, imageThumbnailUrl } from "../state/useGallery";

// While in VR the photo sits ~2.2 m ahead at eye height; on desktop it stays at
// the origin so the fixed camera (z=3.2) frames it. (Phase 2 swaps the inner
// content for a true stereo pair without touching this rig.)
const XR_POSITION: [number, number, number] = [0, 1.5, -2.2];
const DESKTOP_POSITION: [number, number, number] = [0, 0, 0];

function Mesh3D({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.05} />;
}

function FlatPreview({ url, aspect }: { url: string; aspect: number }) {
  const texture = useTexture(url, (t) => {
    t.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh>
      <planeGeometry args={[2.3, 2.3 / aspect]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

export function SpatialPhoto({
  image,
  xrScale = 1,
  xrUseMesh = false,
  xrInteractive = false,
}: {
  image: ImageItem;
  xrScale?: number;
  xrUseMesh?: boolean;
  xrInteractive?: boolean;
}) {
  const session = useXR((state) => state.session);
  const group = useRef<Group>(null);

  useFrame(() => {
    // Gentle idle spin on desktop only; in VR the user manipulates it directly.
    if (session || !group.current) return;
    const t = performance.now() / 1000;
    group.current.rotation.y = Math.sin(t * 0.7) * 0.13;
    group.current.rotation.x = Math.sin(t * 0.45) * 0.035;
  });

  const shouldUseMesh = Boolean(image.mesh_url && (!session || xrUseMesh));
  const content = (
    <group ref={group}>
      <Suspense fallback={null}>
        {shouldUseMesh ? (
          <Mesh3D url={assetUrl(image.mesh_url!)} />
        ) : (
          <FlatPreview
            url={session ? imageThumbnailUrl(image) : assetUrl(image.image_url)}
            aspect={image.width / image.height}
          />
        )}
      </Suspense>
    </group>
  );

  if (!session) {
    return <group position={DESKTOP_POSITION}>{content}</group>;
  }

  if (!xrInteractive) {
    return (
      <group position={XR_POSITION} scale={xrScale}>
        {content}
      </group>
    );
  }

  return (
    <group position={XR_POSITION} scale={xrScale}>
      <HandleTarget>
        <Handle translate rotate scale={{ uniform: true }}>
          {content}
        </Handle>
      </HandleTarget>
    </group>
  );
}
