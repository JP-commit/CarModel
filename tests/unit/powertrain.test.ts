import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  getAllowedEngines,
  getAllowedTransmissions,
  resolveCarEngine,
  resolveCarTransmission,
  type CarManifestEntry,
} from '../../src/data/cars';
import { getSystemLesson } from '../../src/data/lessons';
import { computeRigSystemPlacement } from '../../src/models/rig/rigConfig';
import { computeBankSliderCrank } from '../../src/models/systems/engines/buildEngine';
import {
  buildEngineConfigForOptions,
  computeEngineStats,
  ENGINE_PRESETS,
} from '../../src/models/systems/engines/specs';
import { solveCvtBeltRadii } from '../../src/models/systems/transmissions/cvt';
import {
  getQuizProgressKey,
  getSavedQuizScore,
  VALID_ENGINE_LAYOUTS,
  VALID_TRANSMISSIONS,
} from '../../src/state/appState';

describe('Engine Config, Kinematics & Stats', () => {
  it('computes accurate slider-crank TDC and BDC across inline and 90-degree V banks', () => {
    const crankR = 0.11;
    const rodLen = 0.34;
    // Inline cylinder (tilt=0, throw=0): at angle=0, piston is at TDC = rodLen + crankR
    const tdc = computeBankSliderCrank(0, 0, 0, crankR, rodLen);
    expect(tdc.pistonY).toBeCloseTo(rodLen + crankR, 5);
    expect(tdc.rodRotZ).toBeCloseTo(0, 5);

    // At angle=PI (BDC), piston drops by exactly 2 * crankR
    const bdc = computeBankSliderCrank(Math.PI, 0, 0, crankR, rodLen);
    expect(bdc.pistonY).toBeCloseTo(rodLen - crankR, 5);
    expect(tdc.pistonY - bdc.pistonY).toBeCloseTo(crankR * 2, 5);

    // Right V-bank tilted at +45° reaches local TDC when crank is at +45°
    const vTilt = Math.PI / 4;
    const vTdc = computeBankSliderCrank(vTilt, 0, vTilt, crankR, rodLen);
    expect(vTdc.pistonY).toBeCloseTo(rodLen + crankR, 5);
  });

  it('calculates displacement, firing interval, and boost multipliers accurately', () => {
    const v8Na = buildEngineConfigForOptions('v8', 'petrol', 'na', 'gdi', 'none');
    const naStats = computeEngineStats(v8Na);
    expect(naStats.firingIntervalDeg).toBe(90);
    expect(naStats.displacementCc).toBeGreaterThan(4000);

    const v8Tt = buildEngineConfigForOptions('v8', 'petrol', 'twin-turbo', 'gdi', 'mild-48v');
    const ttStats = computeEngineStats(v8Tt);
    expect(ttStats.peakTorqueNm).toBeGreaterThan(naStats.peakTorqueNm);
    expect(ttStats.peakPowerHp).toBeGreaterThan(naStats.peakPowerHp);

    expect(ENGINE_PRESETS['flat-4'].config.vAngleDeg).toBe(180);
    expect(ENGINE_PRESETS.rotary.config.crankPlane).toBe('eccentric');
  });
});

describe('CVT Constant-Perimeter Belt Invariant', () => {
  it('maintains constant steel push-belt loop length across continuous ratio sweep', () => {
    const centerDist = 0.72;
    const targetLen = 2.83;
    const ratios: number[] = [];

    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const { rPrimary, rSecondary, ratio } = solveCvtBeltRadii(t, centerDist, targetLen);
      const diff = rPrimary - rSecondary;
      const actualLen =
        2 * centerDist + Math.PI * (rPrimary + rSecondary) + (diff * diff) / centerDist;
      expect(Math.abs(actualLen - targetLen)).toBeLessThan(0.03);
      ratios.push(ratio);
    }

    // Ratio must strictly decrease from low launch to high overdrive
    expect(ratios[0]).toBeGreaterThan(ratios[ratios.length - 1]);
  });
});

describe('Manifest Defaults, Allowlists & Quiz Variants', () => {
  const evCar: CarManifestEntry = {
    id: 'test-ev',
    name: 'Test EV',
    bodyType: 'EV',
    powertrain: 'ev',
    defaultTransmission: 'ev-reducer',
    allowedTransmissions: ['ev-reducer'],
    allowedEngines: [],
    modelFile: '/models/EV.glb',
    thumbnail: '/thumbnails/ev.svg',
    defaultCamera: { position: [3, 2, 4], target: [0, 0.5, 0] },
    systems: {},
  };

  const sportCar: CarManifestEntry = {
    id: 'test-coupe',
    name: 'Test Coupe',
    bodyType: 'Coupe',
    powertrain: 'petrol',
    defaultTransmission: 'manual',
    defaultEngine: 'v8',
    allowedTransmissions: ['manual', 'dct'],
    allowedEngines: ['i4', 'v6', 'v8'],
    modelFile: '/models/CarConcept.glb',
    thumbnail: '/thumbnails/coupe.svg',
    defaultCamera: { position: [3, 2, 4], target: [0, 0.5, 0] },
    systems: {},
  };

  it('restricts EVs to single-speed reducer and falls back safely for ICE cars', () => {
    expect(getAllowedTransmissions(evCar)).toEqual(['ev-reducer']);
    expect(getAllowedEngines(evCar)).toEqual([]);
    expect(resolveCarTransmission(evCar, 'cvt')).toBe('ev-reducer');

    expect(resolveCarTransmission(sportCar, 'cvt')).toBe('manual');
    expect(resolveCarTransmission(sportCar, 'dct')).toBe('dct');
    expect(resolveCarEngine(sportCar, 'v12')).toBe('v8');
    expect(resolveCarEngine(sportCar, 'i4')).toBe('i4');
  });

  it('provides full 5-question lessons for every transmission and engine variant', () => {
    for (const t of VALID_TRANSMISSIONS) {
      const lesson = getSystemLesson('transmission', t === 'ev-reducer' ? 'ev' : 'petrol', t);
      expect(lesson.quiz).toHaveLength(5);
      expect(lesson.parts.length).toBeGreaterThanOrEqual(4);
    }
    for (const e of VALID_ENGINE_LAYOUTS) {
      const lesson = getSystemLesson('engine', 'petrol', e);
      expect(lesson.quiz).toHaveLength(5);
      expect(lesson.parts.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('scopes quiz progress per variant with backwards compatibility', () => {
    const key = getQuizProgressKey('transmission', 'petrol', 'cvt');
    expect(key).toBe('petrol:transmission:cvt');
    const progress = {
      'petrol:transmission': { bestScore: 4, total: 5, completedAt: '2026-01-01T00:00:00Z' },
      [key]: { bestScore: 5, total: 5, completedAt: '2026-01-02T00:00:00Z' },
    };
    expect(getSavedQuizScore(progress, 'transmission', 'petrol', 'cvt')?.bestScore).toBe(5);
    expect(getSavedQuizScore(progress, 'transmission', 'petrol', 'manual')?.bestScore).toBe(4);
    expect(getSavedQuizScore(progress, 'transmission', 'petrol', 'dct')).toBeUndefined();
  });

  it('computes bounded rig placements across car sizes', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.9, 0, -2.1), new THREE.Vector3(0.9, 1.4, 2.1));
    const size = box.getSize(new THREE.Vector3());
    const anchor = new THREE.Vector3(0, 0.55, 1.25);
    const placement = computeRigSystemPlacement(
      'engine',
      'petrol',
      anchor,
      { engine: anchor },
      box,
      size,
      1,
    );
    expect(placement.targetExtent).toBeGreaterThan(0.4);
    expect(placement.targetExtent).toBeLessThan(1.0);
  });
});
