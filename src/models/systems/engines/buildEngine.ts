import * as THREE from 'three';
import type { EngineConfig } from '../../../state/appState';
import { disposeObject3D } from '../../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createCoilSpringGeometry,
  createGearGeometry,
  makePartAnchor,
  tagInteractivePart,
  type ExplodableEntry,
} from '../../ProceduralHelpers';
import type {
  SystemFrameStatus,
  SystemLabelAnchor,
  SystemModelInstance,
  SystemSimulationState,
} from '../types';
import { computeEngineStats, ENGINE_PRESETS } from './specs';

export interface BankSliderCrankResult {
  localPinX: number;
  localPinY: number;
  pistonY: number;
  rodCenterX: number;
  rodCenterY: number;
  rodRotZ: number;
}

/**
 * Pure slider-crank solver in bank-local coordinates where +Y aligns with the cylinder bore.
 */
export function computeBankSliderCrank(
  crankAngleRad: number,
  throwOffsetRad: number,
  bankTiltRad: number,
  crankRadius: number,
  conRodLen: number,
): BankSliderCrankResult {
  const localAngle = crankAngleRad + throwOffsetRad - bankTiltRad;
  const localPinX = Math.sin(localAngle) * crankRadius;
  const localPinY = Math.cos(localAngle) * crankRadius;
  const pistonY =
    localPinY + Math.sqrt(Math.max(0.005, conRodLen * conRodLen - localPinX * localPinX));
  return {
    localPinX,
    localPinY,
    pistonY,
    rodCenterX: localPinX * 0.5,
    rodCenterY: (localPinY + pistonY) * 0.5,
    rodRotZ: Math.atan2(localPinX, pistonY - localPinY),
  };
}

/**
 * Thick-walled cutaway cylinder sleeve with a machined inspection window facing +Z
 * (camera side) and solid beveled edges so pistons & rings show cleanly in Solid mode.
 */
function createThickCutawayLinerGeo(
  innerR: number,
  outerR: number,
  height: number,
  openHalfRad = 1.02,
  bevel = true,
): THREE.BufferGeometry {
  // Shape XY rotated by -PI/2 around X -> -Y becomes +Z (front cutaway window)
  const startA = -Math.PI * 0.5 + openHalfRad;
  const endA = Math.PI * 1.5 - openHalfRad;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, startA, endA, false);
  shape.lineTo(Math.cos(endA) * innerR, Math.sin(endA) * innerR);
  shape.absarc(0, 0, innerR, endA, startA, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel,
    bevelSize: bevel ? 0.004 : 0,
    bevelThickness: bevel ? 0.004 : 0,
    bevelSegments: bevel ? 1 : 0,
    curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -height * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Contoured crankcase U-cradle flaring cleanly along ±bankTilt to meet cylinder bases
 * while leaving the front cutaway open toward +Z for Solid-mode crank visibility.
 */
function createContouredCrankcaseGeo(
  halfBaseW: number,
  bankTiltAbs: number,
  isVOrBoxer: boolean,
  crankR: number,
  lengthZ: number,
): THREE.BufferGeometry {
  const outerS = new THREE.Shape();
  const wallT = 0.045;
  const flareAngle = isVOrBoxer ? Math.min(bankTiltAbs, Math.PI * 0.42) : 0.2;
  const topW = halfBaseW + Math.sin(flareAngle) * 0.14;
  const botY = -(crankR + 0.13);
  const topY = isVOrBoxer ? 0.14 : 0.11;

  // Outer contoured profile (trapezoidal flared U-skirt)
  outerS.moveTo(-halfBaseW * 0.85, botY);
  outerS.lineTo(halfBaseW * 0.85, botY);
  outerS.quadraticCurveTo(halfBaseW + 0.04, botY + 0.04, topW + wallT, topY);
  outerS.lineTo(topW - wallT * 0.4, topY);
  outerS.quadraticCurveTo(halfBaseW * 0.78, botY + wallT * 1.4, 0, botY + wallT);
  outerS.quadraticCurveTo(-halfBaseW * 0.78, botY + wallT * 1.4, -(topW - wallT * 0.4), topY);
  outerS.lineTo(-(topW + wallT), topY);
  outerS.quadraticCurveTo(-(halfBaseW + 0.04), botY + 0.04, -halfBaseW * 0.85, botY);
  outerS.closePath();

  const geo = new THREE.ExtrudeGeometry(outerS, {
    depth: lengthZ,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 1,
    curveSegments: 12,
  });
  geo.translate(0, 0, -lengthZ * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Fan-shaped crankshaft counterweight sector extending 180° opposite each crankpin.
 */
function createFanCounterweightGeo(
  innerR = 0.036,
  outerR = 0.165,
  thickness = 0.034,
  halfArc = 0.72,
): THREE.BufferGeometry {
  const s = new THREE.Shape();
  // Centered around -Y (180° opposite +Y crankpin)
  const startA = -Math.PI * 0.5 - halfArc;
  const endA = -Math.PI * 0.5 + halfArc;
  s.absarc(0, 0, outerR, startA, endA, false);
  s.lineTo(Math.cos(endA) * innerR, Math.sin(endA) * innerR);
  s.absarc(0, 0, innerR, endA, startA, true);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 1,
    curveSegments: 16,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

interface CylinderRuntime {
  cylNumber: number;
  firingSlot: number;
  bankTiltRad: number;
  throwRad: number;
  pistonSub: THREE.Group;
  conRodSub: THREE.Group;
  intakeSub: THREE.Group;
  intakeSpring: THREE.Mesh;
  exhaustSub: THREE.Group;
  exhaustSpring: THREE.Mesh;
  gasMesh: THREE.Mesh;
  gasMat: THREE.MeshBasicMaterial;
  sparkFlash: THREE.Mesh;
  sparkFlashMat: THREE.MeshBasicMaterial;
}

export function buildEngine(config: EngineConfig): SystemModelInstance {
  const preset = ENGINE_PRESETS[config.layout];
  const isVOrBoxer = config.vAngleDeg > 0;
  const isBoxer = config.vAngleDeg >= 170;
  const isDiesel = config.fuel === 'diesel';

  const root = new THREE.Group();
  root.name = `EngineCutaway_${config.layout}`;

  const assembly = new THREE.Group();
  assembly.position.y = isBoxer ? 1.08 : 1.02;
  root.add(assembly);

  // Semantic part groups
  const blockGroup = new THREE.Group();
  const oilPanGroup = new THREE.Group();
  const pistonGroup = new THREE.Group();
  const conRodGroup = new THREE.Group();
  const crankGroup = new THREE.Group();
  const camGroup = new THREE.Group();
  const intakeGroup = new THREE.Group();
  const exhaustGroup = new THREE.Group();
  const sparkGroup = new THREE.Group();
  const forcedInductionGroup = new THREE.Group();

  assembly.add(
    blockGroup,
    oilPanGroup,
    pistonGroup,
    conRodGroup,
    crankGroup,
    camGroup,
    intakeGroup,
    exhaustGroup,
    sparkGroup,
    forcedInductionGroup,
  );

  // Distinct outer block casting vs machined honed liner vs sump materials
  const blockMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.68,
    roughness: 0.4,
  });
  const linerMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.88,
    roughness: 0.22,
  });
  const panMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.62,
    roughness: 0.48,
  });
  const pistonMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.88, roughness: 0.2 });
  const ringMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.3 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.92, roughness: 0.22 });
  const crankMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.9, roughness: 0.25 });
  const camMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.86, roughness: 0.25 });
  const intakeMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.65, roughness: 0.28 });
  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#fb7185', metalness: 0.65, roughness: 0.28 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.05, roughness: 0.2 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.85, roughness: 0.25 });
  const chainMat = new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.72, roughness: 0.42 });
  const turboMat = new THREE.MeshStandardMaterial({ color: '#b45309', metalness: 0.82, roughness: 0.32 });
  const hybridOrangeMat = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.3, roughness: 0.45 });

  // Dimensions tuned so side-by-side con-rods sit cleanly on shared crankpins with wide throw spacing
  const cylCount = config.cylinders;
  const cylsPerBank = isVOrBoxer ? Math.ceil(cylCount / 2) : cylCount;
  const throwCount = cylsPerBank;
  const pitchZ = isVOrBoxer ? (cylsPerBank >= 5 ? 0.44 : 0.48) : (cylCount >= 6 ? 0.38 : 0.44);
  const boreR = cylCount >= 10 ? 0.13 : cylCount >= 6 ? 0.145 : 0.165;
  const crankRadius = 0.11;
  const conRodLen = 0.34;
  const crankY = 0;
  const bankTiltAbs = (config.vAngleDeg * 0.5 * Math.PI) / 180;
  const sideOffsetZ = isVOrBoxer ? 0.068 : 0; // ±0.068 => 0.136 side-by-side axial separation on shared crankpins

  const bankSpanZ = (throwCount - 1) * pitchZ;
  const bankZStart = -bankSpanZ * 0.5;
  const rearEndZ = bankZStart - 0.28;
  const frontTimingZ = bankZStart + bankSpanZ + 0.26;
  const crankTotalLen = frontTimingZ - rearEndZ + 0.08;

  // 1. Contoured Crankcase Skirt (front bay cut back so crank throws stay directly visible in Solid mode)
  const crankcaseHalfW = isBoxer ? 0.26 : isVOrBoxer ? 0.21 : 0.18;
  const rearCrankcaseLen = Math.max(0.28, crankTotalLen - 0.42);
  const rearCrankcase = new THREE.Mesh(
    createContouredCrankcaseGeo(crankcaseHalfW, bankTiltAbs, isVOrBoxer, crankRadius, rearCrankcaseLen),
    blockMat,
  );
  rearCrankcase.position.set(0, crankY, rearEndZ + rearCrankcaseLen * 0.5 + 0.04);
  blockGroup.add(rearCrankcase);

  // Rear main-seal bulkhead plate
  const rearBulkhead = new THREE.Mesh(
    new THREE.CylinderGeometry(crankcaseHalfW * 0.9, crankcaseHalfW * 0.9, 0.04, 22),
    blockMat,
  );
  rearBulkhead.rotation.x = Math.PI / 2;
  rearBulkhead.position.set(0, crankY, rearEndZ + 0.04);
  blockGroup.add(rearBulkhead);

  // 2. Stepped Lower Oil Pan / Sump (tucked cleanly behind front timing sprocket / balancer)
  const panY = -(crankRadius + 0.165);
  const panLen = Math.max(0.32, crankTotalLen - 0.34);
  const panCenterZ = rearEndZ + panLen * 0.5 + 0.04;
  const upperPanLip = new THREE.Mesh(
    new THREE.BoxGeometry(crankcaseHalfW * 1.56, 0.045, panLen),
    panMat,
  );
  upperPanLip.position.set(0, panY, panCenterZ);
  const deepSumpBowl = new THREE.Mesh(
    new THREE.BoxGeometry(crankcaseHalfW * 1.32, 0.12, panLen * 0.62),
    panMat,
  );
  deepSumpBowl.position.set(0, panY - 0.08, rearEndZ + panLen * 0.34 + 0.04);
  const drainPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6), brassMat);
  drainPlug.rotation.x = Math.PI / 2;
  drainPlug.position.set(0, panY - 0.1, deepSumpBowl.position.z + panLen * 0.31);
  oilPanGroup.add(upperPanLip, deepSumpBowl, drainPlug);

  // 3. Accurate Rigid Crankshaft (Main Bearing Journals + Fan Counterweights + Shared Crankpins + Balancer + Flywheel)
  const crankSpinner = new THREE.Group();
  crankSpinner.position.set(0, crankY, 0);
  crankGroup.add(crankSpinner);

  // Continuous central main bearing journal bar
  const mainJournalAxis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, crankTotalLen, 20),
    crankMat,
  );
  mainJournalAxis.rotation.x = Math.PI / 2;
  mainJournalAxis.position.z = (rearEndZ + frontTimingZ) * 0.5;
  crankSpinner.add(mainJournalAxis);

  // Distinct slightly larger main bearing journal collars between throws
  const mainJournalGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.08, 20);
  mainJournalGeo.rotateX(Math.PI / 2);
  for (let m = 0; m <= throwCount; m++) {
    const zJournal = bankZStart - pitchZ * 0.5 + m * pitchZ;
    const jMesh = new THREE.Mesh(mainJournalGeo, steelMat);
    jMesh.position.z = Math.max(rearEndZ + 0.08, Math.min(frontTimingZ - 0.08, zJournal));
    crankSpinner.add(jMesh);
  }

  // Rear Flywheel / Flexplate + Starter Ring Gear
  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.045, 32), crankMat);
  flywheel.rotation.x = Math.PI / 2;
  flywheel.position.set(0, 0, rearEndZ);
  const ringTeeth = new THREE.Mesh(
    createGearGeometry({ teeth: 34, pitchRadius: 0.295, thickness: 0.024, boreRadius: 0.26 }),
    steelMat,
  );
  ringTeeth.position.set(0, 0, rearEndZ);
  crankSpinner.add(flywheel, ringTeeth);

  // Front Harmonic Balancer & Toothed Crank Timing Sprocket
  const harmonicDamper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.05, 24),
    panMat,
  );
  harmonicDamper.rotation.x = Math.PI / 2;
  harmonicDamper.position.set(0, 0, frontTimingZ + 0.055);
  const crankSprocketRadius = 0.098;
  const crankTimingGear = new THREE.Mesh(
    createGearGeometry({
      teeth: 14,
      pitchRadius: crankSprocketRadius,
      thickness: 0.038,
      boreRadius: 0.042,
    }),
    steelMat,
  );
  crankTimingGear.position.set(0, 0, frontTimingZ);
  crankSpinner.add(harmonicDamper, crankTimingGear);

  // Build throws + shared crankpins + fan-shaped counterweights 180° opposite each throw
  const fanCounterweightGeo = createFanCounterweightGeo(0.036, 0.165, 0.032, 0.72);
  const crankPinLen = isVOrBoxer ? 0.21 : 0.11;
  const crankPinGeo = new THREE.CylinderGeometry(0.031, 0.031, crankPinLen, 16);
  crankPinGeo.rotateX(Math.PI / 2);
  const webGeo = new THREE.BoxGeometry(0.085, crankRadius + 0.04, 0.028);

  const sharedThrowAnglesRad: number[] = [];
  for (let j = 0; j < throwCount; j++) {
    const throwDeg = preset.crankThrowsDeg[j % preset.crankThrowsDeg.length] ?? 0;
    const throwRad = (throwDeg * Math.PI) / 180;
    sharedThrowAnglesRad.push(throwRad);
    const zThrow = bankZStart + j * pitchZ;

    const pinX = Math.sin(throwRad) * crankRadius;
    const pinY = Math.cos(throwRad) * crankRadius;

    const crankPin = new THREE.Mesh(crankPinGeo, steelMat);
    crankPin.position.set(pinX, pinY, zThrow);
    crankSpinner.add(crankPin);

    // Pair of crank webs + fan counterweights flanking each crankpin
    const cheekOffset = crankPinLen * 0.5 + 0.02;
    for (const dir of [-1, 1]) {
      const zCheek = zThrow + dir * cheekOffset;
      const web = new THREE.Mesh(webGeo, crankMat);
      web.position.set(pinX * 0.5, pinY * 0.5, zCheek);
      web.rotation.z = -throwRad;
      crankSpinner.add(web);

      const cw = new THREE.Mesh(fanCounterweightGeo, crankMat);
      cw.position.set(0, 0, zCheek);
      // Fan weight points 180° opposite the crankpin (+Y when throwRad=0 -> cw points -Y)
      cw.rotation.z = -throwRad;
      crankSpinner.add(cw);
    }
  }

  // Shared geometries for cylinder cutaway sleeves, honed liners, pistons with wrist pins, con-rods, valves
  const innerBoreR = boreR * 1.05;
  const outerWallR = boreR * 1.24;
  const frontSleeveGeo = createThickCutawayLinerGeo(innerBoreR, outerWallR, 0.45, 1.08, true);
  const rearSleeveGeo = createThickCutawayLinerGeo(innerBoreR, outerWallR, 0.45, 0.88, true);
  const frontLinerGeo = createThickCutawayLinerGeo(innerBoreR - 0.009, innerBoreR - 0.001, 0.442, 1.08, false);
  const rearLinerGeo = createThickCutawayLinerGeo(innerBoreR - 0.009, innerBoreR - 0.001, 0.442, 0.88, false);

  const pistonGeo = new THREE.CylinderGeometry(boreR * 0.88, boreR * 0.88, 0.115, 22);
  const ringGeo = new THREE.TorusGeometry(boreR * 0.89, 0.0055, 6, 22);
  const wristPinGeo = new THREE.CylinderGeometry(0.021, 0.021, boreR * 1.66, 12);
  const rodGeo = new THREE.BoxGeometry(0.036, conRodLen, 0.032);
  const bigEndGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.048, 16);
  const smallEndGeo = new THREE.CylinderGeometry(0.029, 0.029, 0.042, 14);
  const valveStemGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10);
  const valveHeadGeo = new THREE.CylinderGeometry(0.045, 0.018, 0.025, 14);
  const springGeo = createCoilSpringGeometry(0.026, 0.12, 4, 0.006, 28);
  const sparkBodyGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.11, 6);
  const sparkCeramicGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.12, 10);
  const flashGeo = new THREE.OctahedronGeometry(0.055, 1);

  const bankTilts = isVOrBoxer ? [-bankTiltAbs, bankTiltAbs] : [0];
  const camSpinners: THREE.Group[] = [];
  const camCentersWorldXY: THREE.Vector2[] = [];
  const runtimeCylinders: CylinderRuntime[] = [];

  const firingSlotByCyl = new Map<number, number>();
  config.firingOrder.forEach((cylNum, idx) => firingSlotByCyl.set(cylNum, idx));

  const camYLocal = 0.78;
  const camGearRadius = 0.14;

  bankTilts.forEach((bankTilt, bankIdx) => {
    const zOffsetBank = isVOrBoxer ? (bankIdx === 0 ? -sideOffsetZ : sideOffsetZ) : 0;

    const makeTiltedHolder = (parent: THREE.Object3D) => {
      const g = new THREE.Group();
      g.position.set(0, crankY, 0);
      g.rotation.z = -bankTilt;
      parent.add(g);
      return g;
    };

    const blockBank = makeTiltedHolder(blockGroup);
    const pistonBank = makeTiltedHolder(pistonGroup);
    const conRodBank = makeTiltedHolder(conRodGroup);
    const camBank = makeTiltedHolder(camGroup);
    const intakeBank = makeTiltedHolder(intakeGroup);
    const exhaustBank = makeTiltedHolder(exhaustGroup);
    const sparkBank = makeTiltedHolder(sparkGroup);

    // Cylinder head deck casting (cut back cleanly over frontmost cylinder so valve heads & combustion dome stay visible)
    const headLen = Math.max(0.28, bankSpanZ + outerWallR * 0.7);
    const headRail = new THREE.Mesh(
      new THREE.BoxGeometry(outerWallR * 2.0, 0.072, headLen),
      blockMat,
    );
    headRail.position.set(0, 0.625, zOffsetBank - outerWallR * 0.65);
    blockBank.add(headRail);

    // Overhead Camshaft & Cam Timing Gear aligned cleanly onto frontTimingZ plane
    const camSpinner = new THREE.Group();
    camSpinner.position.set(0, camYLocal, 0);
    camBank.add(camSpinner);
    camSpinners.push(camSpinner);

    camCentersWorldXY.push(
      new THREE.Vector2(Math.sin(bankTilt) * camYLocal, crankY + Math.cos(bankTilt) * camYLocal),
    );

    const camBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, crankTotalLen - 0.1, 14),
      camMat,
    );
    camBar.rotation.x = Math.PI / 2;
    camBar.position.z = (rearEndZ + frontTimingZ) * 0.5 + 0.06;
    camSpinner.add(camBar);

    const camGear = new THREE.Mesh(
      createGearGeometry({
        teeth: 24,
        pitchRadius: camGearRadius,
        thickness: 0.036,
        boreRadius: 0.025,
      }),
      steelMat,
    );
    camGear.position.set(0, 0, frontTimingZ);
    camSpinner.add(camGear);

    // Outer Exhaust Manifold Collector outside the cylinder bank
    const headerRunner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.046, bankSpanZ + 0.22, 14),
      linerMat,
    );
    headerRunner.rotation.x = Math.PI / 2;
    headerRunner.position.set(
      bankIdx === 0 && isVOrBoxer ? -(outerWallR + 0.065) : outerWallR + 0.065,
      0.62,
      zOffsetBank,
    );
    blockBank.add(headerRunner);

    for (let j = 0; j < cylsPerBank; j++) {
      const cylIndex = isVOrBoxer ? bankIdx * cylsPerBank + j : j;
      if (cylIndex >= cylCount) continue;
      const cylNumber = cylIndex + 1;
      const zPos = bankZStart + j * pitchZ + zOffsetBank;
      const throwRad = sharedThrowAnglesRad[j];
      const isFrontCyl = j === cylsPerBank - 1;

      // Distinct outer casting & inner honed bore liner (zero overlapping coplanar faces)
      const sleeve = new THREE.Mesh(isFrontCyl ? frontSleeveGeo : rearSleeveGeo, blockMat);
      sleeve.position.set(0, 0.37, zPos);
      // Angle front cutaway toward +X/+Z viewer side on right bank so bores/pistons/wrist pins show clearly in Solid mode
      if (isVOrBoxer) {
        sleeve.rotation.y = bankIdx === 1 ? 0.52 : -0.1;
      } else {
        sleeve.rotation.y = 0.36;
      }
      const liner = new THREE.Mesh(isFrontCyl ? frontLinerGeo : rearLinerGeo, linerMat);
      liner.position.copy(sleeve.position);
      liner.rotation.copy(sleeve.rotation);
      blockBank.add(sleeve, liner);

      // Piston + Compression Rings + Visible Wrist Pin
      const pSub = new THREE.Group();
      pSub.position.set(0, 0.35, zPos);
      const pBody = new THREE.Mesh(pistonGeo, pistonMat);
      const pRingTop = new THREE.Mesh(ringGeo, ringMat);
      pRingTop.rotation.x = Math.PI / 2;
      pRingTop.position.y = 0.038;
      const pRingMid = new THREE.Mesh(ringGeo, ringMat);
      pRingMid.rotation.x = Math.PI / 2;
      pRingMid.position.y = 0.018;
      const wristPin = new THREE.Mesh(wristPinGeo, steelMat);
      wristPin.rotation.x = Math.PI / 2;
      wristPin.position.y = -0.02;
      pSub.add(pBody, pRingTop, pRingMid, wristPin);
      pistonBank.add(pSub);

      // Connecting Rod (small-end at piston wrist pin, big-end side-by-side on shared crankpin)
      const rodSub = new THREE.Group();
      rodSub.position.set(0, 0.18, zPos);
      const beam = new THREE.Mesh(rodGeo, steelMat);
      const smallEnd = new THREE.Mesh(smallEndGeo, steelMat);
      smallEnd.rotation.x = Math.PI / 2;
      smallEnd.position.y = conRodLen * 0.5;
      const bigEnd = new THREE.Mesh(bigEndGeo, steelMat);
      bigEnd.rotation.x = Math.PI / 2;
      bigEnd.position.y = -conRodLen * 0.5;
      rodSub.add(beam, smallEnd, bigEnd);
      conRodBank.add(rodSub);

      // Intake & Exhaust valves
      const mkValve = (xOff: number, vMat: THREE.Material) => {
        const sub = new THREE.Group();
        sub.position.set(xOff, 0.72, zPos);
        const stem = new THREE.Mesh(valveStemGeo, vMat);
        const head = new THREE.Mesh(valveHeadGeo, vMat);
        head.position.y = -0.12;
        const spring = new THREE.Mesh(springGeo, steelMat);
        spring.position.y = 0.03;
        sub.add(stem, head, spring);
        return { sub, spring };
      };
      const inV = mkValve(-0.052, intakeMat);
      intakeBank.add(inV.sub);
      const exV = mkValve(0.052, exhaustMat);
      exhaustBank.add(exV.sub);

      // Spark / Fuel Injector + combustion flash
      const spBody = new THREE.Mesh(sparkBodyGeo, steelMat);
      spBody.position.set(0, 0.72, zPos);
      const spCer = new THREE.Mesh(sparkCeramicGeo, isDiesel ? brassMat : ceramicMat);
      spCer.position.set(0, 0.81, zPos);
      sparkBank.add(spBody, spCer);

      const sparkFlashMat = new THREE.MeshBasicMaterial({
        color: isDiesel ? '#fb923c' : '#fef08a',
        transparent: true,
        opacity: 0,
      });
      const sparkFlash = new THREE.Mesh(flashGeo, sparkFlashMat);
      sparkFlash.position.set(0, 0.57, zPos);
      sparkFlash.userData.lessonOnly = true;
      sparkBank.add(sparkFlash);

      // Combustion chamber gas glow inside cylinder bore
      const gasMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const gasMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(boreR * 0.84, boreR * 0.84, 1, 16),
        gasMat,
      );
      gasMesh.position.set(0, 0.5, zPos);
      gasMesh.userData.lessonOnly = true;
      blockBank.add(gasMesh);

      runtimeCylinders.push({
        cylNumber,
        firingSlot: firingSlotByCyl.get(cylNumber) ?? cylIndex,
        bankTiltRad: bankTilt,
        throwRad,
        pistonSub: pSub,
        conRodSub: rodSub,
        intakeSub: inV.sub,
        intakeSpring: inV.spring,
        exhaustSub: exV.sub,
        exhaustSpring: exV.spring,
        gasMesh,
        gasMat,
        sparkFlash,
        sparkFlashMat,
      });
    }
  });

  // 4. Single Continuous Perimeter Timing Chain / Belt Loop (ZERO crossed X belts!)
  let tensionerSpinner: THREE.Mesh | null = null;
  if (isVOrBoxer && camCentersWorldXY.length === 2) {
    const cL = camCentersWorldXY[0]; // negative X
    const cR = camCentersWorldXY[1]; // positive X
    const tensionerY = isBoxer ? crankY + 0.26 : Math.max(crankY + 0.34, cL.y * 0.66);
    const tensionerR = 0.062;

    tensionerSpinner = new THREE.Mesh(
      createGearGeometry({ teeth: 12, pitchRadius: tensionerR, thickness: 0.034, boreRadius: 0.018 }),
      steelMat,
    );
    tensionerSpinner.position.set(0, tensionerY, frontTimingZ);
    camGroup.add(tensionerSpinner);

    const outL = new THREE.Vector2(cL.x - camGearRadius * 0.82, cL.y + camGearRadius * 0.45);
    const topL = new THREE.Vector2(cL.x + camGearRadius * 0.15, cL.y + camGearRadius);
    const topR = new THREE.Vector2(cR.x - camGearRadius * 0.15, cR.y + camGearRadius);
    const outR = new THREE.Vector2(cR.x + camGearRadius * 0.82, cR.y + camGearRadius * 0.45);

    const perimeterPts = [
      new THREE.Vector3(0, crankY - crankSprocketRadius, frontTimingZ),
      new THREE.Vector3(-crankSprocketRadius * 0.95, crankY, frontTimingZ),
      new THREE.Vector3(outL.x, outL.y, frontTimingZ),
      new THREE.Vector3(topL.x, topL.y, frontTimingZ),
      new THREE.Vector3(0, tensionerY - tensionerR * 0.95, frontTimingZ),
      new THREE.Vector3(topR.x, topR.y, frontTimingZ),
      new THREE.Vector3(outR.x, outR.y, frontTimingZ),
      new THREE.Vector3(crankSprocketRadius * 0.95, crankY, frontTimingZ),
    ];
    const perimeterCurve = new THREE.CatmullRomCurve3(perimeterPts, true, 'catmullrom', 0.28);
    const singleChainLoop = new THREE.Mesh(
      new THREE.TubeGeometry(perimeterCurve, 84, 0.014, 6, true),
      chainMat,
    );
    camGroup.add(singleChainLoop);
  } else {
    const cI = camCentersWorldXY[0] ?? new THREE.Vector2(0, camYLocal);
    const inlinePts = [
      new THREE.Vector3(0, crankY - crankSprocketRadius, frontTimingZ),
      new THREE.Vector3(-crankSprocketRadius, crankY, frontTimingZ),
      new THREE.Vector3(cI.x - camGearRadius, cI.y, frontTimingZ),
      new THREE.Vector3(cI.x, cI.y + camGearRadius, frontTimingZ),
      new THREE.Vector3(cI.x + camGearRadius, cI.y, frontTimingZ),
      new THREE.Vector3(crankSprocketRadius, crankY, frontTimingZ),
    ];
    const inlineCurve = new THREE.CatmullRomCurve3(inlinePts, true, 'catmullrom', 0.25);
    const inlineLoop = new THREE.Mesh(
      new THREE.TubeGeometry(inlineCurve, 64, 0.014, 6, true),
      chainMat,
    );
    camGroup.add(inlineLoop);
  }

  // Optional Forced Induction & Hybrid Assist Sub-Assemblies
  const turboSnail = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.06, 12, 22), turboMat);
  turboSnail.position.set(isVOrBoxer ? 0 : 0.44, 0.72, bankSpanZ * 0.45 + 0.16);
  const chargePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.52, 12), camMat);
  chargePipe.rotation.z = Math.PI / 2;
  chargePipe.position.set(isVOrBoxer ? 0 : 0.22, 0.84, bankSpanZ * 0.45 + 0.16);

  const twinTurboSnail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 12, 20), turboMat);
  twinTurboSnail.position.set(-0.34, 0.72, bankSpanZ * 0.45 + 0.16);

  const superchargerBlower = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.18, bankSpanZ + 0.22),
    camMat,
  );
  superchargerBlower.position.set(0, 0.92, 0);

  const hybridMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.22, 18),
    hybridOrangeMat,
  );
  hybridMotor.rotation.x = Math.PI / 2;
  hybridMotor.position.set(-0.36, 0.24, bankZStart + bankSpanZ * 0.35);

  forcedInductionGroup.add(turboSnail, twinTurboSnail, chargePipe, superchargerBlower, hybridMotor);

  const syncOptionVisibility = (sim: SystemSimulationState) => {
    const asp = sim.aspiration ?? config.aspiration;
    const hyb = sim.hybrid ?? config.hybrid;
    const isTurbo = asp === 'turbo' || asp === 'twin-turbo';
    turboSnail.visible = isTurbo;
    chargePipe.visible = isTurbo;
    twinTurboSnail.visible = asp === 'twin-turbo';
    superchargerBlower.visible = asp === 'supercharged';
    hybridMotor.visible = hyb !== 'none';
  };
  syncOptionVisibility({
    playing: true,
    speed: 1,
    explode: 0,
    xray: false,
    reduceMotion: false,
  });

  const partMap: Record<string, THREE.Object3D> = {
    'cylinder-block': blockGroup,
    'oil-pan': oilPanGroup,
    piston: pistonGroup,
    'connecting-rod': conRodGroup,
    crankshaft: crankGroup,
    camshaft: camGroup,
    'intake-valve': intakeGroup,
    'exhaust-valve': exhaustGroup,
    'spark-plug': sparkGroup,
  };

  for (const [partId, obj] of Object.entries(partMap)) {
    tagInteractivePart(obj, partId);
  }

  // Clone material per part group so solid highlighting & X-Ray isolate cleanly
  const partHighlightMats = new Map<string, THREE.MeshStandardMaterial[]>();
  const emissiveOriginal = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  for (const [partId, obj] of Object.entries(partMap)) {
    const matsForPart: THREE.MeshStandardMaterial[] = [];
    const cache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    obj.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material) || m.userData.lessonOnly) return;
      if (!(m.material instanceof THREE.MeshStandardMaterial)) return;
      let cloned = cache.get(m.material);
      if (!cloned) {
        cloned = m.material.clone();
        cache.set(m.material, cloned);
        matsForPart.push(cloned);
        emissiveOriginal.set(cloned, cloned.emissive.clone());
      }
      m.material = cloned;
    });
    partHighlightMats.set(partId, matsForPart);
  }

  const explodables: ExplodableEntry[] = [
    { object: blockGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.05, -1.45) },
    { object: oilPanGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -1.65, 0.15) },
    { object: pistonGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.35, 0.72, 0.45) },
    { object: conRodGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(1.35, -0.05, 0.45) },
    { object: crankGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -1.05, 0.28) },
    { object: camGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 1.85, 0.2) },
    { object: intakeGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.25, 1.25, 0.65) },
    { object: exhaustGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(1.25, 1.25, 0.65) },
    { object: sparkGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 2.55, 0.85) },
  ];

  const firstCyl = runtimeCylinders[0];
  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'cylinder-block', name: 'Cylinder Block', anchor: makePartAnchor(blockGroup, -0.35, 0.45, 0) },
    { partId: 'oil-pan', name: 'Oil Pan / Sump', anchor: makePartAnchor(oilPanGroup, 0.15, panY - 0.1, 0.12) },
    { partId: 'piston', name: 'Pistons', anchor: makePartAnchor(firstCyl.pistonSub, -0.22, 0.08, 0.06) },
    { partId: 'connecting-rod', name: 'Connecting Rods', anchor: makePartAnchor(firstCyl.conRodSub, 0.12, 0, 0.05) },
    { partId: 'crankshaft', name: 'Crankshaft', anchor: makePartAnchor(crankGroup, 0.32, -0.05, frontTimingZ) },
    { partId: 'camshaft', name: 'Camshafts', anchor: makePartAnchor(camGroup, 0.26, 0.85, frontTimingZ) },
    { partId: 'intake-valve', name: 'Intake Valves', anchor: makePartAnchor(firstCyl.intakeSub, -0.14, 0.06, 0.05) },
    { partId: 'exhaust-valve', name: 'Exhaust Valves', anchor: makePartAnchor(firstCyl.exhaustSub, 0.14, 0.06, 0.05) },
    {
      partId: 'spark-plug',
      name: isDiesel ? 'CRDI Injectors' : 'Ignition Coils',
      anchor: makePartAnchor(sparkGroup, 0, 0.92, 0.1),
    },
  ];

  // Tight rest-pose natural bounding dimensions
  root.updateMatrixWorld(true);
  const rawBox = new THREE.Box3();
  for (const obj of Object.values(partMap)) rawBox.expandByObject(obj);
  const rawSize = rawBox.getSize(new THREE.Vector3());

  let cycleAngle = 0;

  const updateKinematics = (angle: number, explodeAmt: number) => {
    const fourPi = Math.PI * 4;
    const norm = ((angle % fourPi) + fourPi) % fourPi;
    crankSpinner.rotation.z = -angle;
    for (const c of camSpinners) c.rotation.z = -angle * 0.5;
    if (tensionerSpinner) tensionerSpinner.rotation.z = angle * 1.1;

    let leadFiringCyl = config.firingOrder[0] ?? 1;
    let leadPhase = 0;
    let bestSpark = -1;

    const fireStepRad = fourPi / Math.max(1, cylCount);

    for (const cyl of runtimeCylinders) {
      const kin = computeBankSliderCrank(
        angle,
        cyl.throwRad,
        cyl.bankTiltRad,
        crankRadius,
        conRodLen,
      );
      cyl.pistonSub.position.x = 0;
      cyl.pistonSub.position.y = kin.pistonY;
      cyl.conRodSub.position.x = kin.rodCenterX;
      cyl.conRodSub.position.y = kin.rodCenterY;
      cyl.conRodSub.rotation.z = kin.rodRotZ;

      const cylCycleOffset = cyl.firingSlot * fireStepRad;
      const localCycle = ((norm - cylCycleOffset + Math.PI * 2 + fourPi * 2) % fourPi);
      const cylPhase = Math.min(3, Math.floor(localCycle / Math.PI));

      const inLift = cylPhase === 0 ? Math.sin(localCycle) * 0.08 : 0;
      const exLift = cylPhase === 3 ? Math.sin(localCycle - Math.PI * 3) * 0.08 : 0;
      cyl.intakeSub.position.y = 0.72 - inLift;
      cyl.intakeSpring.scale.y = 1 - inLift * 2.2;
      cyl.exhaustSub.position.y = 0.72 - exLift;
      cyl.exhaustSpring.scale.y = 1 - exLift * 2.2;

      const crownY = kin.pistonY + 0.058;
      const chamberH = Math.max(0.03, 0.585 - crownY);
      cyl.gasMesh.scale.y = chamberH;
      cyl.gasMesh.position.y = crownY + chamberH * 0.5;
      cyl.gasMesh.visible = explodeAmt < 0.35;

      if (cylPhase === 0) {
        cyl.gasMat.color.set('#38bdf8');
        cyl.gasMat.opacity = 0.25 * Math.sin(localCycle);
        cyl.sparkFlashMat.opacity = 0;
      } else if (cylPhase === 1) {
        const t = (localCycle - Math.PI) / Math.PI;
        cyl.gasMat.color.set('#38bdf8').lerp(new THREE.Color('#a78bfa'), t);
        cyl.gasMat.opacity = 0.22 + t * 0.3;
        cyl.sparkFlashMat.opacity = 0;
      } else if (cylPhase === 2) {
        const t = (localCycle - Math.PI * 2) / Math.PI;
        const pulse = Math.max(0, 1 - t * 4.5);
        cyl.sparkFlashMat.opacity = pulse;
        cyl.sparkFlash.scale.setScalar(0.75 + pulse * 0.9);
        cyl.gasMat.color.set('#f97316').lerp(new THREE.Color('#fde047'), pulse * 0.7);
        cyl.gasMat.opacity = Math.max(0.18, 0.72 * (1 - t * 0.6));
        if (pulse > bestSpark) {
          bestSpark = pulse;
          leadFiringCyl = cyl.cylNumber;
          leadPhase = 2;
        }
      } else {
        const t = (localCycle - Math.PI * 3) / Math.PI;
        cyl.sparkFlashMat.opacity = 0;
        cyl.gasMat.color.set('#fb7185');
        cyl.gasMat.opacity = 0.34 * (1 - t * 0.7);
      }
    }

    if (bestSpark <= 0) {
      const idx = Math.floor(norm / fireStepRad) % config.firingOrder.length;
      leadFiringCyl = config.firingOrder[idx] ?? 1;
      leadPhase = Math.min(3, Math.floor(norm / Math.PI));
    }

    return { leadPhase, leadFiringCyl };
  };

  updateKinematics(0.4, 0);

  const stats = computeEngineStats(config);

  return {
    root,
    variant: config.layout,
    naturalBounds: {
      length: Math.max(rawSize.z, 0.45),
      width: Math.max(rawSize.x, 0.35),
      height: Math.max(rawSize.y, 0.45),
    },
    targetRigExtent: cylCount >= 8 ? 0.68 : cylCount >= 6 ? 0.62 : 0.54,
    defaultCamera: {
      target: [0, isBoxer ? 1.18 : 1.32, 0],
      position: [
        isBoxer ? 2.4 : 2.35,
        isBoxer ? 2.15 : 2.05,
        2.65 + bankSpanZ * 0.45,
      ],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      syncOptionVisibility(sim);
      const rpmNorm = sim.rpmOverride ? sim.rpmOverride / 1800 : sim.speed;
      if (sim.playing) {
        const motionFactor = sim.reduceMotion ? 0.35 : 1;
        cycleAngle += dt * 3.4 * rpmNorm * motionFactor;
      }
      const { leadPhase, leadFiringCyl } = updateKinematics(cycleAngle, sim.explode);
      const displayRpm =
        sim.rpmOverride ?? Math.round(900 + sim.speed * 1800 * ((sim.throttle ?? 0.35) + 0.4));
      return {
        phaseIndex: leadPhase,
        firingCylinder: leadFiringCyl,
        rpm: Math.min(stats.redlineRpm, displayRpm),
        torqueNm: stats.peakTorqueNm,
        powerKw: Math.round(stats.peakPowerHp * 0.746),
      };
    },
    highlightPart: (partId: string | null) => {
      for (const [id, mats] of partHighlightMats.entries()) {
        const active = id === partId;
        for (const mat of mats) {
          const orig = emissiveOriginal.get(mat) ?? new THREE.Color(0x000000);
          if (active) {
            mat.emissive.set('#f59e0b');
            mat.emissiveIntensity = 0.55;
          } else {
            mat.emissive.copy(orig);
            mat.emissiveIntensity = 0;
          }
        }
      }
    },
    setExplode: (amount: number) =>
      applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => {
      for (const xrayId of ['cylinder-block', 'oil-pan']) {
        const mats = partHighlightMats.get(xrayId) ?? [];
        for (const m of mats) {
          m.transparent = enabled;
          m.opacity = enabled ? 0.24 : 1;
          m.depthWrite = !enabled;
          m.needsUpdate = true;
        }
      }
    },
    dispose: () => disposeObject3D(root),
  };
}
