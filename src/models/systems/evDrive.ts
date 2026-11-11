import * as THREE from 'three';
import { disposeObject3D } from '../../scene/SceneManager';
import {
  applyExplodeOffsets,
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

export function createSystemModel(): SystemModelInstance {
  const root = new THREE.Group();
  root.name = 'EVDriveLessonCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const statorGroup = new THREE.Group();
  const rotorGroup = new THREE.Group();
  const inverterGroup = new THREE.Group();
  const gearGroup = new THREE.Group();
  const batteryGroup = new THREE.Group();

  assembly.add(statorGroup, rotorGroup, inverterGroup, gearGroup, batteryGroup);

  const housingMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.72,
    roughness: 0.34,
    side: THREE.DoubleSide,
  });
  const statorRingMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.85,
    roughness: 0.25,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: '#d97706',
    emissive: '#f97316',
    emissiveIntensity: 0.18,
    metalness: 0.82,
    roughness: 0.26,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.88,
    roughness: 0.22,
  });
  const magnetNMat = new THREE.MeshStandardMaterial({
    color: '#d93a1e',
    metalness: 0.45,
    roughness: 0.36,
  });
  const magnetSMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.55,
    roughness: 0.32,
  });
  const inverterMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.65,
    roughness: 0.32,
  });
  const batteryMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.48,
    roughness: 0.44,
  });
  const busOrangeMat = new THREE.MeshStandardMaterial({
    color: '#f97316',
    metalness: 0.2,
    roughness: 0.45,
  });

  // 1. Cutaway Motor Stator Housing & Copper Windings (axis along Z)
  const shellGeo = new THREE.CylinderGeometry(
    0.46,
    0.46,
    0.66,
    28,
    1,
    true,
    Math.PI * 0.22,
    Math.PI * 1.4,
  );
  shellGeo.rotateX(Math.PI / 2);
  const statorHousing = new THREE.Mesh(shellGeo, housingMat);
  statorGroup.add(statorHousing);

  const rearEndBell = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 28), statorRingMat);
  rearEndBell.rotation.x = Math.PI / 2;
  rearEndBell.position.z = -0.33;
  statorGroup.add(rearEndBell);

  const coilMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const coil = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.54), copperMat);
    coil.position.set(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0);
    coil.rotation.z = a;
    statorGroup.add(coil);
    coilMeshes.push(coil);
  }

  // 2. Spinning Permanent-Magnet Rotor + Drive Shaft
  const rotorSpinner = new THREE.Group();
  const rotorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.52, 24), rotorMat);
  rotorCore.rotation.x = Math.PI / 2;
  rotorSpinner.add(rotorCore);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 16), statorRingMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.14;
  rotorSpinner.add(shaft);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.032, 0.48),
      i % 2 === 0 ? magnetNMat : magnetSMat,
    );
    mag.position.set(Math.cos(a) * 0.225, Math.sin(a) * 0.225, 0);
    mag.rotation.z = a + Math.PI / 2;
    rotorSpinner.add(mag);
  }
  rotorGroup.add(rotorSpinner);

  // 3. Top-Mounted Power Inverter + Heatsink Fins + Status Strip
  const invCase = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.42), inverterMat);
  invCase.position.set(0, 0.64, -0.02);
  inverterGroup.add(invCase);

  for (let i = -3; i <= 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.38), statorRingMat);
    fin.position.set(i * 0.085, 0.735, -0.02);
    inverterGroup.add(fin);
  }

  const invStatusMat = new THREE.MeshBasicMaterial({ color: '#d93a1e' });
  const invStatus = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.02), invStatusMat);
  invStatus.position.set(0, 0.64, 0.195);
  inverterGroup.add(invStatus);

  // 4. Single-Speed Helical Reduction Gearset + Output Half-Shaft
  const pinionGear = new THREE.Mesh(
    createGearGeometry({ teeth: 12, pitchRadius: 0.15, thickness: 0.08, boreRadius: 0.028 }),
    rotorMat,
  );
  pinionGear.position.set(0, 0, 0.56);
  gearGroup.add(pinionGear);

  const outputGear = new THREE.Mesh(
    createGearGeometry({ teeth: 24, pitchRadius: 0.32, thickness: 0.09, boreRadius: 0.03 }),
    statorRingMat,
  );
  outputGear.position.set(0.49, 0, 0.56);
  gearGroup.add(outputGear);

  const halfShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 16), statorRingMat);
  halfShaft.rotation.z = Math.PI / 2;
  halfShaft.position.set(0.49, 0, 0.56);
  gearGroup.add(halfShaft);

  // 5. HV Battery Pack + Bidirectional Energy Bus
  const batteryBase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.86), batteryMat);
  batteryBase.position.set(-0.22, -0.68, -0.1);
  batteryGroup.add(batteryBase);

  for (let m = -1; m <= 1; m++) {
    const modCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.72), housingMat);
    modCap.position.set(-0.22 + m * 0.36, -0.585, -0.1);
    batteryGroup.add(modCap);
  }

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, -0.56, 0.16),
    new THREE.Vector3(-0.68, -0.05, 0.18),
    new THREE.Vector3(-0.48, 0.56, 0.14),
    new THREE.Vector3(-0.18, 0.62, 0.08),
  ]);
  const busCable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 28, 0.022, 8, false), busOrangeMat);
  batteryGroup.add(busCable);

  const driveFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, -0.56, 0.16),
    new THREE.Vector3(-0.68, -0.05, 0.18),
    new THREE.Vector3(-0.48, 0.56, 0.14),
    new THREE.Vector3(-0.1, 0.58, 0.06),
    new THREE.Vector3(0, 0.34, 0.1),
  ]);
  const driveStream = createFlowStream(driveFlowCurve, 12, '#d93a1e', 0.032, 0.08);
  batteryGroup.add(driveStream.mesh);

  const regenFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.34, 0.1),
    new THREE.Vector3(-0.1, 0.58, 0.06),
    new THREE.Vector3(-0.48, 0.56, 0.14),
    new THREE.Vector3(-0.68, -0.05, 0.18),
    new THREE.Vector3(-0.62, -0.56, 0.16),
  ]);
  const regenStream = createFlowStream(regenFlowCurve, 12, '#10b981', 0.034, 0.08);
  regenStream.mesh.visible = false;
  batteryGroup.add(regenStream.mesh);

  const partMap: Record<string, THREE.Object3D> = {
    stator: statorGroup,
    rotor: rotorGroup,
    inverter: inverterGroup,
    reduction_gear: gearGroup,
    battery_bus: batteryGroup,
  };

  const partHighlightMats = new Map<string, THREE.MeshStandardMaterial[]>();
  const emissiveOriginal = new Map<THREE.MeshStandardMaterial, THREE.Color>();

  for (const [partId, obj] of Object.entries(partMap)) {
    tagInteractivePart(obj, partId);
    const mats: THREE.MeshStandardMaterial[] = [];
    const clonedCache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    obj.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.material instanceof THREE.MeshStandardMaterial) {
        let cloned = clonedCache.get(m.material);
        if (!cloned) {
          cloned = m.material.clone();
          clonedCache.set(m.material, cloned);
          mats.push(cloned);
          emissiveOriginal.set(cloned, cloned.emissive.clone());
        }
        m.material = cloned;
      }
    });
    partHighlightMats.set(partId, mats);
  }

  const explodables: ExplodableEntry[] = [
    { object: statorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0, -0.82) },
    { object: rotorGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0, 0.58) },
    { object: inverterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.95, 0) },
    { object: gearGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.95, -0.05, 0.28) },
    { object: batteryGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-1.15, -1.0, 0.3) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'stator', name: 'Copper Stator', anchor: makeAnchor(statorGroup, -0.44, 0.28, -0.05) },
    { partId: 'rotor', name: 'Magnetic Rotor', anchor: makeAnchor(rotorGroup, 0.05, 0.14, 0.24) },
    { partId: 'inverter', name: 'Power Inverter', anchor: makeAnchor(inverterGroup, 0, 0.78, 0) },
    { partId: 'reduction_gear', name: 'Reduction Gear', anchor: makeAnchor(gearGroup, 0.56, 0.34, 0.56) },
    { partId: 'battery_bus', name: 'HV Battery Pack', anchor: makeAnchor(batteryGroup, -0.42, -0.52, 0.22) },
  ];

  let cycleAngle = 0;
  let rotorSpinAngle = 0;
  let flowPhase = 0;

  const updateKinematics = (dt: number, sim: SystemSimulationState): number => {
    const fourPi = Math.PI * 4;
    const norm = ((cycleAngle % fourPi) + fourPi) % fourPi;
    const phaseIndex = Math.min(3, Math.floor(norm / Math.PI));

    const speedMul = (sim.reduceMotion ? 0.35 : 1) * sim.speed;
    if (sim.playing) {
      const omega = phaseIndex === 1 ? 6.2 : phaseIndex === 3 ? 2.6 : 4.2;
      rotorSpinAngle += dt * omega * speedMul;
      flowPhase += dt * (phaseIndex === 3 ? 1.15 : 1.0) * speedMul;
    }

    rotorSpinner.rotation.z = -rotorSpinAngle;
    pinionGear.rotation.z = -rotorSpinAngle;
    outputGear.rotation.z = rotorSpinAngle * 0.5;

    const isRegen = phaseIndex === 3;
    const showFlows = sim.explode < 0.35;
    driveStream.mesh.visible = !isRegen && showFlows;
    regenStream.mesh.visible = isRegen && showFlows;

    if (isRegen) {
      regenStream.update(flowPhase);
      invStatusMat.color.set('#10b981');
    } else {
      driveStream.update(flowPhase * (phaseIndex === 2 ? 0.65 : 1));
      invStatusMat.color.set('#d93a1e');
    }

    const statorMatList = partHighlightMats.get('stator') ?? [];
    for (const coil of coilMeshes) {
      if (coil.material instanceof THREE.MeshStandardMaterial) {
        coil.material.emissive.set(isRegen ? '#10b981' : '#f97316');
        coil.material.emissiveIntensity =
          phaseIndex === 1 ? 0.58 : phaseIndex === 3 ? 0.48 : phaseIndex === 0 ? 0.35 : 0.16;
      }
    }
    void statorMatList;

    return phaseIndex;
  };

  return {
    root,
    defaultCamera: {
      target: [0, 1.12, 0.08],
      position: [2.65, 2.05, 3.65],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      if (sim.playing) {
        const motionFactor = sim.reduceMotion ? 0.35 : 1;
        cycleAngle += dt * 1.45 * sim.speed * motionFactor;
      }
      const phaseIndex = updateKinematics(dt, sim);
      const labels = [
        '1. Energize Stator',
        '2. Magnetic Torque',
        '3. Efficient Cruise',
        '4. Regen Braking',
      ];
      return {
        phaseIndex,
        statusText: labels[phaseIndex],
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
    setExplode: (amount: number) => {
      applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount)));
    },
    setXRay: (enabled: boolean) => {
      if (statorHousing.material instanceof THREE.MeshStandardMaterial) {
        statorHousing.material.transparent = enabled;
        statorHousing.material.opacity = enabled ? 0.24 : 1;
        statorHousing.material.depthWrite = !enabled;
        statorHousing.material.needsUpdate = true;
      }
    },
    dispose: () => {
      disposeObject3D(root);
    },
  };
}
