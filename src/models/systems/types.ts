import type * as THREE from 'three';
import type {
  BrakeType,
  DifferentialMode,
  DrivetrainLayout,
  EngineAspiration,
  EngineHybrid,
  EngineInjection,
  Powertrain,
  SteeringType,
  SuspensionType,
  SystemId,
} from '../../state/appState';
import type { ExplodableEntry } from '../ProceduralHelpers';

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
  rpmOverride?: number | null;
  throttle?: number;
  brake?: number;
  gradePct?: number;
  roadBump?: number;
  faultId?: string | null;
  aspiration?: EngineAspiration;
  injection?: EngineInjection;
  hybrid?: EngineHybrid;
  drivetrainLayout?: DrivetrainLayout;
  differentialMode?: DifferentialMode;
  brakeType?: BrakeType;
  suspensionType?: SuspensionType;
  steeringType?: SteeringType;
}

export interface SystemFrameStatus {
  phaseIndex?: number;
  statusText?: string;
  phaseLabel?: string;
  rpm?: number;
  activeGear?: string;
  gearRatio?: number;
  powerFlowPct?: number;
  firingCylinder?: number;
  brakeTempC?: number;
  torqueNm?: number;
  powerKw?: number;
  headNod?: boolean;
  caption?: string;
}

export interface SystemModelInstance {
  root: THREE.Group;
  variant?: string;
  naturalBounds?: { length: number; width: number; height: number };
  targetRigExtent?: number;
  defaultCamera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  partObjects: THREE.Object3D[];
  labelAnchors: SystemLabelAnchor[];
  explodables?: ExplodableEntry[];
  update: (dt: number, sim: SystemSimulationState) => SystemFrameStatus;
  highlightPart: (partId: string | null) => void;
  setExplode: (amount: number) => void;
  setXRay: (enabled: boolean) => void;
  dispose: () => void;
}

export type SystemModuleLoader = (
  powertrain: Powertrain,
  variant?: string,
) => SystemModelInstance;

export interface SystemRegistryKey {
  systemId: SystemId;
  powertrain: Powertrain;
  variant?: string;
}
