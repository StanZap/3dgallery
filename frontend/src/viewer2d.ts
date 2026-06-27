import type { ImageItem } from "./gallery";

export class Viewer2D {
  constructor(private readonly assetUrl: (path: string) => string) {}

  mount(root: HTMLElement, image: ImageItem): void {
    root.innerHTML = `
      <div class="pane-label">2D</div>
      <img class="photo-preview" src="${this.assetUrl(image.image_url)}" alt="${image.name}" />
    `;
  }
}

