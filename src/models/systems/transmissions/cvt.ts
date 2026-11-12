import * as THREE from 'three';
import { createGearGeometry, makePartAnchor, type ExplodableEntry } from '../../ProceduralHelpers';
import type { SystemLabelAnchor, SystemModelInstance } from '../types';
import {
  buildDifferentialAssembly,
  createTransmissionMaterials,
  finalizeTransmissionModel,
} from './shared';

/**
 * Pure belt geometry solver for CVT two-pulley constant-perimeter loop.
 * Given fixed shaft center distance and active primary radius r1, solves secondary
 * radius r2 iteratively so total steel push-belt loop length stays invariant.
 */
export function solveCvtBeltRadii(
  ratio01: number,
  centerDist = 0.72,
  targetBeltLength = 2.83,
): { rPrimary: number; rSecondary: number; ratio: number } {
  const rPrimary = 0.14 + Math.max(0, Math.min(1, ratio01)) * 0.16;
  // Approximate open-belt length: 2*C + pi*(r1 + r2) + (r1 - r2)^2 / C
  let rSecondary = (targetBeltLength - 2 * centerDist) / Math.PI - rPrimary;
  for (let i = 0; i < 4; i++) {
    const diff = rPrimary - rSecondary;
    const len = 2 * centerDist + Math.PI * (rPrimary + rSecondary) + (diff * diff) / centerDist;
    rSecondary += (targetBeltLength - len) / Math.PI;
  }
  rSecondary = Math.max(0.12, Math.min(0.34, rSecondary));
  return {
    rPrimary,
    rSecondary,
    ratio: rSecondary / Math.max(rPrimary, 0.01),
  };
}

function buildBeltCurvePoints(r1: number, r2: number, x1: number, x2: number, yCenter: number): THREE.Vector3[] {
  const dx = x2 - x1;
  const beta = Math.asin(Math.max(-0.85, Math.min(0.85, (r2 - r1) / dx)));
  return [
    new THREE.Vector3(x1 - r1, yCenter, 0),
    new THREE.Vector3(x1 - r1 * Math.sin(beta), yCenter + r1 * Math.cos(beta), 0),
    new THREE.Vector3(x2 - r2 * Math.sin(beta), yCenter + r2 * Math.cos(beta), 0),
    new THREE.Vector3(x2 + r2, yCenter, 0),
    new THREE.Vector3(x2 - r2 * Math.sin(beta), yCenter - r2 * Math.cos(beta), 0),
    new THREE.Vector3(x1 - r1 * Math.sin(beta), yCenter - r1 * Math.cos(beta), 0),
  ];
}

export function createCvtTransmissionModel(): SystemModelInstance {
  const mats = createTransmissionMaterials();
  const root = new THREE.Group();
  root.name = 'TransmissionCutaway_CVT';

  const assembly = new THREE.Group();
  assembly.position.y = 1.05;
  root.add(assembly);

  const casingGroup = new THREE.Group();
  const primaryGroup = new THREE.Group();
  const secondaryGroup = new THREE.Group();
  const beltGroup = new THREE.Group();
  const frGroup = new THREE.Group();
  const { diffGroup, diffSpin } = buildDifferentialAssembly(mats, 0.96, 0.08);
  assembly.add(casingGroup, primaryGroup, secondaryGroup, beltGroup, frGroup, diffGroup);

  // Outer CVT aluminum shell
  const mainShell = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 0.88, 0.42),
    mats.caseMat,
  );
  mainShell.position.set(-0.08, 0.08, -0.26);
  casingGroup.add(mainShell);

  const centerDist = 0.72;
  const pX = -0.32;
  const sX = pX + centerDist;
  const axisY = 0.12;

  // 1. Primary Conical Sheaves (fixed rear cone, sliding front cone along Z)
  const primarySpin = new THREE.Group();
  primarySpin.position.set(pX, axisY, 0);
  primaryGroup.add(primarySpin);

  const pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 16), mats.steelMat);
  pShaft.rotation.x = Math.PI / 2;
  const pConeFixed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.34, 0.14, 28), mats.aluMat);
  pConeFixed.rotation.x = Math.PI / 2;
  pConeFixed.position.z = -0.09;
  const pConeMove = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.06, 0.14, 28), mats.steelMat);
  pConeMove.rotation.x = Math.PI / 2;
  pConeMove.position.z = 0.09;
  primarySpin.add(pShaft, pConeFixed, pConeMove);

  // 2. Secondary Conical Sheaves
  const secondarySpin = new THREE.Group();
  secondarySpin.position.set(sX, axisY, 0);
  secondaryGroup.add(secondarySpin);

  const sShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 16), mats.steelMat);
  sShaft.rotation.x = Math.PI / 2;
  const sConeFixed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.34, 0.14, 28), mats.aluMat);
  sConeFixed.rotation.x = Math.PI / 2;
  sConeFixed.position.z = -0.09;
  const sConeMove = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.06, 0.14, 28), mats.steelMat);
  sConeMove.rotation.x = Math.PI / 2;
  sConeMove.position.z = 0.09;
  secondarySpin.add(sShaft, sConeFixed, sConeMove);

  // 3. Constant-Length Steel Push-Belt + Dynamic Edges
  const initBelt = solveCvtBeltRadii(0.2, centerDist);
  const initCurve = new THREE.CatmullRomCurve3(
    buildBeltCurvePoints(initBelt.rPrimary, initBelt.rSecondary, pX, sX, axisY),
    true,
  );
  const beltMesh = new THREE.Mesh(new THREE.TubeGeometry(initCurve, 56, 0.032, 8, true), mats.beltMat);
  beltMesh.userData.dynamicEdgeRebuild = true;
  beltGroup.add(beltMesh);

  // Animated belt marker blocks so belt speed is clearly readable in Solid & Outline
  const beltBlocks: THREE.Mesh[] = [];
  const blockGeo = new THREE.BoxGeometry(0.045, 0.045, 0.085);
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(blockGeo, mats.brassMat);
    beltGroup.add(b);
    beltBlocks.push(b);
  }

  // 4. Forward / Reverse Planetary Set & Hydraulic Pump
  const frSun = new THREE.Mesh(
    createGearGeometry({ teeth: 18, pitchRadius: 0.17, thickness: 0.09, boreRadius: 0.04 }),
    mats.darkSteelMat,
  );
  frSun.position.set(-0.98, axisY, 0);
  const frClutch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 22), mats.copperMat);
  frClutch.rotation.x = Math.PI / 2;
  frClutch.position.set(-0.74, axisY, 0);
  const hydPump = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 16), mats.accentBlueMat);
  hydPump.position.set(-0.88, -0.25, 0.08);
  frGroup.add(frSun, frClutch, hydPump);

  const partMap: Record<string, THREE.Object3D> = {
    casing: casingGroup,
    'primary-pulley': primaryGroup,
    'secondary-pulley': secondaryGroup,
    'steel-belt': beltGroup,
    'forward-reverse': frGroup,
    differential: diffGroup,
  };

  const explodables: ExplodableEntry[] = [
    { object: casingGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.6, -0.95) },
    { object: frGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.95, 0.1, 0.25) },
    { object: primaryGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(-0.4, 0.65, 0.45) },
    { object: beltGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0, 0.92, 0.35) },
    { object: secondaryGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.45, -0.52, 0.45) },
    { object: diffGroup, basePosition: new THREE.Vector3(), explodeOffset: new THREE.Vector3(0.95, 0, 0) },
  ];

  const labelAnchors: SystemLabelAnchor[] = [
    { partId: 'casing', name: 'CVT Housing', anchor: makePartAnchor(casingGroup, -0.05, 0.56, -0.22) },
    { partId: 'forward-reverse', name: 'F/R Planetary & Pump', anchor: makePartAnchor(frClutch, 0, 0.32, 0.1) },
    { partId: 'primary-pulley', name: 'Primary Pulley', anchor: makePartAnchor(primarySpin, 0, 0.38, 0.14) },
    { partId: 'steel-belt', name: 'Steel Push-Belt', anchor: makePartAnchor(beltGroup, 0.04, 0.4, 0.1) },
    { partId: 'secondary-pulley', name: 'Secondary Pulley', anchor: makePartAnchor(secondarySpin, 0, -0.38, 0.14) },
    { partId: 'differential', name: 'Reduction & Diff', anchor: makePartAnchor(diffSpin, 0, 0.35, 0.2) },
  ];

  let elapsed = 0;
  let pAngle = 0;
  let sAngle = 0;
  let beltTravel = 0;
  let lastBeltRatio = -1;
  let activeBeltCurve = initCurve;

  return finalizeTransmissionModel({
    root,
    variant: 'cvt',
    partMap,
    explodables,
    labelAnchors,
    onUpdate: (dt, sim) => {
      const motionFactor = sim.reduceMotion ? 0.35 : 1;
      const step = sim.playing ? dt * sim.speed * motionFactor : 0;
      elapsed += step;

      // 0: Low launch, 1: Continuous climb, 2: Overdrive, 3: Reverse planetary
      const cyclePos = (elapsed / 2.8) % 4;
      const stage = Math.floor(cyclePos);
      const isReverse = stage === 3;
      const ratio01 =
        stage === 0
          ? 0.08
          : stage === 1
            ? 0.08 + (cyclePos - 1) * 0.84
            : stage === 2
              ? 0.92
              : 0.15;

      const { rPrimary, rSecondary, ratio } = solveCvtBeltRadii(ratio01, centerDist);

      // Slide sheaves oppositely to match active belt pitch radius
      pConeMove.position.z = 0.135 - (rPrimary - 0.14) * 0.55;
      sConeMove.position.z = 0.05 + (rPrimary - 0.14) * 0.55;

      if (Math.abs(ratio01 - lastBeltRatio) > 0.025) {
        lastBeltRatio = ratio01;
        activeBeltCurve = new THREE.CatmullRomCurve3(
          buildBeltCurvePoints(rPrimary, rSecondary, pX, sX, axisY),
          true,
        );
        const oldGeo = beltMesh.geometry;
        beltMesh.geometry = new THREE.TubeGeometry(activeBeltCurve, 48, 0.028, 8, true);
        oldGeo.dispose();
      }

      const dir = isReverse ? -1 : 1;
      const inSpeed = 3.8 * dir;
      pAngle += step * inSpeed;
      sAngle += step * (inSpeed / Math.max(ratio, 0.35));
      beltTravel = (beltTravel + step * 0.42 * dir + 10) % 1;

      primarySpin.rotation.z = -pAngle;
      secondarySpin.rotation.z = -sAngle;
      frSun.rotation.z = pAngle;
      diffSpin.rotation.z = -sAngle * 0.48;

      const ptTmp = new THREE.Vector3();
      const tanTmp = new THREE.Vector3();
      for (let i = 0; i < beltBlocks.length; i++) {
        const u = (i / beltBlocks.length + beltTravel) % 1;
        activeBeltCurve.getPointAt(u, ptTmp);
        activeBeltCurve.getTangentAt(u, tanTmp);
        beltBlocks[i].position.copy(ptTmp);
        beltBlocks[i].rotation.z = Math.atan2(tanTmp.y, tanTmp.x);
      }

      return {
        phaseIndex: stage,
        activeGear: isReverse ? 'Reverse' : `CVT (${ratio.toFixed(2)})`,
        gearRatio: Number(ratio.toFixed(2)),
        rpm: stage === 1 ? 2650 : stage === 2 ? 1750 : 2100,
        powerFlowPct: 93,
      };
    },
  });
}
