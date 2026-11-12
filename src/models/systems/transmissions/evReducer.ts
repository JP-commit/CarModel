import * as THREE from 'three';
import { createGearGeometry, makePartAnchor, type ExplodableEntry } from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';
import {
  buildDifferentialAssembly,
  createTransmissionMaterials,
  finalizeTransmissionModel,
} from './shared';

export function createEvReducerTransmissionModel(): SystemModelInstance {
  const mats = createTransmissionMaterials();
  const root = new THREE.Group();
  root.name = 'TransmissionCutaway_EVReducer';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const casingGroup = new THREE.Group();
  const inputGroup = new THREE.Group();
  const counterGroup = new THREE.Group();
  const { diffGroup, diffSpin } = buildDifferentialAssembly(mats, 0.62, -0.04);
  assembly.add(casingGroup, inputGroup, counterGroup, diffGroup);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 1.05, 28, 1, true, Math.PI * 0.45, Math.PI * 1.1),
    mats.aluMat,
  );
  shell.rotation.z = Math.PI / 2;
  shell.position.set(0.05, 0.04, 0);
  casingGroup.add(shell);

  // Motor Input Pinion
  const inSpin = new THREE.Group();
  inSpin.position.set(-0.42, 0.22, 0);
  inputGroup.add(inSpin);

  const inShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 16), mats.steelMat);
  inShaft.rotation.z = Math.PI / 2;
  const pinion = new THREE.Mesh(
    createGearGeometry({ teeth: 13, pitchRadius: 0.12, thickness: 0.09, boreRadius: 0.038 }),
    mats.steelMat,
  );
  pinion.rotation.y = Math.PI / 2;
  pinion.position.x = 0.06;
  inSpin.add(inShaft, pinion);

  // Intermediate Reduction Gear
  const midSpin = new THREE.Group();
  midSpin.position.set(0.08, -0.02, 0);
  counterGroup.add(midSpin);

  const midShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.48, 16), mats.darkSteelMat);
  midShaft.rotation.z = Math.PI / 2;
  const largeGear = new THREE.Mesh(
    createGearGeometry({ teeth: 30, pitchRadius: 0.28, thickness: 0.075, boreRadius: 0.038 }),
    mats.darkSteelMat,
  );
  largeGear.rotation.y = Math.PI / 2;
  largeGear.position.x = -0.08;
  const stepPinion = new THREE.Mesh(
    createGearGeometry({ teeth: 14, pitchRadius: 0.14, thickness: 0.075, boreRadius: 0.038 }),
    mats.steelMat,
  );
  stepPinion.rotation.y = Math.PI / 2;
  stepPinion.position.x = 0.1;
  midSpin.add(midShaft, largeGear, stepPinion);

  const partMap: Record<string, THREE.Object3D> = {
    casing: casingGroup,
    'input-shaft': inputGroup,
    countershaft: counterGroup,
    differential: diffGroup,
  };

  const explodables: ExplodableEntry[] = [
    { object: casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.65, -0.82) },
    { object: inputGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.75, 0.25, 0.22) },
    { object: counterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.58, 0.3) },
    { object: diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.85, 0, 0.15) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'EV Reducer Case', anchor: makePartAnchor(casingGroup, 0, 0.52, -0.15) },
    { partId: 'input-shaft', name: 'Motor Pinion', anchor: makePartAnchor(inSpin, 0, 0.2, 0.1) },
    { partId: 'countershaft', name: 'Reduction Gear', anchor: makePartAnchor(midSpin, 0, -0.3, 0.12) },
    { partId: 'differential', name: 'Final Ring & Axles', anchor: makePartAnchor(diffSpin, 0, 0.35, 0.2) },
  ];

  let elapsed = 0;
  let motorAngle = 0;

  return finalizeTransmissionModel({
    root,
    variant: 'ev-reducer',
    partMap,
    explodables,
    labelAnchors,
    targetRigExtent: 0.44,
    onUpdate: (dt, sim) => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      const step = sim.playing ? dt * sim.speed * motionFactor : 0;
      elapsed += step;

      const stage = Math.floor((elapsed / 3.0) % 4);
      const omega = stage === 2 ? -5.0 : stage === 1 ? 9.2 : stage === 3 ? 4.2 : 6.4;
      motorAngle += step * omega;

      inSpin.rotation.x = motorAngle;
      midSpin.rotation.x = -motorAngle / 2.3;
      diffSpin.rotation.z = motorAngle / 9.1;

      return {
        phaseIndex: stage,
        activeGear: stage === 2 ? 'Reverse (Electronic)' : stage === 3 ? 'Regen' : '1-Speed Drive',
        gearRatio: 9.1,
        rpm: Math.round(Math.abs(omega) * 1150),
        powerFlowPct: stage === 3 ? -68 : 98,
      };
    },
  });
}

