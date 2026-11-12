import * as THREE from 'three';
import { createGearGeometry, makePartAnchor, type ExplodableEntry } from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';
import {
  buildCutawayBellCasing,
  buildDifferentialAssembly,
  createTransmissionMaterials,
  finalizeTransmissionModel,
} from './shared';

export function createDctTransmissionModel(): SystemModelInstance {
  const mats = createTransmissionMaterials();
  const root = new THREE.Group();
  root.name = 'TransmissionCutaway_DCT';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const casingGroup = buildCutawayBellCasing(mats, { length: 1.56, radius: 0.48 });
  const dualClutchGroup = new THREE.Group();
  const shaftsGroup = new THREE.Group();
  const syncGroup = new THREE.Group();
  const mechaGroup = new THREE.Group();
  const { diffGroup, diffSpin } = buildDifferentialAssembly(mats, 0.98, 0.16);
  assembly.add(casingGroup, dualClutchGroup, shaftsGroup, syncGroup, mechaGroup, diffGroup);

  // 1. Coaxial Dual Clutches: K1 (Outer Amber - Odd) & K2 (Inner Blue - Even)
  const k1Spin = new THREE.Group();
  k1Spin.position.set(-1.12, 0.16, 0);
  const k1Disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.055, 28), mats.clutchPadMat);
  k1Disc.rotation.z = Math.PI / 2;
  k1Spin.add(k1Disc);

  const k2Spin = new THREE.Group();
  k2Spin.position.set(-0.98, 0.16, 0);
  const k2Disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 26), mats.accentBlueMat);
  k2Disc.rotation.z = Math.PI / 2;
  k2Spin.add(k2Disc);
  dualClutchGroup.add(k1Spin, k2Spin);

  // 2. Concentric Odd (Solid Inner) & Even (Hollow Outer) Shafts + Stepped Gears
  const oddSpin = new THREE.Group();
  oddSpin.position.set(-0.38, 0.16, 0);
  const oddShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.32, 14), mats.copperMat);
  oddShaft.rotation.z = Math.PI / 2;
  oddSpin.add(oddShaft);

  const evenSpin = new THREE.Group();
  evenSpin.position.set(-0.62, 0.16, 0);
  const evenHollowShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.72, 16, 1, true),
    mats.accentBlueMat,
  );
  evenHollowShaft.rotation.z = Math.PI / 2;
  evenSpin.add(evenHollowShaft);

  for (const x of [-0.08, 0.24]) {
    const g = new THREE.Mesh(
      createGearGeometry({ teeth: x < 0 ? 13 : 19, pitchRadius: x < 0 ? 0.13 : 0.18, thickness: 0.065, boreRadius: 0.03 }),
      mats.copperMat,
    );
    g.rotation.y = Math.PI / 2;
    g.position.x = x;
    oddSpin.add(g);
  }
  for (const x of [-0.08, 0.16]) {
    const g = new THREE.Mesh(
      createGearGeometry({ teeth: x < 0 ? 16 : 22, pitchRadius: x < 0 ? 0.15 : 0.21, thickness: 0.065, boreRadius: 0.055 }),
      mats.accentBlueMat,
    );
    g.rotation.y = Math.PI / 2;
    g.position.x = x;
    evenSpin.add(g);
  }
  shaftsGroup.add(oddSpin, evenSpin);

  // Countershaft & Synchronizer Collars (Odd vs Even pre-select)
  const counterSpin = new THREE.Group();
  counterSpin.position.set(-0.24, -0.18, 0);
  const cBar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1.32, 16), mats.darkSteelMat);
  cBar.rotation.z = Math.PI / 2;
  counterSpin.add(cBar);

  for (const spec of [
    { x: -0.46, r: 0.22 },
    { x: -0.22, r: 0.19 },
    { x: 0.12, r: 0.16 },
    { x: 0.36, r: 0.13 },
  ]) {
    const cg = new THREE.Mesh(
      createGearGeometry({ teeth: 18, pitchRadius: spec.r, thickness: 0.062, boreRadius: 0.038 }),
      mats.darkSteelMat,
    );
    cg.rotation.y = Math.PI / 2;
    cg.position.x = spec.x;
    counterSpin.add(cg);
  }
  syncGroup.add(counterSpin);

  const oddCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 18), mats.copperMat);
  oddCollar.rotation.z = Math.PI / 2;
  oddCollar.position.set(-0.2, -0.18, 0);
  const evenCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 18), mats.accentBlueMat);
  evenCollar.rotation.z = Math.PI / 2;
  evenCollar.position.set(-0.56, -0.18, 0);
  syncGroup.add(oddCollar, evenCollar);

  // 3. Mechatronic Actuator & Dual Shift Forks
  const mechaBlock = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.24), mats.beltMat);
  mechaBlock.position.set(-0.24, 0.62, 0.12);
  const oddFork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.05), mats.copperMat);
  oddFork.position.set(-0.2, 0.22, 0.08);
  const evenFork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.05), mats.accentBlueMat);
  evenFork.position.set(-0.56, 0.22, -0.08);
  mechaGroup.add(mechaBlock, oddFork, evenFork);

  const partMap: Record<string, THREE.Object3D> = {
    casing: casingGroup,
    'dual-clutch': dualClutchGroup,
    'concentric-shafts': shaftsGroup,
    synchronizer: syncGroup,
    mechatronic: mechaGroup,
    differential: diffGroup,
  };

  const explodables: ExplodableEntry[] = [
    { object: casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.65, -0.95) },
    { object: dualClutchGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.02, 0, 0) },
    { object: shaftsGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.3, 0.58, 0.35) },
    { object: syncGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.68, 0.28) },
    { object: mechaGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.25, 0.84, 0.45) },
    { object: diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.98, 0, 0) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'DCT Housing', anchor: makePartAnchor(casingGroup, -0.15, 0.55, -0.2) },
    { partId: 'dual-clutch', name: 'K1 / K2 Clutches', anchor: makePartAnchor(k1Spin, 0.06, 0.42, 0) },
    { partId: 'concentric-shafts', name: 'Concentric Shafts', anchor: makePartAnchor(oddSpin, 0, 0.3, 0.14) },
    { partId: 'synchronizer', name: 'Odd/Even Syncs', anchor: makePartAnchor(counterSpin, 0, -0.32, 0.14) },
    { partId: 'mechatronic', name: 'Mechatronic TCU', anchor: makePartAnchor(mechaBlock, 0, 0.16, 0.1) },
    { partId: 'differential', name: 'Differential', anchor: makePartAnchor(diffSpin, 0, 0.35, 0.2) },
  ];

  let elapsed = 0;
  let kAngle = 0;
  let outAngle = 0;

  return finalizeTransmissionModel({
    root,
    variant: 'dct',
    partMap,
    explodables,
    labelAnchors,
    onUpdate: (dt, sim) => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      const step = sim.playing ? dt * sim.speed * motionFactor : 0;
      elapsed += step;

      // Stages 0..3 correspond to 1st (K1), 2nd (K2), 3rd (K1), 4th (K2)
      const stage = Math.floor((elapsed / 2.4) % 4);
      const activeK1 = stage % 2 === 0;
      const ratios = [3.5, 2.25, 1.5, 1.02];
      const outMul = [0.42, 0.68, 0.96, 1.28][stage];

      kAngle += step * 4.4;
      outAngle += step * 4.4 * outMul;

      k1Spin.rotation.x = kAngle;
      k2Spin.rotation.x = kAngle;
      // Show subtle axial clamping offset between K1 and K2
      k1Disc.position.x = activeK1 ? 0.035 : -0.025;
      k2Disc.position.x = activeK1 ? -0.025 : 0.035;

      oddSpin.rotation.x = kAngle;
      evenSpin.rotation.x = kAngle;
      counterSpin.rotation.x = -outAngle;
      diffSpin.rotation.z = -outAngle * 0.46;

      // Active collar sits engaged, while idle shaft collar PRE-SELECTS the next gear!
      const targetOddX = stage <= 1 ? -0.16 : 0.14;
      const targetEvenX = stage === 0 || stage === 1 ? -0.44 : 0.36;
      oddCollar.position.x += (targetOddX - oddCollar.position.x) * Math.min(1, dt * 8);
      evenCollar.position.x += (targetEvenX - evenCollar.position.x) * Math.min(1, dt * 8);
      oddFork.position.x = oddCollar.position.x;
      evenFork.position.x = evenCollar.position.x;

      return {
        phaseIndex: stage,
        activeGear: `${stage + 1}${stage === 0 ? 'st' : stage === 1 ? 'nd' : stage === 2 ? 'rd' : 'th'} (${activeK1 ? 'K1' : 'K2'})`,
        gearRatio: ratios[stage],
        rpm: 2400 + (stage % 2 === 0 ? 450 : -180),
        powerFlowPct: 99,
      };
    },
  });
}

