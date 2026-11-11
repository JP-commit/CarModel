import * as THREE from 'three';

export interface ProjectedLabelEntry {
  id: string;
  anchor: THREE.Vector3 | THREE.Object3D;
  element: HTMLElement;
  outwardNormal?: THREE.Vector3;
  offsetY?: number;
}

export interface LabelProjectionBounds {
  rightPanelOpen?: boolean;
  mobileExpanded?: boolean;
}

export class LabelProjector {
  private entries: ProjectedLabelEntry[] = [];
  private readonly lastCoords = new Map<string, [number, number]>();
  private readonly tempVec = new THREE.Vector3();
  private readonly worldPos = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();
  private visible = true;

  setEntries(entries: ProjectedLabelEntry[]): void {
    this.entries = entries;
    this.lastCoords.clear();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const entry of this.entries) {
      entry.element.style.display = visible ? '' : 'none';
    }
  }

  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    bounds: LabelProjectionBounds = {},
  ): void {
    if (!this.visible || width <= 0 || height <= 0) return;

    const isMobile = width <= 768;
    const minX = isMobile ? 24 : 84;
    const maxX = isMobile ? width - 24 : width - 28;
    const minY = isMobile ? 88 : 74;
    const maxY = isMobile
      ? height * (bounds.mobileExpanded ? 0.45 : 0.82)
      : height - 68;

    const panelLeftEdge = !isMobile && bounds.rightPanelOpen ? width - 388 : width;
    const flipThresholdX = isMobile
      ? width * 0.64
      : bounds.rightPanelOpen
        ? panelLeftEdge - 110
        : width * 0.7;

    for (const entry of this.entries) {
      if (entry.anchor instanceof THREE.Object3D) {
        entry.anchor.getWorldPosition(this.worldPos);
      } else {
        this.worldPos.copy(entry.anchor);
      }

      this.tempVec.copy(this.worldPos).project(camera);

      // Hide pins outside camera clip depth
      if (this.tempVec.z < -1 || this.tempVec.z > 1) {
        entry.element.classList.add('is-occluded');
        continue;
      }

      entry.element.classList.remove('is-occluded');

      // Hide hotspots that face away from the camera
      if (entry.outwardNormal) {
        this.toCam.copy(camera.position).sub(this.worldPos).normalize();
        const facing = entry.outwardNormal.dot(this.toCam);
        entry.element.classList.toggle('is-backfacing', facing < -0.08);
      }

      const rawX = (this.tempVec.x * 0.5 + 0.5) * width;
      const rawY = (-this.tempVec.y * 0.5 + 0.5) * height + (entry.offsetY ?? 0);

      // Hide dots that fall underneath the desktop right panel or mobile bottom sheet
      const underDesktopPanel = !isMobile && bounds.rightPanelOpen && rawX > panelLeftEdge;
      const underMobileSheet = isMobile && rawY > maxY;
      entry.element.classList.toggle('is-panel-hidden', underDesktopPanel || underMobileSheet);

      const x = Math.max(minX, Math.min(maxX, rawX));
      const y = Math.max(minY, Math.min(maxY, rawY));

      // Flip leader line & dark name tag to the left when approaching right edge or right panel
      entry.element.classList.toggle('is-flip-left', x > flipThresholdX);

      const prev = this.lastCoords.get(entry.id);
      if (!prev || Math.abs(prev[0] - x) > 0.25 || Math.abs(prev[1] - y) > 0.25) {
        this.lastCoords.set(entry.id, [x, y]);
        entry.element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
    }
  }

  clear(): void {
    this.entries = [];
    this.lastCoords.clear();
  }
}
