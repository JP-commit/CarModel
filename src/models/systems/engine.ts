import * as THREE from 'three';
import type { Powertrain } from '../../state/appState';
import { disposeObject3D } from '../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createCoilSpringGeometry,
  createFlowStream,
  createGearGeometry,
  tagInteractivePart,
  type ExplodableEntry,
} from '../ProceduralHelpers';
import type {
  SystemFrameStatus,
  SystemLabelAnchor,
  SystemModelInstance,
  SystemSimulationState,
} from './types';

function makeAnchor(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Object3D {
  const node = new THREE.Object3D();
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

function createCamLobeGeometry(baseR = 0.075, noseLift = 0.068, thickness = 0.08): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    // Smooth egg-shaped cam profile pointing down along -Y at t = -PI/2
    const lobe = Math.pow(Math.max(0, Math.sin(t)), 3) * noseLift;
    const r = baseR + lobe;
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export function createSystemModel(powertrain: Powertrain = 'petrol'): SystemModelInstance {
  const isDiesel = powertrain === 'diesel';
  const root = new THREE.Group();
  root.name = 'EngineLessonCutaway';

  // Elevate assembly above the studio floor (y = 0) even at full downward explode
  const assembly = new THREE.Group();
  assembly.position.y = 1.12;
  root.add(assembly);

  // Semantic part wrapper groups (each explodes cleanly along its own vector)
  const blockGroup = new THREE.Group();
  const pistonGroup = new THREE.Group();
  const conRodGroup = new THREE.Group();
  const crankGroup = new THREE.Group();
  const camGroup = new THREE.Group();
  const intakeGroup = new THREE.Group();
  const exhaustGroup = new THREE.Group();
  const sparkGroup = new THREE.Group();

  assembly.add(
    blockGroup,
    pistonGroup,
    conRodGroup,
    crankGroup,
    camGroup,
    intakeGroup,
    exhaustGroup,
    sparkGroup,
  );

  // Materials
  const blockMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.72,
    roughness: 0.36,
    transparent: false,
    opacity: 1,
    side: THREE.DoubleSide,
  });
  const blockInnerMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.85,
    roughness: 0.22,
    transparent: false,
    opacity: 1,
  });
  const pistonMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.88,
    roughness: 0.2,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.9,
    roughness: 0.3,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    metalness: 0.92,
    roughness: 0.24,
  });
  const crankMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.9,
    roughness: 0.26,
  });
  const camMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.86,
    roughness: 0.25,
  });
  const intakeValveMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    metalness: 0.65,
    roughness: 0.28,
  });
  const exhaustValveMat = new THREE.MeshStandardMaterial({
    color: '#fb7185',
    metalness: 0.65,
    roughness: 0.28,
  });
  const ceramicMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    metalness: 0.05,
    roughness: 0.2,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    metalness: 0.85,
    roughness: 0.25,
  });
  const beltMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    metalness: 0.1,
    roughness: 0.85,
  });

  // 1. Cutaway Cylinder Block (220° arc sleeve open to camera so internals stay visible!)
  const cylRadius = 0.4;
  const cylWallGeo = new THREE.CylinderGeometry(
    cylRadius + 0.05,
    cylRadius + 0.05,
    1.15,
    36,
    1,
    true,
    Math.PI * 0.42,
    Math.PI * 1.16,
  );
  const cylOuter = new THREE.Mesh(cylWallGeo, blockMat);
  cylOuter.position.set(0, 0.72, 0);
  blockGroup.add(cylOuter);

  const cylLinerGeo = new THREE.CylinderGeometry(
    cylRadius - 0.005,
    cylRadius - 0.005,
    1.15,
    36,
    1,
    true,
    Math.PI * 0.42,
    Math.PI * 1.16,
  );
  const cylLiner = new THREE.Mesh(cylLinerGeo, blockInnerMat);
  cylLiner.position.set(0, 0.72, 0);
  blockGroup.add(cylLiner);

  // Cylinder head deck cutaway plate
  const headPlate = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.56), blockMat);
  headPlate.position.set(0, 1.32, -0.14);
  blockGroup.add(headPlate);

  // Crankcase lower saddle
  const crankcase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.68, 28, 1, true, Math.PI * 0.35, Math.PI * 1.3),
    blockMat,
  );
  crankcase.rotation.x = Math.PI / 2;
  crankcase.position.set(0, -0.2, -0.05);
  blockGroup.add(crankcase);

  // Instanced cooling fins wrapping around rear of cylinder block (1 draw call!)
  const finCount = 8;
  const finGeo = new THREE.CylinderGeometry(
    cylRadius + 0.13,
    cylRadius + 0.13,
    0.022,
    32,
    1,
    false,
    Math.PI * 0.45,
    Math.PI * 1.1,
  );
  const coolingFins = new THREE.InstancedMesh(finGeo, blockInnerMat, finCount);
  const finDummy = new THREE.Object3D();
  for (let i = 0; i < finCount; i++) {
    finDummy.position.set(0, 0.3 + i * 0.12, 0);
    finDummy.updateMatrix();
    coolingFins.setMatrixAt(i, finDummy.matrix);
  }
  coolingFins.instanceMatrix.needsUpdate = true;
  blockGroup.add(coolingFins);

  // Intake & Exhaust manifold stub pipes on left and right of head
  const intakePipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.38, 18),
    blockMat,
  );
  intakePipe.rotation.z = Math.PI * 0.36;
  intakePipe.position.set(-0.46, 1.44, -0.06);
  blockGroup.add(intakePipe);

  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.38, 18),
    blockMat,
  );
  exhaustPipe.rotation.z = -Math.PI * 0.36;
  exhaustPipe.position.set(0.46, 1.44, -0.06);
  blockGroup.add(exhaustPipe);

  // Combustion chamber dynamic gas glow (lives inside cylinder above piston)
  const gasMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const gasMesh = new THREE.Mesh(new THREE.CylinderGeometry(cylRadius - 0.03, cylRadius - 0.03, 1, 24), gasMat);
  gasMesh.position.set(0, 1.0, 0);
  gasMesh.userData.lessonOnly = true;
  assembly.add(gasMesh);

  // Intake & Exhaust flow particle streams
  const intakeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, 1.52, -0.04),
    new THREE.Vector3(-0.34, 1.38, -0.02),
    new THREE.Vector3(-0.18, 1.16, 0),
    new THREE.Vector3(-0.08, 0.85, 0),
  ]);
  const intakeStream = createFlowStream(intakeCurve, 7, '#38bdf8', 0.024, 0.065);
  assembly.add(intakeStream.mesh);

  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, 0.9, 0),
    new THREE.Vector3(0.2, 1.2, 0),
    new THREE.Vector3(0.36, 1.39, -0.02),
    new THREE.Vector3(0.65, 1.54, -0.04),
  ]);
  const exhaustStream = createFlowStream(exhaustCurve, 7, '#fb7185', 0.024, 0.065);
  assembly.add(exhaustStream.mesh);

  // 2. Piston (crown + cutaway skirt + compression rings + wrist pin)
  const pistonSub = new THREE.Group();
  const pistonBody = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.26, 32), pistonMat);
  pistonSub.add(pistonBody);

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.358, 0.011, 8, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08 - i * 0.04;
    pistonSub.add(ring);
  }
  const wristPin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.56, 16), steelMat);
  wristPin.rotation.x = Math.PI / 2;
  wristPin.position.y = -0.03;
  pistonSub.add(wristPin);
  pistonGroup.add(pistonSub);

  // 3. Connecting Rod
  const conRodLength = 0.7;
  const conRodSub = new THREE.Group();
  const rodBeam = new THREE.Mesh(new THREE.BoxGeometry(0.08, conRodLength, 0.06), steelMat);
  conRodSub.add(rodBeam);
  const smallEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 18), steelMat);
  smallEnd.rotation.x = Math.PI / 2;
  smallEnd.position.y = conRodLength * 0.5;
  conRodSub.add(smallEnd);
  const bigEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 20), steelMat);
  bigEnd.rotation.x = Math.PI / 2;
  bigEnd.position.y = -conRodLength * 0.5;
  conRodSub.add(bigEnd);
  conRodGroup.add(conRodSub);

  // 4. Crankshaft + Counterweights + Flywheel + Crank Timing Gear
  const crankY = -0.2;
  const crankRadius = 0.24;
  const crankSpinner = new THREE.Group();
  crankSpinner.position.set(0, crankY, 0);
  crankGroup.add(crankSpinner);

  const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.9, 20), crankMat);
  mainShaft.rotation.x = Math.PI / 2;
  crankSpinner.add(mainShaft);

  // Counterweights opposite crankpin (-Y when crankpin is +Y)
  for (const zOff of [-0.14, 0.14]) {
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.065), crankMat);
    web.position.set(0, 0.04, zOff);
    crankSpinner.add(web);
  }

  const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 18), steelMat);
  crankPin.rotation.x = Math.PI / 2;
  crankPin.position.set(0, crankRadius, 0);
  crankSpinner.add(crankPin);

  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 36), crankMat);
  flywheel.rotation.x = Math.PI / 2;
  flywheel.position.set(0, 0, -0.38);
  crankSpinner.add(flywheel);

  const crankGearGeo = createGearGeometry({
    teeth: 16,
    pitchRadius: 0.17,
    thickness: 0.055,
    boreRadius: 0.055,
  });
  const crankGear = new THREE.Mesh(crankGearGeo, steelMat);
  crankGear.position.set(0, 0, 0.42);
  crankSpinner.add(crankGear);

  // 5. Camshaft + Cam Lobes + 2:1 Cam Gear + Timing Belt
  const camY = 1.98;
  const camSpinner = new THREE.Group();
  camSpinner.position.set(0, camY, 0);
  camGroup.add(camSpinner);

  const camShaftBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.96, 18), camMat);
  camShaftBar.rotation.x = Math.PI / 2;
  camSpinner.add(camShaftBar);

  const camLobeGeo = createCamLobeGeometry();
  const intakeLobe = new THREE.Mesh(camLobeGeo, camMat);
  intakeLobe.position.set(-0.18, 0, 0);
  // Points down (-Y = -PI/2) at camAngle = PI/4 (mid-intake: cycle = PI/2 -> cam = PI/4)
  intakeLobe.rotation.z = -Math.PI * 0.75;
  camSpinner.add(intakeLobe);

  const exhaustLobe = new THREE.Mesh(camLobeGeo, camMat);
  exhaustLobe.position.set(0.18, 0, 0);
  // Points down (-Y = -PI/2) at camAngle = 7*PI/4 (mid-exhaust: cycle = 3.5*PI -> cam = 1.75*PI)
  exhaustLobe.rotation.z = Math.PI * 0.25;
  camSpinner.add(exhaustLobe);

  // 2:1 Camshaft timing gear (32 teeth, 2x crank pitch radius)
  const camGearGeo = createGearGeometry({
    teeth: 32,
    pitchRadius: 0.34,
    thickness: 0.055,
    boreRadius: 0.045,
  });
  const camGear = new THREE.Mesh(camGearGeo, steelMat);
  camGear.position.set(0, 0, 0.42);
  camSpinner.add(camGear);

  // Timing belt loop connecting crank gear and cam gear
  const beltPts = [
    new THREE.Vector3(-0.18, crankY, 0.42),
    new THREE.Vector3(-0.34, camY, 0.42),
    new THREE.Vector3(0, camY + 0.34, 0.42),
    new THREE.Vector3(0.34, camY, 0.42),
    new THREE.Vector3(0.18, crankY, 0.42),
    new THREE.Vector3(0, crankY - 0.17, 0.42),
  ];
  const beltCurve = new THREE.CatmullRomCurve3(beltPts, true);
  const timingBelt = new THREE.Mesh(new THREE.TubeGeometry(beltCurve, 64, 0.022, 8, true), beltMat);
  camGroup.add(timingBelt);

  // 6 & 7. Intake & Exhaust Valves + Valve Springs
  const buildValveAssembly = (xPos: number, mat: THREE.Material) => {
    const sub = new THREE.Group();
    sub.position.set(xPos, 1.56, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 12), mat);
    sub.add(stem);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.035, 0.055, 20), mat);
    head.position.y = -0.29;
    sub.add(head);
    const tappet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), steelMat);
    tappet.position.y = 0.27;
    sub.add(tappet);
    const spring = new THREE.Mesh(createCoilSpringGeometry(0.055, 0.28, 5, 0.011, 56), steelMat);
    spring.position.y = 0.08;
    sub.add(spring);
    return { sub, spring };
  };

  const intakeAssembly = buildValveAssembly(-0.18, intakeValveMat);
  intakeGroup.add(intakeAssembly.sub);

  const exhaustAssembly = buildValveAssembly(0.18, exhaustValveMat);
  exhaustGroup.add(exhaustAssembly.sub);

  // 8. Spark Plug + Electric Arc Flash
  const sparkSub = new THREE.Group();
  sparkSub.position.set(0, 1.52, 0);
  const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 6), steelMat);
  sparkSub.add(plugBody);
  const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.24, 16), ceramicMat);
  insulator.position.y = 0.18;
  sparkSub.add(insulator);
  const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 12), brassMat);
  terminal.position.y = 0.32;
  sparkSub.add(terminal);
  const electrode = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 10), steelMat);
  electrode.position.y = -0.15;
  sparkSub.add(electrode);

  const sparkFlashMat = new THREE.MeshBasicMaterial({
    color: isDiesel ? '#fb923c' : '#fef08a',
    transparent: true,
    opacity: 0,
  });
  const sparkFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 1), sparkFlashMat);
  sparkFlash.position.y = -0.26;
  sparkFlash.userData.lessonOnly = true;
  sparkSub.add(sparkFlash);
  sparkGroup.add(sparkSub);

  // Tag every part sub-tree with its partId for raycasting & highlighting
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

  // Record original emissive colors so highlightPart never clobbers custom tints
  const emissiveOriginal = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial && !emissiveOriginal.has(m)) {
        emissiveOriginal.set(m, m.emissive.clone());
      }
    }
  });

  // Clone material per part group ONLY for highlighting cleanly without cross-tinting shared steelMat
  const partHighlightMats = new Map<string, THREE.MeshStandardMaterial[]>();
  for (const [partId, obj] of Object.entries(partMap)) {
    const matsForPart: THREE.MeshStandardMaterial[] = [];
    const clonedCache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      if (mesh.material === sparkFlashMat || mesh.material === gasMat) return;
      if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
      let cloned = clonedCache.get(mesh.material);
      if (!cloned) {
        cloned = mesh.material.clone();
        clonedCache.set(mesh.material, cloned);
        matsForPart.push(cloned);
        emissiveOriginal.set(cloned, cloned.emissive.clone());
      }
      mesh.material = cloned;
    });
    partHighlightMats.set(partId, matsForPart);
  }

  const explodables: ExplodableEntry[] = [
    { object: blockGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.1, -1.05) },
    { object: pistonGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.95, 0.25, 0.42) },
    { object: conRodGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.95, -0.15, 0.42) },
    { object: crankGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.95, 0.15) },
    { object: camGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 2.05, 0.12) },
    { object: intakeGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.92, 0.9, 0.45) },
    { object: exhaustGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.92, 0.9, 0.45) },
    { object: sparkGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 3.25, 0.95) },
  ];

  // Label anchors attached to moving/exploding parts
  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'cylinder-block', name: 'Cylinder Block', anchor: makeAnchor(blockGroup, -0.5, 0.72, -0.1) },
    { partId: 'piston', name: 'Piston', anchor: makeAnchor(pistonSub, -0.38, 0.05, 0.18) },
    { partId: 'connecting-rod', name: 'Connecting Rod', anchor: makeAnchor(conRodSub, 0.16, 0, 0.1) },
    { partId: 'crankshaft', name: 'Crankshaft', anchor: makeAnchor(crankGroup, 0.45, -0.25, 0.2) },
    { partId: 'camshaft', name: 'Camshaft', anchor: makeAnchor(camGroup, 0.42, camY, 0.22) },
    { partId: 'intake-valve', name: 'Intake Valve', anchor: makeAnchor(intakeAssembly.sub, -0.22, 0.08, 0.12) },
    { partId: 'exhaust-valve', name: 'Exhaust Valve', anchor: makeAnchor(exhaustAssembly.sub, 0.22, 0.08, 0.12) },
    {
      partId: 'spark-plug',
      name: isDiesel ? 'Fuel Injector' : 'Spark Plug',
      anchor: makeAnchor(sparkSub, 0, 0.38, 0.08),
    },
  ];

  let cycleAngle = 0; // 0 .. 4*PI
  let currentExplode = 0;

  const updateKinematics = (angle: number, explodeAmt: number, dt: number) => {
    const fourPi = Math.PI * 4;
    const normAngle = ((angle % fourPi) + fourPi) % fourPi;
    const phaseIndex = Math.min(3, Math.floor(normAngle / Math.PI));

    // Slider-crank math
    const crankAngle = normAngle;
    const cx = Math.sin(crankAngle) * crankRadius;
    const cy = crankY + Math.cos(crankAngle) * crankRadius;
    const py = cy + Math.sqrt(Math.max(0.01, conRodLength * conRodLength - cx * cx));

    // Rotate crank clockwise (negative Z turns +Y pin toward +X)
    crankSpinner.rotation.z = -crankAngle;
    camSpinner.rotation.z = -crankAngle * 0.5;

    // Position piston and connecting rod inside their semantic groups
    pistonSub.position.set(0, py, 0);
    conRodSub.position.set(cx * 0.5, (cy + py) * 0.5, 0);
    conRodSub.rotation.z = Math.atan2(cx, py - cy);

    // Valve lifts: Intake open during 0..PI, Exhaust open during 3*PI..4*PI
    const intakeLift =
      phaseIndex === 0 ? Math.sin(normAngle) * 0.16 : 0;
    const exhaustLift =
      phaseIndex === 3 ? Math.sin(normAngle - Math.PI * 3) * 0.16 : 0;

    intakeAssembly.sub.position.y = 1.56 - intakeLift;
    intakeAssembly.spring.scale.y = 1 - intakeLift * 1.4;

    exhaustAssembly.sub.position.y = 1.56 - exhaustLift;
    exhaustAssembly.spring.scale.y = 1 - exhaustLift * 1.4;

    // Combustion chamber gas fills from top deck (y = 1.25) down to piston crown (py + 0.13)
    const crownY = py + 0.13;
    const topDeckY = 1.25;
    const chamberH = Math.max(0.05, topDeckY - crownY);
    gasMesh.scale.y = chamberH;
    gasMesh.position.y = crownY + chamberH * 0.5;
    gasMesh.visible = explodeAmt < 0.35;

    // Phase-specific gas color, spark flash, and intake/exhaust particles
    if (phaseIndex === 0) {
      gasMat.color.set('#38bdf8');
      gasMat.opacity = 0.28 * Math.sin(normAngle);
      sparkFlashMat.opacity = 0;
      intakeStream.mesh.visible = explodeAmt < 0.35;
      exhaustStream.mesh.visible = false;
      intakeStream.update((normAngle / Math.PI) * 1.2);
    } else if (phaseIndex === 1) {
      const t = (normAngle - Math.PI) / Math.PI;
      gasMat.color.set('#38bdf8').lerp(new THREE.Color('#a78bfa'), t);
      gasMat.opacity = 0.24 + t * 0.32;
      sparkFlashMat.opacity = 0;
      intakeStream.mesh.visible = false;
      exhaustStream.mesh.visible = false;
    } else if (phaseIndex === 2) {
      const t = (normAngle - Math.PI * 2) / Math.PI;
      const sparkPulse = Math.max(0, 1 - t * 4.5);
      sparkFlashMat.opacity = sparkPulse;
      sparkFlash.scale.setScalar(0.8 + sparkPulse * 1.1);
      sparkFlash.rotation.y += dt * 12;
      gasMat.color.set('#f97316').lerp(new THREE.Color('#fde047'), sparkPulse * 0.7);
      gasMat.opacity = Math.max(0.18, 0.72 * (1 - t * 0.65));
      intakeStream.mesh.visible = false;
      exhaustStream.mesh.visible = false;
    } else {
      const t = (normAngle - Math.PI * 3) / Math.PI;
      sparkFlashMat.opacity = 0;
      gasMat.color.set('#fb7185');
      gasMat.opacity = 0.36 * (1 - t * 0.75);
      intakeStream.mesh.visible = false;
      exhaustStream.mesh.visible = explodeAmt < 0.35;
      exhaustStream.update(t * 1.2);
    }

    return phaseIndex;
  };

  const setExplode = (amount: number) => {
    currentExplode = Math.max(0, Math.min(1, amount));
    applyExplodeOffsets(explodables, currentExplode);
    timingBelt.visible = currentExplode < 0.2;
  };

  const setXRay = (enabled: boolean) => {
    const blockMats = partHighlightMats.get('cylinder-block') ?? [];
    for (const mat of blockMats) {
      mat.transparent = enabled;
      mat.opacity = enabled ? 0.24 : 1;
      mat.depthWrite = !enabled;
      mat.needsUpdate = true;
    }
  };

  const highlightPart = (partId: string | null) => {
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
  };

  updateKinematics(0.55, 0, 0);

  return {
    root,
    defaultCamera: {
      target: [0, 1.94, 0],
      position: [2.85, 2.55, 4.05],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      if (sim.playing) {
        const motionFactor = sim.reduceMotion ? 0.35 : 1;
        cycleAngle += dt * 3.1 * sim.speed * motionFactor;
      }
      const phaseIndex = updateKinematics(cycleAngle, sim.explode, dt);
      const phases = ['1. Intake', '2. Compression', '3. Power', '4. Exhaust'];
      return {
        phaseIndex,
        statusText: phases[phaseIndex],
      };
    },
    highlightPart,
    setExplode,
    setXRay,
    dispose: () => {
      disposeObject3D(root);
    },
  };
}

