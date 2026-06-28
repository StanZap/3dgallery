import { Container, Image, Root, Text } from "@react-three/uikit";
import type { Gallery } from "../state/useGallery";
import { assetUrl } from "../state/useGallery";

// WebXR-only floating panel. Step 1 = static placement; reposition / follow-me /
// resize land in the next step.
const PANEL_POSITION: [number, number, number] = [0, 1.0, -1.6];

export function ControlPanel({ gallery }: { gallery: Gallery }) {
  const { images, selected, selectedId, setSelectedId, busy, status, process } = gallery;
  const label = busy ? "Working…" : selected?.processed ? "Remake 3D" : "Make 3D";

  return (
    <group position={PANEL_POSITION}>
      <Root
        pixelSize={0.0016}
        flexDirection="column"
        width={560}
        padding={18}
        gap={14}
        backgroundColor="#15171c"
        borderRadius={18}
      >
        <Text fontSize={22} color="#ffffff">
          3D gallery
        </Text>

        <Container flexDirection="row" flexWrap="wrap" gap={10}>
          {images.map((image) => (
            <Image
              key={image.id}
              src={assetUrl(image.image_url)}
              width={120}
              height={120}
              borderRadius={10}
              borderWidth={image.id === selectedId ? 3 : 0}
              borderColor="#3b82f6"
              onClick={() => setSelectedId(image.id)}
            />
          ))}
        </Container>

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
          <Container
            backgroundColor="#2a2d34"
            borderRadius={10}
            paddingX={18}
            paddingY={14}
            justifyContent="center"
            onClick={() => void gallery.refresh()}
          >
            <Text fontSize={18} color="#ffffff">
              Refresh
            </Text>
          </Container>
        </Container>

        {status ? (
          <Text fontSize={14} color="#9aa0aa">
            {status}
          </Text>
        ) : null}
      </Root>
    </group>
  );
}
