import { useCallback, useEffect, useState } from "react";
import type { ImageItem } from "../types";

// Empty default = same origin; Vite proxies /api to the backend. Override with
// VITE_API_BASE only if the backend is served elsewhere.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function assetUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export function imageThumbnailUrl(image: ImageItem): string {
  return assetUrl(image.thumbnail_url ?? image.image_url);
}

export type Gallery = ReturnType<typeof useGallery>;

export function useGallery() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    imageId: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/images`);
    if (!response.ok)
      throw new Error(`Could not load images: ${response.statusText}`);
    const data: ImageItem[] = await response.json();
    setImages(data);
    setSelectedId((current) => current ?? data[0]?.id ?? null);
  }, []);

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [refresh]);

  const process = useCallback(async (id: string): Promise<ImageItem> => {
    setBusy(true);
    setStatus({ imageId: id, message: "Generating depth and mesh…" });
    try {
      const response = await fetch(`${API_BASE}/api/images/${id}/process`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ detail: response.statusText }));
        throw new Error(body.detail ?? response.statusText);
      }
      const payload = await response.json();
      const updated = payload.image as ImageItem;
      setImages((prev) =>
        prev.map((image) => (image.id === updated.id ? updated : image)),
      );
      setStatus({ imageId: id, message: "3D asset ready." });
      return updated;
    } catch (e) {
      setStatus({
        imageId: id,
        message: e instanceof Error ? e.message : "Processing failed.",
      });
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const selected = images.find((image) => image.id === selectedId) ?? null;
  return {
    images,
    selected,
    selectedId,
    setSelectedId,
    busy,
    status,
    error,
    refresh,
    process,
  };
}
