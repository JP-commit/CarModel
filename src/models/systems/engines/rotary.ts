import * as THREE from 'three';
import { disposeObject3D } from '../../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createPartController,
  makePartAnchor,
  type ExplodableEntry,
} from '../../ProceduralHelpers';
import type {
  SystemFrameStatus,
  SystemLabelAnchor,
  SystemModelInstance,
  SystemSimulationState,
} from '../types';

function createEpitrochoidShape(radius = 0.52, e = 0.095): THREE.Shape {
  const shape = new THREE.Shape();
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = radius * Math.cos(t) + e * Math.cos(3 * t);
    const y = radius * Math.sin(t) + e * Math.sin(3 * t);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createReuleauxRotorShape(r = 0.44): THREE.Shape {
  const shape = new THREE.Shape();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 2;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < 3; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % 3];
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const bulge = mid.clone().normalize().multiplyScalar(r * 0.62);
    shape.quadraticCurveTo(bulge.x, bulge.y, p2.x, p2.y);
  }
  shape.closePath();
  return shape;
}

export function createRotaryEngineModel(): SystemModelInstance {
  const root = new THREE.Group();
  root.name = 'EngineCutaway_Rotary';

  const assembly = new THREE.Group();
  assembly.position.y = 1.25;
  root.add(assembly);

  const housingGroup = new THREE.Group();
  const rotorGroup = new THREE.Group();
  const shaftGroup = new THREE.Group();
  const intakeGroup = new THREE.Group();
  const exhaustGroup = new THREE.Group();
  const sparkGroup = new THREE.Group();
  assembly.add(housingGroup, rotorGroup, shaftGroup, intakeGroup, exhaustGroup, sparkGroup);

  const housingMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.75,
    roughness: 0.34,
    side: THREE.DoubleSide,
  });
  const rotorMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.88, roughness: 0.22 });
  const sealMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.85, roughness: 0.25 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.9, roughness: 0.24 });
  const portInMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.6, roughness: 0.3 });
  const portExMat = new THREE.MeshStandardMaterial({ color: '#fb7185', metalness: 0.6, roughness: 0.3 });

  // 1. Cutaway Epitrochoid Rotor Housing Ring
  const outerShape = createEpitrochoidShape(0.62, 0.11);
  const innerHole = createEpitrochoidShape(0.51, 0.092);
  outerShape.holes.push(innerHole);

  const housingGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.32,
    bevelEnabled: false,
  });
  housingGeo.center();
  const housingMesh = new THREE.Mesh(housingGeo, housingMat);
  housingGroup.add(housingMesh);

  // Rear housing end-plate
  const rearPlateGeo = new THREE.ExtrudeGeometry(createEpitrochoidShape(0.62, 0.11), {
    depth: 0.04,
    bevelEnabled: false,
  });
  rearPlateGeo.center();
  const rearPlate = new THREE.Mesh(rearPlateGeo, housingMat);
  rearPlate.position.z = -0.18;
  housingGroup.add(rearPlate);

  // 2. Orbiting Triangular Rotor + Apex Seals
  const rotorOrbitPivot = new THREE.Group();
  rotorGroup.add(rotorOrbitPivot);

  const rotorBodyGeo = new THREE.ExtrudeGeometry(createReuleauxRotorShape(0.45), {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
  });
  rotorBodyGeo.center();
  const rotorSpinMesh = new THREE.Mesh(rotorBodyGeo, rotorMat);
  rotorOrbitPivot.add(rotorSpinMesh);

  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 2;
    const seal = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.045, 0.28), sealMat);
    seal.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0);
    seal.rotation.z = a;
    rotorSpinMesh.add(seal);
  }

  // 3. Eccentric Output Shaft + Counterweight
  const shaftSpin = new THREE.Group();
  shaftGroup.add(shaftSpin);
  const mainBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.92, 18), shaftMat);
  mainBar.rotation.x = Math.PI / 2;
  const eccLobe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 18), sealMat);
  eccLobe.rotation.x = Math.PI / 2;
  eccLobe.position.y = 0.065;
  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 28), shaftMat);
  flywheel.rotation.x = Math.PI / 2;
  flywheel.position.z = -0.34;
  shaftSpin.add(mainBar, eccLobe, flywheel);

  // 4. Intake & Exhaust Peripheral Ports
  const inPort = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 16), portInMat);
  inPort.rotation.z = Math.PI / 3;
  inPort.position.set(-0.68, 0.24, 0);
  intakeGroup.add(inPort);

  const exPort = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.26, 16), portExMat);
  exPort.rotation.z = -Math.PI / 3;
  exPort.position.set(-0.68, -0.24, 0);
  exhaustGroup.add(exPort);

  // 5. Dual Leading & Trailing Spark Plugs + Ignition Flash
  const leadPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), rotorMat);
  leadPlug.rotation.z = Math.PI / 2;
  leadPlug.position.set(0.68, 0.14, 0);
  const trailPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), rotorMat);
  trailPlug.rotation.z = Math.PI / 2;
  trailPlug.position.set(0.68, -0.14, 0);
  sparkGroup.add(leadPlug, trailPlug);

  const flashMat = new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0 });
  const burnFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), flashMat);
  burnFlash.position.set(0.46, 0, 0);
  burnFlash.userData.lessonOnly = true;
  sparkGroup.add(burnFlash);

  const partMap: Record<string, THREE.Object3D> = {
    'cylinder-block': housingGroup,
    piston: rotorGroup,
    crankshaft: shaftGroup,
    'intake-valve': intakeGroup,
    'exhaust-valve': exhaustGroup,
    'spark-plug': sparkGroup,
  };

  const partCtrl = createPartController(partMap, [flashMat]);

  const explodables: ExplodableEntry[] = [
    { object: housingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0, -0.75) },
    { object: rotorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.28, 0.52) },
    { object: shaftGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.65, 0.35) },
    { object: intakeGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.68, 0.4, 0.25) },
    { object: exhaustGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.68, -0.4, 0.25) },
    { object: sparkGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.75, 0.1, 0.25) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'cylinder-block', name: 'Trochoid Housing', anchor: makePartAnchor(housingGroup, 0, 0.68, 0) },
    { partId: 'piston', name: 'Triangular Rotor', anchor: makePartAnchor(rotorOrbitPivot, 0, 0.2, 0.18) },
    { partId: 'crankshaft', name: 'Eccentric Shaft', anchor: makePartAnchor(shaftSpin, 0, -0.2, 0.38) },
    { partId: 'intake-valve', name: 'Intake Port', anchor: makePartAnchor(inPort, -0.15, 0.12, 0) },
    { partId: 'exhaust-valve', name: 'Exhaust Port', anchor: makePartAnchor(exPort, -0.15, -0.12, 0) },
    { partId: 'spark-plug', name: 'Twin Spark Plugs', anchor: makePartAnchor(leadPlug, 0.12, 0.08, 0) },
  ];

  let eccAngle = 0;

  return {
    root,
    variant: 'rotary',
    naturalBounds: { length: 1.5, width: 1.4, height: 1.4 },
    targetRigExtent: 0.48,
    defaultCamera: {
      target: [0, 1.25, 0],
      position: [1.85, 1.85, 2.75],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      if (sim.playing) {
        const motionFactor = sim.reduceMotion ? 0.35 : 1;
        const rpmScale = sim.rpmOverride ? sim.rpmOverride / 2000 : sim.speed;
        eccAngle += dt * 4.5 * rpmScale * motionFactor;
      }

      // Eccentric shaft spins 3x faster than rotor itself
      shaftSpin.rotation.z = -eccAngle;
      const eOff = 0.065;
      rotorSpinMesh.position.set(Math.sin(eccAngle) * eOff, Math.cos(eccAngle) * eOff, 0);
      rotorSpinMesh.rotation.z = -eccAngle / 3;

      const twoPi = Math.PI * 2;
      const phaseMod = ((eccAngle % twoPi) + twoPi) % twoPi;
      const phaseIndex = Math.min(3, Math.floor((phaseMod / twoPi) * 4));
      flashMat.opacity = phaseIndex === 2 ? Math.max(0.15, Math.sin((phaseMod / twoPi) * Math.PI * 4)) : 0;

      return {
        phaseIndex,
        rpm: sim.rpmOverride ?? Math.round(1400 + sim.speed * 3200),
        firingCylinder: (Math.floor(eccAngle / (twoPi / 3)) % 3) + 1,
        torqueNm: 215,
        powerKw: 172,
      };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) =>
      applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['cylinder-block'], enabled, 0.24),
    dispose: () => disposeObject3D(root),
  };
}

