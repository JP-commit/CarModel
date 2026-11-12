import * as THREE from 'three';
import { makePartAnchor, type ExplodableEntry } from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';
import { buildManualGearboxCore } from './manual';
import { createTransmissionMaterials, finalizeTransmissionModel } from './shared';

export function createAmtTransmissionModel(): SystemModelInstance {
  const mats = createTransmissionMaterials();
  const core = buildManualGearboxCore(mats);
  core.root.name = 'TransmissionCutaway_AMT';

  // Clutch Electro-Hydraulic Actuator Motor
  const clutchActGroup = new THREE.Group();
  clutchActGroup.position.set(-1.18, -0.34, 0.36);
  core.assembly.add(clutchActGroup);

  const actMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 18), mats.accentBlueMat);
  actMotor.rotation.z = Math.PI / 2;
  const actRod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 12), mats.steelMat);
  actRod.rotation.z = Math.PI / 2;
  actRod.position.x = 0.18;
  clutchActGroup.add(actMotor, actRod);

  // Shift-Fork Actuator Tower
  const shiftActGroup = new THREE.Group();
  shiftActGroup.position.set(-0.02, 0.62, 0.16);
  core.assembly.add(shiftActGroup);

  const shiftHousing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.22), mats.darkSteelMat);
  const shiftServo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), mats.accentBlueMat);
  shiftServo.rotation.x = Math.PI / 2;
  shiftServo.position.set(-0.09, 0.11, 0);
  const shiftLinkRod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 12), mats.brassMat);
  shiftLinkRod.position.set(0, -0.14, -0.12);
  shiftActGroup.add(shiftHousing, shiftServo, shiftLinkRod);

  // TCU Computer Block + Status Indicator LED
  const tcuGroup = new THREE.Group();
  tcuGroup.position.set(-0.62, 0.62, -0.22);
  core.assembly.add(tcuGroup);

  const tcuBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), mats.beltMat);
  const tcuFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.16), mats.aluMat);
  tcuFin.position.y = 0.06;
  const ledMat = new THREE.MeshBasicMaterial({ color: '#10b981' });
  const tcuLed = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), ledMat);
  tcuLed.position.set(0.11, 0.075, 0.07);
  tcuLed.userData.lessonOnly = true;
  tcuGroup.add(tcuBox, tcuFin, tcuLed);

  const partMap: Record<string, THREE.Object3D> = {
    casing: core.casingGroup,
    clutch: core.clutchGroup,
    'input-shaft': core.inputGroup,
    countershaft: core.counterGroup,
    synchronizer: core.syncGroup,
    differential: core.diffGroup,
    'clutch-actuator': clutchActGroup,
    'shift-actuator': shiftActGroup,
    'tcu-module': tcuGroup,
  };

  const explodables: ExplodableEntry[] = [
    { object: core.casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.65, -0.95) },
    { object: core.clutchGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.98, 0, 0) },
    { object: core.inputGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.52, 0.55, 0.3) },
    { object: core.counterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.68, 0.25) },
    { object: core.syncGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.42, 0.55, 0.3) },
    { object: core.diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.98, 0, 0) },
    { object: clutchActGroup, basePosition: clutchActGroup.position.clone(), explodeOffset: new THREE.Vector3(-0.7, -0.45, 0.55) },
    { object: shiftActGroup, basePosition: shiftActGroup.position.clone(), explodeOffset: new THREE.Vector3(0.1, 0.72, 0.45) },
    { object: tcuGroup, basePosition: tcuGroup.position.clone(), explodeOffset: new THREE.Vector3(-0.45, 0.85, -0.45) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'Casing', anchor: makePartAnchor(core.casingGroup, -0.2, 0.55, -0.2) },
    { partId: 'clutch', name: 'Single Clutch', anchor: makePartAnchor(core.clutchSpin, 0, 0.4, 0) },
    { partId: 'clutch-actuator', name: 'Clutch Actuator', anchor: makePartAnchor(clutchActGroup, 0, -0.16, 0.14) },
    { partId: 'shift-actuator', name: 'Shift Actuator', anchor: makePartAnchor(shiftActGroup, 0.14, 0.16, 0.14) },
    { partId: 'tcu-module', name: 'TCU Brain', anchor: makePartAnchor(tcuGroup, 0, 0.14, 0) },
    { partId: 'synchronizer', name: 'Synchronizer', anchor: makePartAnchor(core.syncCollar, 0, 0.28, 0.1) },
    { partId: 'differential', name: 'Differential', anchor: makePartAnchor(core.diffSpin, 0, 0.35, 0.2) },
  ];

  let elapsed = 0;
  let inAngle = 0;
  let outAngle = 0;

  return finalizeTransmissionModel({
    root: core.root,
    variant: 'amt',
    partMap,
    explodables,
    labelAnchors,
    skipMaterials: [ledMat],
    onUpdate: (dt, sim) => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      const step = sim.playing ? dt * sim.speed * motionFactor : 0;
      elapsed += step;

      // 4 stages: 0 = 1st Drive, 1 = Torque Interruption Shift Pause, 2 = 2nd Drive, 3 = 3rd Cruise
      const stage = Math.floor((elapsed / 2.6) % 4);
      const isPause = stage === 1;
      const gearIndex = stage === 0 ? 0 : stage === 1 || stage === 2 ? 1 : 2;
      const stageProgress = (elapsed % 2.6) / 2.6;

      inAngle += step * (isPause ? 1.8 : 4.0);
      const outMul = gearIndex === 0 ? 0.44 : gearIndex === 1 ? 0.74 : 1.08;
      outAngle += step * 4.0 * outMul * (isPause ? 0.55 : 1);

      const clutchStroke = isPause ? Math.sin(stageProgress * Math.PI) : 0;
      core.clutchSpin.rotation.x = inAngle;
      core.frictionDisc.position.x = 0.03 + clutchStroke * 0.08;
      actRod.position.x = 0.18 + clutchStroke * 0.12;

      core.inputSpin.rotation.x = inAngle * (1 - clutchStroke * 0.65);
      core.counterSpin.rotation.x = -inAngle * 0.6 * (1 - clutchStroke * 0.65);
      core.outSpin.rotation.x = outAngle;
      core.diffSpin.rotation.z = -outAngle * 0.45;
      core.sleeve.rotation.x = outAngle;

      const targetSyncX = gearIndex === 0 ? -0.3 : gearIndex === 1 ? 0.04 : 0.36;
      core.syncCollar.position.x += (targetSyncX - core.syncCollar.position.x) * Math.min(1, dt * 7);
      shiftLinkRod.position.x = core.syncCollar.position.x * 0.45;

      // Subtle longitudinal head-nod indicator during torque interruption
      core.assembly.rotation.z = isPause ? -Math.sin(stageProgress * Math.PI) * 0.045 : 0;
      ledMat.color.set(isPause ? '#f59e0b' : '#10b981');

      return {
        phaseIndex: stage,
        activeGear: isPause ? 'Shifting…' : gearIndex === 0 ? '1st' : gearIndex === 1 ? '2nd' : '3rd',
        gearRatio: gearIndex === 0 ? 3.4 : gearIndex === 1 ? 2.05 : 1.32,
        rpm: isPause ? 1250 : 2100 + gearIndex * 500,
        powerFlowPct: isPause ? 8 : 96,
        headNod: isPause,
      };
    },
  });
}

