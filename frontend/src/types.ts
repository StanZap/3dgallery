export type ImageItem = {
  id: string;
  name: string;
  width: number;
  height: number;
  image_url: string;
  processed: boolean;
  mesh_url: string | null;
  depth_url: string | null;
};
