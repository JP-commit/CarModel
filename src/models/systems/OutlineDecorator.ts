import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { RenderMode } from '../../state/appState';

interface DecoratedMeshRecord {
  mesh: THREE.Mesh;
  partId: string | null;
  solidMat: THREE.Material | THREE.Material[];
  solidRenderOrder: number;
  edgeLine: LineSegments2 | null;
  edgeGeo: LineSegmentsGeometry | null;
}

export interface LessonOutlineController {
  setRenderMode: (mode: RenderMode) => void;
  setXRay: (enabled: boolean) => void;
  highlightPart: (partId: string | null) => void;
  setHiddenParts: (hidden: Set<string>) => void;
  setResolution: (width: number, height: number) => void;
  syncDynamicGeometries: () => void;
  dispose: () => void;
}

function getMeshPartId(mesh: THREE.Object3D): string | null {
  let cur: THREE.Object3D | null = mesh;
  while (cur) {
    if (typeof cur.userData.partId === 'string') return cur.userData.partId;
    cur = cur.parent;
  }
  return null;
}

/**
 * Attaches EdgesGeometry-backed LineSegments2 children directly onto each animated Mesh
 * inside a lesson model so moving/rotating/scaling parts (pistons, valves, springs, gears,
 * pulleys, clutches) animate seamlessly in BOTH Solid and Outline modes.
 */
export function createLessonOutlineController(
  root: THREE.Object3D,
  drawBufSize: THREE.Vector2,
  xrayPartIds: string[] = ['cylinder-block', 'casing'],
): LessonOutlineController {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const bw = Math.max(1, drawBufSize.x);
  const bh = Math.max(1, drawBufSize.y);

  const edgeInkMat = new LineMaterial({
    color: 0x1c1b19,
    linewidth: 1.55 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    resolution: new THREE.Vector2(bw, bh),
  });

  const edgeAccentMat = new LineMaterial({
    color: 0xd93a1e,
    linewidth: 2.55 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    resolution: new THREE.Vector2(bw, bh),
  });

  const edgeXrayMat = new LineMaterial({
    color: 0x45413a,
    linewidth: 1.15 * dpr,
    dashed: true,
    dashScale: 1,
    dashSize: 0.04,
    gapSize: 0.028,
    transparent: true,
    opacity: 0.48,
    depthTest: false,
    depthWrite: false,
    resolution: new THREE.Vector2(bw, bh),
  });

  const paperFillMat = new THREE.MeshBasicMaterial({
    color: '#fdf9f6',
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide,
  });

  const paperXrayMat = new THREE.MeshBasicMaterial({
    color: '#f5f2eb',
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const paperHighlightMat = new THREE.MeshBasicMaterial({
    color: '#d93a1e',
    transparent: true,
    opacity: 0.24,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide,
  });

  const sharedEdgeCache = new Map<THREE.BufferGeometry, Float32Array | null>();
  const createdLineGeos: LineSegmentsGeometry[] = [];
  const records: DecoratedMeshRecord[] = [];
  const xraySet = new Set(xrayPartIds);

  const buildEdgePositions = (geo: THREE.BufferGeometry): Float32Array | null => {
    if (!geo.attributes.position) return null;
    const edges = new THREE.EdgesGeometry(geo, 30);
    const attr = edges.attributes.position;
    const arr = attr && attr.count >= 2 ? new Float32Array(attr.array as ArrayLike<number>) : null;
    edges.dispose();
    return arr;
  };

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.isOutlineChild || mesh.userData.lessonOnly || mesh.userData.skipOutlineEdges) {
      return;
    }
    if ((obj as THREE.InstancedMesh).isInstancedMesh) return;

    let edgePos = sharedEdgeCache.get(mesh.geometry);
    if (edgePos === undefined) {
      edgePos = buildEdgePositions(mesh.geometry);
      sharedEdgeCache.set(mesh.geometry, edgePos);
    }

    let edgeGeo: LineSegmentsGeometry | null = null;
    let edgeLine: LineSegments2 | null = null;
    if (edgePos && edgePos.length >= 6) {
      edgeGeo = new LineSegmentsGeometry();
      edgeGeo.setPositions(edgePos);
      createdLineGeos.push(edgeGeo);

      edgeLine = new LineSegments2(edgeGeo, edgeInkMat);
      edgeLine.name = `${mesh.name || 'LessonPart'}_OutlineEdge`;
      edgeLine.userData.isOutlineChild = true;
      edgeLine.renderOrder = 6;
      edgeLine.visible = false;
      mesh.add(edgeLine);
    }

    records.push({
      mesh,
      partId: getMeshPartId(mesh),
      solidMat: mesh.material,
      solidRenderOrder: mesh.renderOrder,
      edgeLine,
      edgeGeo,
    });
  });

  let currentMode: RenderMode = 'solid';
  let currentXray = false;
  let currentPartId: string | null = null;
  let currentHidden = new Set<string>();

  const applyState = () => {
    const isOutline = currentMode === 'outline';
    for (const rec of records) {
      const isHidden = rec.partId !== null && currentHidden.has(rec.partId);
      rec.mesh.visible = !isHidden;

      if (isHidden) {
        if (rec.edgeLine) rec.edgeLine.visible = false;
        continue;
      }

      const partMatch = currentPartId !== null && rec.partId === currentPartId;
      const isXrayCasing = currentXray && rec.partId !== null && xraySet.has(rec.partId);

      if (!isOutline) {
        rec.mesh.material = rec.solidMat;
        rec.mesh.renderOrder = rec.solidRenderOrder;
        if (rec.edgeLine) rec.edgeLine.visible = false;
        continue;
      }

      if (partMatch) {
        rec.mesh.material = paperHighlightMat;
        rec.mesh.renderOrder = 5;
      } else if (isXrayCasing) {
        rec.mesh.material = paperXrayMat;
        rec.mesh.renderOrder = 2;
      } else {
        rec.mesh.material = paperFillMat;
        rec.mesh.renderOrder = 1;
      }

      if (rec.edgeLine) {
        rec.edgeLine.visible = true;
        if (partMatch) {
          rec.edgeLine.material = edgeAccentMat;
          rec.edgeLine.renderOrder = 8;
        } else if (isXrayCasing) {
          rec.edgeLine.material = edgeXrayMat;
          rec.edgeLine.renderOrder = 4;
          rec.edgeLine.computeLineDistances();
        } else {
          rec.edgeLine.material = edgeInkMat;
          rec.edgeLine.renderOrder = 6;
        }
      }
    }
  };

  return {
    setRenderMode: (mode: RenderMode) => {
      currentMode = mode;
      applyState();
    },
    setXRay: (enabled: boolean) => {
      currentXray = enabled;
      applyState();
    },
    highlightPart: (partId: string | null) => {
      currentPartId = partId;
      applyState();
    },
    setHiddenParts: (hidden: Set<string>) => {
      currentHidden = new Set(hidden);
      applyState();
    },
    setResolution: (width: number, height: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, width * ratio);
      const h = Math.max(1, height * ratio);
      edgeInkMat.resolution.set(w, h);
      edgeInkMat.linewidth = 1.55 * ratio;
      edgeAccentMat.resolution.set(w, h);
      edgeAccentMat.linewidth = 2.55 * ratio;
      edgeXrayMat.resolution.set(w, h);
      edgeXrayMat.linewidth = 1.15 * ratio;
    },
    syncDynamicGeometries: () => {
      for (const rec of records) {
        if (!rec.mesh.userData.dynamicEdgeRebuild || !rec.edgeGeo) continue;
        const nextPos = buildEdgePositions(rec.mesh.geometry);
        if (nextPos && nextPos.length >= 6) {
          rec.edgeGeo.setPositions(nextPos);
        }
      }
    },
    dispose: () => {
      for (const rec of records) {
        if (rec.edgeLine) rec.edgeLine.removeFromParent();
      }
      for (const g of createdLineGeos) g.dispose();
      edgeInkMat.dispose();
      edgeAccentMat.dispose();
      edgeXrayMat.dispose();
      paperFillMat.dispose();
      paperXrayMat.dispose();
      paperHighlightMat.dispose();
    },
  };
}

