import type {
  EngineAspiration,
  EngineConfig,
  EngineHybrid,
  EngineInjection,
  EngineLayout,
  Powertrain,
} from '../../../state/appState';

export interface EnginePresetMeta {
  config: EngineConfig;
  crankThrowsDeg: number[];
  balanceRating: string;
  redlineRpm: number;
  baseTorquePerLiterNm: number;
  basePowerPerLiterHp: number;
  compressionRatio: string;
}

export const ENGINE_PRESETS: Record<EngineLayout, EnginePresetMeta> = {
  'single-cylinder': {
    config: {
      layout: 'single-cylinder',
      cylinders: 1,
      fuel: 'petrol',
      firingOrder: [1],
      boreMm: 88,
      strokeMm: 82,
      vAngleDeg: 0,
      crankPlane: 'inline',
      aspiration: 'na',
      injection: 'mpfi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0],
    balanceRating: 'Single-throw (needs heavy balance weight)',
    redlineRpm: 7200,
    baseTorquePerLiterNm: 98,
    basePowerPerLiterHp: 78,
    compressionRatio: '10.5 : 1',
  },
  i3: {
    config: {
      layout: 'i3',
      cylinders: 3,
      fuel: 'petrol',
      firingOrder: [1, 2, 3],
      boreMm: 76,
      strokeMm: 88,
      vAngleDeg: 0,
      crankPlane: 'inline',
      aspiration: 'turbo',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 240, 120],
    balanceRating: '120° even firing (balance-shaft damped)',
    redlineRpm: 6500,
    baseTorquePerLiterNm: 105,
    basePowerPerLiterHp: 82,
    compressionRatio: '10.2 : 1',
  },
  i4: {
    config: {
      layout: 'i4',
      cylinders: 4,
      fuel: 'petrol',
      firingOrder: [1, 3, 4, 2],
      boreMm: 86,
      strokeMm: 86,
      vAngleDeg: 0,
      crankPlane: 'flat',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 180, 180, 0],
    balanceRating: 'Even 180° firing (mild secondary shake)',
    redlineRpm: 7000,
    baseTorquePerLiterNm: 104,
    basePowerPerLiterHp: 90,
    compressionRatio: '11.0 : 1',
  },
  i6: {
    config: {
      layout: 'i6',
      cylinders: 6,
      fuel: 'petrol',
      firingOrder: [1, 5, 3, 6, 2, 4],
      boreMm: 84,
      strokeMm: 90,
      vAngleDeg: 0,
      crankPlane: 'inline',
      aspiration: 'turbo',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 120, 240, 240, 120, 0],
    balanceRating: 'Inherently balanced primary & secondary',
    redlineRpm: 7200,
    baseTorquePerLiterNm: 112,
    basePowerPerLiterHp: 96,
    compressionRatio: '10.8 : 1',
  },
  v6: {
    config: {
      layout: 'v6',
      cylinders: 6,
      fuel: 'petrol',
      firingOrder: [1, 2, 3, 4, 5, 6],
      boreMm: 88,
      strokeMm: 82,
      vAngleDeg: 60,
      crankPlane: 'cross',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 120, 240, 0, 120, 240],
    balanceRating: 'Compact 60° even-fire V-bank',
    redlineRpm: 7400,
    baseTorquePerLiterNm: 108,
    basePowerPerLiterHp: 94,
    compressionRatio: '11.2 : 1',
  },
  v8: {
    config: {
      layout: 'v8',
      cylinders: 8,
      fuel: 'petrol',
      firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],
      boreMm: 92,
      strokeMm: 83,
      vAngleDeg: 90,
      crankPlane: 'cross',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 90, 270, 180, 270, 180, 0, 90],
    balanceRating: 'Cross-plane 90° smooth torque rumble',
    redlineRpm: 7200,
    baseTorquePerLiterNm: 115,
    basePowerPerLiterHp: 98,
    compressionRatio: '11.0 : 1',
  },
  v10: {
    config: {
      layout: 'v10',
      cylinders: 10,
      fuel: 'petrol',
      firingOrder: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9],
      boreMm: 84.5,
      strokeMm: 92.8,
      vAngleDeg: 72,
      crankPlane: 'cross',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 72, 144, 216, 288, 36, 108, 180, 252, 324],
    balanceRating: '72° split-pin exotic screamer',
    redlineRpm: 8700,
    baseTorquePerLiterNm: 108,
    basePowerPerLiterHp: 118,
    compressionRatio: '12.5 : 1',
  },
  v12: {
    config: {
      layout: 'v12',
      cylinders: 12,
      fuel: 'petrol',
      firingOrder: [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10],
      boreMm: 88,
      strokeMm: 82,
      vAngleDeg: 60,
      crankPlane: 'cross',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 120, 240, 240, 120, 0, 60, 180, 300, 300, 180, 60],
    balanceRating: 'Double-six turbine zero-gap balance',
    redlineRpm: 8500,
    baseTorquePerLiterNm: 110,
    basePowerPerLiterHp: 122,
    compressionRatio: '12.8 : 1',
  },
  'flat-4': {
    config: {
      layout: 'flat-4',
      cylinders: 4,
      fuel: 'petrol',
      firingOrder: [1, 3, 2, 4],
      boreMm: 94,
      strokeMm: 86,
      vAngleDeg: 180,
      crankPlane: 'opposed',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 180, 180, 0],
    balanceRating: '180° Boxer opposing cancellation & ultra-low CG',
    redlineRpm: 7500,
    baseTorquePerLiterNm: 105,
    basePowerPerLiterHp: 94,
    compressionRatio: '11.5 : 1',
  },
  'flat-6': {
    config: {
      layout: 'flat-6',
      cylinders: 6,
      fuel: 'petrol',
      firingOrder: [1, 6, 2, 4, 3, 5],
      boreMm: 97,
      strokeMm: 77.5,
      vAngleDeg: 180,
      crankPlane: 'opposed',
      aspiration: 'na',
      injection: 'gdi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 120, 240, 180, 300, 60],
    balanceRating: 'Naturally balanced flat-plane boxer',
    redlineRpm: 8400,
    baseTorquePerLiterNm: 108,
    basePowerPerLiterHp: 112,
    compressionRatio: '12.2 : 1',
  },
  rotary: {
    config: {
      layout: 'rotary',
      cylinders: 2,
      fuel: 'petrol',
      firingOrder: [1, 2],
      boreMm: 80,
      strokeMm: 65,
      vAngleDeg: 0,
      crankPlane: 'eccentric',
      aspiration: 'na',
      injection: 'mpfi',
      hybrid: 'none',
    },
    crankThrowsDeg: [0, 180],
    balanceRating: 'Pure rotary inertia (zero reciprocating mass)',
    redlineRpm: 9000,
    baseTorquePerLiterNm: 165,
    basePowerPerLiterHp: 180,
    compressionRatio: '10.0 : 1',
  },
};

export interface EngineComputedStats {
  displacementCc: number;
  displacementL: string;
  compressionRatio: string;
  firingIntervalDeg: number;
  peakTorqueNm: number;
  peakPowerHp: number;
  redlineRpm: number;
  balanceRating: string;
  firingOrderLabel: string;
  /** 7 normalized torque samples across RPM range for inline SVG curve */
  torqueCurveNormalized: number[];
}

export function buildEngineConfigForOptions(
  layout: EngineLayout,
  fuel: Powertrain,
  aspiration?: EngineAspiration,
  injection?: EngineInjection,
  hybrid?: EngineHybrid,
): EngineConfig {
  const base = ENGINE_PRESETS[layout].config;
  return {
    ...base,
    fuel,
    aspiration: aspiration ?? base.aspiration,
    injection: fuel === 'diesel' ? 'crdi' : (injection ?? base.injection),
    hybrid: hybrid ?? base.hybrid,
  };
}

export function computeEngineStats(cfg: EngineConfig): EngineComputedStats {
  const meta = ENGINE_PRESETS[cfg.layout];
  const rCm = cfg.boreMm / 20;
  const hCm = cfg.strokeMm / 10;
  const singleCylCc = Math.PI * rCm * rCm * hCm;
  const displacementCc =
    cfg.layout === 'rotary' ? 1308 : Math.round(singleCylCc * cfg.cylinders);
  const liters = displacementCc / 1000;

  const aspBoost =
    cfg.aspiration === 'twin-turbo'
      ? 1.48
      : cfg.aspiration === 'turbo'
        ? 1.32
        : cfg.aspiration === 'supercharged'
          ? 1.28
          : 1.0;
  const hybridTorque =
    cfg.hybrid === 'phev' ? 95 : cfg.hybrid === 'full-hybrid' ? 65 : cfg.hybrid === 'mild-48v' ? 35 : 0;
  const hybridHp =
    cfg.hybrid === 'phev' ? 85 : cfg.hybrid === 'full-hybrid' ? 50 : cfg.hybrid === 'mild-48v' ? 18 : 0;
  const dieselMul = cfg.fuel === 'diesel' ? 1.25 : 1.0;

  const peakTorqueNm = Math.round(liters * meta.baseTorquePerLiterNm * aspBoost * dieselMul + hybridTorque);
  const peakPowerHp = Math.round(
    liters * meta.basePowerPerLiterHp * aspBoost * (cfg.fuel === 'diesel' ? 0.85 : 1.0) + hybridHp,
  );
  const firingIntervalDeg =
    cfg.layout === 'rotary' ? 180 : Math.round(720 / Math.max(1, cfg.cylinders));

  const torqueCurveNormalized =
    cfg.aspiration === 'turbo' || cfg.aspiration === 'twin-turbo'
      ? [0.46, 0.78, 0.98, 1.0, 0.95, 0.86, 0.74]
      : cfg.aspiration === 'supercharged'
        ? [0.76, 0.9, 0.97, 1.0, 0.96, 0.9, 0.82]
        : [0.58, 0.72, 0.85, 0.94, 1.0, 0.96, 0.84];

  return {
    displacementCc,
    displacementL: liters.toFixed(1),
    compressionRatio: cfg.fuel === 'diesel' ? '16.5 : 1' : meta.compressionRatio,
    firingIntervalDeg,
    peakTorqueNm,
    peakPowerHp,
    redlineRpm: cfg.fuel === 'diesel' ? Math.min(5000, meta.redlineRpm) : meta.redlineRpm,
    balanceRating: meta.balanceRating,
    firingOrderLabel: cfg.firingOrder.join(' - '),
    torqueCurveNormalized,
  };
}

