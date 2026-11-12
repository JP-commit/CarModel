import * as THREE from 'three';
import { createGearGeometry, makePartAnchor, type ExplodableEntry } from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';
import {
  buildCutawayBellCasing,
  buildDifferentialAssembly,
  createTransmissionMaterials,
  finalizeTransmissionModel,
} from './shared';

export function buildManualGearboxCore(mats: ReturnType<typeof createTransmissionMaterials>) {
  const root = new THREE.Group();
  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const casingGroup = buildCutawayBellCasing(mats);
  const clutchGroup = new THREE.Group();
  const inputGroup = new THREE.Group();
  const counterGroup = new THREE.Group();
  const syncGroup = new THREE.Group();
  const { diffGroup, diffSpin } = buildDifferentialAssembly(mats, 0.95, 0.18);
  assembly.add(casingGroup, clutchGroup, inputGroup, counterGroup, syncGroup, diffGroup);

  // Clutch Assembly
  const clutchSpin = new THREE.Group();
  clutchSpin.position.set(-1.12, 0.18, 0);
  clutchGroup.add(clutchSpin);

  const pressurePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.05, 32),
    mats.darkSteelMat,
  );
  pressurePlate.rotation.z = Math.PI / 2;
  pressurePlate.position.x = -0.05;
  const frictionDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.045, 32),
    mats.clutchPadMat,
  );
  frictionDisc.rotation.z = Math.PI / 2;
  frictionDisc.position.x = 0.03;
  clutchSpin.add(pressurePlate, frictionDisc);

  // Input Shaft + Gear
  const inputSpin = new THREE.Group();
  inputSpin.position.set(-0.45, 0.18, 0);
  inputGroup.add(inputSpin);

  const inShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.96, 18), mats.steelMat);
  inShaft.rotation.z = Math.PI / 2;
  inputSpin.add(inShaft);

  const inGear = new THREE.Mesh(
    createGearGeometry({ teeth: 14, pitchRadius: 0.15, thickness: 0.075, boreRadius: 0.04 }),
    mats.steelMat,
  );
  inGear.rotation.y = Math.PI / 2;
  inGear.position.x = -0.25;
  inputSpin.add(inGear);

  // Countershaft
  const counterSpin = new THREE.Group();
  counterSpin.position.set(-0.18, -0.18, 0);
  counterGroup.add(counterSpin);

  const cShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.35, 18),
    mats.darkSteelMat,
  );
  cShaft.rotation.z = Math.PI / 2;
  counterSpin.add(cShaft);

  const counterGearSpecs = [
    { x: -0.52, teeth: 24, r: 0.21 },
    { x: -0.12, teeth: 13, r: 0.13 },
    { x: 0.22, teeth: 18, r: 0.17 },
    { x: 0.54, teeth: 22, r: 0.21 },
  ];
  for (const spec of counterGearSpecs) {
    const g = new THREE.Mesh(
      createGearGeometry({
        teeth: spec.teeth,
        pitchRadius: spec.r,
        thickness: 0.07,
        boreRadius: 0.038,
      }),
      mats.darkSteelMat,
    );
    g.rotation.y = Math.PI / 2;
    g.position.x = spec.x;
    counterSpin.add(g);
  }

  // Output Shaft + Synchronizer Collar
  const outSpin = new THREE.Group();
  outSpin.position.set(0.24, 0.18, 0);
  syncGroup.add(outSpin);

  const outShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 1.15, 18),
    mats.steelMat,
  );
  outShaft.rotation.z = Math.PI / 2;
  outSpin.add(outShaft);

  const outGearSpecs = [
    { x: -0.54, teeth: 26, r: 0.23 },
    { x: -0.2, teeth: 20, r: 0.19 },
    { x: 0.12, teeth: 15, r: 0.15 },
  ];
  for (const spec of outGearSpecs) {
    const g = new THREE.Mesh(
      createGearGeometry({
        teeth: spec.teeth,
        pitchRadius: spec.r,
        thickness: 0.068,
        boreRadius: 0.045,
      }),
      mats.steelMat,
    );
    g.rotation.y = Math.PI / 2;
    g.position.x = spec.x;
    outSpin.add(g);
  }

  const syncCollar = new THREE.Group();
  syncCollar.position.set(-0.37, 0.18, 0);
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.12, 20),
    mats.brassMat,
  );
  sleeve.rotation.z = Math.PI / 2;
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.06), mats.brassMat);
  fork.position.y = 0.14;
  syncCollar.add(sleeve, fork);
  syncGroup.add(syncCollar);

  return {
    root,
    assembly,
    casingGroup,
    clutchGroup,
    clutchSpin,
    frictionDisc,
    inputGroup,
    inputSpin,
    counterGroup,
    counterSpin,
    syncGroup,
    outSpin,
    syncCollar,
    sleeve,
    diffGroup,
    diffSpin,
  };
}

export function createManualTransmissionModel(): SystemModelInstance {
  const mats = createTransmissionMaterials();
  const core = buildManualGearboxCore(mats);
  core.root.name = 'TransmissionCutaway_Manual';

  // H-Pattern Shifter Gate + Pivoting Lever
  const shifterGroup = new THREE.Group();
  shifterGroup.position.set(-0.08, 0.72, 0.34);
  core.assembly.add(shifterGroup);

  const gatePlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.32), mats.aluMat);
  shifterGroup.add(gatePlate);

  // Visual H-slot rails on top of gate plate
  const railMat = mats.darkSteelMat;
  for (const xSlot of [-0.12, 0, 0.12]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.014, 0.22), railMat);
    rail.position.set(xSlot, 0.022, 0);
    shifterGroup.add(rail);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.014, 0.028), railMat);
  bridge.position.set(0, 0.022, 0);
  shifterGroup.add(bridge);

  const shifterPivot = new THREE.Group();
  shifterPivot.position.set(0, -0.02, 0);
  shifterGroup.add(shifterPivot);

  const leverRod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 14), mats.steelMat);
  leverRod.position.y = 0.17;
  const shiftKnob = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 16), mats.copperMat);
  shiftKnob.position.y = 0.35;
  shifterPivot.add(leverRod, shiftKnob);

  // Foot Clutch Pedal + Release Fork Linkage
  const pedalGroup = new THREE.Group();
  pedalGroup.position.set(-1.38, -0.22, 0.45);
  core.assembly.add(pedalGroup);

  const pedalPivot = new THREE.Group();
  pedalPivot.position.set(0, 0.42, 0);
  pedalGroup.add(pedalPivot);

  const pedalArm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.04), mats.darkSteelMat);
  pedalArm.position.y = -0.21;
  const pedalPad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.035), mats.beltMat);
  pedalPad.position.set(-0.02, -0.42, 0.03);
  pedalPivot.add(pedalArm, pedalPad);

  const releaseFork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), mats.brassMat);
  releaseFork.position.set(0.24, 0.26, -0.34);
  pedalGroup.add(releaseFork);

  const partMap: Record<string, THREE.Object3D> = {
    casing: core.casingGroup,
    clutch: core.clutchGroup,
    'input-shaft': core.inputGroup,
    countershaft: core.counterGroup,
    synchronizer: core.syncGroup,
    differential: core.diffGroup,
    'shifter-gate': shifterGroup,
    'clutch-pedal': pedalGroup,
  };

  const explodables: ExplodableEntry[] = [
    { object: core.casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.65, -0.95) },
    { object: core.clutchGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.98, 0, 0) },
    { object: core.inputGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.52, 0.55, 0.3) },
    { object: core.counterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.68, 0.25) },
    { object: core.syncGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.42, 0.55, 0.3) },
    { object: core.diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.98, 0, 0) },
    { object: shifterGroup, basePosition: shifterGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0.72, 0.45) },
    { object: pedalGroup, basePosition: pedalGroup.position.clone(), explodeOffset: new THREE.Vector3(-0.75, -0.3, 0.55) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'Casing', anchor: makePartAnchor(core.casingGroup, -0.2, 0.55, -0.2) },
    { partId: 'clutch', name: 'Clutch', anchor: makePartAnchor(core.clutchSpin, 0, 0.4, 0) },
    { partId: 'input-shaft', name: 'Input Shaft', anchor: makePartAnchor(core.inputSpin, -0.2, 0.25, 0.1) },
    { partId: 'countershaft', name: 'Countershaft', anchor: makePartAnchor(core.counterSpin, 0, -0.25, 0.15) },
    { partId: 'synchronizer', name: 'Synchronizer', anchor: makePartAnchor(core.syncCollar, 0, 0.28, 0.1) },
    { partId: 'differential', name: 'Differential', anchor: makePartAnchor(core.diffSpin, 0, 0.35, 0.2) },
    { partId: 'shifter-gate', name: 'H-Shifter', anchor: makePartAnchor(shiftKnob, 0, 0.1, 0) },
    { partId: 'clutch-pedal', name: 'Clutch Pedal', anchor: makePartAnchor(pedalPad, 0, -0.08, 0.06) },
  ];

  let elapsed = 0;
  let inAngle = 0;
  let outAngle = 0;
  let lastStage = 0;
  let clutchTimer = 0;

  return finalizeTransmissionModel({
    root: core.root,
    variant: 'manual',
    partMap,
    explodables,
    labelAnchors,
    onUpdate: (dt, sim) => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      const step = sim.playing ? dt * sim.speed * motionFactor : 0;
      elapsed += step;

      const stageCycle = Math.floor((elapsed / 3.2) % 4);
      const gearIndex = Math.min(2, stageCycle);
      if (stageCycle !== lastStage) {
        lastStage = stageCycle;
        clutchTimer = 0.55;
      }
      if (clutchTimer > 0 && sim.playing) {
        clutchTimer = Math.max(0, clutchTimer - dt * sim.speed * motionFactor);
      }
      const clutchPress = Math.sin((clutchTimer / 0.55) * Math.PI);

      const gearRatios = [3.4, 2.05, 1.32];
      const gearNames = ['1st', '2nd', '3rd'];
      const targetRatio = gearRatios[gearIndex];
      const outMul = gearIndex === 0 ? 0.42 : gearIndex === 1 ? 0.72 : 1.08;

      inAngle += step * 3.8;
      const powerFactor = 1 - clutchPress * 0.72;
      outAngle += step * 3.8 * outMul * (0.4 + 0.6 * powerFactor);

      core.clutchSpin.rotation.x = inAngle;
      core.frictionDisc.position.x = 0.03 + clutchPress * 0.07;
      core.inputSpin.rotation.x = inAngle * (1 - clutchPress * 0.45);
      core.counterSpin.rotation.x = -inAngle * 0.6 * (1 - clutchPress * 0.45);
      core.outSpin.rotation.x = outAngle;
      core.diffSpin.rotation.z = -outAngle * 0.45;
      core.sleeve.rotation.x = outAngle;

      const targetSyncX = gearIndex === 0 ? -0.3 : gearIndex === 1 ? 0.04 : 0.36;
      core.syncCollar.position.x += (targetSyncX - core.syncCollar.position.x) * Math.min(1, dt * 8);

      // Animate H-pattern shifter position into 1st (front-left), 2nd (rear-left), 3rd (front-center)
      const targetPitch = gearIndex === 0 ? -0.26 : gearIndex === 1 ? 0.26 : -0.26;
      const targetRoll = gearIndex === 2 ? 0 : 0.24;
      shifterPivot.rotation.x += (targetPitch - shifterPivot.rotation.x) * Math.min(1, dt * 10);
      shifterPivot.rotation.z += (targetRoll - shifterPivot.rotation.z) * Math.min(1, dt * 10);

      pedalPivot.rotation.x = clutchPress * 0.48;
      releaseFork.rotation.z = -clutchPress * 0.28;

      return {
        phaseIndex: stageCycle,
        activeGear: gearNames[gearIndex],
        gearRatio: targetRatio,
        rpm: Math.round(1400 + gearIndex * 420 + (sim.throttle ?? 0.35) * 1800),
        powerFlowPct: Math.round((1 - clutchPress * 0.9) * 98),
      };
    },
  });
}

