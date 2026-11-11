import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { getSystemLesson } from '../../data/lessons';
import { disposeObject3D } from '../../scene/SceneManager';
import type { Powertrain, RenderMode, SystemId } from '../../state/appState';
import { applyExplodeOffsets, type ExplodableEntry } from '../ProceduralHelpers';
import { loadSystemModule } from '../systems/registry';
import type { SystemModelInstance } from '../systems/types';
import {
  applyRigPartHighlightState,
  createCombinedPartEdgeLines,
  createRigHighlightPalette,
  decorateRigMesh,
  type RigPartVisualRecord,
} from './PartHighlight';
import { computeRigSystemPlacement } from './rigConfig';

export interface RigPartMetadata {
  systemId: SystemId;
  partId: string;
  name: string;
  description: string;
}

export interface RigPartLabelEntry {
  partId: string;
  name: string;
  anchor: THREE.Object3D;
}

export interface RigSystemEntry {
  systemId: SystemId;
  root: THREE.Group;
  restPosition: THREE.Vector3;
  systemPinAnchor: THREE.Object3D;
  modelInstance: SystemModelInstance;
  partMeta: Map<string, RigPartMetadata>;
  partLabels: RigPartLabelEntry[];
  partVisuals: RigPartVisualRecord[];
  explodables: ExplodableEntry[];
  setExplode: (amount: number) => void;
}

export interface CarInnerRig {
  root: THREE.Group;
  pickMeshes: THREE.Mesh[];
  systems: Map<SystemId, RigSystemEntry>;
  systemAnchorObjects: Partial<Record<SystemId, THREE.Object3D>>;
  setExplodeForSystem: (
    activeSystem: SystemId | null,
    amount: number,
    outwardNormals?: Partial<Record<SystemId, THREE.Vector3>>,
  ) => void;
  setVisualState: (opts: {
    renderMode: RenderMode;
    activeSystem: SystemId | null;
    hoveredPart: { systemId: SystemId; partId: string } | null;
    selectedPart: { systemId: SystemId; partId: string } | null;
    visibleSystems: Set<SystemId>;
    ghostedSystems: Set<SystemId>;
    ghostFade?: number;
  }) => void;
  getPartMetadata: (systemId: SystemId, partId: string) => RigPartMetadata | null;
  getExplodedPartLabels: (systemId: SystemId) => RigPartLabelEntry[];
  getSystemWorldBoundingSphere: (systemId: SystemId) => THREE.Sphere | null;
  setResolution: (width: number, height: number) => void;
  dispose: () => void;
}

/**
 * Replaces rigid static InstancedMeshes with standard cloned Meshes sharing a single geometry
 * so every cooling fin, bolt, or radiator louver supports uniform outline edges and Solid rims.
 */
function expandStaticInstancedMeshes(root: THREE.Object3D): THREE.BufferGeometry[] {
  const retiredGeos: THREE.BufferGeometry[] = [];
  const toExpand: THREE.InstancedMesh[] = [];
  root.traverse((obj) => {
    const inst = obj as THREE.InstancedMesh;
    if (inst.isInstancedMesh && !inst.userData.lessonOnly) {
      toExpand.push(inst);
    }
  });

  const dummyMatrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (const inst of toExpand) {
    const parent = inst.parent;
    if (!parent) continue;
    const isDecorativeHoles =
      inst.count > 24 &&
      inst.material instanceof THREE.MeshStandardMaterial &&
      inst.material.color.getHexString() === '0f172a';
    if (isDecorativeHoles) {
      // Omit 30+ dark decorative hole punches in miniature rig assemblies for clean lines and 60fps
      parent.remove(inst);
      retiredGeos.push(inst.geometry);
      continue;
    }

    const holder = new THREE.Group();
    holder.name = `${inst.name || 'Instanced'}_Group`;
    holder.userData.partId = inst.userData.partId;

    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, dummyMatrix);
      dummyMatrix.decompose(pos, quat, scale);
      const child = new THREE.Mesh(inst.geometry, inst.material);
      child.position.copy(pos);
      child.quaternion.copy(quat);
      child.scale.copy(scale);
      child.userData.partId = inst.userData.partId;
      if (inst.count >= 8 && i % 2 === 1) {
        child.userData.skipRigEdges = true;
      }
      holder.add(child);
    }

    parent.add(holder);
    parent.remove(inst);
    retiredGeos.push(inst.geometry);
  }

  return retiredGeos;
}

export async function buildCarInnerRig(
  availableSystems: SystemId[],
  powertrain: Powertrain,
  anchors: Partial<Record<SystemId, THREE.Vector3>>,
  carBox: THREE.Box3,
  carSize: THREE.Vector3,
  frontSign: number,
  drawBufSize: THREE.Vector2,
): Promise<CarInnerRig> {
  const rigRoot = new THREE.Group();
  rigRoot.name = 'InnerSystemsRig';

  const palette = createRigHighlightPalette(drawBufSize);
  const sharedEdgesCache = new Map<THREE.BufferGeometry, Float32Array | null>();
  const createdLineGeos: LineSegmentsGeometry[] = [];
  const systems = new Map<SystemId, RigSystemEntry>();
  const systemAnchorObjects: Partial<Record<SystemId, THREE.Object3D>> = {};
  const pickMeshes: THREE.Mesh[] = [];

  await Promise.all(
    availableSystems.map(async (sysId) => {
      const anchor = anchors[sysId];
      if (!anchor) return;

      const modelInstance = await loadSystemModule(sysId, powertrain);
      const lessonData = getSystemLesson(sysId, powertrain);

      const partMeta = new Map<string, RigPartMetadata>();
      for (const p of lessonData.parts) {
        partMeta.set(p.id, {
          systemId: sysId,
          partId: p.id,
          name: p.name,
          description: p.plainEnglish,
        });
      }
      for (const la of modelInstance.labelAnchors) {
        if (!partMeta.has(la.partId)) {
          partMeta.set(la.partId, {
            systemId: sysId,
            partId: la.partId,
            name: la.name,
            description: lessonData.subtitle,
          });
        }
      }

      // Remove animation-only particles / road strips cleanly before measuring bounding box
      const lessonOnlyObjects: THREE.Object3D[] = [];
      modelInstance.root.traverse((obj) => {
        if (obj.userData.lessonOnly) {
          lessonOnlyObjects.push(obj);
        }
      });
      for (const obj of lessonOnlyObjects) {
        obj.removeFromParent();
        disposeObject3D(obj);
      }

      expandStaticInstancedMeshes(modelInstance.root);

      // Compute tight rest-pose bounding box across mechanical sub-parts only
      modelInstance.root.updateMatrixWorld(true);
      const rawBox = new THREE.Box3();
      for (const partRoot of modelInstance.partObjects) {
        rawBox.expandByObject(partRoot);
      }
      if (rawBox.isEmpty()) {
        rawBox.setFromObject(modelInstance.root);
      }

      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.01);

      const placement = computeRigSystemPlacement(
        sysId,
        powertrain,
        anchor,
        anchors,
        carBox,
        carSize,
        frontSign,
      );
      const uniformScale = placement.targetExtent / maxDim;

      const systemRoot = new THREE.Group();
      systemRoot.name = `RigSystem_${sysId}`;
      systemRoot.position.copy(placement.position);
      systemRoot.rotation.y = placement.rotationY;

      const fitGroup = new THREE.Group();
      fitGroup.scale.setScalar(uniformScale);
      fitGroup.position.copy(rawCenter).multiplyScalar(-uniformScale);
      fitGroup.add(modelInstance.root);
      systemRoot.add(fitGroup);
      rigRoot.add(systemRoot);

      // Guard against any nose, bumper, or floor protrusion by clamping placed world bounds inside safe vehicle envelope
      systemRoot.updateMatrixWorld(true);
      const placedBox = new THREE.Box3().setFromObject(systemRoot);
      const minYFloor = carBox.min.y + 0.14;
      const maxYCeiling = carBox.min.y + carSize.y * 0.82;
      if (placedBox.min.y < minYFloor) {
        systemRoot.position.y += minYFloor - placedBox.min.y;
      } else if (placedBox.max.y > maxYCeiling) {
        systemRoot.position.y -= placedBox.max.y - maxYCeiling;
      }

      const zClearance = sysId === 'exhaust' ? 0.16 : 0.34;
      const minZSafe = carBox.min.z + zClearance;
      const maxZSafe = carBox.max.z - zClearance;
      if (placedBox.max.z > maxZSafe) {
        systemRoot.position.z -= placedBox.max.z - maxZSafe;
      } else if (placedBox.min.z < minZSafe) {
        systemRoot.position.z += minZSafe - placedBox.min.z;
      }

      if (sysId !== 'brakes' && sysId !== 'suspension') {
        const xClearance = 0.18;
        const minXSafe = carBox.min.x + xClearance;
        const maxXSafe = carBox.max.x - xClearance;
        if (placedBox.max.x > maxXSafe) {
          systemRoot.position.x -= placedBox.max.x - maxXSafe;
        } else if (placedBox.min.x < minXSafe) {
          systemRoot.position.x += minXSafe - placedBox.min.x;
        }
      }

      const partVisuals: RigPartVisualRecord[] = [];
      const partLabels: RigPartLabelEntry[] = [];
      systemRoot.updateMatrixWorld(true);
      const partWorldInv = new THREE.Matrix4();
      const meshBox = new THREE.Box3();
      const partLocalBox = new THREE.Box3();
      const localCenter = new THREE.Vector3();

      for (const partObj of modelInstance.partObjects) {
        const partId = (partObj.userData.partId as string) || 'part';
        partObj.updateMatrixWorld(true);
        partWorldInv.copy(partObj.matrixWorld).invert();
        partLocalBox.makeEmpty();

        const partMeshes: THREE.Mesh[] = [];
        partObj.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || mesh.userData.isOutlineChild || mesh.userData.lessonOnly) return;
          mesh.userData.systemId = sysId;
          mesh.userData.partId = partId;
          partMeshes.push(mesh);

          if (mesh.geometry) {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            if (mesh.geometry.boundingBox) {
              meshBox.copy(mesh.geometry.boundingBox);
              const relMat = new THREE.Matrix4().multiplyMatrices(partWorldInv, mesh.matrixWorld);
              meshBox.applyMatrix4(relMat);
              partLocalBox.union(meshBox);
            }
          }
        });

        const { lineGeo, dashedLine, solidLine } = createCombinedPartEdgeLines(
          partObj,
          partMeshes,
          palette,
          sharedEdgesCache,
        );
        if (lineGeo) createdLineGeos.push(lineGeo);

        const meshRecs = partMeshes.map((mesh) => {
          pickMeshes.push(mesh);
          return decorateRigMesh(mesh, partId, palette);
        });

        const labelNode = new THREE.Object3D();
        labelNode.name = `RigPartLabel_${sysId}_${partId}`;
        if (!partLocalBox.isEmpty()) {
          partLocalBox.getCenter(localCenter);
          labelNode.position.copy(localCenter);
        }
        partObj.add(labelNode);
        const meta = partMeta.get(partId);
        partLabels.push({
          partId,
          name: meta?.name ?? partId,
          anchor: labelNode,
        });

        partVisuals.push({
          partId,
          dashedLine,
          solidLine,
          meshes: meshRecs,
        });
      }

      const systemPinAnchor = new THREE.Object3D();
      systemPinAnchor.name = `RigSystemPin_${sysId}`;
      systemRoot.add(systemPinAnchor);
      systemAnchorObjects[sysId] = systemPinAnchor;

      const explodables = modelInstance.explodables ?? [];
      const setExplode = (amount: number) => {
        const clamped = Math.max(0, Math.min(1, amount));
        if (explodables.length > 0) {
          applyExplodeOffsets(explodables, clamped);
        } else {
          modelInstance.setExplode(clamped);
        }
      };

      systems.set(sysId, {
        systemId: sysId,
        root: systemRoot,
        restPosition: systemRoot.position.clone(),
        systemPinAnchor,
        modelInstance,
        partMeta,
        partLabels,
        partVisuals,
        explodables,
        setExplode,
      });
    }),
  );

  const setExplodeForSystem: CarInnerRig['setExplodeForSystem'] = (
    activeSystem,
    amount,
    outwardNormals,
  ) => {
    const clamped = Math.max(0, Math.min(1, amount));
    if (activeSystem === null) {
      for (const [sysId, entry] of systems) {
        entry.setExplode(0);
        entry.root.position.copy(entry.restPosition);
        if (clamped > 0.001) {
          const normal = outwardNormals?.[sysId];
          if (normal) {
            entry.root.position.addScaledVector(normal, clamped * 0.24);
          } else {
            entry.root.position.y += clamped * 0.14;
          }
          entry.root.position.y = Math.max(entry.restPosition.y - 0.04, entry.root.position.y);
        }
      }
      return;
    }

    for (const [sysId, entry] of systems) {
      entry.root.position.copy(entry.restPosition);
      if (activeSystem === sysId) {
        entry.setExplode(clamped);
      } else {
        entry.setExplode(0);
      }
    }
  };

  const setVisualState: CarInnerRig['setVisualState'] = ({
    renderMode,
    activeSystem,
    hoveredPart,
    selectedPart,
    visibleSystems,
    ghostedSystems,
    ghostFade = 1,
  }) => {
    palette.setGhostFade(ghostFade);
    for (const [sysId, entry] of systems) {
      const visible = visibleSystems.has(sysId);
      entry.root.visible = visible;
      if (!visible) continue;

      const isSelectedSystem = activeSystem === sysId;
      const ghosted = ghostedSystems.has(sysId);
      const hoveredId = hoveredPart?.systemId === sysId ? hoveredPart.partId : null;
      const selectedId = selectedPart?.systemId === sysId ? selectedPart.partId : null;

      for (const partRec of entry.partVisuals) {
        applyRigPartHighlightState(partRec, palette, {
          renderMode,
          isSelectedSystem,
          hoveredPartId: hoveredId,
          selectedPartId: selectedId,
          visible: true,
          ghosted,
        });
      }
    }
  };

  const getPartMetadata = (systemId: SystemId, partId: string): RigPartMetadata | null => {
    const entry = systems.get(systemId);
    if (!entry) return null;
    return entry.partMeta.get(partId) ?? null;
  };

  const getExplodedPartLabels = (systemId: SystemId): RigPartLabelEntry[] => {
    return systems.get(systemId)?.partLabels ?? [];
  };

  const getSystemWorldBoundingSphere = (systemId: SystemId): THREE.Sphere | null => {
    const entry = systems.get(systemId);
    if (!entry) return null;
    entry.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const obj of entry.modelInstance.partObjects) {
      box.expandByObject(obj);
    }
    if (box.isEmpty()) return null;
    return box.getBoundingSphere(new THREE.Sphere());
  };

  return {
    root: rigRoot,
    pickMeshes,
    systems,
    systemAnchorObjects,
    setExplodeForSystem,
    setVisualState,
    getPartMetadata,
    getExplodedPartLabels,
    getSystemWorldBoundingSphere,
    setResolution: (width, height) => palette.setResolution(width, height),
    dispose: () => {
      for (const lineGeo of createdLineGeos) {
        lineGeo.dispose();
      }
      createdLineGeos.length = 0;
      sharedEdgesCache.clear();
      palette.dispose();
      for (const entry of systems.values()) {
        entry.modelInstance.dispose();
      }
      disposeObject3D(rigRoot);
    },
  };
}

