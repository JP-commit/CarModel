import * as THREE from 'three';
import { disposeObject3D } from '../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createFlowStream,
  createGearGeometry,
  createPartController,
  makePartAnchor,
  type ExplodableEntry,
} from '../ProceduralHelpers';
import type {
  SystemFrameStatus,
  SystemLabelAnchor,
  SystemModelInstance,
  SystemSimulationState,
} from './types';

export function createSystemModel(): SystemModelInstance {
  const root = new THREE.Group();
  root.name = 'ElectricalCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const batteryGroup = new THREE.Group();
  const ignitionGroup = new THREE.Group();
  const starterGroup = new THREE.Group();
  const alternatorGroup = new THREE.Group();
  const harnessGroup = new THREE.Group();
  assembly.add(batteryGroup, ignitionGroup, starterGroup, alternatorGroup, harnessGroup);

  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.25, roughness: 0.55 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.88, roughness: 0.24 });
  const copperMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.85, roughness: 0.28 });
  const redTermMat = new THREE.MeshStandardMaterial({ color: '#f05a28', metalness: 0.35, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#facc15',
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });

  // 1. 12V Battery + Instanced 6 Internal Cells
  const batCase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.46, 0.44), darkMat);
  batCase.position.set(-0.95, 0.05, 0);
  const posPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 14), redTermMat);
  posPost.position.set(-0.74, 0.31, 0.12);
  const negPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 14), metalMat);
  negPost.position.set(-1.16, 0.31, 0.12);
  batteryGroup.add(batCase, posPost, negPost);

  const cellGeo = new THREE.BoxGeometry(0.075, 0.36, 0.36);
  const cells = new THREE.InstancedMesh(cellGeo, metalMat, 6);
  const cd = new THREE.Object3D();
  for (let i = 0; i < 6; i++) {
    cd.position.set(-0.95 + (i - 2.5) * 0.098, 0.04, 0);
    cd.updateMatrix();
    cells.setMatrixAt(i, cd.matrix);
  }
  cells.instanceMatrix.needsUpdate = true;
  batteryGroup.add(cells);

  // 2. Ignition Key Switch Module
  const igBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 18), darkMat);
  igBody.rotation.x = Math.PI / 2;
  igBody.position.set(-0.25, 0.65, 0.15);
  const keyTab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.05), metalMat);
  keyTab.position.set(0, 0, 0.1);
  const keySpin = new THREE.Group();
  keySpin.position.set(-0.25, 0.65, 0.15);
  keySpin.add(keyTab);
  ignitionGroup.add(igBody, keySpin);

  // 3. Starter Motor + Solenoid + Sliding Pinion Engaging Flywheel Ring Gear
  const starterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.44, 20), darkMat);
  starterBody.rotation.z = Math.PI / 2;
  starterBody.position.set(0.05, -0.22, 0.18);
  const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 16), metalMat);
  solenoid.rotation.z = Math.PI / 2;
  solenoid.position.set(0.05, -0.02, 0.18);
  const starterPinion = new THREE.Mesh(
    createGearGeometry({ teeth: 10, pitchRadius: 0.085, thickness: 0.06, boreRadius: 0.02 }),
    metalMat,
  );
  starterPinion.rotation.y = Math.PI / 2;
  starterPinion.position.set(0.32, -0.22, 0.18);
  const flywheelRing = new THREE.Mesh(
    createGearGeometry({ teeth: 32, pitchRadius: 0.34, thickness: 0.06, boreRadius: 0.18 }),
    metalMat,
  );
  flywheelRing.rotation.y = Math.PI / 2;
  flywheelRing.position.set(0.56, -0.04, 0);
  starterGroup.add(starterBody, solenoid, starterPinion, flywheelRing);

  // 4. Alternator + Internal Copper Stator + Belt Drive Pulley
  const altCase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 20), metalMat);
  altCase.rotation.z = Math.PI / 2;
  altCase.position.set(0.75, 0.48, 0);
  const altCoil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 10, 22), copperMat);
  altCoil.rotation.y = Math.PI / 2;
  altCoil.position.set(0.75, 0.48, 0);
  const altPulley = new THREE.Mesh(
    createGearGeometry({ teeth: 14, pitchRadius: 0.11, thickness: 0.05, boreRadius: 0.03 }),
    darkMat,
  );
  altPulley.rotation.y = Math.PI / 2;
  altPulley.position.set(0.54, 0.48, 0);
  alternatorGroup.add(altCase, altCoil, altPulley);

  // 5. Wiring Harness Cables + Headlight Lamp + Current Flow Streams
  const startCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.74, 0.31, 0.12),
    new THREE.Vector3(-0.5, 0.18, 0.2),
    new THREE.Vector3(-0.18, -0.04, 0.22),
    new THREE.Vector3(0.05, -0.04, 0.18),
  ]);
  const chargeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.75, 0.68, 0),
    new THREE.Vector3(0.25, 0.85, -0.1),
    new THREE.Vector3(-0.35, 0.6, -0.12),
    new THREE.Vector3(-0.74, 0.31, 0.12),
  ]);
  const cableA = new THREE.Mesh(new THREE.TubeGeometry(startCurve, 32, 0.018, 8, false), redTermMat);
  const cableB = new THREE.Mesh(new THREE.TubeGeometry(chargeCurve, 32, 0.018, 8, false), copperMat);
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), lampMat);
  headlight.position.set(-0.25, 0.25, -0.35);
  harnessGroup.add(cableA, cableB, headlight);

  const crankFlow = createFlowStream(startCurve, 6, '#f05a28', 0.024, 0.055);
  const chargeFlow = createFlowStream(chargeCurve, 8, '#facc15', 0.022, 0.055);
  harnessGroup.add(crankFlow.mesh, chargeFlow.mesh);

  const partMap: Record<string, THREE.Object3D> = {
    battery: batteryGroup,
    'ignition-switch': ignitionGroup,
    'starter-motor': starterGroup,
    alternator: alternatorGroup,
    'wiring-harness': harnessGroup,
  };
  const partCtrl = createPartController(partMap, [
    crankFlow.mesh.material as THREE.Material,
    chargeFlow.mesh.material as THREE.Material,
    lampMat,
  ]);

  const explodables: ExplodableEntry[] = [
    { object: batteryGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.85, -0.15, 0.25) },
    { object: ignitionGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.25, 0.65, 0.35) },
    { object: starterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.25, -0.48, 0.3) },
    { object: alternatorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.75, 0.42, 0) },
    { object: harnessGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.52, -0.58) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'battery', name: '12V Battery', anchor: makePartAnchor(batCase, 0, 0.34, 0) },
    { partId: 'ignition-switch', name: 'Ignition', anchor: makePartAnchor(igBody, 0, 0.2, 0.1) },
    { partId: 'starter-motor', name: 'Starter Motor', anchor: makePartAnchor(starterBody, -0.1, -0.22, 0.15) },
    { partId: 'alternator', name: 'Alternator', anchor: makePartAnchor(altCase, 0, 0.28, 0) },
    { partId: 'wiring-harness', name: 'Wiring & Lamp', anchor: makePartAnchor(headlight, 0, 0.2, -0.05) },
  ];

  let elapsed = 0;
  let flowPhase = 0;

  return {
    root,
    defaultCamera: {
      target: [-0.05, 1.18, 0],
      position: [1.85, 1.95, 3.35],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        const step = dt * sim.speed * motionFactor;
        elapsed += step;
        flowPhase += step * 1.1;
      }

      const cycle = (elapsed % 8) / 8;
      const stage = Math.min(3, Math.floor(cycle * 4));

      // Stage 0-1: Ignition turn + starter engages flywheel; Stage 2-3: Alternator spins & recharges
      const isCranking = stage <= 1;
      keySpin.rotation.z = isCranking ? -0.6 : -0.3;

      const pinionSlide = isCranking ? 0.46 : 0.32;
      starterPinion.position.x += (pinionSlide - starterPinion.position.x) * Math.min(1, dt * 10);

      if (sim.playing) {
        const spin = dt * sim.speed * motionFactor;
        if (isCranking) {
          starterPinion.rotation.x += spin * 7.5;
          flywheelRing.rotation.x += spin * 2.5;
        } else {
          flywheelRing.rotation.x += spin * 5.2;
          altPulley.rotation.x += spin * 9.0;
          altCoil.rotation.x += spin * 9.0;
        }
      }

      crankFlow.mesh.visible = isCranking;
      chargeFlow.mesh.visible = !isCranking;
      crankFlow.update(flowPhase);
      chargeFlow.update(flowPhase);
      lampMat.emissiveIntensity = isCranking ? 0.25 : 1.15;

      return { phaseIndex: stage };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['battery', 'alternator'], enabled, 0.25),
    dispose: () => disposeObject3D(root),
  };
}

