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

function createThickCutawayLinerGeo(
  innerR: number,
  outerR: number,
  height: number,
  openHalfRad = 0.85,
): THREE.BufferGeometry {
  // Shape XY rotates by -PI/2 around X -> +X stays +X, -Y becomes +Z (camera side)
  // Cutaway opening centered at -PI/2 (+Z toward viewer) so solid thick wall wraps around sides & back
  const startA = -Math.PI * 0.5 + openHalfRad;
  const endA = Math.PI * 1.5 - openHalfRad;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, startA, endA, false);
  shape.lineTo(Math.cos(endA) * innerR, Math.sin(endA) * innerR);
  shape.absarc(0, 0, innerR, endA, startA, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -height * 0.5, 0);
  return geo;
}

export function buildEngine(config: EngineConfig): SystemModelInstance {
  const preset = ENGINE_PRESETS[config.layout];
  const isVOrBoxer = config.vAngleDeg > 0;
  const isBoxer = config.vAngleDeg >= 170;
  const isDiesel = config.fuel === 'diesel';

  const root = new THREE.Group();
  root.name = `EngineCutaway_${config.layout}`;

  const assembly = new THREE.Group();
  assembly.position.y = isBoxer ? 1.05 : 0.96;
  root.add(assembly);

  // Semantic groups sharing partIds for consistent rig highlighting & explode
  const blockGroup = new THREE.Group();
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
    pistonGroup,
    conRodGroup,
    crankGroup,
    camGroup,
    intakeGroup,
    exhaustGroup,
    sparkGroup,
    forcedInductionGroup,
  );

  // Materials
  const blockMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.72,
    roughness: 0.36,
    side: THREE.DoubleSide,
  });
  const linerMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.85,
    roughness: 0.24,
  });
  const pistonMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.88, roughness: 0.2 });
  const ringMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.3 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.92, roughness: 0.24 });
  const crankMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.9, roughness: 0.26 });
  const camMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.86, roughness: 0.25 });
  const intakeMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.65, roughness: 0.28 });
  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#fb7185', metalness: 0.65, roughness: 0.28 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.05, roughness: 0.2 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.85, roughness: 0.25 });
  const beltMat = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.1, roughness: 0.85 });
  const turboMat = new THREE.MeshStandardMaterial({ color: '#b45309', metalness: 0.82, roughness: 0.32 });
  const hybridOrangeMat = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.3, roughness: 0.45 });

  // Compact scaled dimensions per cylinder so V12 stays clear without inter-bore collisions
  const cylCount = config.cylinders;
  const pitchZ = cylCount >= 10 ? 0.34 : cylCount >= 6 ? 0.38 : 0.44;
  const boreR = cylCount >= 10 ? 0.135 : cylCount >= 6 ? 0.15 : 0.17;
  const crankRadius = 0.11;
  const conRodLen = 0.34;
  const crankY = 0.0;
  const bankTiltAbs = (config.vAngleDeg * 0.5 * Math.PI) / 180;

  const cylsPerBank = isVOrBoxer ? Math.ceil(cylCount / 2) : cylCount;
  const bankSpanZ = (cylsPerBank - 1) * pitchZ;
  const bankZStart = -bankSpanZ * 0.5;

  // Shared crank length + main shaft
  const crankLen = bankSpanZ + 0.56;
  const crankSpinner = new THREE.Group();
  crankSpinner.position.set(0, crankY, 0);
  crankGroup.add(crankSpinner);

  const mainShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, crankLen, 18),
    crankMat,
  );
  mainShaft.rotation.x = Math.PI / 2;
  crankSpinner.add(mainShaft);

  const flywheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.055, 28),
    crankMat,
  );
  flywheel.rotation.x = Math.PI / 2;
  flywheel.position.set(0, 0, -crankLen * 0.5 - 0.02);
  crankSpinner.add(flywheel);

  const crankTimingGear = new THREE.Mesh(
    createGearGeometry({ teeth: 14, pitchRadius: 0.11, thickness: 0.04, boreRadius: 0.04 }),
    steelMat,
  );
  crankTimingGear.position.set(0, 0, crankLen * 0.5 + 0.02);
  crankSpinner.add(crankTimingGear);

  // Solid lower crankcase U-cradle + oil sump pan (open toward front/top cutaway, completely enclosing crank throws)
  const sumpWidth = isBoxer ? 0.62 : isVOrBoxer ? 0.54 : 0.42;
  const sumpBottom = new THREE.Mesh(
    new THREE.BoxGeometry(sumpWidth, 0.06, crankLen - 0.06),
    blockMat,
  );
  sumpBottom.position.set(0, crankY - 0.22, 0);
  const sumpRearWall = new THREE.Mesh(
    new THREE.BoxGeometry(sumpWidth, 0.34, 0.045),
    blockMat,
  );
  sumpRearWall.position.set(0, crankY - 0.06, -(crankLen - 0.08) * 0.5);
  const sumpBackSpine = new THREE.Mesh(
    new THREE.BoxGeometry(sumpWidth, 0.22, crankLen - 0.08),
    linerMat,
  );
  sumpBackSpine.position.set(0, crankY - 0.14, -0.02);
  blockGroup.add(sumpBottom, sumpRearWall, sumpBackSpine);

  // Shared geometries for pistons, rods, thick cutaway liners, valves, springs
  const innerBoreR = boreR * 1.06;
  const outerWallR = boreR * 1.26;
  const cylSleeveGeo = createThickCutawayLinerGeo(innerBoreR, outerWallR, 0.46, 0.88);
  const pistonGeo = new THREE.CylinderGeometry(boreR * 0.86, boreR * 0.86, 0.11, 20);
  const ringGeo = new THREE.TorusGeometry(boreR * 0.87, 0.0055, 6, 20);
  const rodGeo = new THREE.BoxGeometry(0.036, conRodLen, 0.032);
  const endCapGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.045, 12);
  const valveStemGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10);
  const valveHeadGeo = new THREE.CylinderGeometry(0.045, 0.018, 0.025, 14);
  const springGeo = createCoilSpringGeometry(0.026, 0.12, 4, 0.006, 28);
  const sparkBodyGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.11, 6);
  const sparkCeramicGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.12, 10);
  const flashGeo = new THREE.OctahedronGeometry(0.055, 1);

  const bankTilts = isVOrBoxer ? [-bankTiltAbs, bankTiltAbs] : [0];
  const camSpinners: THREE.Group[] = [];
  const runtimeCylinders: CylinderRuntime[] = [];

  const firingSlotByCyl = new Map<number, number>();
  config.firingOrder.forEach((cylNum, idx) => firingSlotByCyl.set(cylNum, idx));

  const camYLocal = 0.78;

  bankTilts.forEach((bankTilt, bankIdx) => {
    const zOffsetBank = isVOrBoxer ? (bankIdx === 0 ? -0.025 : 0.025) : 0;

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

    // Bank head deck casting & outer exhaust manifold
    const headRail = new THREE.Mesh(
      new THREE.BoxGeometry(outerWallR * 2.05, 0.075, bankSpanZ + outerWallR * 2.2),
      blockMat,
    );
    headRail.position.set(0, 0.625, zOffsetBank);
    // Solid block spine connecting cylinders cleanly along rear of bank
    const blockWeb = new THREE.Mesh(
      new THREE.BoxGeometry(outerWallR * 1.7, 0.42, bankSpanZ + outerWallR * 1.6),
      linerMat,
    );
    blockWeb.position.set(0, 0.36, zOffsetBank - outerWallR * 0.38);
    blockBank.add(headRail, blockWeb);

    const camSpinner = new THREE.Group();
    camSpinner.position.set(0, camYLocal, 0);
    camBank.add(camSpinner);
    camSpinners.push(camSpinner);

    const camBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, bankSpanZ + 0.36, 14),
      camMat,
    );
    camBar.rotation.x = Math.PI / 2;
    camSpinner.add(camBar);

    const camGearZ = bankSpanZ * 0.5 + 0.22;
    const camGear = new THREE.Mesh(
      createGearGeometry({ teeth: 24, pitchRadius: 0.16, thickness: 0.036, boreRadius: 0.025 }),
      steelMat,
    );
    camGear.position.set(0, 0, camGearZ);
    camSpinner.add(camGear);

    const bankBeltCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.11, 0, camGearZ),
        new THREE.Vector3(-0.16, camYLocal, camGearZ),
        new THREE.Vector3(0, camYLocal + 0.16, camGearZ),
        new THREE.Vector3(0.16, camYLocal, camGearZ),
        new THREE.Vector3(0.11, 0, camGearZ),
        new THREE.Vector3(0, -0.11, camGearZ),
      ],
      true,
    );
    const timingBelt = new THREE.Mesh(
      new THREE.TubeGeometry(bankBeltCurve, 44, 0.014, 6, true),
      beltMat,
    );
    camBank.add(timingBelt);

    // Exhaust manifold header collector cleanly outside outer flank of bank
    const headerRunner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.048, bankSpanZ + 0.24, 14),
      linerMat,
    );
    headerRunner.rotation.x = Math.PI / 2;
    headerRunner.position.set(
      bankIdx === 0 && isVOrBoxer ? -(outerWallR + 0.07) : outerWallR + 0.07,
      0.62,
      zOffsetBank,
    );
    blockBank.add(headerRunner);

    for (let j = 0; j < cylsPerBank; j++) {
      const cylIndex = isVOrBoxer ? bankIdx * cylsPerBank + j : j;
      if (cylIndex >= cylCount) continue;
      const cylNumber = cylIndex + 1;
      const zPos = bankZStart + j * pitchZ + zOffsetBank;
      const throwDeg = preset.crankThrowsDeg[cylIndex % preset.crankThrowsDeg.length] ?? 0;
      const throwRad = (throwDeg * Math.PI) / 180;

      // Thick-walled cutaway cylinder sleeve centered so TDC/BDC stay 100% inside bore
      const sleeve = new THREE.Mesh(cylSleeveGeo, blockMat);
      sleeve.position.set(0, 0.37, zPos);
      blockBank.add(sleeve);

      // Crankpin throw + counterweight web on crankshaft
      const throwX = Math.sin(throwRad) * crankRadius;
      const throwY = Math.cos(throwRad) * crankRadius;
      const crankPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12),
        steelMat,
      );
      crankPin.rotation.x = Math.PI / 2;
      crankPin.position.set(throwX, throwY, zPos);
      crankSpinner.add(crankPin);

      const web = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.028), crankMat);
      web.position.set(-throwX * 0.45, -throwY * 0.45, zPos - 0.06);
      web.rotation.z = -throwRad;
      crankSpinner.add(web);

      // Piston
      const pSub = new THREE.Group();
      pSub.position.set(0, 0.35, zPos);
      const pBody = new THREE.Mesh(pistonGeo, pistonMat);
      const pRing = new THREE.Mesh(ringGeo, ringMat);
      pRing.rotation.x = Math.PI / 2;
      pRing.position.y = 0.04;
      pSub.add(pBody, pRing);
      pistonBank.add(pSub);

      // Con-rod
      const rodSub = new THREE.Group();
      rodSub.position.set(0, 0.18, zPos);
      const beam = new THREE.Mesh(rodGeo, steelMat);
      const bigEnd = new THREE.Mesh(endCapGeo, steelMat);
      bigEnd.rotation.x = Math.PI / 2;
      bigEnd.position.y = -conRodLen * 0.48;
      rodSub.add(beam, bigEnd);
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
      const inV = mkValve(-0.055, intakeMat);
      intakeBank.add(inV.sub);
      const exV = mkValve(0.055, exhaustMat);
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
      sparkFlash.position.set(0, 0.59, zPos);
      sparkFlash.userData.lessonOnly = true;
      sparkBank.add(sparkFlash);

      // Combustion chamber gas glow
      const gasMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const gasMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(boreR * 0.86, boreR * 0.86, 1, 16),
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

  // Optional Forced Induction & Hybrid Assist Sub-Assemblies (toggled via sim options)
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
  hybridMotor.position.set(-0.36, 0.24, crankLen * 0.35);

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

  // Clone material per part group so solid highlighting isolates cleanly
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
    { object: blockGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.25, -1.45) },
    { object: pistonGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.35, 0.65, 0.45) },
    { object: conRodGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(1.35, -0.1, 0.45) },
    { object: crankGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -1.35, 0.22) },
    { object: camGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 1.85, 0.16) },
    { object: intakeGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.25, 1.25, 0.65) },
    { object: exhaustGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(1.25, 1.25, 0.65) },
    { object: sparkGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 2.55, 0.85) },
  ];

  const firstCyl = runtimeCylinders[0];
  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'cylinder-block', name: 'Cylinder Block', anchor: makePartAnchor(blockGroup, -0.35, 0.45, 0) },
    { partId: 'piston', name: 'Pistons', anchor: makePartAnchor(firstCyl.pistonSub, -0.22, 0.08, 0.06) },
    { partId: 'connecting-rod', name: 'Connecting Rods', anchor: makePartAnchor(firstCyl.conRodSub, 0.12, 0, 0.05) },
    { partId: 'crankshaft', name: 'Crankshaft', anchor: makePartAnchor(crankGroup, 0.32, -0.12, 0.15) },
    { partId: 'camshaft', name: 'Camshafts', anchor: makePartAnchor(camGroup, 0.26, 0.85, 0.15) },
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

      // 4-stroke cycle phase offset strictly aligned to cylinder's firing slot in firingOrder
      const cylCycleOffset = cyl.firingSlot * fireStepRad;
      // Shift so Power stroke starts at localCycle = 2*PI
      const localCycle = ((norm - cylCycleOffset + Math.PI * 2 + fourPi * 2) % fourPi);
      const cylPhase = Math.min(3, Math.floor(localCycle / Math.PI));

      const inLift = cylPhase === 0 ? Math.sin(localCycle) * 0.08 : 0;
      const exLift = cylPhase === 3 ? Math.sin(localCycle - Math.PI * 3) * 0.08 : 0;
      cyl.intakeSub.position.y = 0.72 - inLift;
      cyl.intakeSpring.scale.y = 1 - inLift * 2.2;
      cyl.exhaustSub.position.y = 0.72 - exLift;
      cyl.exhaustSpring.scale.y = 1 - exLift * 2.2;

      const crownY = kin.pistonY + 0.065;
      const chamberH = Math.max(0.03, 0.62 - crownY);
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
      const idx = Math.floor((norm / fireStepRad)) % config.firingOrder.length;
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
      target: [0, isBoxer ? 1.18 : 1.38, 0],
      position: [
        isBoxer ? 2.4 : 2.35,
        isBoxer ? 2.15 : 2.1,
        2.55 + bankSpanZ * 0.45,
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
      const mats = partHighlightMats.get('cylinder-block') ?? [];
      for (const m of mats) {
        m.transparent = enabled;
        m.opacity = enabled ? 0.24 : 1;
        m.depthWrite = !enabled;
        m.needsUpdate = true;
      }
    },
    dispose: () => disposeObject3D(root),
  };
}
