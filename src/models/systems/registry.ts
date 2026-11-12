import { isEngineLayout, type Powertrain, type SystemId } from '../../state/appState';
import type { SystemModelInstance } from './types';

type LoaderModule = {
  createSystemModel: (powertrain?: Powertrain, variant?: string) => SystemModelInstance;
};

const SYSTEM_LOADERS: Record<SystemId, () => Promise<LoaderModule>> = {
  engine: () => import('./engine'),
  transmission: () => import('./transmission'),
  brakes: () => import('./brakes'),
  suspension: () => import('./suspension'),
  steering: () => import('./steering'),
  electrical: () => import('./electrical'),
  cooling: () => import('./cooling'),
  exhaust: () => import('./exhaust'),
};

export function isLessonImplemented(id: SystemId, powertrain: Powertrain = 'petrol'): boolean {
  if (powertrain === 'ev' && id === 'exhaust') return false;
  return Boolean(SYSTEM_LOADERS[id]);
}

export async function loadSystemModule(
  id: SystemId,
  powertrain: Powertrain = 'petrol',
  variant?: string,
): Promise<SystemModelInstance> {
  if (id === 'engine' && powertrain === 'ev') {
    const mod = await import('./evDrive');
    return mod.createSystemModel();
  }

  if (id === 'transmission') {
    const transVariant = powertrain === 'ev' ? 'ev-reducer' : (variant ?? 'manual');
    switch (transVariant) {
      case 'amt':
        return (await import('./transmissions/amt')).createAmtTransmissionModel();
      case 'at':
        return (await import('./transmissions/at')).createAtTransmissionModel();
      case 'cvt':
        return (await import('./transmissions/cvt')).createCvtTransmissionModel();
      case 'dct':
        return (await import('./transmissions/dct')).createDctTransmissionModel();
      case 'ev-reducer':
        return (await import('./transmissions/evReducer')).createEvReducerTransmissionModel();
      case 'manual':
      default:
        return (await import('./transmissions/manual')).createManualTransmissionModel();
    }
  }

  if (id === 'engine') {
    const layout = isEngineLayout(variant) ? variant : 'single-cylinder';
    if (layout === 'rotary') {
      const mod = await import('./engines/rotary');
      return mod.createRotaryEngineModel();
    }
    if (layout === 'single-cylinder') {
      const mod = await import('./engine');
      return mod.createSystemModel(powertrain, layout);
    }
    const [{ buildEngine }, { buildEngineConfigForOptions }] = await Promise.all([
      import('./engines/buildEngine'),
      import('./engines/specs'),
    ]);
    return buildEngine(buildEngineConfigForOptions(layout, powertrain));
  }

  const loader = SYSTEM_LOADERS[id];
  const mod = await loader();
  return mod.createSystemModel(powertrain, variant);
}
