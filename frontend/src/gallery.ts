import { Maximize2, RefreshCcw, Sparkles } from "lucide";
import { createIcons } from "lucide";
import { Viewer2D } from "./viewer2d";
import { Viewer3D } from "./viewer3d";

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

type ProcessResponse = {
  image: ImageItem;
  depth_url: string;
  mesh_url: string;
  metadata_url: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export class GalleryApp {
  private images: ImageItem[] = [];
  private selected: ImageItem | null = null;
  private busy = false;
  private statusText = "";
  private readonly viewer2d: Viewer2D;
  private readonly viewer3d: Viewer3D;

  constructor(private readonly root: HTMLElement) {
    this.viewer2d = new Viewer2D((path) => this.assetUrl(path));
    this.viewer3d = new Viewer3D((path) => this.assetUrl(path));
  }

  async start(): Promise<void> {
    await this.loadImages();
    this.selected = this.images[0] ?? null;
    this.render();
  }

  private async loadImages(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/images`);
    if (!response.ok) {
      throw new Error(`Could not load images: ${response.statusText}`);
    }
    this.images = await response.json();
  }

  private render(): void {
    this.root.innerHTML = `
      <section class="shell">
        <aside class="sidebar">
          <div class="brand">
            <span>3D Gallery</span>
            <button class="icon-button" data-action="refresh" title="Refresh gallery" aria-label="Refresh gallery">
              <i data-lucide="refresh-ccw"></i>
            </button>
          </div>
          <div class="thumb-grid">
            ${this.images.map((image) => this.renderThumb(image)).join("")}
          </div>
        </aside>
        <section class="stage">
          ${this.renderStage()}
        </section>
      </section>
    `;
    createIcons({ icons: { RefreshCcw, Sparkles, Maximize2 } });
    this.bindEvents();
    this.mountViewer();
  }

  private renderThumb(image: ImageItem): string {
    const selected = this.selected?.id === image.id ? "is-selected" : "";
    const status = image.processed ? "3D" : "2D";
    return `
      <button class="thumb ${selected}" data-image-id="${image.id}" title="${image.name}">
        <img src="${this.assetUrl(image.image_url)}" alt="" loading="lazy" />
        <span>${image.name}</span>
        <b>${status}</b>
      </button>
    `;
  }

  private renderStage(): string {
    if (!this.selected) {
      return `<div class="empty-state">Add images to the selected folder, then refresh.</div>`;
    }

    const canEnter = this.selected.mesh_url ? "" : "disabled";
    const processLabel = this.busy ? "Working" : this.selected.processed ? "Remake 3D" : "Make 3D";
    return `
      <header class="toolbar">
        <div>
          <h1>${this.selected.name}</h1>
          <p>${this.selected.width} x ${this.selected.height}</p>
        </div>
        <div class="actions">
          <button class="command" data-action="process" ${this.busy ? "disabled" : ""}>
            <i data-lucide="sparkles"></i>
            <span>${processLabel}</span>
          </button>
          <button class="command" data-action="enter-xr" ${canEnter}>
            <i data-lucide="maximize-2"></i>
            <span>Enter XR</span>
          </button>
        </div>
      </header>
      ${this.statusText ? `<div class="status-line">${this.statusText}</div>` : ""}
      <div class="viewer-layout">
        <div id="viewer2d" class="viewer-pane"></div>
        <div id="viewer3d" class="viewer-pane"></div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-image-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selected = this.images.find((image) => image.id === button.dataset.imageId) ?? null;
        this.render();
      });
    });

    this.root.querySelector<HTMLButtonElement>("[data-action='refresh']")?.addEventListener("click", async () => {
      await this.loadImages();
      if (this.selected) {
        this.selected = this.images.find((image) => image.id === this.selected?.id) ?? this.images[0] ?? null;
      } else {
        this.selected = this.images[0] ?? null;
      }
      this.render();
    });

    this.root.querySelector<HTMLButtonElement>("[data-action='process']")?.addEventListener("click", () => {
      void this.processSelected();
    });

    this.root.querySelector<HTMLButtonElement>("[data-action='enter-xr']")?.addEventListener("click", () => {
      void this.viewer3d.enterXR();
    });
  }

  private mountViewer(): void {
    const image = this.selected;
    if (!image) return;

    const viewer2dRoot = this.root.querySelector<HTMLElement>("#viewer2d");
    const viewer3dRoot = this.root.querySelector<HTMLElement>("#viewer3d");
    if (viewer2dRoot) {
      this.viewer2d.mount(viewer2dRoot, image);
    }
    if (viewer3dRoot) {
      this.viewer3d.mount(viewer3dRoot, image);
    }
  }

  private async processSelected(): Promise<void> {
    if (!this.selected) return;
    this.busy = true;
    this.statusText = "Generating depth and mesh...";
    this.render();
    try {
      const response = await fetch(`${API_BASE}/api/images/${this.selected.id}/process`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(body.detail ?? response.statusText);
      }
      const processed: ProcessResponse = await response.json();
      this.images = this.images.map((image) => (image.id === processed.image.id ? processed.image : image));
      this.selected = processed.image;
      this.statusText = "3D asset ready.";
    } catch (error) {
      this.statusText = error instanceof Error ? error.message : "Processing failed.";
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private assetUrl(path: string): string {
    if (path.startsWith("http")) return path;
    return `${API_BASE}${path}`;
  }
}
