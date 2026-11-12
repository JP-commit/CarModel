import type { EngineLayout, Powertrain, SystemId, TransmissionType } from '../state/appState';

export interface CarSystemManifest {
  anchorNode?: string;
  cameraTarget?: [number, number, number];
  cameraOffset?: [number, number, number];
  meshNames: string[];
}

export type CarStyle = 'realistic' | 'stylized';
export type CarQuality = 'full' | 'outline-only';

export interface CarNodeMap {
  shell: string[];
  glass: string[];
  wheels: {
    fl: string | null;
    fr: string | null;
    rl: string | null;
    rr: string | null;
  };
  hood: string | null;
  doors: string[];
}

export interface ShellExplodePart {
  nodeNames: string[];
  direction: [number, number, number];
  distance: number;
}

export interface CarManifestEntry {
  id: string;
  name: string;
  bodyType: string;
  powertrain: Powertrain;
  defaultTransmission?: TransmissionType;
  defaultEngine?: EngineLayout;
  allowedTransmissions?: TransmissionType[];
  allowedEngines?: EngineLayout[];
  style?: CarStyle;
  quality?: CarQuality;
  modelFile: string;
  thumbnail: string;
  defaultCamera: {
    position: [number, number, number];
    target: [number, number, number];
    mobilePosition?: [number, number, number];
    mobileTarget?: [number, number, number];
  };
  systems: Partial<Record<SystemId, CarSystemManifest>>;
  nodeMap?: CarNodeMap;
  shell?: ShellExplodePart[];
  credits?: {
    author: string;
    license: string;
    source: string;
  };
}

export function getAllowedTransmissions(car: CarManifestEntry): TransmissionType[] {
  if (car.allowedTransmissions && car.allowedTransmissions.length > 0) {
    return car.allowedTransmissions;
  }
  if (car.powertrain === 'ev') return ['ev-reducer'];
  return ['manual', 'amt', 'at', 'cvt', 'dct'];
}

export function getAllowedEngines(car: CarManifestEntry): EngineLayout[] {
  if (car.powertrain === 'ev') return [];
  if (car.allowedEngines && car.allowedEngines.length > 0) {
    return car.allowedEngines;
  }
  return ['single-cylinder', 'i3', 'i4', 'i6', 'v6', 'v8', 'flat-4'];
}

export function resolveCarTransmission(
  car: CarManifestEntry,
  preferred?: TransmissionType,
): TransmissionType {
  const allowed = getAllowedTransmissions(car);
  if (preferred && allowed.includes(preferred)) return preferred;
  if (car.defaultTransmission && allowed.includes(car.defaultTransmission)) {
    return car.defaultTransmission;
  }
  return allowed[0] ?? (car.powertrain === 'ev' ? 'ev-reducer' : 'manual');
}

export function resolveCarEngine(
  car: CarManifestEntry,
  preferred?: EngineLayout,
): EngineLayout {
  const allowed = getAllowedEngines(car);
  if (allowed.length === 0) return 'single-cylinder';
  if (preferred && allowed.includes(preferred)) return preferred;
  if (car.defaultEngine && allowed.includes(car.defaultEngine)) {
    return car.defaultEngine;
  }
  return allowed[0] ?? 'single-cylinder';
}

export const POWERTRAIN_LABELS: Record<Powertrain, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  ev: 'Electric',
};

export async function loadCarsManifest(): Promise<CarManifestEntry[]> {
  const res = await fetch('/cars.json');
  if (!res.ok) {
    throw new Error(`Unable to fetch vehicle manifest (${res.status})`);
  }
  const data = (await res.json()) as CarManifestEntry[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Vehicle manifest is empty');
  }
  return data;
}

export function preloadCarThumbnails(cars: CarManifestEntry[]): void {
  for (const car of cars) {
    const img = new Image();
    img.decoding = 'async';
    img.src = car.thumbnail;
  }
}

export function resolveCarFromManifest(
  cars: CarManifestEntry[],
  preferredId: string,
): CarManifestEntry {
  return cars.find((c) => c.id === preferredId) ?? cars[0];
}

