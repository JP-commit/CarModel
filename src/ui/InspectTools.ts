import * as THREE from 'three';
import { appStore, type ClipAxis } from '../state/appState';

export function buildShareableViewUrl(camera: THREE.PerspectiveCamera, target: THREE.Vector3): string {
  const snap = appStore.getSnapshot();
  const url = new URL(window.location.href);
  url.searchParams.set('car', snap.selectedCarId);
  url.searchParams.set('trans', snap.selectedTransmission);
  url.searchParams.set('engine', snap.selectedEngineConfig);
  url.searchParams.set('mode', snap.renderMode);
  if (snap.activeLesson) {
    url.searchParams.set('lesson', snap.activeLesson);
  } else if (snap.selectedSystem) {
    url.searchParams.set('sys', snap.selectedSystem);
  } else {
    url.searchParams.delete('lesson');
    url.searchParams.delete('sys');
  }
  url.searchParams.set('exp', snap.homeExplode.toFixed(2));
  url.searchParams.set(
    'cam',
    [
      camera.position.x,
      camera.position.y,
      camera.position.z,
      target.x,
      target.y,
      target.z,
    ]
      .map((n) => n.toFixed(2))
      .join(','),
  );
  return url.toString();
}

export function exportCanvasPng(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  filename = 'howcarswork-view.png',
): void {
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export class CrossSectionController {
  private readonly plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);
  private targetRoot: THREE.Object3D | null = null;
  private bounds = new THREE.Box3();

  attach(root: THREE.Object3D | null): void {
    this.clear();
    this.targetRoot = root;
    if (!root) return;
    root.updateMatrixWorld(true);
    this.bounds.setFromObject(root);
    this.apply(appStore.getSnapshot().clipAxis, appStore.getSnapshot().clipRatio);
  }

  apply(axis: ClipAxis, ratio: number): void {
    if (!this.targetRoot) return;
    const isOff = axis === 'none';
    const clamped = Math.max(0.05, Math.min(0.95, ratio));
    if (axis === 'x') {
      const min = this.bounds.min.x;
      const max = this.bounds.max.x;
      const cut = min + (max - min) * clamped;
      this.plane.set(new THREE.Vector3(-1, 0, 0), cut);
    } else if (axis === 'y') {
      const min = this.bounds.min.y;
      const max = this.bounds.max.y;
      const cut = min + (max - min) * clamped;
      this.plane.set(new THREE.Vector3(0, -1, 0), cut);
    } else if (axis === 'z') {
      const min = this.bounds.min.z;
      const max = this.bounds.max.z;
      const cut = min + (max - min) * clamped;
      this.plane.set(new THREE.Vector3(0, 0, -1), cut);
    }

    this.targetRoot.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (!m || Array.isArray(m) || obj.userData.isOutlineChild) return;
      m.clippingPlanes = isOff ? null : [this.plane];
      m.needsUpdate = true;
    });
  }

  clear(): void {
    if (!this.targetRoot) return;
    this.targetRoot.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (!m || Array.isArray(m)) return;
      if (m.clippingPlanes) {
        m.clippingPlanes = null;
        m.needsUpdate = true;
      }
    });
    this.targetRoot = null;
  }
}

export class MeasureRulerTool {
  readonly group = new THREE.Group();
  private active = false;
  private pointA: THREE.Vector3 | null = null;
  private pointB: THREE.Vector3 | null = null;
  private markerA: THREE.Mesh;
  private markerB: THREE.Mesh;
  private lineMesh: THREE.Line;

  constructor(scene: THREE.Scene) {
    this.group.name = 'MeasureRulerOverlay';
    this.group.visible = false;
    const mGeo = new THREE.SphereGeometry(0.032, 12, 12);
    const mMat = new THREE.MeshBasicMaterial({ color: '#d93a1e', depthTest: false });
    this.markerA = new THREE.Mesh(mGeo, mMat);
    this.markerB = new THREE.Mesh(mGeo, mMat);
    this.markerA.renderOrder = 15;
    this.markerB.renderOrder = 15;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: '#d93a1e', depthTest: false });
    this.lineMesh = new THREE.Line(lineGeo, lineMat);
    this.lineMesh.renderOrder = 15;
    this.group.add(this.markerA, this.markerB, this.lineMesh);
    scene.add(this.group);
  }

  setActive(next: boolean): void {
    this.active = next;
    if (!next) {
      this.reset();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  reset(): void {
    this.pointA = null;
    this.pointB = null;
    this.group.visible = false;
  }

  recordPoint(worldPoint: THREE.Vector3): string | null {
    if (!this.active) return null;
    if (!this.pointA || this.pointB) {
      this.pointA = worldPoint.clone();
      this.pointB = null;
      this.markerA.position.copy(this.pointA);
      this.markerB.visible = false;
      this.lineMesh.visible = false;
      this.group.visible = true;
      return 'Point A placed — click a second point to measure';
    }
    this.pointB = worldPoint.clone();
    this.markerB.position.copy(this.pointB);
    this.markerB.visible = true;
    this.lineMesh.visible = true;
    this.lineMesh.geometry.setFromPoints([this.pointA, this.pointB]);
    const distMeters = this.pointA.distanceTo(this.pointB);
    return `Measured: ${(distMeters * 100).toFixed(1)} cm (${Math.round(distMeters * 1000)} mm)`;
  }

  dispose(): void {
    this.markerA.geometry.dispose();
    (this.markerA.material as THREE.Material).dispose();
    this.lineMesh.geometry.dispose();
    (this.lineMesh.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}

export function createDeveloperDebugHud(uiRoot: HTMLElement): {
  recordFrame: (dt: number, renderer: THREE.WebGLRenderer, partCount: number) => void;
  toggle: () => void;
  destroy: () => void;
} {
  const hud = document.createElement('div');
  hud.className = 'dev-debug-hud';
  hud.hidden = true;
  uiRoot.appendChild(hud);

  let visible = false;
  let frames = 0;
  let accum = 0;
  let lastFps = 60;

  return {
    toggle: () => {
      visible = !visible;
      hud.hidden = !visible;
    },
    recordFrame: (dt, renderer, partCount) => {
      if (!visible) return;
      frames += 1;
      accum += dt;
      if (accum >= 0.4) {
        lastFps = Math.round(frames / accum);
        frames = 0;
        accum = 0;
        const info = renderer.info;
        hud.innerHTML = `
          <div><strong>FPS:</strong> ${lastFps}</div>
          <div><strong>Calls:</strong> ${info.render.calls} · <strong>Tris:</strong> ${info.render.triangles.toLocaleString()}</div>
          <div><strong>Geos:</strong> ${info.memory.geometries} · <strong>Tex:</strong> ${info.memory.textures} · <strong>Parts:</strong> ${partCount}</div>
        `;
      }
    },
    destroy: () => hud.remove(),
  };
}

