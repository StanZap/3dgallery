import type { ImageItem } from "./gallery";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from "three";

export class Viewer3D {
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private model: Group | Mesh | null = null;
  private readonly clock = new Clock();

  constructor(private readonly assetUrl: (path: string) => string) {}

  mount(root: HTMLElement, image: ImageItem): void {
    this.dispose();
    root.innerHTML = `<div class="pane-label">3D</div>`;

    const scene = new Scene();
    scene.background = new Color(0x101114);
    const camera = new PerspectiveCamera(45, root.clientWidth / root.clientHeight, 0.01, 100);
    camera.position.set(0, 0, 3.2);

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(root.clientWidth, root.clientHeight);
    root.appendChild(renderer.domElement);

    scene.add(new AmbientLight(0xffffff, 1.2));
    const key = new DirectionalLight(0xffffff, 1.8);
    key.position.set(1, 2, 3);
    scene.add(key);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    if (image.mesh_url) {
      this.loadMesh(image.mesh_url);
    } else {
      this.loadFlatPreview(image.image_url);
    }

    window.addEventListener("resize", this.resize);
    renderer.setAnimationLoop(() => this.renderFrame());
  }

  async enterXR(): Promise<void> {
    if (!this.renderer) return;
    const xr = (navigator as Navigator & { xr?: any }).xr;
    if (!xr) {
      throw new Error("WebXR is not available in this browser.");
    }
    const supported = await xr.isSessionSupported("immersive-vr");
    if (!supported) {
      throw new Error("Immersive VR sessions are not supported on this device.");
    }
    const session = await xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
    });
    await this.renderer.xr.setSession(session);
  }

  private loadMesh(meshPath: string): void {
    if (!this.scene) return;
    const loader = new GLTFLoader();
    loader.load(this.assetUrl(meshPath), (gltf) => {
      this.model = gltf.scene;
      this.model.scale.setScalar(1.05);
      this.scene?.add(this.model);
    });
  }

  private loadFlatPreview(imagePath: string): void {
    if (!this.scene) return;
    const texture = new TextureLoader().load(this.assetUrl(imagePath));
    texture.colorSpace = SRGBColorSpace;
    const geometry = new PlaneGeometry(2.3, 1.55, 1, 1);
    const material = new MeshBasicMaterial({ map: texture });
    this.model = new Mesh(geometry, material);
    this.scene.add(this.model);
  }

  private renderFrame(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    const elapsed = this.clock.getElapsedTime();
    if (this.model && !this.renderer.xr.isPresenting) {
      this.model.rotation.y = Math.sin(elapsed * 0.7) * 0.13;
      this.model.rotation.x = Math.sin(elapsed * 0.45) * 0.035;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private resize = (): void => {
    if (!this.renderer || !this.camera) return;
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    this.camera.aspect = parent.clientWidth / parent.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(parent.clientWidth, parent.clientHeight);
  };

  private dispose(): void {
    window.removeEventListener("resize", this.resize);
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.renderer.dispose();
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.model = null;
  }
}
