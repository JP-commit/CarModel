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
  root.name = 'TransmissionCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const casingGroup = new THREE.Group();
  const clutchGroup = new THREE.Group();
  const inputGroup = new THREE.Group();
  const counterGroup = new THREE.Group();
  const syncGroup = new THREE.Group();
  const diffGroup = new THREE.Group();
  assembly.add(casingGroup, clutchGroup, inputGroup, counterGroup, syncGroup, diffGroup);

  const caseMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.72,
    roughness: 0.36,
    side: THREE.DoubleSide,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.24 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.88, roughness: 0.28 });
  const clutchPadMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.2, roughness: 0.72 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.86, roughness: 0.24 });

  // 1. Split Cutaway Casing + Instanced Bolts
  const bellShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.56, 0.45, 28, 1, true, Math.PI * 0.45, Math.PI * 1.1),
    caseMat,
  );
  bellShell.rotation.z = Math.PI / 2;
  bellShell.position.set(-1.05, 0.14, 0);
  casingGroup.add(bellShell);

  const mainShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 1.5, 28, 1, true, Math.PI * 0.48, Math.PI * 1.04),
    caseMat,
  );
  mainShell.rotation.z = Math.PI / 2;
  mainShell.position.set(-0.08, 0.04, 0);
  casingGroup.add(mainShell);

  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6);
  const bolts = new THREE.InstancedMesh(boltGeo, steelMat, 8);
  const bd = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bd.position.set(-0.84, 0.14 + Math.sin(a) * 0.44, Math.cos(a) * 0.44);
    bd.rotation.set(0, 0, Math.PI / 2);
    bd.updateMatrix();
    bolts.setMatrixAt(i, bd.matrix);
  }
  bolts.instanceMatrix.needsUpdate = true;
  casingGroup.add(bolts);

  // 2. Clutch Assembly (flywheel plate + friction disc)
  const clutchSpin = new THREE.Group();
  clutchSpin.position.set(-1.12, 0.18, 0);
  clutchGroup.add(clutchSpin);

  const pressurePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 32), darkSteelMat);
  pressurePlate.rotation.z = Math.PI / 2;
  pressurePlate.position.x = -0.05;
  const frictionDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.045, 32), clutchPadMat);
  frictionDisc.rotation.z = Math.PI / 2;
  frictionDisc.position.x = 0.03;
  clutchSpin.add(pressurePlate, frictionDisc);

  // 3. Input Shaft + Drive Gear + Stepped Output Gears (aligned on X = -0.9 .. +0.4)
  const inputSpin = new THREE.Group();
  inputSpin.position.set(-0.45, 0.18, 0);
  inputGroup.add(inputSpin);

  const inShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.96, 18), steelMat);
  inShaft.rotation.z = Math.PI / 2;
  inputSpin.add(inShaft);

  const inGear = new THREE.Mesh(
    createGearGeometry({ teeth: 14, pitchRadius: 0.15, thickness: 0.075, boreRadius: 0.04 }),
    steelMat,
  );
  inGear.rotation.y = Math.PI / 2;
  inGear.position.x = -0.25;
  inputSpin.add(inGear);

  // 4. Countershaft (below main axis at y = -0.18)
  const counterSpin = new THREE.Group();
  counterSpin.position.set(-0.18, -0.18, 0);
  counterGroup.add(counterSpin);

  const cShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 18), darkSteelMat);
  cShaft.rotation.z = Math.PI / 2;
  counterSpin.add(cShaft);

  const counterGearSpecs = [
    { x: -0.52, teeth: 24, r: 0.21 }, // meshes with input gear
    { x: -0.12, teeth: 13, r: 0.13 }, // 1st gear drive
    { x: 0.22, teeth: 18, r: 0.17 },  // 2nd gear drive
    { x: 0.54, teeth: 22, r: 0.21 },  // 3rd gear drive
  ];
  for (const spec of counterGearSpecs) {
    const g = new THREE.Mesh(
      createGearGeometry({ teeth: spec.teeth, pitchRadius: spec.r, thickness: 0.07, boreRadius: 0.038 }),
      darkSteelMat,
    );
    g.rotation.y = Math.PI / 2;
    g.position.x = spec.x;
    counterSpin.add(g);
  }

  // 5. Output Shaft + 3 Freewheeling Output Gears + Sliding Synchronizer Collar
  const outSpin = new THREE.Group();
  outSpin.position.set(0.24, 0.18, 0);
  syncGroup.add(outSpin);

  const outShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.15, 18), steelMat);
  outShaft.rotation.z = Math.PI / 2;
  outSpin.add(outShaft);

  const outGearSpecs = [
    { x: -0.54, teeth: 26, r: 0.23 }, // 1st gear driven (large = torque)
    { x: -0.2, teeth: 20, r: 0.19 },  // 2nd gear driven
    { x: 0.12, teeth: 15, r: 0.15 },  // 3rd gear driven (small = speed)
  ];
  const outGears: THREE.Mesh[] = [];
  for (const spec of outGearSpecs) {
    const g = new THREE.Mesh(
      createGearGeometry({ teeth: spec.teeth, pitchRadius: spec.r, thickness: 0.068, boreRadius: 0.045 }),
      steelMat,
    );
    g.rotation.y = Math.PI / 2;
    g.position.x = spec.x;
    outSpin.add(g);
    outGears.push(g);
  }

  // Sliding synchronizer sleeve + shift fork
  const syncCollar = new THREE.Group();
  syncCollar.position.set(-0.37, 0.18, 0);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 20), brassMat);
  sleeve.rotation.z = Math.PI / 2;
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.06), brassMat);
  fork.position.y = 0.14;
  syncCollar.add(sleeve, fork);
  syncGroup.add(syncCollar);

  // 6. Differential Ring Gear + Bevel Housing + Left/Right Axle Half-Shafts
  const diffSpin = new THREE.Group();
  diffSpin.position.set(0.95, 0.18, 0);
  diffGroup.add(diffSpin);

  const ringGear = new THREE.Mesh(
    createGearGeometry({ teeth: 28, pitchRadius: 0.3, thickness: 0.065, boreRadius: 0.12 }),
    steelMat,
  );
  ringGear.position.z = -0.14;
  diffSpin.add(ringGear);

  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 18), darkSteelMat);
  cage.rotation.x = Math.PI / 2;
  diffSpin.add(cage);

  const axleL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.72, 16), steelMat);
  axleL.rotation.x = Math.PI / 2;
  axleL.position.z = 0.42;
  const axleR = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.72, 16), steelMat);
  axleR.rotation.x = Math.PI / 2;
  axleR.position.z = -0.42;
  diffSpin.add(axleL, axleR);

  const partMap: Record<string, THREE.Object3D> = {
    casing: casingGroup,
    clutch: clutchGroup,
    'input-shaft': inputGroup,
    countershaft: counterGroup,
    synchronizer: syncGroup,
    differential: diffGroup,
  };
  const partCtrl = createPartController(partMap);

  const explodables: ExplodableEntry[] = [
    { object: casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.55, -0.75) },
    { object: clutchGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.75, 0, 0) },
    { object: inputGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.3, 0.35, 0.25) },
    { object: counterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.48, 0.2) },
    { object: syncGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.25, 0.35, 0.25) },
    { object: diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.75, 0, 0) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'Casing', anchor: makePartAnchor(casingGroup, -0.2, 0.55, -0.2) },
    { partId: 'clutch', name: 'Clutch', anchor: makePartAnchor(clutchSpin, 0, 0.4, 0) },
    { partId: 'input-shaft', name: 'Input Shaft', anchor: makePartAnchor(inputSpin, -0.2, 0.25, 0.1) },
    { partId: 'countershaft', name: 'Countershaft', anchor: makePartAnchor(counterSpin, 0, -0.25, 0.15) },
    { partId: 'synchronizer', name: 'Synchronizer', anchor: makePartAnchor(syncCollar, 0, 0.28, 0.1) },
    { partId: 'differential', name: 'Differential', anchor: makePartAnchor(diffSpin, 0, 0.35, 0.2) },
  ];

  let elapsed = 0;
  let inAngle = 0;
  let outAngle = 0;

  return {
    root,
    defaultCamera: {
      target: [0.05, 1.05, 0],
      position: [2.65, 2.1, 4.05],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        const step = dt * sim.speed * motionFactor;
        elapsed += step;
        inAngle += step * 3.8;
      }

      const stage = Math.floor((elapsed / 3.2) % 4);
      const gearRatio = stage === 0 ? 0.42 : stage === 1 ? 0.72 : 1.08;
      if (sim.playing) {
        outAngle += dt * sim.speed * motionFactor * 3.8 * gearRatio;
      }

      clutchSpin.rotation.x = inAngle;
      inputSpin.rotation.x = inAngle;
      counterSpin.rotation.x = -inAngle * 0.6;
      outSpin.rotation.x = outAngle;
      diffSpin.rotation.z = -outAngle * 0.45;
      sleeve.rotation.x = outAngle;

      // Smoothly slide synchronizer collar between 1st, 2nd, and 3rd gear
      const targetSyncX = stage === 0 ? -0.3 : stage === 1 ? 0.04 : 0.36;
      syncCollar.position.x += (targetSyncX - syncCollar.position.x) * Math.min(1, dt * 8);

      return { phaseIndex: stage };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['casing'], enabled, 0.22),
    dispose: () => disposeObject3D(root),
  };
}

