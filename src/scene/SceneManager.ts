import gsap from 'gsap';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { GraphicsQuality } from '../state/appState';

export type FrameCallback = (dt: number, elapsed: number) => void;
export type CustomRenderCallback = (renderer: THREE.WebGLRenderer, width: number, height: number) => void;

export function detectWebGLSupport(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    const matOrList = mesh.material;
    if (matOrList) {
      const list = Array.isArray(matOrList) ? matOrList : [matOrList];
      for (const mat of list) {
        materials.add(mat);
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) {
            textures.add(value);
          }
        }
      }
    }
  });

  for (const tex of textures) {
    tex.dispose();
  }
  for (const mat of materials) {
    mat.dispose();
  }
  for (const geo of geometries) {
    geo.dispose();
  }
}

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly container: HTMLElement;
  private readonly pmremGenerator: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private quality: GraphicsQuality = 'high';
  private readonly resizeObserver: ResizeObserver;
  private frameCallback: FrameCallback | null = null;
  private customRenderCallback: CustomRenderCallback | null = null;
  private resizeCallback: ((width: number, height: number) => void) | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    onContextLost?: () => void,
    initialQuality: GraphicsQuality = 'high',
  ) {
    this.container = container;
    this.quality = initialQuality;

    this.scene = new THREE.Scene();

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.08, 65);
    this.camera.position.set(3.85, 1.68, 4.25);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.loadStudioHdrEnvironment();

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.stop();
      onContextLost?.();
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  getViewportSize(): { width: number; height: number } {
    return {
      width: Math.max(this.container.clientWidth, 1),
      height: Math.max(this.container.clientHeight, 1),
    };
  }

  setFrameCallback(cb: FrameCallback | null): void {
    this.frameCallback = cb;
  }

  setCustomRenderCallback(cb: CustomRenderCallback | null): void {
    this.customRenderCallback = cb;
    if (!cb) {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(
        0,
        0,
        Math.max(this.container.clientWidth, 1),
        Math.max(this.container.clientHeight, 1),
      );
    }
  }

  setResizeCallback(cb: ((width: number, height: number) => void) | null): void {
    this.resizeCallback = cb;
  }

  start(): void {
    if (this.rafId !== null || this.disposed) return;
    gsap.ticker.lagSmoothing(0);
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.elapsed += dt;
      this.frameCallback?.(dt, this.elapsed);
      if (this.customRenderCallback) {
        this.customRenderCallback(
          this.renderer,
          Math.max(this.container.clientWidth, 1),
          Math.max(this.container.clientHeight, 1),
        );
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setQuality(quality: GraphicsQuality): void {
    if (this.quality === quality) return;
    this.quality = quality;
    this.handleResize();
  }

  getQuality(): GraphicsQuality {
    return this.quality;
  }

  private loadStudioHdrEnvironment(): void {
    const loader = new HDRLoader();
    loader.load(
      '/env/studio_1k.hdr',
      (hdrTex) => {
        if (this.disposed) {
          hdrTex.dispose();
          return;
        }
        hdrTex.mapping = THREE.EquirectangularReflectionMapping;
        const pmremTarget = this.pmremGenerator.fromEquirectangular(hdrTex);
        hdrTex.dispose();
        this.envRenderTarget?.dispose();
        this.envRenderTarget = pmremTarget;
        this.scene.environment = pmremTarget.texture;
      },
      undefined,
      (err) => {
        console.warn('[HowCarsWork] Failed to load 1k HDR environment:', err);
      },
    );
  }

  private handleResize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.resizeCallback?.(width, height);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    disposeObject3D(this.scene);
    this.envRenderTarget?.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
  }
}
