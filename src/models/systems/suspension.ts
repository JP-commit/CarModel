import * as THREE from 'three';
import { disposeObject3D } from '../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createCoilSpringGeometry,
  createPartController,
  makePartAnchor,
  type ExplodableEntry,
} from '../ProceduralHelpers';
import type {
  SystemFrameStatus,
  SystemLabelAnchor,
  SystemModelInstance,
  SystemSimulationState,
} from './types';

export interface SuspensionRoadSample {
  bumpWorldX: number;
  bumpUnderTire: number;
  phaseIndex: number;
}

const ROAD_LEN = 3.8;
const TIRE_X = 0.35;
const TIRE_OUTER_R = 0.5;
const BUMP_HALF_W = 0.44;
const BUMP_MAX_H = 0.19;

export function evalRoadBumpAtWorldX(
  worldX: number,
  bumpWorldX: number,
  bumpScale: number,
): number {
  let dx = worldX - bumpWorldX;
  if (dx > ROAD_LEN * 0.5) dx -= ROAD_LEN;
  if (dx < -ROAD_LEN * 0.5) dx += ROAD_LEN;
  if (Math.abs(dx) >= BUMP_HALF_W) return 0;
  return Math.cos((dx / BUMP_HALF_W) * Math.PI * 0.5) ** 2 * BUMP_MAX_H * bumpScale;
}

/**
 * Computes moving bump center & exact tire contact height (with circular tire profile)
 * so the bump rolls across the road and touches the tire cleanly only when underneath.
 */
export function computeSuspensionRoadSample(
  roadOffset: number,
  bumpScale = 1,
): SuspensionRoadSample {
  const bumpWorldX = (((roadOffset % ROAD_LEN) + ROAD_LEN) % ROAD_LEN) - ROAD_LEN * 0.5;
  let maxContactLift = 0;
  for (let s = -4; s <= 4; s++) {
    const sampleX = TIRE_X + s * 0.06;
    const roadH = evalRoadBumpAtWorldX(sampleX, bumpWorldX, bumpScale);
    const tireCurveDrop = TIRE_OUTER_R - Math.sqrt(Math.max(0.01, TIRE_OUTER_R * TIRE_OUTER_R - (s * 0.06) ** 2));
    const liftNeeded = Math.max(0, roadH - tireCurveDrop);
    if (liftNeeded > maxContactLift) maxContactLift = liftNeeded;
  }

  let dxFromBump = TIRE_X - bumpWorldX;
  if (dxFromBump > ROAD_LEN * 0.5) dxFromBump -= ROAD_LEN;
  if (dxFromBump < -ROAD_LEN * 0.5) dxFromBump += ROAD_LEN;

  // Phase 0: Flat Roll, 1: Bump Impact (front edge), 2: Full Compression (peak), 3: Rebound
  let phaseIndex = 0;
  if (maxContactLift > 0.015) {
    if (dxFromBump > 0.1) phaseIndex = 1;
    else if (dxFromBump >= -0.1) phaseIndex = 2;
    else phaseIndex = 3;
  }

  return {
    bumpWorldX,
    bumpUnderTire: maxContactLift,
    phaseIndex,
  };
}

export function createSystemModel(): SystemModelInstance {
  const root = new THREE.Group();
  root.name = 'SuspensionCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 0.92;
  root.add(assembly);

  const hubGroup = new THREE.Group();
  const armGroup = new THREE.Group();
  const springGroup = new THREE.Group();
  const damperGroup = new THREE.Group();
  const mountGroup = new THREE.Group();
  assembly.add(hubGroup, armGroup, springGroup, damperGroup, mountGroup);

  const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.88, roughness: 0.24 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.78, roughness: 0.34 });
  const springMat = new THREE.MeshStandardMaterial({ color: '#f05a28', metalness: 0.5, roughness: 0.32 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.1, roughness: 0.85 });
  const bumpMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.3, roughness: 0.7 });

  // Animated road bump strip underneath tire (InstancedMesh road blocks)
  const blockCount = 24;
  const roadGeo = new THREE.BoxGeometry(0.16, 0.06, 0.7);
  const roadMesh = new THREE.InstancedMesh(roadGeo, bumpMat, blockCount);
  roadMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  roadMesh.userData.lessonOnly = true;
  assembly.add(roadMesh);

  // 1. Wheel Hub + Tire
  const wheelAssembly = new THREE.Group();
  wheelAssembly.position.set(0.35, -0.1, 0);
  hubGroup.add(wheelAssembly);

  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 16, 36), tireMat);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 24), steelMat);
  rim.rotation.x = Math.PI / 2;
  const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), darkMetalMat);
  knuckle.position.set(-0.24, 0.08, 0);
  wheelAssembly.add(tire, rim, knuckle);

  // 2. Lower Control Arm (hinged at chassis x = -0.75, y = -0.14)
  const armPivot = new THREE.Group();
  armPivot.position.set(-0.75, -0.12, 0);
  armGroup.add(armPivot);
  const armFront = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.055, 0.08), darkMetalMat);
  armFront.position.set(0.42, 0, 0.12);
  armFront.rotation.y = -0.12;
  const armRear = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.055, 0.08), darkMetalMat);
  armRear.position.set(0.42, 0, -0.12);
  armRear.rotation.y = 0.12;
  armPivot.add(armFront, armRear);

  // Double-Wishbone Upper Control Arm & Multi-Link Trailing Arms (toggled by sim.suspensionType)
  const upperArmPivot = new THREE.Group();
  upperArmPivot.position.set(-0.62, 0.28, 0);
  const upperF = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.045, 0.065), steelMat);
  upperF.position.set(0.32, 0, 0.09);
  upperF.rotation.y = -0.1;
  const upperR = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.045, 0.065), steelMat);
  upperR.position.set(0.32, 0, -0.09);
  upperR.rotation.y = 0.1;
  upperArmPivot.add(upperF, upperR);
  armGroup.add(upperArmPivot);

  const multiLinkArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 10), springMat);
  multiLinkArm.rotation.z = Math.PI / 2;
  multiLinkArm.position.set(-0.34, 0.02, -0.22);
  armGroup.add(multiLinkArm);

  // 3. Shock Absorber (Damper) Body + Chrome Piston Rod
  const damperBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.56, 20), darkMetalMat);
  damperBody.position.set(0.06, 0.34, 0);
  damperBody.rotation.z = 0.18;
  const damperRod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.56, 14), steelMat);
  damperRod.position.set(0.01, 0.62, 0);
  damperRod.rotation.z = 0.18;
  const innerPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.07, 18), steelMat);
  innerPiston.position.set(0.04, 0.44, 0);
  innerPiston.rotation.z = 0.18;
  damperGroup.add(damperBody, damperRod, innerPiston);

  // 4. Helical Coil Spring (wraps around upper strut)
  const coilMesh = new THREE.Mesh(
    createCoilSpringGeometry(0.14, 0.62, 6, 0.022, 84),
    springMat,
  );
  coilMesh.position.set(0.01, 0.66, 0);
  coilMesh.rotation.z = 0.18;
  springGroup.add(coilMesh);

  // 5. Upper Strut Mount Tower
  const topTower = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 24), darkMetalMat);
  topTower.position.set(-0.08, 1.04, 0);
  const frameBeam = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.34), darkMetalMat);
  frameBeam.position.set(-0.45, 1.06, 0);
  mountGroup.add(topTower, frameBeam);

  const partMap: Record<string, THREE.Object3D> = {
    'wheel-hub': hubGroup,
    'control-arm': armGroup,
    'coil-spring': springGroup,
    'shock-damper': damperGroup,
    'strut-mount': mountGroup,
  };
  const partCtrl = createPartController(partMap, [bumpMat]);

  const explodables: ExplodableEntry[] = [
    { object: hubGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.62, -0.1, 0) },
    { object: armGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.55, -0.35, 0) },
    { object: springGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.35, 0.25, 0.42) },
    { object: damperGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.3, 0.15, -0.35) },
    { object: mountGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.55, 0) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'wheel-hub', name: 'Wheel Hub', anchor: makePartAnchor(wheelAssembly, 0.25, 0, 0.25) },
    { partId: 'control-arm', name: 'Control Arm', anchor: makePartAnchor(armPivot, 0.4, -0.05, 0.18) },
    { partId: 'coil-spring', name: 'Coil Spring', anchor: makePartAnchor(coilMesh, -0.18, 0, 0.15) },
    { partId: 'shock-damper', name: 'Shock Damper', anchor: makePartAnchor(damperBody, 0.14, 0, -0.12) },
    { partId: 'strut-mount', name: 'Strut Mount', anchor: makePartAnchor(topTower, 0, 0.15, 0.1) },
  ];

  const dummy = new THREE.Object3D();
  let roadOffset = 0;
  let currentPhase = 0;

  const updateRoadAndFlex = (offset: number, bumpScale = 1, suspType: string = 'double-wishbone') => {
    upperArmPivot.visible = suspType === 'double-wishbone' || suspType === 'multi-link';
    multiLinkArm.visible = suspType === 'multi-link';

    const sample = computeSuspensionRoadSample(offset, bumpScale);
    currentPhase = sample.phaseIndex;

    for (let i = 0; i < blockCount; i++) {
      const s = (i / blockCount) * ROAD_LEN;
      const wrappedX = (((s + offset) % ROAD_LEN) + ROAD_LEN) % ROAD_LEN - ROAD_LEN * 0.5;
      const h = evalRoadBumpAtWorldX(wrappedX, sample.bumpWorldX, bumpScale);
      // Keep bottom of road block anchored at y = -0.66 so top surface is exactly at -0.60 + h
      dummy.position.set(wrappedX, -0.63 + h * 0.5, 0);
      dummy.scale.set(1, (0.06 + h) / 0.06, 1);
      dummy.updateMatrix();
      roadMesh.setMatrixAt(i, dummy.matrix);
    }
    roadMesh.instanceMatrix.needsUpdate = true;

    // Tire outer radius = 0.38 + 0.12 = 0.50; rest wheel center y = -0.10 => rest bottom = -0.60
    const flex = sample.bumpUnderTire;
    wheelAssembly.position.y = -0.1 + flex;
    armPivot.rotation.z = Math.atan2(flex, 0.86);
    upperArmPivot.rotation.z = Math.atan2(flex, 0.66);
    coilMesh.scale.y = Math.max(0.45, 1 - flex * 1.15);
    coilMesh.position.y = 0.66 + flex * 0.45;
    damperBody.position.y = 0.34 + flex * 0.72;
    innerPiston.position.y = 0.44 + flex * 0.25;
  };

  updateRoadAndFlex(0);

  return {
    root,
    defaultCamera: {
      target: [-0.05, 1.15, 0],
      position: [1.85, 1.55, 3.25],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        const step = dt * sim.speed * motionFactor;
        roadOffset += step * 1.15;
        tire.rotation.z -= step * 2.3;
        rim.rotation.y -= step * 2.3;
      }
      updateRoadAndFlex(roadOffset, sim.roadBump ?? 1, sim.suspensionType ?? 'double-wishbone');
      return { phaseIndex: currentPhase };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['shock-damper'], enabled, 0.26),
    dispose: () => disposeObject3D(root),
  };
}

