import * as THREE from 'three';
import type { Powertrain } from '../../state/appState';
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

export function createSystemModel(
  _powertrain: Powertrain = 'petrol',
  variant?: string,
): SystemModelInstance {
  const isDualBank = Boolean(variant && /^(v6|v8|v10|v12|flat-4|flat-6)/.test(variant));
  const root = new THREE.Group();
  root.name = 'CoolingCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const jacketGroup = new THREE.Group();
  const pumpGroup = new THREE.Group();
  const thermostatGroup = new THREE.Group();
  const radiatorGroup = new THREE.Group();
  const fanGroup = new THREE.Group();
  assembly.add(jacketGroup, pumpGroup, thermostatGroup, radiatorGroup, fanGroup);

  const blockMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.72, roughness: 0.36 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.88, roughness: 0.24 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.85, roughness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.3, roughness: 0.6 });
  const hoseMat = new THREE.MeshStandardMaterial({ color: '#27272a', metalness: 0.1, roughness: 0.78 });

  // 1. Engine Cooling Water Jacket (left side at x = -0.9)
  const blockShell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.74, 0.5), blockMat);
  blockShell.position.set(-0.95, 0.18, 0);
  const coreSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 22), metalMat);
  coreSleeve.position.set(-0.95, 0.18, isDualBank ? -0.14 : 0);
  jacketGroup.add(blockShell, coreSleeve);
  if (isDualBank) {
    const bank2Sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.56, 20), metalMat);
    bank2Sleeve.position.set(-0.95, 0.18, 0.16);
    jacketGroup.add(bank2Sleeve);
  }

  // 2. Water Pump + Spinning Impeller Blades (InstancedMesh)
  const pumpHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.14, 22, 1, true, Math.PI * 0.4, Math.PI * 1.2),
    metalMat,
  );
  pumpHousing.rotation.x = Math.PI / 2;
  pumpHousing.position.set(-0.42, -0.18, 0.12);
  pumpGroup.add(pumpHousing);

  const impellerHub = new THREE.Group();
  impellerHub.position.set(-0.42, -0.18, 0.12);
  const hubCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 14), brassMat);
  hubCyl.rotation.x = Math.PI / 2;
  impellerHub.add(hubCyl);

  const bladeGeo = new THREE.BoxGeometry(0.12, 0.022, 0.07);
  const impellerBlades = new THREE.InstancedMesh(bladeGeo, brassMat, 6);
  const bd = new THREE.Object3D();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bd.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
    bd.rotation.set(0, 0, a + 0.35);
    bd.updateMatrix();
    impellerBlades.setMatrixAt(i, bd.matrix);
  }
  impellerBlades.instanceMatrix.needsUpdate = true;
  impellerHub.add(impellerBlades);
  pumpGroup.add(impellerHub);

  // 3. Thermostat Housing + Opening Valve Disc
  const thermoHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 18), metalMat);
  thermoHousing.rotation.z = Math.PI / 2;
  thermoHousing.position.set(-0.32, 0.56, 0.06);
  const thermoDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), brassMat);
  thermoDisc.position.set(-0.32, 0.56, 0.06);
  thermostatGroup.add(thermoHousing, thermoDisc);

  // 4. Aluminum Radiator Core + Instanced Horizontal Cooling Fins (at x = +0.85)
  const radLeftTank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.22), darkMat);
  radLeftTank.position.set(0.48, 0.18, 0);
  const radRightTank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.22), darkMat);
  radRightTank.position.set(1.22, 0.18, 0);
  radiatorGroup.add(radLeftTank, radRightTank);

  const finCount = 16;
  const radFinGeo = new THREE.BoxGeometry(0.64, 0.016, 0.14);
  const radFins = new THREE.InstancedMesh(radFinGeo, metalMat, finCount);
  const fd = new THREE.Object3D();
  for (let i = 0; i < finCount; i++) {
    fd.position.set(0.85, -0.2 + (i / (finCount - 1)) * 0.76, 0);
    fd.updateMatrix();
    radFins.setMatrixAt(i, fd.matrix);
  }
  radFins.instanceMatrix.needsUpdate = true;
  radiatorGroup.add(radFins);

  // 5. Electric Cooling Fan Behind Radiator (Instanced Blades)
  const fanShroud = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 10, 28), darkMat);
  fanShroud.position.set(0.85, 0.18, -0.22);
  fanGroup.add(fanShroud);

  const fanSpin = new THREE.Group();
  fanSpin.position.set(0.85, 0.18, -0.22);
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), darkMat);
  fanHub.rotation.x = Math.PI / 2;
  fanSpin.add(fanHub);

  const fBladeGeo = new THREE.BoxGeometry(0.22, 0.065, 0.012);
  const fanBlades = new THREE.InstancedMesh(fBladeGeo, darkMat, 7);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    bd.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0);
    bd.rotation.set(0.45, 0, a);
    bd.updateMatrix();
    fanBlades.setMatrixAt(i, bd.matrix);
  }
  fanBlades.instanceMatrix.needsUpdate = true;
  fanSpin.add(fanBlades);
  fanGroup.add(fanSpin);

  // Coolant Loop Tubes + Thermal Color-Shifting Flow Particles
  const loopCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.75, 0.5, 0.06),
      new THREE.Vector3(-0.32, 0.56, 0.06),
      new THREE.Vector3(0.48, 0.56, 0.04),
      new THREE.Vector3(1.15, 0.52, 0),
      new THREE.Vector3(1.15, -0.18, 0),
      new THREE.Vector3(0.48, -0.18, 0.06),
      new THREE.Vector3(-0.42, -0.18, 0.12),
      new THREE.Vector3(-0.85, -0.12, 0.06),
    ],
    true,
  );
  const hoseMesh = new THREE.Mesh(
    new THREE.TubeGeometry(loopCurve, 64, 0.025, 8, true),
    hoseMat,
  );
  hoseMat.transparent = true;
  hoseMat.opacity = 0.35;
  hoseMesh.userData.lessonOnly = true;
  assembly.add(hoseMesh);

  const coolantStream = createFlowStream(loopCurve, 18, '#f05a28', 0.028, 0.075);
  assembly.add(coolantStream.mesh);

  const partMap: Record<string, THREE.Object3D> = {
    'engine-jacket': jacketGroup,
    'water-pump': pumpGroup,
    thermostat: thermostatGroup,
    radiator: radiatorGroup,
    'cooling-fan': fanGroup,
  };
  const partCtrl = createPartController(partMap);

  const explodables: ExplodableEntry[] = [
    { object: jacketGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.62, 0.1, 0) },
    { object: pumpGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.1, -0.45, 0.3) },
    { object: thermostatGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.15, 0.5, 0.2) },
    { object: radiatorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.55, 0, 0.22) },
    { object: fanGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.55, 0, -0.5) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'engine-jacket', name: 'Engine Jacket', anchor: makePartAnchor(blockShell, 0, 0.45, 0) },
    { partId: 'water-pump', name: 'Water Pump', anchor: makePartAnchor(impellerHub, 0, -0.25, 0.1) },
    { partId: 'thermostat', name: 'Thermostat', anchor: makePartAnchor(thermoHousing, 0, 0.2, 0.1) },
    { partId: 'radiator', name: 'Radiator', anchor: makePartAnchor(radRightTank, -0.3, 0.5, 0.1) },
    { partId: 'cooling-fan', name: 'Cooling Fan', anchor: makePartAnchor(fanSpin, 0, -0.35, -0.1) },
  ];

  const hotColor = new THREE.Color('#f05a28');
  const coolColor = new THREE.Color('#38bdf8');
  let elapsed = 0;
  let flowPhase = 0;

  return {
    root,
    defaultCamera: {
      target: [0.05, 1.18, 0],
      position: [1.9, 1.95, 4.15],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        const step = dt * sim.speed * motionFactor;
        elapsed += step;
        impellerHub.rotation.z -= step * 6.5;
        fanSpin.rotation.z -= step * 7.5;
        flowPhase += step * 0.22;
      }

      const cycle = (elapsed % 8) / 8;
      const stage = Math.min(3, Math.floor(cycle * 4));
      const thermoOpen = stage >= 2 ? 1 : 0;

      // Thermostat disc pivots open at temperature
      thermoDisc.rotation.z += ((thermoOpen ? Math.PI * 0.45 : 0) - thermoDisc.rotation.z) * Math.min(1, dt * 8);

      // Color each coolant capsule smoothly from hot orange-red (engine exit) to cool cyan (radiator exit)
      coolantStream.update(flowPhase, (t, out) => {
        if (t < 0.42) {
          out.copy(hotColor);
        } else if (t < 0.65) {
          out.copy(hotColor).lerp(coolColor, (t - 0.42) / 0.23);
        } else {
          out.copy(coolColor);
        }
      });

      return { phaseIndex: stage };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['engine-jacket', 'thermostat'], enabled, 0.25),
    dispose: () => disposeObject3D(root),
  };
}

