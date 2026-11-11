import * as THREE from 'three';
import type { Powertrain } from '../../state/appState';

export interface SystemLabelAnchor {
  partId: string;
  name: string;
  anchor: THREE.Object3D;
}

export interface SystemSimulationState {
  playing: boolean;
  speed: number;
  explode: number;
  xray: boolean;
  reduceMotion: boolean;
}

export interface SystemFrameStatus {
  phaseIndex?: number;
  statusText?: string;
}

export interface SystemModelInstance {
  root: THREE.Group;
  defaultCamera: {
    target: [number, number, number];
    position: [number, number, number];
  };
  /** Interactive sub-trees tagged with userData.partId for raycasting */
  partObjects: THREE.Object3D[];
  /** Anchors for 3D-projected part labels */
  labelAnchors: SystemLabelAnchor[];
  update: (dt: number, sim: SystemSimulationState) => SystemFrameStatus;
  highlightPart: (partId: string | null) => void;
  setExplode: (amount: number) => void;
  setXRay: (enabled: boolean) => void;
  dispose: () => void;
}

export type SystemModuleLoader = () => Promise<{
  createSystemModel: (powertrain?: Powertrain) => SystemModelInstance;
}>;

