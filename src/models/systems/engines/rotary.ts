import * as THREE from 'three';
import {
  applyExplodeOffsets,
  createFlowStream,
  createPartController,
  makePartAnchor,
  type ExplodableEntry,
} from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';

export const WANKEL_ROTOR_RADIUS = 0.54;
export const WANKEL_ECCENTRICITY = 0.088;
export const WANKEL_HOUSING_CLEARANCE = 0.01;
export const WANKEL_SUN_TEETH = 16;
export const WANKEL_RING_TEETH = 24;

const SUN_PITCH_R = 2 * WANKEL_ECCENTRICITY; // 0.176
const RING_PITCH_R = 3 * WANKEL_ECCENTRICITY; // 0.264
const GEAR_MODULE = (2 * SUN_PITCH_R) / WANKEL_SUN_TEETH; // 0.022

/**
 * Pure kinematic helper returning the exact world-space position of rotor apex `apexIndex` (0..2)
 * for a given eccentric shaft rotation `shaftAngleRad` (CW when positive).
 * Housing inner bore uses: X(u) = R*cos(u) - e*cos(3u), Y(u) = R*sin(u) - e*sin(3u).
 */
export function computeWankelApexPosition(
  shaftAngleRad: number,
  apexIndex: number,
  R = WANKEL_ROTOR_RADIUS,
  e = WANKEL_ECCENTRICITY,
): { x: number; y: number; u: number } {
  const orbitAngle = -shaftAngleRad;
  const rotorAngle = orbitAngle / 3;
  const cx = -e * Math.cos(orbitAngle);
  const cy = -e * Math.sin(orbitAngle);
  const u = rotorAngle + (apexIndex * 2 * Math.PI) / 3;
  return {
    x: cx + R * Math.cos(u),
    y: cy + R * Math.sin(u),
    u,
  };
}

function evalEpitrochoid(u: number, r: number, e: number): [number, number] {
  return [r * Math.cos(u) - e * Math.cos(3 * u), r * Math.sin(u) - e * Math.sin(3 * u)];
}

/** Evaluates a bowed Reuleaux flank point in the rotor's local frame (t in 0..1 from apex k to apex k+1). */
function evalRotorFlankLocal(
  k: number,
  t: number,
  R = WANKEL_ROTOR_RADIUS,
): [number, number] {
  const a0 = (k * 2 * Math.PI) / 3;
  const a1 = ((k + 1) * 2 * Math.PI) / 3;
  const x0 = R * Math.cos(a0);
  const y0 = R * Math.sin(a0);
  const x1 = R * Math.cos(a1);
  const y1 = R * Math.sin(a1);
  const midA = (a0 + a1) * 0.5;
  const nx = Math.cos(midA);
  const ny = Math.sin(midA);

  const bx = x0 + (x1 - x0) * t;
  const by = y0 + (y1 - y0) * t;
  // Bowed flank staying safely inside the housing waist (clearance ~0.03 at TDC) with a small combustion pocket dimple
  const arch = Math.sin(t * Math.PI) * 0.064;
  const dimple = Math.exp(-Math.pow((t - 0.5) / 0.16, 2)) * -0.016;
  const offset = arch + dimple;
  return [bx + nx * offset, by + ny * offset];
}

function createExternalGearGeometry(
  teeth: number,
  pitchR: number,
  thickness: number,
  boreR: number,
): THREE.ExtrudeGeometry {
  const addendum = 0.78 * GEAR_MODULE;
  const dedendum = 0.98 * GEAR_MODULE;
  const rOuter = pitchR + addendum;
  const rRoot = Math.max(boreR + 0.014, pitchR - dedendum);

  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const base = i * step;
    const a0 = base - step * 0.24;
    const a1 = base - step * 0.13;
    const a2 = base + step * 0.13;
    const a3 = base + step * 0.24;
    const a4 = base + step * 0.5;
    const pts: [number, number][] = [
      [Math.cos(a0) * rRoot, Math.sin(a0) * rRoot],
      [Math.cos(a1) * rOuter, Math.sin(a1) * rOuter],
      [Math.cos(a2) * rOuter, Math.sin(a2) * rOuter],
      [Math.cos(a3) * rRoot, Math.sin(a3) * rRoot],
      [Math.cos(a4) * rRoot, Math.sin(a4) * rRoot],
    ];
    if (i === 0) shape.moveTo(pts[0][0], pts[0][1]);
    else shape.lineTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) shape.lineTo(pts[j][0], pts[j][1]);
  }
  shape.closePath();

  if (boreR > 0.005) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

/**
 * Builds an annular internal ring gear whose inward teeth have gaps aligned at angle 0
 * so the external sun gear centered along +X meshes tooth-into-valley at shaftAngle = 0.
 */
function createInternalGearGeometry(
  teeth: number,
  pitchR: number,
  outerR: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const addendum = 0.76 * GEAR_MODULE;
  const dedendum = 1.02 * GEAR_MODULE;
  const rToothTip = pitchR - addendum; // points inward
  const rToothRoot = Math.min(outerR - 0.015, pitchR + dedendum);

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  const step = (Math.PI * 2) / teeth;
  // Half-step shift places a valley centered at angle = 0 so sun tooth at angle = 0 meshes cleanly
  for (let i = 0; i < teeth; i++) {
    const center = (i + 0.5) * step;
    const a0 = center - step * 0.24;
    const a1 = center - step * 0.13;
    const a2 = center + step * 0.13;
    const a3 = center + step * 0.24;
    const a4 = center + step * 0.5;
    const pts: [number, number][] = [
      [Math.cos(a0) * rToothRoot, Math.sin(a0) * rToothRoot],
      [Math.cos(a1) * rToothTip, Math.sin(a1) * rToothTip],
      [Math.cos(a2) * rToothTip, Math.sin(a2) * rToothTip],
      [Math.cos(a3) * rToothRoot, Math.sin(a3) * rToothRoot],
      [Math.cos(a4) * rToothRoot, Math.sin(a4) * rToothRoot],
    ];
    if (i === 0) hole.moveTo(pts[0][0], pts[0][1]);
    else hole.lineTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) hole.lineTo(pts[j][0], pts[j][1]);
  }
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.0025,
    bevelThickness: 0.0025,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

/** Builds a thick extruded epitrochoid stator wall arc spanning uStart..uEnd. */
function createHousingWallArcGeometry(
  uStart: number,
  uEnd: number,
  rInner: number,
  wallThick: number,
  depth: number,
  steps = 44,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const u = uStart + ((uEnd - uStart) * i) / steps;
    const [x, y] = evalEpitrochoid(u, rInner, WANKEL_ECCENTRICITY);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const u = uStart + ((uEnd - uStart) * i) / steps;
    const [x, y] = evalEpitrochoid(u, rInner + wallThick, WANKEL_ECCENTRICITY);
    shape.lineTo(x, y);
  }
  shape.closePath();

  const raw = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    bevelSegments: 1,
  });
  raw.translate(0, 0, -depth * 0.5);
  return raw;
}

function createChamberQuadGeometry(segments = 20): THREE.BufferGeometry {
  const vertCount = (segments + 1) * 2;
  const positions = new Float32Array(vertCount * 3);
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function colorForChamberAngle(uMidRaw: number, targetColor: THREE.Color): number {
  const twoPi = Math.PI * 2;
  const u = ((uMidRaw % twoPi) + twoPi) % twoPi;
  // CW travel:
  // Intake port ~0.82*pi -> top lobe ~0.50*pi (Cyan)
  // Compression ~0.50*pi -> 0.14*pi (Indigo/Violet)
  // Ignition & Power ~0.14*pi -> 0 -> 1.48*pi (Orange/Amber)
  // Exhaust ~1.48*pi -> 0.82*pi (Rose-Red)
  const intakeCol = new THREE.Color('#38bdf8');
  const compCol = new THREE.Color('#6366f1');
  const sparkCol = new THREE.Color('#f97316');
  const exhaustCol = new THREE.Color('#fb7185');

  if (u >= Math.PI * 0.48 && u < Math.PI * 0.92) {
    targetColor.copy(intakeCol);
    return 0.42;
  }
  if (u >= Math.PI * 0.14 && u < Math.PI * 0.48) {
    const t = 1 - (u - Math.PI * 0.14) / (Math.PI * 0.34);
    targetColor.copy(intakeCol).lerp(compCol, t);
    return 0.46 + t * 0.14;
  }
  if (u < Math.PI * 0.14 || u >= Math.PI * 1.46) {
    // Near TDC (around 0 / 2*pi) glows brightest
    const distFromTdc = u < Math.PI * 0.14 ? u : twoPi - u;
    const flash = Math.max(0, 1 - distFromTdc / (Math.PI * 0.25));
    targetColor.copy(sparkCol);
    return 0.44 + flash * 0.36;
  }
  // Exhaust sweep (1.46*pi down to 0.92*pi)
  const tEx = 1 - (u - Math.PI * 0.92) / (Math.PI * 0.54);
  targetColor.copy(sparkCol).lerp(exhaustCol, Math.min(1, tEx * 1.15));
  return 0.46;
}

export function createRotaryEngineModel(): SystemModelInstance {
  const root = new THREE.Group();
  root.name = 'RotaryWankelSystem';

  const R = WANKEL_ROTOR_RADIUS;
  const e = WANKEL_ECCENTRICITY;
  const rHousing = R + WANKEL_HOUSING_CLEARANCE;

  // Materials
  const housingMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.72,
    roughness: 0.34,
    side: THREE.DoubleSide,
  });
  const housingBackMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.75,
    roughness: 0.45,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    metalness: 0.82,
    roughness: 0.26,
  });
  const sealMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    metalness: 0.55,
    roughness: 0.3,
  });
  const ringGearMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.85,
    roughness: 0.24,
  });
  const sunGearMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    metalness: 0.82,
    roughness: 0.24,
  });
  const shaftMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.88,
    roughness: 0.2,
  });
  const flywheelMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.78,
    roughness: 0.34,
  });
  const plugBodyMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.3,
    roughness: 0.45,
  });
  const intakeMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    metalness: 0.45,
    roughness: 0.32,
  });
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: '#fb7185',
    metalness: 0.45,
    roughness: 0.32,
  });
  const flashLeadMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: new THREE.Color('#f97316'),
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
  });
  const flashTrailMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: new THREE.Color('#f97316'),
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
  });

  // ── 1. Epitrochoid Housing (Open Front Cutaway + Left Port Channels) ────────────
  const housingGroup = new THREE.Group();
  root.add(housingGroup);

  // Rear stator backplate so internal gears & gas chambers stand out cleanly
  const backShape = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const u = (i / 96) * Math.PI * 2;
    const [x, y] = evalEpitrochoid(u, rHousing + 0.145, e);
    if (i === 0) backShape.moveTo(x, y);
    else backShape.lineTo(x, y);
  }
  backShape.closePath();
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.005,
    bevelThickness: 0.005,
    bevelSegments: 1,
  });
  const backPlate = new THREE.Mesh(backGeo, housingBackMat);
  backPlate.position.z = -0.23;
  housingGroup.add(backPlate);

  // Peripheral stator wall in 2 clean open-port segments (gap at top-left intake & bottom-left exhaust)
  // Intake port spans u = [0.74π, 0.90π], Exhaust port spans u = [1.10π, 1.26π]
  const wallDepth = 0.34;
  const bridgeWall = new THREE.Mesh(
    createHousingWallArcGeometry(Math.PI * 0.9, Math.PI * 1.1, rHousing, 0.145, wallDepth, 16),
    housingMat,
  );
  bridgeWall.position.z = 0.02;
  housingGroup.add(bridgeWall);

  const mainWall = new THREE.Mesh(
    createHousingWallArcGeometry(Math.PI * 1.26, Math.PI * 2.74, rHousing, 0.145, wallDepth, 72),
    housingMat,
  );
  mainWall.position.z = 0.02;
  housingGroup.add(mainWall);

  // Cooling fin ribs on top/right/bottom housing perimeter
  for (let i = 0; i < 10; i++) {
    const u = Math.PI * 1.38 + (i / 9) * (Math.PI * 1.28);
    const [fx, fy] = evalEpitrochoid(u, rHousing + 0.165, e);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.024, 0.32), housingMat);
    fin.position.set(fx, fy, 0.02);
    fin.rotation.z = u;
    housingGroup.add(fin);
  }

  // ── 2. Intake & Exhaust Peripheral Port Ducts + Flow Particle Streams ──────────
  const intakeGroup = new THREE.Group();
  root.add(intakeGroup);
  const [inX, inY] = evalEpitrochoid(Math.PI * 0.82, rHousing + 0.08, e);
  const intakeRunner = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.28), intakeMat);
  intakeRunner.position.set(inX - 0.18, inY + 0.02, 0.02);
  intakeGroup.add(intakeRunner);
  const intakeFlange = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.23, 0.32), intakeMat);
  intakeFlange.position.set(inX - 0.39, inY + 0.02, 0.02);
  intakeGroup.add(intakeFlange);

  const intakeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(inX - 0.48, inY + 0.04, 0.02),
    new THREE.Vector3(inX - 0.12, inY + 0.02, 0.02),
    new THREE.Vector3(-0.24, 0.36, 0.02),
    new THREE.Vector3(0.05, 0.42, 0.02),
  ]);
  const intakeStream = createFlowStream(intakeCurve, 9, '#38bdf8', 0.017, 0.052);
  intakeGroup.add(intakeStream.mesh);

  const exhaustGroup = new THREE.Group();
  root.add(exhaustGroup);
  const [exX, exY] = evalEpitrochoid(Math.PI * 1.18, rHousing + 0.08, e);
  const exhaustRunner = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.17, 0.28), exhaustMat);
  exhaustRunner.position.set(exX - 0.19, exY - 0.02, 0.02);
  exhaustGroup.add(exhaustRunner);
  const exhaustFlange = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.23, 0.32), exhaustMat);
  exhaustFlange.position.set(exX - 0.41, exY - 0.02, 0.02);
  exhaustGroup.add(exhaustFlange);

  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.08, -0.44, 0.02),
    new THREE.Vector3(-0.34, -0.34, 0.02),
    new THREE.Vector3(exX - 0.12, exY - 0.02, 0.02),
    new THREE.Vector3(exX - 0.52, exY - 0.05, 0.02),
  ]);
  const exhaustStream = createFlowStream(exhaustCurve, 9, '#fb7185', 0.017, 0.052);
  exhaustGroup.add(exhaustStream.mesh);

  // ── 3. Twin Spark Plugs (Leading lower-right & Trailing upper-right on waist) ──
  const sparkGroup = new THREE.Group();
  root.add(sparkGroup);
  const sparkFlashes: THREE.Mesh[] = [];
  const plugAngles = [-0.22, 0.22];
  plugAngles.forEach((ang, idx) => {
    const [px, py] = evalEpitrochoid(ang, rHousing + 0.15, e);
    const plug = new THREE.Group();
    plug.position.set(px, py, 0.02);
    plug.rotation.z = ang - Math.PI / 2;

    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6), shaftMat);
    hex.position.y = 0.02;
    plug.add(hex);
    const ceramic = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 14), plugBodyMat);
    ceramic.position.y = 0.14;
    plug.add(ceramic);
    const electrode = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.06, 10), sunGearMat);
    electrode.position.y = -0.06;
    plug.add(electrode);

    const flash = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 0),
      idx === 0 ? flashLeadMat : flashTrailMat,
    );
    flash.position.y = -0.14;
    flash.userData.lessonOnly = true;
    plug.add(flash);
    sparkFlashes.push(flash);
    sparkGroup.add(plug);
  });

  // ── 4. Stationary 16-Tooth Phasing Sun Gear Fixed to Side Cover at (0,0) ───────
  const phasingGearGroup = new THREE.Group();
  phasingGearGroup.position.set(0, 0, 0.105);
  root.add(phasingGearGroup);

  const sunGear = new THREE.Mesh(
    createExternalGearGeometry(WANKEL_SUN_TEETH, SUN_PITCH_R, 0.068, 0.072),
    sunGearMat,
  );
  phasingGearGroup.add(sunGear);

  const sunCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.09, 24), housingBackMat);
  sunCollar.rotation.x = Math.PI / 2;
  sunCollar.position.z = 0.02;
  phasingGearGroup.add(sunCollar);

  // ── 5. Triangular Rotor + Apex Seals + 24-Tooth Internal Ring Gear ────────────
  const rotorExplodeGroup = new THREE.Group();
  root.add(rotorExplodeGroup);
  const rotorOrbitGroup = new THREE.Group();
  rotorExplodeGroup.add(rotorOrbitGroup);

  // Main triangular rotor body recessed in the front so internal ring gear sits cleanly visible
  const rotorShape = new THREE.Shape();
  const rotorStepsPerSide = 16;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < rotorStepsPerSide; i++) {
      const t = i / rotorStepsPerSide;
      const [rx, ry] = evalRotorFlankLocal(k, t, R);
      if (k === 0 && i === 0) rotorShape.moveTo(rx, ry);
      else rotorShape.lineTo(rx, ry);
    }
  }
  rotorShape.closePath();
  const rotorHole = new THREE.Path();
  rotorHole.absarc(0, 0, 0.305, 0, Math.PI * 2, true);
  rotorShape.holes.push(rotorHole);

  const rotorGeo = new THREE.ExtrudeGeometry(rotorShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    bevelSegments: 1,
  });
  rotorGeo.translate(0, 0, -0.14);
  const rotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
  rotorOrbitGroup.add(rotorMesh);

  // Rear rotor web backing behind internal gear cavity
  const webGeo = new THREE.CylinderGeometry(0.315, 0.315, 0.13, 36);
  webGeo.rotateX(Math.PI / 2);
  const rotorWeb = new THREE.Mesh(webGeo, housingBackMat);
  rotorWeb.position.z = -0.07;
  rotorOrbitGroup.add(rotorWeb);

  // 24-tooth internal ring gear attached to the front recess of the rotor
  const ringGear = new THREE.Mesh(
    createInternalGearGeometry(WANKEL_RING_TEETH, RING_PITCH_R, 0.325, 0.068),
    ringGearMat,
  );
  ringGear.position.z = 0.105;
  rotorOrbitGroup.add(ringGear);

  // 3 metallic apex seals at exact rotor tip vertices
  for (let k = 0; k < 3; k++) {
    const a = (k * 2 * Math.PI) / 3;
    const seal = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.022, 0.265), sealMat);
    seal.position.set(R * Math.cos(a), R * Math.sin(a), -0.018);
    seal.rotation.z = a;
    rotorOrbitGroup.add(seal);
  }

  // ── 6. Dynamic 3-Chamber Gas Color Crescents (lessonOnly) ─────────────────────
  const chamberGroups: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial }[] = [];
  for (let k = 0; k < 3; k++) {
    const geo = createChamberQuadGeometry(20);
    const mat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -0.04;
    mesh.userData.lessonOnly = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    chamberGroups.push({ mesh, geo, mat });
  }

  // ── 7. Eccentric Output Shaft + Counterweight Flywheel ────────────────────────
  const shaftExplodeGroup = new THREE.Group();
  root.add(shaftExplodeGroup);

  const shaftSpinGroup = new THREE.Group();
  shaftExplodeGroup.add(shaftSpinGroup);

  // Central concentric main shaft passing through origin (0,0)
  const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.88, 22), shaftMat);
  mainShaft.rotation.x = Math.PI / 2;
  mainShaft.position.z = -0.08;
  shaftSpinGroup.add(mainShaft);

  // Eccentric cam lobe offset at (-e, 0) matching rotor center orbit (-e*cos(orbit), -e*sin(orbit))
  const eccentricLobe = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.18, 24), sealMat);
  eccentricLobe.rotation.x = Math.PI / 2;
  eccentricLobe.position.set(-e, 0, -0.04);
  shaftSpinGroup.add(eccentricLobe);

  // Rear counterweight flywheel
  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 36), flywheelMat);
  flywheel.rotation.x = Math.PI / 2;
  flywheel.position.z = -0.42;
  shaftSpinGroup.add(flywheel);

  // ── 8. Part Controller, Explodables & Floating Label Anchors ──────────────────
  const partMap: Record<string, THREE.Object3D> = {
    'cylinder-block': housingGroup,
    piston: rotorExplodeGroup,
    'phasing-gear': phasingGearGroup,
    crankshaft: shaftExplodeGroup,
    'intake-valve': intakeGroup,
    'exhaust-valve': exhaustGroup,
    'spark-plug': sparkGroup,
  };

  const { highlightPart, setPartsXRay } = createPartController(partMap, [
    flashLeadMat,
    flashTrailMat,
    ...chamberGroups.map((c) => c.mat),
  ]);

  const explodables: ExplodableEntry[] = [
    { object: housingGroup, basePosition: housingGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0, -0.35) },
    { object: rotorExplodeGroup, basePosition: rotorExplodeGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0, 0.28) },
    { object: phasingGearGroup, basePosition: phasingGearGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0, 0.62) },
    { object: shaftExplodeGroup, basePosition: shaftExplodeGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0, -0.82) },
    { object: intakeGroup, basePosition: intakeGroup.position.clone(), explodeOffset: new THREE.Vector3(-0.42, 0.25, 0.08) },
    { object: exhaustGroup, basePosition: exhaustGroup.position.clone(), explodeOffset: new THREE.Vector3(-0.42, -0.25, 0.08) },
    { object: sparkGroup, basePosition: sparkGroup.position.clone(), explodeOffset: new THREE.Vector3(0.42, 0, 0.12) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'cylinder-block', name: 'Epitrochoid Housing', anchor: makePartAnchor(housingGroup, 0, 0.72, 0.18) },
    { partId: 'piston', name: 'Triangular Rotor & Ring Gear', anchor: makePartAnchor(rotorOrbitGroup, 0.36, 0.26, 0.2) },
    { partId: 'phasing-gear', name: 'Stationary Phasing Gear', anchor: makePartAnchor(phasingGearGroup, -0.02, 0.19, 0.16) },
    { partId: 'crankshaft', name: 'Eccentric Output Shaft', anchor: makePartAnchor(shaftExplodeGroup, 0.04, -0.36, -0.42) },
    { partId: 'intake-valve', name: 'Intake Port', anchor: makePartAnchor(intakeGroup, inX - 0.2, inY + 0.18, 0.18) },
    { partId: 'exhaust-valve', name: 'Exhaust Port', anchor: makePartAnchor(exhaustGroup, exX - 0.22, exY - 0.18, 0.18) },
    { partId: 'spark-plug', name: 'Twin Spark Plugs', anchor: makePartAnchor(sparkGroup, 0.76, 0.22, 0.12) },
  ];

  let shaftAngle = 0;

  function updateChambers(rotorAngle: number, cx: number, cy: number): number {
    const rWall = rHousing - 0.004;
    const cosR = Math.cos(rotorAngle);
    const sinR = Math.sin(rotorAngle);
    const segments = 20;
    const tmpCol = new THREE.Color();
    let chamber0Phase = 0;

    for (let k = 0; k < 3; k++) {
      const ch = chamberGroups[k];
      const posAttr = ch.geo.getAttribute('position') as THREE.BufferAttribute;
      const uStart = rotorAngle + (k * 2 * Math.PI) / 3;
      const uEnd = rotorAngle + ((k + 1) * 2 * Math.PI) / 3;
      const uMid = (uStart + uEnd) * 0.5;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const u = uStart + (uEnd - uStart) * t;
        const [hx, hy] = evalEpitrochoid(u, rWall, e);
        const [lx, ly] = evalRotorFlankLocal(k, t, R);
        const fx = cx + lx * cosR - ly * sinR;
        const fy = cy + lx * sinR + ly * cosR;

        posAttr.setXYZ(i * 2, hx, hy, 0);
        posAttr.setXYZ(i * 2 + 1, fx, fy, 0);
      }
      posAttr.needsUpdate = true;
      ch.geo.computeVertexNormals();

      const opacity = colorForChamberAngle(uMid, tmpCol);
      ch.mat.color.copy(tmpCol);
      ch.mat.opacity = opacity;

      if (k === 0) {
        const twoPi = Math.PI * 2;
        const wrapU = ((uMid % twoPi) + twoPi) % twoPi;
        if (wrapU >= Math.PI * 0.48 && wrapU < Math.PI * 0.92) chamber0Phase = 0; // Intake
        else if (wrapU >= Math.PI * 0.14 && wrapU < Math.PI * 0.48) chamber0Phase = 1; // Squeeze
        else if (wrapU < Math.PI * 0.14 || wrapU >= Math.PI * 1.46) chamber0Phase = 2; // Twin-Spark Burn
        else chamber0Phase = 3; // Exhaust
      }
    }
    return chamber0Phase;
  }

  function applyKinematics(angle: number): number {
    const orbitAngle = -angle;
    const rotorAngle = orbitAngle / 3;
    const cx = -e * Math.cos(orbitAngle);
    const cy = -e * Math.sin(orbitAngle);

    shaftSpinGroup.rotation.z = orbitAngle;
    rotorOrbitGroup.position.set(cx, cy, 0);
    rotorOrbitGroup.rotation.z = rotorAngle;

    const phaseIdx = updateChambers(rotorAngle, cx, cy);

    // Fire leading/trailing sparks cleanly whenever any rotor flank crosses TDC (uMid ~ 0 mod 2pi/3)
    const flankCenterMod = (((rotorAngle + Math.PI / 3) % ((Math.PI * 2) / 3)) + (Math.PI * 2) / 3) % ((Math.PI * 2) / 3);
    const distToTdc = Math.min(flankCenterMod, (Math.PI * 2) / 3 - flankCenterMod);
    const leadFire = Math.max(0, 1 - distToTdc / 0.24);
    const trailFire = Math.max(0, 1 - Math.abs(distToTdc - 0.08) / 0.22);

    flashLeadMat.opacity = leadFire * 0.95;
    flashLeadMat.emissiveIntensity = leadFire * 2.8;
    flashTrailMat.opacity = trailFire * 0.85;
    flashTrailMat.emissiveIntensity = trailFire * 2.4;

    if (sparkFlashes[0]) sparkFlashes[0].scale.setScalar(0.55 + leadFire * 0.85);
    if (sparkFlashes[1]) sparkFlashes[1].scale.setScalar(0.5 + trailFire * 0.75);

    return phaseIdx;
  }

  // Initial pose
  applyKinematics(0);

  return {
    root,
    variant: 'rotary',
    naturalBounds: { length: 1.9, width: 1.5, height: 1.75 },
    targetRigExtent: 0.72,
    defaultCamera: {
      position: [0.35, 0.22, 2.75],
      target: [-0.04, 0, 0],
    },
    partObjects: [
      housingGroup,
      rotorExplodeGroup,
      phasingGearGroup,
      shaftExplodeGroup,
      intakeGroup,
      exhaustGroup,
      sparkGroup,
    ],
    labelAnchors,
    explodables,
    update(dt, sim) {
      const rate = sim.playing ? (sim.reduceMotion ? 1.8 : 4.2) * sim.speed : 0;
      shaftAngle = (shaftAngle + dt * rate) % (Math.PI * 6);
      const phaseIndex = applyKinematics(shaftAngle);

      const flowPhase = (shaftAngle / (Math.PI * 2)) % 1;
      intakeStream.update(flowPhase);
      exhaustStream.update((flowPhase + 0.5) % 1);

      const shaftRpm = Math.round(
        sim.playing ? (sim.rpmOverride ?? 1800 + sim.speed * 1400) : 0,
      );
      const rotorRpm = Math.round(shaftRpm / 3);
      return {
        phaseIndex,
        rpm: shaftRpm,
        statusText: `Eccentric Shaft ${shaftRpm} RPM • Rotor ${rotorRpm} RPM (3:1)`,
      };
    },
    highlightPart,
    setExplode(amount) {
      applyExplodeOffsets(explodables, amount, 1.55);
    },
    setXRay(enabled) {
      setPartsXRay(['cylinder-block'], enabled, 0.24);
    },
    dispose() {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}
