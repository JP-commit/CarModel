import * as THREE from 'three';
import { disposeObject3D } from '../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createGearGeometry,
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

export function createSystemModel(): SystemModelInstance {
  const root = new THREE.Group();
  root.name = 'SteeringCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 0.85;
  root.add(assembly);

  const wheelGroup = new THREE.Group();
  const columnGroup = new THREE.Group();
  const pinionGroup = new THREE.Group();
  const rackGroup = new THREE.Group();
  const tieGroup = new THREE.Group();
  assembly.add(wheelGroup, columnGroup, pinionGroup, rackGroup, tieGroup);

  const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.88, roughness: 0.24 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.72, roughness: 0.36 });
  const gripMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.15, roughness: 0.78 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#f05a28', metalness: 0.5, roughness: 0.35 });

  // 1. Steering Wheel (angled cleanly toward viewer at top-left)
  const wheelSpin = new THREE.Group();
  wheelSpin.position.set(0, 1.25, 0.45);
  wheelSpin.rotation.x = -0.62;
  wheelGroup.add(wheelSpin);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 14, 36), gripMat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 18), darkMat);
  hub.rotation.x = Math.PI / 2;
  const topMarker = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.07), accentMat);
  topMarker.position.y = 0.32;
  wheelSpin.add(rim, hub, topMarker);

  for (const ang of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.025), steelMat);
    spoke.position.set(Math.sin(ang) * 0.15, -Math.cos(ang) * 0.15, 0);
    spoke.rotation.z = ang;
    wheelSpin.add(spoke);
  }

  // 2. Steering Column + U-joint
  const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.92, 16), steelMat);
  colShaft.position.set(0, 0.86, 0.22);
  colShaft.rotation.x = -0.58;
  const uJoint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 14), darkMat);
  uJoint.position.set(0, 0.44, -0.02);
  columnGroup.add(colShaft, uJoint);

  // 3. Pinion Gear (12 teeth meshing at top of steering rack)
  const pinionSpin = new THREE.Group();
  pinionSpin.position.set(0, 0.24, -0.02);
  const pinionGear = new THREE.Mesh(
    createGearGeometry({ teeth: 12, pitchRadius: 0.11, thickness: 0.09, boreRadius: 0.03 }),
    accentMat,
  );
  pinionGear.rotation.x = Math.PI / 2;
  pinionSpin.add(pinionGear);
  pinionGroup.add(pinionSpin);

  // 4. Cutaway Rack Tube + Sliding Toothed Rack Bar
  const rackTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 1.38, 22, 1, true, Math.PI * 0.35, Math.PI * 1.3),
    darkMat,
  );
  rackTube.rotation.z = Math.PI / 2;
  rackTube.position.set(0, 0.08, -0.02);
  rackGroup.add(rackTube);

  const slidingRack = new THREE.Group();
  slidingRack.position.set(0, 0.08, -0.02);
  const rackBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.065, 0.07), steelMat);
  slidingRack.add(rackBar);

  // Instanced teeth along center of rack bar
  const toothCount = 15;
  const toothGeo = new THREE.BoxGeometry(0.032, 0.035, 0.065);
  const rackTeeth = new THREE.InstancedMesh(toothGeo, steelMat, toothCount);
  const td = new THREE.Object3D();
  for (let i = 0; i < toothCount; i++) {
    td.position.set((i - (toothCount - 1) / 2) * 0.056, 0.045, 0);
    td.updateMatrix();
    rackTeeth.setMatrixAt(i, td.matrix);
  }
  rackTeeth.instanceMatrix.needsUpdate = true;
  slidingRack.add(rackTeeth);
  rackGroup.add(slidingRack);

  // 5. Left & Right Tie Rods + Pivoting Front Wheel Knuckles
  const tieRodL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 12), steelMat);
  tieRodL.rotation.z = Math.PI / 2;
  const tieRodR = tieRodL.clone();
  tieGroup.add(tieRodL, tieRodR);

  const makeSteeredWheel = (xPos: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xPos, 0.08, 0.16);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 28), gripMat);
    tire.rotation.z = Math.PI / 2;
    const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.19, 18), steelMat);
    rimMesh.rotation.z = Math.PI / 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.18), darkMat);
    arm.position.set(xPos > 0 ? -0.1 : 0.1, 0, -0.09);
    pivot.add(tire, rimMesh, arm);
    tieGroup.add(pivot);
    return pivot;
  };
  const wheelL = makeSteeredWheel(-1.15);
  const wheelR = makeSteeredWheel(1.15);

  const partMap: Record<string, THREE.Object3D> = {
    'steering-wheel': wheelGroup,
    'steering-column': columnGroup,
    'pinion-gear': pinionGroup,
    'steering-rack': rackGroup,
    'tie-rods': tieGroup,
  };
  const partCtrl = createPartController(partMap);

  const explodables: ExplodableEntry[] = [
    { object: wheelGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.5, 0.45) },
    { object: columnGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.3, 0.2) },
    { object: pinionGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.22, -0.25) },
    { object: rackGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.32, -0.15) },
    { object: tieGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.15, 0.38) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'steering-wheel', name: 'Steering Wheel', anchor: makePartAnchor(wheelSpin, 0.35, 0.2, 0) },
    { partId: 'steering-column', name: 'Column', anchor: makePartAnchor(colShaft, -0.18, 0, 0.08) },
    { partId: 'pinion-gear', name: 'Pinion Gear', anchor: makePartAnchor(pinionSpin, 0.18, 0.12, 0.05) },
    { partId: 'steering-rack', name: 'Steering Rack', anchor: makePartAnchor(slidingRack, 0, -0.18, 0.12) },
    { partId: 'tie-rods', name: 'Tie Rods & Wheels', anchor: makePartAnchor(wheelR, 0, 0.38, 0) },
  ];

  let elapsed = 0;

  return {
    root,
    defaultCamera: {
      target: [0, 1.35, 0.1],
      position: [1.95, 2.25, 3.35],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        elapsed += dt * sim.speed * motionFactor;
      }
      const sweep = Math.sin(elapsed * 1.45); // -1 .. +1
      const steerAngle = sweep * 1.25;

      wheelSpin.rotation.z = -steerAngle;
      colShaft.rotation.y = steerAngle;
      pinionSpin.rotation.y = -steerAngle;

      const rackShift = sweep * 0.22;
      slidingRack.position.x = rackShift;
      tieRodL.position.set(-0.92 + rackShift * 0.5, 0.08, 0.04);
      tieRodR.position.set(0.92 + rackShift * 0.5, 0.08, 0.04);

      const wheelTurn = -sweep * 0.42;
      wheelL.rotation.y = wheelTurn;
      wheelR.rotation.y = wheelTurn;

      const norm = ((elapsed * 1.45) % (Math.PI * 2)) / (Math.PI * 2);
      const stage = norm < 0.18 ? 0 : norm < 0.5 ? 1 : norm < 0.68 ? 2 : 3;
      return { phaseIndex: stage };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['steering-rack'], enabled, 0.24),
    dispose: () => disposeObject3D(root),
  };
}

