import type { Powertrain, SystemId } from '../../state/appState';
import type { SystemModuleLoader } from './types';

export const SYSTEM_LOADERS: Record<SystemId, SystemModuleLoader> = {
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

export async function loadSystemModule(id: SystemId, powertrain: Powertrain = 'petrol') {
  if (id === 'engine' && powertrain === 'ev') {
    const mod = await import('./evDrive');
    return mod.createSystemModel();
  }
  const loader = SYSTEM_LOADERS[id];
  const mod = await loader();
  return mod.createSystemModel(powertrain);
}
