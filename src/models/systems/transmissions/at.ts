import * as THREE from 'three';
import {
  createFlowStream,
  createGearGeometry,
  makePartAnchor,
  type ExplodableEntry,
} from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';
import {
  buildCutawayBellCasing,
  buildDifferentialAssembly,
  createTransmissionMaterials,
  finalizeTransmissionModel,
} from './shared';

export function createAtTransmissionModel(): SystemModelInstance {
  const mats = createTransmissionMaterials();
  const root = new THREE.Group();
  root.name = 'TransmissionCutaway_AT';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const casingGroup = buildCutawayBellCasing(mats, { length: 1.55, radius: 0.48, bellX: -1.06, mainX: -0.06 });
  // Lower ATF Oil Pan Sump
  const oilPan = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.62), mats.caseMat);
  oilPan.position.set(-0.08, -0.48, 0);
  casingGroup.add(oilPan);

  const tcGroup = new THREE.Group();
  const planetaryGroup = new THREE.Group();
  const clutchPackGroup = new THREE.Group();
  const valveBodyGroup = new THREE.Group();
  const { diffGroup, diffSpin } = buildDifferentialAssembly(mats, 0.98, 0.14);
  assembly.add(casingGroup, tcGroup, planetaryGroup, clutchPackGroup, valveBodyGroup, diffGroup);

  // 1. Cutaway Torque Converter (Impeller/Pump, Stator, Turbine, Lock-Up Clutch)
  const tcCenterX = -1.04;
  const impellerGroup = new THREE.Group();
  impellerGroup.position.set(tcCenterX - 0.1, 0.14, 0);
  tcGroup.add(impellerGroup);

  const pumpBowl = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.1, 14, 28, Math.PI * 1.45),
    mats.darkSteelMat,
  );
  pumpBowl.rotation.y = Math.PI / 2;
  impellerGroup.add(pumpBowl);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.025), mats.aluMat);
    vane.position.set(0.03, Math.sin(a) * 0.25, Math.cos(a) * 0.25);
    vane.rotation.x = a;
    impellerGroup.add(vane);
  }

  const statorSpin = new THREE.Group();
  statorSpin.position.set(tcCenterX + 0.02, 0.14, 0);
  tcGroup.add(statorSpin);
  const statorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 18), mats.brassMat);
  statorHub.rotation.z = Math.PI / 2;
  statorSpin.add(statorHub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.02), mats.brassMat);
    blade.position.set(0, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
    blade.rotation.x = a;
    blade.rotation.y = 0.45;
    statorSpin.add(blade);
  }

  const turbineSpin = new THREE.Group();
  turbineSpin.position.set(tcCenterX + 0.14, 0.14, 0);
  tcGroup.add(turbineSpin);
  const turbineDish = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.05, 24), mats.steelMat);
  turbineDish.rotation.z = Math.PI / 2;
  turbineSpin.add(turbineDish);

  const lockupDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.025, 24),
    mats.clutchPadMat,
  );
  lockupDisc.rotation.z = Math.PI / 2;
  lockupDisc.position.set(-0.04, 0, 0);
  turbineSpin.add(lockupDisc);

  // ATF toroidal fluid flow particles inside converter
  const atfCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(tcCenterX - 0.12, 0.36, 0.12),
      new THREE.Vector3(tcCenterX + 0.14, 0.36, 0.12),
      new THREE.Vector3(tcCenterX + 0.1, 0.16, 0.14),
      new THREE.Vector3(tcCenterX - 0.08, 0.16, 0.12),
    ],
    true,
  );
  const atfFlow = createFlowStream(atfCurve, 8, '#f87171', 0.024, 0.06);
  tcGroup.add(atfFlow.mesh);

  // 2. Planetary Gearsets (Sun, 3 Planet Gears + Carrier, Cutaway Ring)
  const planX = -0.18;
  const planY = 0.14;
  const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.55, 16), mats.steelMat);
  mainShaft.rotation.z = Math.PI / 2;
  mainShaft.position.set(0.08, planY, 0);
  planetaryGroup.add(mainShaft);

  const sunSpin = new THREE.Group();
  sunSpin.position.set(planX, planY, 0);
  const sunGear = new THREE.Mesh(
    createGearGeometry({ teeth: 14, pitchRadius: 0.11, thickness: 0.1, boreRadius: 0.036 }),
    mats.steelMat,
  );
  sunGear.rotation.y = Math.PI / 2;
  sunSpin.add(sunGear);
  planetaryGroup.add(sunSpin);

  const carrierSpin = new THREE.Group();
  carrierSpin.position.set(planX, planY, 0);
  const planetGears: THREE.Mesh[] = [];
  const planetGeo = createGearGeometry({ teeth: 11, pitchRadius: 0.085, thickness: 0.085, boreRadius: 0.022 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pMesh = new THREE.Mesh(planetGeo, mats.brassMat);
    pMesh.rotation.y = Math.PI / 2;
    pMesh.position.set(0, Math.sin(a) * 0.195, Math.cos(a) * 0.195);
    carrierSpin.add(pMesh);
    planetGears.push(pMesh);
  }
  const carrierPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 20), mats.aluMat);
  carrierPlate.rotation.z = Math.PI / 2;
  carrierPlate.position.x = 0.065;
  carrierSpin.add(carrierPlate);
  planetaryGroup.add(carrierSpin);

  const ringSpin = new THREE.Group();
  ringSpin.position.set(planX, planY, 0);
  const ringShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.11, 28, 1, true, Math.PI * 0.45, Math.PI * 1.25),
    mats.darkSteelMat,
  );
  ringShell.rotation.z = Math.PI / 2;
  ringSpin.add(ringShell);
  planetaryGroup.add(ringSpin);

  // Rear overdrive planetary stage
  const rearCarrier = new THREE.Mesh(
    createGearGeometry({ teeth: 20, pitchRadius: 0.2, thickness: 0.08, boreRadius: 0.04 }),
    mats.steelMat,
  );
  rearCarrier.rotation.y = Math.PI / 2;
  rearCarrier.position.set(0.34, planY, 0);
  planetaryGroup.add(rearCarrier);

  // 3. Multi-Plate Clutch Packs & Brake Band
  for (let i = 0; i < 4; i++) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.018, 24),
      i % 2 === 0 ? mats.clutchPadMat : mats.steelMat,
    );
    plate.rotation.z = Math.PI / 2;
    plate.position.set(-0.56 + i * 0.032, planY, 0);
    clutchPackGroup.add(plate);
  }
  const brakeBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.09, 24, 1, true, Math.PI * 0.3, Math.PI * 1.4),
    mats.copperMat,
  );
  brakeBand.rotation.z = Math.PI / 2;
  brakeBand.position.set(0.14, planY, 0);
  clutchPackGroup.add(brakeBand);

  // 4. Valve Body, Solenoids & ATF Pump
  const vbPlate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.09, 0.44), mats.aluMat);
  vbPlate.position.set(-0.08, -0.32, 0);
  valveBodyGroup.add(vbPlate);

  for (let s = 0; s < 3; s++) {
    const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 14), mats.accentBlueMat);
    solenoid.rotation.x = Math.PI / 2;
    solenoid.position.set(-0.32 + s * 0.22, -0.27, 0.24);
    valveBodyGroup.add(solenoid);
  }

  const atfPump = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 18), mats.darkSteelMat);
  atfPump.rotation.z = Math.PI / 2;
  atfPump.position.set(-0.74, planY, 0);
  valveBodyGroup.add(atfPump);

  const partMap: Record<string, THREE.Object3D> = {
    casing: casingGroup,
    'torque-converter': tcGroup,
    'planetary-set': planetaryGroup,
    'clutch-packs': clutchPackGroup,
    'valve-body': valveBodyGroup,
    differential: diffGroup,
  };

  const explodables: ExplodableEntry[] = [
    { object: casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.65, -0.95) },
    { object: tcGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.05, 0.1, 0) },
    { object: clutchPackGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.35, 0.72, 0.35) },
    { object: planetaryGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.25, 0.55, 0.3) },
    { object: valveBodyGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.78, 0.32) },
    { object: diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.98, 0, 0) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'Housing & Oil Pan', anchor: makePartAnchor(casingGroup, -0.1, -0.5, 0.2) },
    { partId: 'torque-converter', name: 'Torque Converter', anchor: makePartAnchor(tcGroup, tcCenterX, 0.54, 0) },
    { partId: 'clutch-packs', name: 'Clutch Packs', anchor: makePartAnchor(clutchPackGroup, -0.5, 0.42, 0.1) },
    { partId: 'planetary-set', name: 'Planetary Gearset', anchor: makePartAnchor(planetaryGroup, planX, 0.46, 0.12) },
    { partId: 'valve-body', name: 'Valve Body & Pump', anchor: makePartAnchor(valveBodyGroup, -0.1, -0.26, 0.32) },
    { partId: 'differential', name: 'Differential', anchor: makePartAnchor(diffSpin, 0, 0.35, 0.2) },
  ];

  let elapsed = 0;
  let pumpAngle = 0;
  let outAngle = 0;

  return finalizeTransmissionModel({
    root,
    variant: 'at',
    partMap,
    explodables,
    labelAnchors,
    skipMaterials: [atfFlow.mesh.material as THREE.Material],
    onUpdate: (dt, sim) => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      const step = sim.playing ? dt * sim.speed * motionFactor : 0;
      elapsed += step;

      // 0: Idle coupling, 1: Launch torque multiplication, 2: Lock-up cruise, 3: Planetary overdrive
      const stage = Math.floor((elapsed / 3.0) % 4);
      const turbineRatio = stage === 0 ? 0.18 : stage === 1 ? 0.65 : 1.0;
      const planRatio = stage === 0 ? 0.2 : stage === 1 ? 0.42 : stage === 2 ? 0.96 : 1.3;
      const gears = ['D1 (Idle)', 'D1 (Launch)', 'D3 (Lock-up)', 'D6 (Overdrive)'];
      const ratios = [3.6, 3.6, 1.0, 0.68];

      pumpAngle += step * 4.2;
      outAngle += step * 4.2 * turbineRatio * planRatio;

      impellerGroup.rotation.x = pumpAngle;
      turbineSpin.rotation.x = pumpAngle * turbineRatio;
      // Stator stays locked in Launch multiplication (stage 1), freewheels in cruise
      statorSpin.rotation.x = stage === 1 ? 0 : pumpAngle * 0.85;
      // Lock-up clutch slides left against pump housing during lockup & overdrive
      lockupDisc.position.x = stage >= 2 ? -0.11 : -0.02;

      sunSpin.rotation.x = pumpAngle * turbineRatio;
      carrierSpin.rotation.x = outAngle;
      for (const p of planetGears) {
        p.rotation.x = -pumpAngle * 1.4;
      }
      ringSpin.rotation.x = stage === 3 ? outAngle * 0.35 : 0;
      rearCarrier.rotation.x = outAngle;
      diffSpin.rotation.z = -outAngle * 0.45;

      // Brake band clamps tight when ring gear holds still in 1st/3rd
      brakeBand.scale.setScalar(stage < 3 ? 0.97 : 1.04);

      atfFlow.mesh.visible = sim.explode < 0.35;
      if (sim.playing) atfFlow.update(elapsed * (stage === 1 ? 1.8 : 1.1));

      return {
        phaseIndex: stage,
        activeGear: gears[stage],
        gearRatio: ratios[stage],
        rpm: stage === 0 ? 780 : stage === 1 ? 3100 : stage === 2 ? 2250 : 1780,
        powerFlowPct: stage === 0 ? 22 : stage >= 2 ? 98 : 88,
      };
    },
  });
}

