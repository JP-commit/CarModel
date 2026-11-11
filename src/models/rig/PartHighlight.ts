import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { createSilhouetteHullMaterial } from '../../scene/OutlineBuilder';
import type { RenderMode } from '../../state/appState';

export interface RigPartVisualRecord {
  partId: string;
  dashedLine: LineSegments2 | null;
  solidLine: LineSegments2 | null;
  meshes: RigMeshStyleRecord[];
}

export interface RigMeshStyleRecord {
  mesh: THREE.Mesh;
  partId: string;
  solidMat: THREE.MeshStandardMaterial | THREE.Material;
  originalEmissive: THREE.Color;
  originalEmissiveIntensity: number;
  originalOpacity: number;
  originalTransparent: boolean;
  originalDepthWrite: boolean;
  solidRimHull: THREE.Mesh | null;
}

export interface RigHighlightPalette {
  dashedMat: LineMaterial;
  dashedGhostMat: LineMaterial;
  activeEdgeMat: LineMaterial;
  focusedPartEdgeMat: LineMaterial;
  hoveredPartEdgeMat: LineMaterial;
  outlinePartPaperMat: THREE.MeshBasicMaterial;
  outlineActiveTintMat: THREE.MeshBasicMaterial;
  outlineFocusedTintMat: THREE.MeshBasicMaterial;
  outlineGhostFillMat: THREE.MeshBasicMaterial;
  outlineHiddenFillMat: THREE.MeshBasicMaterial;
  solidRimHullMat: THREE.ShaderMaterial;
  ghostSolidMat: THREE.MeshStandardMaterial;
  setGhostFade: (factor: number) => void;
  dispose: () => void;
  setResolution: (width: number, height: number) => void;
}

export function createRigHighlightPalette(drawBufSize: THREE.Vector2): RigHighlightPalette {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const dashedMat = new LineMaterial({
    color: 0x45413a,
    linewidth: 1.3 * dpr,
    dashed: true,
    dashScale: 1,
    dashSize: 0.036,
    gapSize: 0.024,
    transparent: true,
    opacity: 0.56,
    depthTest: false,
    depthWrite: false,
    resolution: drawBufSize.clone(),
  });

  const dashedGhostMat = new LineMaterial({
    color: 0x45413a,
    linewidth: 1.05 * dpr,
    dashed: true,
    dashScale: 1,
    dashSize: 0.036,
    gapSize: 0.024,
    transparent: true,
    opacity: 0.2,
    depthTest: false,
    depthWrite: false,
    resolution: drawBufSize.clone(),
  });

  const activeEdgeMat = new LineMaterial({
    color: 0xd93a1e,
    linewidth: 1.85 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    resolution: drawBufSize.clone(),
  });

  const focusedPartEdgeMat = new LineMaterial({
    color: 0xd93a1e,
    linewidth: 2.85 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    resolution: drawBufSize.clone(),
  });

  const hoveredPartEdgeMat = new LineMaterial({
    color: 0x1c1b19,
    linewidth: 2.55 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    resolution: drawBufSize.clone(),
  });

  const outlinePartPaperMat = new THREE.MeshBasicMaterial({
    color: '#fdf9f6',
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  // Faint depth-tested accent tints — NO depthTest: false flat boxes
  const outlineActiveTintMat = new THREE.MeshBasicMaterial({
    color: '#d93a1e',
    transparent: true,
    opacity: 0.14,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const outlineFocusedTintMat = new THREE.MeshBasicMaterial({
    color: '#d93a1e',
    transparent: true,
    opacity: 0.28,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const outlineGhostFillMat = new THREE.MeshBasicMaterial({
    color: '#e5e4dd',
    transparent: true,
    opacity: 0.06,
    depthTest: true,
    depthWrite: false,
  });

  const outlineHiddenFillMat = new THREE.MeshBasicMaterial({
    visible: false,
  });

  const solidRimHullMat = createSilhouetteHullMaterial('#d93a1e', 2.4, drawBufSize);

  const ghostSolidMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
  });

  return {
    dashedMat,
    dashedGhostMat,
    activeEdgeMat,
    focusedPartEdgeMat,
    hoveredPartEdgeMat,
    outlinePartPaperMat,
    outlineActiveTintMat,
    outlineFocusedTintMat,
    outlineGhostFillMat,
    outlineHiddenFillMat,
    solidRimHullMat,
    ghostSolidMat,
    setGhostFade: (factor: number) => {
      const f = Math.max(0, Math.min(1, factor));
      dashedGhostMat.opacity = 0.2 * f;
      outlineGhostFillMat.opacity = 0.06 * f;
      ghostSolidMat.opacity = 0.06 * f;
    },
    setResolution: (width, height) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const bw = Math.max(1, width * ratio);
      const bh = Math.max(1, height * ratio);
      dashedMat.resolution.set(bw, bh);
      dashedMat.linewidth = 1.3 * ratio;
      dashedGhostMat.resolution.set(bw, bh);
      dashedGhostMat.linewidth = 1.05 * ratio;
      activeEdgeMat.resolution.set(bw, bh);
      activeEdgeMat.linewidth = 1.85 * ratio;
      focusedPartEdgeMat.resolution.set(bw, bh);
      focusedPartEdgeMat.linewidth = 2.85 * ratio;
      hoveredPartEdgeMat.resolution.set(bw, bh);
      hoveredPartEdgeMat.linewidth = 2.55 * ratio;
      solidRimHullMat.uniforms.uResolution?.value.set(bw, bh);
      if (solidRimHullMat.uniforms.uLinewidth) {
        solidRimHullMat.uniforms.uLinewidth.value = 2.4 * ratio;
      }
    },
    dispose: () => {
      dashedMat.dispose();
      dashedGhostMat.dispose();
      activeEdgeMat.dispose();
      focusedPartEdgeMat.dispose();
      hoveredPartEdgeMat.dispose();
      outlinePartPaperMat.dispose();
      outlineActiveTintMat.dispose();
      outlineFocusedTintMat.dispose();
      outlineGhostFillMat.dispose();
      outlineHiddenFillMat.dispose();
      solidRimHullMat.dispose();
      ghostSolidMat.dispose();
    },
  };
}

export function createCombinedPartEdgeLines(
  partObj: THREE.Object3D,
  partMeshes: THREE.Mesh[],
  palette: RigHighlightPalette,
  sharedEdgesCache: Map<THREE.BufferGeometry, Float32Array | null>,
): {
  lineGeo: LineSegmentsGeometry | null;
  dashedLine: LineSegments2 | null;
  solidLine: LineSegments2 | null;
} {
  partObj.updateMatrixWorld(true);
  const partInv = new THREE.Matrix4().copy(partObj.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4();
  const tempVec = new THREE.Vector3();
  const chunks: Float32Array[] = [];
  let totalFloats = 0;

  for (const mesh of partMeshes) {
    if (!mesh.geometry || !mesh.geometry.attributes.position || mesh.userData.skipRigEdges) {
      continue;
    }

    let cachedPos = sharedEdgesCache.get(mesh.geometry);
    if (cachedPos === undefined) {
      const edges = new THREE.EdgesGeometry(mesh.geometry, 36);
      const attr = edges.attributes.position;
      if (attr && attr.count >= 2) {
        cachedPos = new Float32Array(attr.array as ArrayLike<number>);
      } else {
        cachedPos = null;
      }
      edges.dispose();
      sharedEdgesCache.set(mesh.geometry, cachedPos);
    }

    if (!cachedPos || cachedPos.length < 6) continue;

    relMatrix.multiplyMatrices(partInv, mesh.matrixWorld);
    const transformed = new Float32Array(cachedPos.length);
    for (let i = 0; i < cachedPos.length; i += 3) {
      tempVec.set(cachedPos[i], cachedPos[i + 1], cachedPos[i + 2]).applyMatrix4(relMatrix);
      transformed[i] = tempVec.x;
      transformed[i + 1] = tempVec.y;
      transformed[i + 2] = tempVec.z;
    }
    chunks.push(transformed);
    totalFloats += transformed.length;
  }

  if (totalFloats < 6) {
    return { lineGeo: null, dashedLine: null, solidLine: null };
  }

  const merged = new Float32Array(totalFloats);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const lineGeo = new LineSegmentsGeometry();
  lineGeo.setPositions(merged);

  const dashedLine = new LineSegments2(lineGeo, palette.dashedMat);
  dashedLine.userData.isOutlineChild = true;
  dashedLine.userData.isRigHelper = true;
  dashedLine.renderOrder = 6;
  dashedLine.computeLineDistances();
  partObj.add(dashedLine);

  const solidLine = new LineSegments2(lineGeo, palette.activeEdgeMat);
  solidLine.userData.isOutlineChild = true;
  solidLine.userData.isRigHelper = true;
  solidLine.renderOrder = 8;
  solidLine.visible = false;
  partObj.add(solidLine);

  return { lineGeo, dashedLine, solidLine };
}

export function decorateRigMesh(
  mesh: THREE.Mesh,
  partId: string,
  palette: RigHighlightPalette,
): RigMeshStyleRecord {
  // Clone MeshStandardMaterial per rig mesh so emissive / transparency never leaks
  let solidMat: THREE.MeshStandardMaterial | THREE.Material = mesh.material as THREE.Material;
  let originalEmissive = new THREE.Color(0x000000);
  let originalEmissiveIntensity = 0;

  if (mesh.material instanceof THREE.MeshStandardMaterial) {
    const cloned = mesh.material.clone();
    mesh.material = cloned;
    solidMat = cloned;
    originalEmissive = cloned.emissive.clone();
    originalEmissiveIntensity = cloned.emissiveIntensity;
  }

  let solidRimHull: THREE.Mesh | null = null;
  if (mesh.geometry?.attributes.normal && !mesh.userData.skipRigEdges) {
    solidRimHull = new THREE.Mesh(mesh.geometry, palette.solidRimHullMat);
    solidRimHull.userData.isOutlineChild = true;
    solidRimHull.userData.isRigHelper = true;
    solidRimHull.userData.isSilhouetteHull = true;
    solidRimHull.renderOrder = 4;
    solidRimHull.visible = false;
    mesh.add(solidRimHull);
  }

  return {
    mesh,
    partId,
    solidMat,
    originalEmissive,
    originalEmissiveIntensity,
    originalOpacity: solidMat.opacity,
    originalTransparent: solidMat.transparent,
    originalDepthWrite: solidMat.depthWrite,
    solidRimHull,
  };
}

export function applyRigPartHighlightState(
  partRec: RigPartVisualRecord,
  palette: RigHighlightPalette,
  opts: {
    renderMode: RenderMode;
    isSelectedSystem: boolean;
    hoveredPartId: string | null;
    selectedPartId: string | null;
    visible: boolean;
    ghosted: boolean;
  },
): void {
  const { renderMode, isSelectedSystem, hoveredPartId, selectedPartId, visible, ghosted } = opts;

  if (!visible) {
    if (partRec.dashedLine) partRec.dashedLine.visible = false;
    if (partRec.solidLine) partRec.solidLine.visible = false;
    for (const rec of partRec.meshes) rec.mesh.visible = false;
    return;
  }

  const isSelectedPart = isSelectedSystem && selectedPartId === partRec.partId;
  const isHoveredPart = isSelectedSystem && hoveredPartId === partRec.partId;
  const isSingleFocus = isSelectedPart || isHoveredPart;
  const hasPartFocus = isSelectedSystem && (selectedPartId !== null || hoveredPartId !== null);

  if (renderMode === 'outline') {
    if (isSelectedSystem) {
      if (partRec.dashedLine) partRec.dashedLine.visible = false;
      if (partRec.solidLine) {
        partRec.solidLine.visible = true;
        partRec.solidLine.material = isSelectedPart
          ? palette.focusedPartEdgeMat
          : isHoveredPart
            ? palette.hoveredPartEdgeMat
            : palette.activeEdgeMat;
      }
    } else {
      if (partRec.solidLine) partRec.solidLine.visible = false;
      if (partRec.dashedLine) {
        partRec.dashedLine.visible = true;
        partRec.dashedLine.material = ghosted ? palette.dashedGhostMat : palette.dashedMat;
      }
    }

    for (const rec of partRec.meshes) {
      rec.mesh.visible = true;
      if (rec.solidRimHull) rec.solidRimHull.visible = false;
      if (isSelectedSystem) {
        if (isSingleFocus) {
          rec.mesh.material = palette.outlineFocusedTintMat;
          rec.mesh.renderOrder = 7;
        } else if (hasPartFocus) {
          rec.mesh.material = palette.outlinePartPaperMat;
          rec.mesh.renderOrder = 3;
        } else {
          rec.mesh.material = palette.outlineActiveTintMat;
          rec.mesh.renderOrder = 6;
        }
      } else {
        rec.mesh.material = ghosted ? palette.outlineGhostFillMat : palette.outlineHiddenFillMat;
        rec.mesh.renderOrder = 2;
      }
    }
    return;
  }

  // SOLID MODE
  if (partRec.dashedLine) partRec.dashedLine.visible = false;
  if (partRec.solidLine) partRec.solidLine.visible = false;

  for (const rec of partRec.meshes) {
    rec.mesh.visible = true;
    if (ghosted && !isSelectedSystem) {
      rec.mesh.material = palette.ghostSolidMat;
      if (rec.solidRimHull) rec.solidRimHull.visible = false;
      continue;
    }

    rec.mesh.material = rec.solidMat;
    if (rec.solidMat instanceof THREE.MeshStandardMaterial) {
      if (isSingleFocus) {
        rec.solidMat.emissive.set('#d93a1e');
        rec.solidMat.emissiveIntensity = isSelectedPart ? 0.36 : 0.24;
      } else if (isSelectedSystem && !hasPartFocus) {
        rec.solidMat.emissive.set('#d93a1e');
        rec.solidMat.emissiveIntensity = 0.14;
      } else {
        rec.solidMat.emissive.copy(rec.originalEmissive);
        rec.solidMat.emissiveIntensity = rec.originalEmissiveIntensity;
      }
      rec.solidMat.opacity = rec.originalOpacity;
      rec.solidMat.transparent = rec.originalTransparent;
      rec.solidMat.depthWrite = rec.originalDepthWrite;
    }

    if (rec.solidRimHull) {
      rec.solidRimHull.visible = isSingleFocus || (isSelectedSystem && !hasPartFocus);
    }
  }
}

