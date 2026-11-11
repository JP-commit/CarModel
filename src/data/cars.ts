import type { Powertrain, SystemId } from '../state/appState';

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

