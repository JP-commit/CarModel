import * as THREE from 'three';
import { disposeObject3D } from '../../scene/SceneManager';
import {
  applyExplodeOffsets,
  createFlowStream,
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
  root.name = 'ExhaustCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const manifoldGroup = new THREE.Group();
  const sensorGroup = new THREE.Group();
  const catGroup = new THREE.Group();
  const resonatorGroup = new THREE.Group();
  const mufflerGroup = new THREE.Group();
  assembly.add(manifoldGroup, sensorGroup, catGroup, resonatorGroup, mufflerGroup);

  const headerMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.86, roughness: 0.28 });
  const shellMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.8,
    roughness: 0.32,
    side: THREE.DoubleSide,
  });
  const sensorMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.75, roughness: 0.3 });
  const honeycombMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#f05a28',
    emissiveIntensity: 0.55,
    metalness: 0.3,
    roughness: 0.5,
  });

  // 1. 4-into-1 Exhaust Manifold Headers (x = -1.45 .. -0.65)
  for (let i = 0; i < 4; i++) {
    const zOff = (i - 1.5) * 0.16;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.45, 0.38, zOff),
      new THREE.Vector3(-1.12, 0.34, zOff * 0.8),
      new THREE.Vector3(-0.85, 0.08, zOff * 0.25),
      new THREE.Vector3(-0.62, 0, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.036, 10, false), headerMat);
    manifoldGroup.add(tube);
  }

  // 2. Oxygen (O2) Sensor screwed into collector pipe
  const o2Body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 12), sensorMat);
  o2Body.position.set(-0.55, 0.14, 0);
  o2Body.rotation.z = -0.2;
  sensorGroup.add(o2Body);

  // 3. Cutaway Catalytic Converter + Instanced Hexagonal Honeycomb Core (x = -0.15)
  const catShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.54, 24, 1, true, Math.PI * 0.42, Math.PI * 1.16),
    shellMat,
  );
  catShell.rotation.z = Math.PI / 2;
  catShell.position.set(-0.15, 0, 0);
  catGroup.add(catShell);

  const cellGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.44, 6);
  cellGeo.rotateZ(Math.PI / 2);
  const cellCoords: [number, number][] = [];
  for (let r = -3; r <= 3; r++) {
    for (let c = -3; c <= 3; c++) {
      const y = r * 0.048;
      const z = c * 0.048 + (r % 2 === 0 ? 0 : 0.024);
      if (y * y + z * z <= 0.16 * 0.16) {
        cellCoords.push([y, z]);
      }
    }
  }
  const honeycomb = new THREE.InstancedMesh(cellGeo, honeycombMat, cellCoords.length);
  const cd = new THREE.Object3D();
  cellCoords.forEach(([y, z], idx) => {
    cd.position.set(-0.15, y, z);
    cd.updateMatrix();
    honeycomb.setMatrixAt(idx, cd.matrix);
  });
  honeycomb.instanceMatrix.needsUpdate = true;
  catGroup.add(honeycomb);

  // 4. Mid-pipe Acoustic Resonator (x = +0.48)
  const midPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 16), headerMat);
  midPipe.rotation.z = Math.PI / 2;
  midPipe.position.set(0.32, 0, 0);
  const resCan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 20), shellMat);
  resCan.rotation.z = Math.PI / 2;
  resCan.position.set(0.45, 0, 0);
  resonatorGroup.add(midPipe, resCan);

  // 5. Cutaway Baffled Muffler & Chrome Tailpipe Tip (x = +1.08)
  const mufShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.56, 26, 1, true, Math.PI * 0.44, Math.PI * 1.12),
    shellMat,
  );
  mufShell.rotation.z = Math.PI / 2;
  mufShell.position.set(1.05, 0, 0);
  mufflerGroup.add(mufShell);

  for (const xOff of [0.9, 1.2]) {
    const baffle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20), headerMat);
    baffle.rotation.z = Math.PI / 2;
    baffle.position.set(xOff, 0, 0);
    mufflerGroup.add(baffle);
  }
  const innerPerfPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.62, 16), headerMat);
  innerPerfPipe.rotation.z = Math.PI / 2;
  innerPerfPipe.position.set(1.05, 0, 0);
  const tailTip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.24, 20), headerMat);
  tailTip.rotation.z = Math.PI / 2;
  tailTip.position.set(1.44, 0, 0);
  mufflerGroup.add(innerPerfPipe, tailTip);

  // Exhaust gas pulse flow shifting from fiery hot orange-red to cooler faint mist
  const gasCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.35, 0.3, 0),
    new THREE.Vector3(-0.62, 0, 0),
    new THREE.Vector3(-0.15, 0, 0),
    new THREE.Vector3(0.45, 0, 0),
    new THREE.Vector3(1.05, 0, 0),
    new THREE.Vector3(1.75, 0.05, 0),
  ]);
  const gasStream = createFlowStream(gasCurve, 16, '#f05a28', 0.028, 0.085);
  assembly.add(gasStream.mesh);

  const partMap: Record<string, THREE.Object3D> = {
    manifold: manifoldGroup,
    'o2-sensor': sensorGroup,
    'catalytic-converter': catGroup,
    resonator: resonatorGroup,
    muffler: mufflerGroup,
  };
  const partCtrl = createPartController(partMap);

  const explodables: ExplodableEntry[] = [
    { object: manifoldGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.55, 0.25, 0) },
    { object: sensorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.15, 0.55, 0.2) },
    { object: catGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, -0.35, 0.35) },
    { object: resonatorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.25, 0.3, 0) },
    { object: mufflerGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.6, 0, 0.25) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'manifold', name: 'Manifold', anchor: makePartAnchor(manifoldGroup, -1.15, 0.45, 0) },
    { partId: 'o2-sensor', name: 'O₂ Sensor', anchor: makePartAnchor(o2Body, 0, 0.22, 0) },
    { partId: 'catalytic-converter', name: 'Catalytic Converter', anchor: makePartAnchor(catShell, 0, -0.32, 0) },
    { partId: 'resonator', name: 'Resonator', anchor: makePartAnchor(resCan, 0, 0.24, 0) },
    { partId: 'muffler', name: 'Muffler', anchor: makePartAnchor(mufShell, 0, -0.32, 0) },
  ];

  const hotColor = new THREE.Color('#f05a28');
  const cleanColor = new THREE.Color('#94a3b8');
  let elapsed = 0;
  let flowPhase = 0;

  return {
    root,
    defaultCamera: {
      target: [0.05, 1.08, 0],
      position: [1.75, 1.95, 4.25],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        const step = dt * sim.speed * motionFactor;
        elapsed += step;
        flowPhase += step * 0.45;
      }

      const stage = Math.min(3, Math.floor(((elapsed % 6) / 6) * 4));
      gasStream.update(flowPhase, (t, out) => {
        out.copy(hotColor).lerp(cleanColor, Math.min(1, t * 1.15));
      });

      return { phaseIndex: stage };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['catalytic-converter', 'muffler'], enabled, 0.25),
    dispose: () => disposeObject3D(root),
  };
}

