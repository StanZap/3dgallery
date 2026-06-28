import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Handle, HandleTarget } from "@react-three/handle";
import { useXR } from "@react-three/xr";
import { Container, Image, Root, Text } from "@react-three/uikit";
import { Group, Vector3 } from "three";
import type { Gallery } from "../state/useGallery";
import { imageThumbnailUrl } from "../state/useGallery";

const PANEL_POSITION: [number, number, number] = [0, 1.0, -1.6];
const PANEL_PIXEL_SIZE = 0.0016;
const PANEL_FOLLOW_DISTANCE = 1.6;
const MIN_PANEL_SCALE = 0.7;
const MAX_PANEL_SCALE = 1.45;
const PANEL_SCALE_STEP = 0.15;
const PHOTO_SCALE_STEP = 0.15;
const MIN_PHOTO_SCALE = 0.45;
const MAX_PHOTO_SCALE = 2.5;
const MAX_XR_THUMBNAILS = 8;

const forward = new Vector3();

function clampPanelScale(value: number) {
  return Math.min(MAX_PANEL_SCALE, Math.max(MIN_PANEL_SCALE, value));
}

function clampPhotoScale(value: number) {
  return Math.min(MAX_PHOTO_SCALE, Math.max(MIN_PHOTO_SCALE, value));
}

function PanelButton({
  label,
  onClick,
  flexGrow,
}: {
  label: string;
  onClick: () => void;
  flexGrow?: number;
}) {
  return (
    <Container
      flexGrow={flexGrow}
      backgroundColor="#2a2d34"
      borderRadius={10}
      paddingX={18}
      paddingY={14}
      justifyContent="center"
      onClick={onClick}
    >
      <Text fontSize={18} color="#ffffff">
        {label}
      </Text>
    </Container>
  );
}

export type PhotoControls = {
  scale: number;
  setScale: (update: (scale: number) => number) => void;
  recenter: () => void;
  useMesh: boolean;
  toggleMesh: () => void;
};

export function ControlPanel({
  gallery,
  photoControls,
}: {
  gallery: Gallery;
  photoControls: PhotoControls;
}) {
  const { images, selected, selectedId, setSelectedId, busy, status, process } =
    gallery;
  const panelRef = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const session = useXR((state) => state.session);
  const [follow, setFollow] = useState(true);
  const [panelScale, setPanelScale] = useState(1);
  const label = busy
    ? "Working…"
    : selected?.processed
      ? "Remake 3D"
      : "Make 3D";
  const visibleImages = images.slice(0, MAX_XR_THUMBNAILS);

  useFrame(() => {
    if (!follow || !panelRef.current) return;
    camera.getWorldDirection(forward);
    panelRef.current.position
      .copy(camera.position)
      .addScaledVector(forward, PANEL_FOLLOW_DISTANCE);
    panelRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <HandleTarget targetRef={panelRef}>
      <group ref={panelRef} position={PANEL_POSITION}>
        <Root
          pixelSize={PANEL_PIXEL_SIZE * panelScale}
          flexDirection="column"
          width={560}
          padding={18}
          gap={14}
          backgroundColor="#15171c"
          borderRadius={18}
        >
          <Handle
            targetRef="from-context"
            translate
            rotate={false}
            scale={false}
          >
            <Container
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              gap={12}
              backgroundColor="#20242c"
              borderRadius={12}
              paddingX={14}
              paddingY={12}
            >
              <Text fontSize={22} color="#ffffff">
                3D gallery
              </Text>
              <Text fontSize={13} color="#9aa0aa">
                grab title to move
              </Text>
            </Container>
          </Handle>

          <Container flexDirection="row" gap={10}>
            <PanelButton label="Exit VR" onClick={() => void session?.end()} />
            <PanelButton
              label={follow ? "Follow: on" : "Follow: off"}
              flexGrow={1}
              onClick={() => setFollow((current) => !current)}
            />
            <PanelButton
              label="−"
              onClick={() =>
                setPanelScale((scale) =>
                  clampPanelScale(scale - PANEL_SCALE_STEP),
                )
              }
            />
            <PanelButton
              label="+"
              onClick={() =>
                setPanelScale((scale) =>
                  clampPanelScale(scale + PANEL_SCALE_STEP),
                )
              }
            />
          </Container>

          <Container flexDirection="row" gap={10}>
            <PanelButton
              label="Recenter photo"
              flexGrow={1}
              onClick={photoControls.recenter}
            />
            <PanelButton
              label="Photo −"
              onClick={() =>
                photoControls.setScale((scale) =>
                  clampPhotoScale(scale - PHOTO_SCALE_STEP),
                )
              }
            />
            <PanelButton
              label="Photo +"
              onClick={() =>
                photoControls.setScale((scale) =>
                  clampPhotoScale(scale + PHOTO_SCALE_STEP),
                )
              }
            />
          </Container>

          <Container flexDirection="row" gap={10}>
            <PanelButton
              label={photoControls.useMesh ? "3D: on" : "3D: off"}
              flexGrow={1}
              onClick={photoControls.toggleMesh}
            />
          </Container>

          <Text fontSize={13} color="#9aa0aa">
            Photo scale: {photoControls.scale.toFixed(2)}× · 3D loads only when
            enabled
          </Text>

          <Container flexDirection="row" flexWrap="wrap" gap={10}>
            {visibleImages.map((image) => (
              <Image
                key={image.id}
                src={imageThumbnailUrl(image)}
                width={120}
                height={120}
                borderRadius={10}
                borderWidth={image.id === selectedId ? 3 : 0}
                borderColor="#3b82f6"
                onClick={() => setSelectedId(image.id)}
              />
            ))}
          </Container>

          {images.length > visibleImages.length ? (
            <Text fontSize={13} color="#9aa0aa">
              Showing {visibleImages.length} of {images.length} images in VR for
              performance.
            </Text>
          ) : null}

          <Container flexDirection="row" gap={10}>
            <Container
              flexGrow={1}
              backgroundColor="#1b6cff"
              borderRadius={10}
              paddingY={14}
              justifyContent="center"
              onClick={() => {
                if (!busy && selected) void process(selected.id);
              }}
            >
              <Text fontSize={18} color="#ffffff">
                {label}
              </Text>
            </Container>
            <PanelButton
              label="Refresh"
              onClick={() => void gallery.refresh()}
            />
          </Container>

          {status ? (
            <Text fontSize={14} color="#9aa0aa">
              {status}
            </Text>
          ) : null}
        </Root>
      </group>
    </HandleTarget>
  );
}
