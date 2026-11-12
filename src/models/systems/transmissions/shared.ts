import * as THREE from 'three';
import { disposeObject3D } from '../../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createGearGeometry,
  createPartController,
  type ExplodableEntry,
} from '../../ProceduralHelpers';
import type {
  SystemFrameStatus,
  SystemLabelAnchor,
  SystemModelInstance,
  SystemSimulationState,
} from '../types';

export interface TransmissionMaterials {
  caseMat: THREE.MeshStandardMaterial;
  aluMat: THREE.MeshStandardMaterial;
  steelMat: THREE.MeshStandardMaterial;
  darkSteelMat: THREE.MeshStandardMaterial;
  clutchPadMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  copperMat: THREE.MeshStandardMaterial;
  accentBlueMat: THREE.MeshStandardMaterial;
  beltMat: THREE.MeshStandardMaterial;
  atfMat: THREE.MeshStandardMaterial;
}

export function createTransmissionMaterials(): TransmissionMaterials {
  return {
    caseMat: new THREE.MeshStandardMaterial({
      color: '#334155',
      metalness: 0.72,
      roughness: 0.36,
      side: THREE.DoubleSide,
    }),
    aluMat: new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.78,
      roughness: 0.28,
      side: THREE.DoubleSide,
    }),
    steelMat: new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.9,
      roughness: 0.24,
    }),
    darkSteelMat: new THREE.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.88,
      roughness: 0.28,
    }),
    clutchPadMat: new THREE.MeshStandardMaterial({
      color: '#d97706',
      metalness: 0.2,
      roughness: 0.72,
    }),
    brassMat: new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.86,
      roughness: 0.24,
    }),
    copperMat: new THREE.MeshStandardMaterial({
      color: '#d93a1e',
      metalness: 0.65,
      roughness: 0.32,
    }),
    accentBlueMat: new THREE.MeshStandardMaterial({
      color: '#0284c7',
      metalness: 0.55,
      roughness: 0.34,
    }),
    beltMat: new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.75,
      roughness: 0.38,
    }),
    atfMat: new THREE.MeshStandardMaterial({
      color: '#ef4444',
      metalness: 0.15,
      roughness: 0.25,
    }),
  };
}

export function buildDifferentialAssembly(
  mats: TransmissionMaterials,
  xPos = 0.95,
  yPos = 0.18,
): { diffGroup: THREE.Group; diffSpin: THREE.Group } {
  const diffGroup = new THREE.Group();
  const diffSpin = new THREE.Group();
  diffSpin.position.set(xPos, yPos, 0);
  diffGroup.add(diffSpin);

  const ringGear = new THREE.Mesh(
    createGearGeometry({ teeth: 28, pitchRadius: 0.3, thickness: 0.065, boreRadius: 0.12 }),
    mats.steelMat,
  );
  ringGear.position.z = -0.14;
  diffSpin.add(ringGear);

  const cage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.34, 18),
    mats.darkSteelMat,
  );
  cage.rotation.x = Math.PI / 2;
  diffSpin.add(cage);

  const axleL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.72, 16),
    mats.steelMat,
  );
  axleL.rotation.x = Math.PI / 2;
  axleL.position.z = 0.42;
  const axleR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.72, 16),
    mats.steelMat,
  );
  axleR.rotation.x = Math.PI / 2;
  axleR.position.z = -0.42;
  diffSpin.add(axleL, axleR);

  return { diffGroup, diffSpin };
}

export function buildCutawayBellCasing(
  mats: TransmissionMaterials,
  opts: { length?: number; radius?: number; bellX?: number; mainX?: number } = {},
): THREE.Group {
  const casingGroup = new THREE.Group();
  const len = opts.length ?? 1.5;
  const rad = opts.radius ?? 0.46;
  const bellX = opts.bellX ?? -1.05;
  const mainX = opts.mainX ?? -0.08;

  const bellShell = new THREE.Mesh(
    new THREE.CylinderGeometry(rad * 0.91, rad * 1.22, 0.45, 28, 1, true, Math.PI * 0.45, Math.PI * 1.1),
    mats.caseMat,
  );
  bellShell.rotation.z = Math.PI / 2;
  bellShell.position.set(bellX, 0.14, 0);
  casingGroup.add(bellShell);

  const mainShell = new THREE.Mesh(
    new THREE.CylinderGeometry(rad, rad, len, 28, 1, true, Math.PI * 0.48, Math.PI * 1.04),
    mats.caseMat,
  );
  mainShell.rotation.z = Math.PI / 2;
  mainShell.position.set(mainX, 0.04, 0);
  casingGroup.add(mainShell);

  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6);
  const bolts = new THREE.InstancedMesh(boltGeo, mats.steelMat, 8);
  const bd = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bd.position.set(bellX + 0.21, 0.14 + Math.sin(a) * rad * 0.95, Math.cos(a) * rad * 0.95);
    bd.rotation.set(0, 0, Math.PI / 2);
    bd.updateMatrix();
    bolts.setMatrixAt(i, bd.matrix);
  }
  bolts.instanceMatrix.needsUpdate = true;
  casingGroup.add(bolts);

  return casingGroup;
}

export function finalizeTransmissionModel(params: {
  root: THREE.Group;
  variant: string;
  partMap: Record<string, THREE.Object3D>;
  explodables: ExplodableEntry[];
  labelAnchors: SystemLabelAnchor[];
  xrayParts?: string[];
  skipMaterials?: THREE.Material[];
  defaultCamera?: { position: [number, number, number]; target: [number, number, number] };
  targetRigExtent?: number;
  onUpdate: (dt: number, sim: SystemSimulationState) => SystemFrameStatus;
}): SystemModelInstance {
  const partCtrl = createPartController(params.partMap, params.skipMaterials ?? []);

  params.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const obj of Object.values(params.partMap)) {
    box.expandByObject(obj);
  }
  const size = box.getSize(new THREE.Vector3());

  return {
    root: params.root,
    variant: params.variant,
    naturalBounds: {
      length: Math.max(size.x, size.z, 0.1),
      width: Math.min(size.x, size.z, 2.0),
      height: Math.max(size.y, 0.1),
    },
    targetRigExtent: params.targetRigExtent ?? 0.52,
    defaultCamera: params.defaultCamera ?? {
      target: [0.05, 1.05, 0],
      position: [2.65, 2.1, 4.05],
    },
    partObjects: Object.values(params.partMap),
    labelAnchors: params.labelAnchors,
    explodables: params.explodables,
    update: params.onUpdate,
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) =>
      applyExplodeOffsets(params.explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) =>
      partCtrl.setPartsXRay(params.xrayParts ?? ['casing'], enabled, 0.22),
    dispose: () => disposeObject3D(params.root),
  };
}

