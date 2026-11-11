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
  root.name = 'BrakesCutaway';

  const assembly = new THREE.Group();
  assembly.position.y = 1.15;
  root.add(assembly);

  const masterGroup = new THREE.Group();
  const linesGroup = new THREE.Group();
  const caliperGroup = new THREE.Group();
  const padsGroup = new THREE.Group();
  const discGroup = new THREE.Group();
  assembly.add(masterGroup, linesGroup, caliperGroup, padsGroup, discGroup);

  const metalMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.88, roughness: 0.24 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.82, roughness: 0.34 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.45, roughness: 0.32 });
  const padMat = new THREE.MeshStandardMaterial({ color: '#57534e', metalness: 0.2, roughness: 0.82 });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.9,
    roughness: 0.22,
    emissive: '#f05a28',
    emissiveIntensity: 0,
  });

  // 1. Brake Pedal + Master Cylinder (positioned on the left at x = -1.15)
  const pedalPivot = new THREE.Group();
  pedalPivot.position.set(-1.35, 0.32, 0);
  const pedalArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.05), darkMetalMat);
  pedalArm.position.y = -0.3;
  const pedalPad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.18), darkMetalMat);
  pedalPad.position.set(0.05, -0.62, 0);
  pedalPivot.add(pedalArm, pedalPad);
  masterGroup.add(pedalPivot);

  const mcBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 20), metalMat);
  mcBody.rotation.z = Math.PI / 2;
  mcBody.position.set(-0.92, 0.16, 0);
  const reservoir = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.16), darkMetalMat);
  reservoir.position.set(-0.92, 0.34, 0);
  const mcPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), metalMat);
  mcPiston.rotation.z = Math.PI / 2;
  mcPiston.position.set(-1.14, 0.16, 0);
  masterGroup.add(mcBody, reservoir, mcPiston);

  // 2. Hydraulic Brake Lines + Flowing Fluid Particles
  const lineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.68, 0.16, 0),
    new THREE.Vector3(-0.35, 0.16, 0.08),
    new THREE.Vector3(0.05, 0.26, 0.12),
    new THREE.Vector3(0.45, 0.36, 0.14),
    new THREE.Vector3(0.68, 0.32, 0.12),
  ]);
  const linePipe = new THREE.Mesh(new THREE.TubeGeometry(lineCurve, 44, 0.02, 8, false), metalMat);
  linesGroup.add(linePipe);

  const fluidStream = createFlowStream(lineCurve, 8, '#f05a28', 0.025, 0.06);
  linesGroup.add(fluidStream.mesh);

  // 3. Ventilated Brake Disc + Instanced Cross-Drilled Cooling Holes (centered at x = 0.68)
  const rotorSpin = new THREE.Group();
  rotorSpin.position.set(0.68, 0, 0);
  discGroup.add(rotorSpin);

  const rotorRing = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.075, 42), rotorMat);
  rotorRing.rotation.x = Math.PI / 2;
  const hubBell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 24), darkMetalMat);
  hubBell.rotation.x = Math.PI / 2;
  rotorSpin.add(rotorRing, hubBell);

  const holeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.085, 8);
  holeGeo.rotateX(Math.PI / 2);
  const holeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
  const holeCount = 36;
  const holes = new THREE.InstancedMesh(holeGeo, holeMat, holeCount);
  const hd = new THREE.Object3D();
  for (let i = 0; i < holeCount; i++) {
    const ring = i % 2;
    const angle = (Math.floor(i / 2) / (holeCount / 2)) * Math.PI * 2 + ring * 0.15;
    const rad = ring === 0 ? 0.42 : 0.56;
    hd.position.set(Math.cos(angle) * rad, Math.sin(angle) * rad, 0);
    hd.updateMatrix();
    holes.setMatrixAt(i, hd.matrix);
  }
  holes.instanceMatrix.needsUpdate = true;
  rotorSpin.add(holes);

  // 4. Cutaway Brake Caliper Straddling Top-Right of Rotor
  const caliperHousing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.3), caliperMat);
  caliperHousing.position.set(0.68, 0.52, 0);
  const pistonF = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 16), metalMat);
  pistonF.rotation.x = Math.PI / 2;
  pistonF.position.set(0.68, 0.48, 0.11);
  const pistonB = pistonF.clone();
  pistonB.position.z = -0.11;
  caliperGroup.add(caliperHousing, pistonF, pistonB);

  // 5. Inner & Outer Friction Brake Pads
  const padFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.045), padMat);
  padFront.position.set(0.68, 0.48, 0.075);
  const padBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.045), padMat);
  padBack.position.set(0.68, 0.48, -0.075);
  padsGroup.add(padFront, padBack);

  const partMap: Record<string, THREE.Object3D> = {
    'master-cylinder': masterGroup,
    'brake-lines': linesGroup,
    caliper: caliperGroup,
    'brake-pads': padsGroup,
    'brake-disc': discGroup,
  };
  const partCtrl = createPartController(partMap, [fluidStream.mesh.material as THREE.Material, holeMat]);

  const explodables: ExplodableEntry[] = [
    { object: masterGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.85, 0.1, 0) },
    { object: linesGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.35, 0.45, -0.15) },
    { object: caliperGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.18, 0.85, 0) },
    { object: padsGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.38, 0.15, 0.48) },
    { object: discGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.55, -0.25, -0.45) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'master-cylinder', name: 'Master Cylinder', anchor: makePartAnchor(mcBody, 0, 0.32, 0) },
    { partId: 'brake-lines', name: 'Brake Lines', anchor: makePartAnchor(linesGroup, -0.1, 0.28, 0.12) },
    { partId: 'caliper', name: 'Brake Caliper', anchor: makePartAnchor(caliperHousing, 0, 0.26, 0.1) },
    { partId: 'brake-pads', name: 'Brake Pads', anchor: makePartAnchor(padFront, 0.2, 0, 0.12) },
    { partId: 'brake-disc', name: 'Brake Disc', anchor: makePartAnchor(rotorSpin, 0.35, -0.35, 0.1) },
  ];

  let elapsed = 0;
  let fluidPhase = 0;

  return {
    root,
    defaultCamera: {
      target: [-0.05, 1.15, 0],
      position: [1.85, 1.85, 3.25],
    },
    partObjects: Object.values(partMap),
    labelAnchors,
    explodables,
    update: (dt: number, sim: SystemSimulationState): SystemFrameStatus => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      if (sim.playing) {
        elapsed += dt * sim.speed * motionFactor;
      }
      const cycle = (elapsed % 6) / 6; // 0..1
      const stage = Math.min(3, Math.floor(cycle * 4));
      // Smooth clamping pressure curve: peaks during stage 2 (0.45..0.75)
      const clampAmount = Math.max(0, Math.sin(Math.max(0, (cycle - 0.2) / 0.65) * Math.PI));

      // Disc spins fast when coasting, slows cleanly during clamp
      const discSpinSpeed = 3.8 * (1 - clampAmount * 0.86);
      if (sim.playing) {
        rotorSpin.rotation.z -= dt * sim.speed * motionFactor * discSpinSpeed;
        fluidPhase += dt * sim.speed * motionFactor * (0.2 + clampAmount * 1.4);
      }

      pedalPivot.rotation.z = -clampAmount * 0.28;
      mcPiston.position.x = -1.14 + clampAmount * 0.14;

      const padGap = 0.088 - clampAmount * 0.032;
      padFront.position.z = padGap;
      padBack.position.z = -padGap;
      pistonF.position.z = padGap + 0.045;
      pistonB.position.z = -(padGap + 0.045);

      fluidStream.update(fluidPhase);
      // Warm friction heat glow on disc when clamped
      rotorSpin.traverse((obj) => {
        const m = (obj as THREE.Mesh).material;
        if (m instanceof THREE.MeshStandardMaterial && m !== holeMat && m !== darkMetalMat) {
          if (m.emissiveIntensity < 0.45) {
            m.emissive.set('#f05a28');
            m.emissiveIntensity = clampAmount * 0.38;
          }
        }
      });

      return { phaseIndex: stage };
    },
    highlightPart: partCtrl.highlightPart,
    setExplode: (amount: number) => applyExplodeOffsets(explodables, Math.max(0, Math.min(1, amount))),
    setXRay: (enabled: boolean) => partCtrl.setPartsXRay(['caliper'], enabled, 0.28),
    dispose: () => disposeObject3D(root),
  };
}

