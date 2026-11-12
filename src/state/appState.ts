export type SystemId =
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'suspension'
  | 'steering'
  | 'electrical'
  | 'cooling'
  | 'exhaust';

export type ViewMode = 'home' | 'lesson' | 'tour' | 'compare';
export type RenderMode = 'outline' | 'solid';
export type Powertrain = 'petrol' | 'diesel' | 'ev';
export type IsolationMode = 'isolate' | 'ghost' | 'all';
export type GraphicsQuality = 'high' | 'low';

export type TransmissionType = 'manual' | 'amt' | 'at' | 'cvt' | 'dct' | 'ev-reducer';
export type EngineLayout =
  | 'single-cylinder'
  | 'i3'
  | 'i4'
  | 'i6'
  | 'v6'
  | 'v8'
  | 'v10'
  | 'v12'
  | 'flat-4'
  | 'flat-6'
  | 'rotary';
export type EngineAspiration = 'na' | 'turbo' | 'twin-turbo' | 'supercharged';
export type EngineInjection = 'mpfi' | 'gdi' | 'crdi';
export type EngineHybrid = 'none' | 'mild-48v' | 'full-hybrid' | 'phev';

export interface EngineConfig {
  layout: EngineLayout;
  cylinders: number;
  fuel: Powertrain;
  firingOrder: number[];
  boreMm: number;
  strokeMm: number;
  vAngleDeg: number;
  crankPlane: 'flat' | 'cross' | 'opposed' | 'inline' | 'eccentric';
  aspiration: EngineAspiration;
  injection: EngineInjection;
  hybrid: EngineHybrid;
}

export type DrivetrainLayout = 'fwd' | 'rwd' | 'awd' | '4wd';
export type DifferentialMode = 'open' | 'lsd' | 'locking' | 'torque-vectoring';
export type BrakeType = 'disc' | 'drum';
export type SuspensionType = 'macpherson' | 'double-wishbone' | 'multi-link';
export type SteeringType = 'hydraulic' | 'eps';
export type LearningPathId = 'all' | 'beginner' | 'intermediate' | 'advanced';
export type AppLocale = 'en' | 'es' | 'de';
export type ClipAxis = 'none' | 'x' | 'y' | 'z';

export interface LayerVisibility {
  outline: boolean;
  mesh: boolean;
  innerSystems: boolean;
}

export interface QuizProgressEntry {
  bestScore: number;
  total: number;
  completedAt: string;
}

export interface AppState {
  viewMode: ViewMode;
  renderMode: RenderMode;
  layers: LayerVisibility;
  selectedCarId: string;
  activePowertrain: Powertrain;
  selectedTransmission: TransmissionType;
  selectedEngineConfig: EngineLayout;
  engineAspiration: EngineAspiration;
  engineInjection: EngineInjection;
  engineHybrid: EngineHybrid;
  drivetrainLayout: DrivetrainLayout;
  differentialMode: DifferentialMode;
  brakeType: BrakeType;
  suspensionType: SuspensionType;
  steeringType: SteeringType;
  learningPath: LearningPathId;
  audioEnabled: boolean;
  locale: AppLocale;
  fontScale: 'normal' | 'large';
  captionsEnabled: boolean;
  clipAxis: ClipAxis;
  clipRatio: number;
  selectedSystem: SystemId | null;
  selectedPartId: string | null;
  isolationMode: IsolationMode;
  graphicsQuality: GraphicsQuality;
  paintColor: string;
  activeLesson: SystemId | null;
  homeExplode: number;
  xrayCar: boolean;
  reduceMotion: boolean;
  hintDismissed: boolean;
  loadingPercent: number;
  loadingLabel: string;
  carReady: boolean;
  webglSupported: boolean;
  quizProgress: Partial<Record<string, QuizProgressEntry>>;
}

type Listener = (state: Readonly<AppState>) => void;

const STORAGE_QUIZ_KEY = 'howcarswork_quiz_progress_v1';
const STORAGE_MOTION_KEY = 'howcarswork_reduce_motion_v1';
const STORAGE_HINT_KEY = 'howcarswork_hint_dismissed_v1';
const STORAGE_RENDER_MODE_KEY = 'howcarswork_render_mode_v1';
const STORAGE_ISOLATION_KEY = 'howcarswork_isolation_mode_v1';
const STORAGE_CAR_ID_KEY = 'howcarswork_selected_car_v1';
const STORAGE_QUALITY_KEY = 'howcarswork_graphics_quality_v1';
const STORAGE_PAINT_KEY = 'howcarswork_paint_color_v1';
const STORAGE_TRANS_KEY = 'howcarswork_transmission_v1';
const STORAGE_ENGINE_KEY = 'howcarswork_engine_config_v1';
const STORAGE_LOCALE_KEY = 'howcarswork_locale_v1';
const STORAGE_FONT_SCALE_KEY = 'howcarswork_font_scale_v1';
const STORAGE_CAPTIONS_KEY = 'howcarswork_captions_v1';
const STORAGE_LEARNING_PATH_KEY = 'howcarswork_learning_path_v1';

export const VALID_TRANSMISSIONS: readonly TransmissionType[] = [
  'manual',
  'amt',
  'at',
  'cvt',
  'dct',
  'ev-reducer',
];

export const VALID_ENGINE_LAYOUTS: readonly EngineLayout[] = [
  'single-cylinder',
  'i3',
  'i4',
  'i6',
  'v6',
  'v8',
  'v10',
  'v12',
  'flat-4',
  'flat-6',
  'rotary',
];

export function isTransmissionType(val: string | null | undefined): val is TransmissionType {
  return Boolean(val && (VALID_TRANSMISSIONS as readonly string[]).includes(val));
}

export function isEngineLayout(val: string | null | undefined): val is EngineLayout {
  return Boolean(val && (VALID_ENGINE_LAYOUTS as readonly string[]).includes(val));
}

export function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function loadInitialQuality(): GraphicsQuality {
  try {
    const saved = localStorage.getItem(STORAGE_QUALITY_KEY);
    if (saved === 'high' || saved === 'low') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return detectMobileDevice() ? 'low' : 'high';
}

function loadInitialPaintColor(): string {
  try {
    const saved = localStorage.getItem(STORAGE_PAINT_KEY);
    if (saved && (saved === 'original' || /^#[0-9a-f]{6}$/i.test(saved))) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'original';
}

function loadInitialIsolationMode(): IsolationMode {
  try {
    const saved = localStorage.getItem(STORAGE_ISOLATION_KEY);
    if (saved === 'isolate' || saved === 'ghost' || saved === 'all') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'ghost';
}

function loadInitialRenderMode(): RenderMode {
  try {
    const saved = localStorage.getItem(STORAGE_RENDER_MODE_KEY);
    if (saved === 'outline' || saved === 'solid') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'outline';
}

function loadInitialCarId(): string {
  try {
    const param = new URLSearchParams(window.location.search).get('car');
    if (param) return param.trim().toLowerCase();
    const saved = localStorage.getItem(STORAGE_CAR_ID_KEY);
    if (saved) return saved;
  } catch {
    // Ignore URL/storage access errors
  }
  return 'coupe';
}

function loadInitialTransmission(): TransmissionType {
  try {
    const param = new URLSearchParams(window.location.search).get('trans')?.trim().toLowerCase();
    if (isTransmissionType(param)) return param;
    const saved = localStorage.getItem(STORAGE_TRANS_KEY);
    if (isTransmissionType(saved)) return saved;
  } catch {
    // Ignore URL/storage errors
  }
  return 'manual';
}

function loadInitialEngineConfig(): EngineLayout {
  try {
    const param = new URLSearchParams(window.location.search).get('engine')?.trim().toLowerCase();
    if (isEngineLayout(param)) return param;
    const saved = localStorage.getItem(STORAGE_ENGINE_KEY);
    if (isEngineLayout(saved)) return saved;
  } catch {
    // Ignore URL/storage errors
  }
  return 'single-cylinder';
}

function loadInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_LOCALE_KEY);
    if (saved === 'en' || saved === 'es' || saved === 'de') return saved;
  } catch {
    // Ignore
  }
  return 'en';
}

function loadInitialFontScale(): 'normal' | 'large' {
  try {
    return localStorage.getItem(STORAGE_FONT_SCALE_KEY) === 'large' ? 'large' : 'normal';
  } catch {
    return 'normal';
  }
}

function loadInitialCaptions(): boolean {
  try {
    return localStorage.getItem(STORAGE_CAPTIONS_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadInitialLearningPath(): LearningPathId {
  try {
    const saved = localStorage.getItem(STORAGE_LEARNING_PATH_KEY);
    if (saved === 'all' || saved === 'beginner' || saved === 'intermediate' || saved === 'advanced') {
      return saved;
    }
  } catch {
    // Ignore
  }
  return 'all';
}

function loadInitialReduceMotion(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_MOTION_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function loadInitialHintDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_HINT_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadInitialQuizProgress(): Partial<Record<string, QuizProgressEntry>> {
  try {
    const raw = localStorage.getItem(STORAGE_QUIZ_KEY);
    if (raw) {
      return JSON.parse(raw) as Partial<Record<string, QuizProgressEntry>>;
    }
  } catch {
    // Ignore corrupt or blocked localStorage
  }
  return {};
}

export function hasUrlVariantOverride(): { trans: boolean; engine: boolean } {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      trans: isTransmissionType(params.get('trans')?.trim().toLowerCase()),
      engine: isEngineLayout(params.get('engine')?.trim().toLowerCase()),
    };
  } catch {
    return { trans: false, engine: false };
  }
}

export function getActiveSystemVariant(
  state: Pick<AppState, 'activePowertrain' | 'selectedTransmission' | 'selectedEngineConfig'>,
  systemId: SystemId,
): string | undefined {
  if (systemId === 'transmission') {
    return state.activePowertrain === 'ev' ? 'ev-reducer' : state.selectedTransmission;
  }
  if (systemId === 'engine' && state.activePowertrain !== 'ev') {
    return state.selectedEngineConfig;
  }
  return undefined;
}

export function getQuizProgressKey(
  systemId: SystemId,
  powertrain: Powertrain,
  variant?: string,
): string {
  return variant ? `${powertrain}:${systemId}:${variant}` : `${powertrain}:${systemId}`;
}

export function getSavedQuizScore(
  progress: Partial<Record<string, QuizProgressEntry>>,
  systemId: SystemId,
  powertrain: Powertrain,
  variant?: string,
): QuizProgressEntry | undefined {
  if (variant) {
    const variantHit = progress[`${powertrain}:${systemId}:${variant}`];
    if (variantHit) return variantHit;
    if (
      (systemId === 'transmission' && variant === 'manual') ||
      (systemId === 'engine' && variant === 'single-cylinder')
    ) {
      return progress[`${powertrain}:${systemId}`] ?? (powertrain === 'petrol' ? progress[systemId] : undefined);
    }
    return undefined;
  }
  return progress[`${powertrain}:${systemId}`] ?? (powertrain === 'petrol' ? progress[systemId] : undefined);
}

class AppStateStore {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor() {
    const reduceMotion = loadInitialReduceMotion();
    const renderMode = loadInitialRenderMode();
    const locale = loadInitialLocale();
    const fontScale = loadInitialFontScale();
    this.state = {
      viewMode: 'home',
      renderMode,
      layers: {
        outline: true,
        mesh: true,
        innerSystems: true,
      },
      selectedCarId: loadInitialCarId(),
      activePowertrain: 'petrol',
      selectedTransmission: loadInitialTransmission(),
      selectedEngineConfig: loadInitialEngineConfig(),
      engineAspiration: 'na',
      engineInjection: 'mpfi',
      engineHybrid: 'none',
      drivetrainLayout: 'rwd',
      differentialMode: 'open',
      brakeType: 'disc',
      suspensionType: 'double-wishbone',
      steeringType: 'eps',
      learningPath: loadInitialLearningPath(),
      audioEnabled: false,
      locale,
      fontScale,
      captionsEnabled: loadInitialCaptions(),
      clipAxis: 'none',
      clipRatio: 0.5,
      selectedSystem: null,
      selectedPartId: null,
      isolationMode: loadInitialIsolationMode(),
      graphicsQuality: loadInitialQuality(),
      paintColor: loadInitialPaintColor(),
      activeLesson: null,
      homeExplode: 0,
      xrayCar: false,
      reduceMotion,
      hintDismissed: loadInitialHintDismissed(),
      loadingPercent: 0,
      loadingLabel: 'Preparing drafting studio…',
      carReady: false,
      webglSupported: true,
      quizProgress: loadInitialQuizProgress(),
    };
    this.syncMotionAttribute(reduceMotion);
    this.syncRenderModeAttribute(renderMode);
    this.syncFontScaleAttribute(fontScale);
  }

  getSnapshot(): Readonly<AppState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    if ('reduceMotion' in patch) {
      this.syncMotionAttribute(this.state.reduceMotion);
      try {
        localStorage.setItem(STORAGE_MOTION_KEY, String(this.state.reduceMotion));
      } catch {
        // Ignore storage errors
      }
    }
    if ('renderMode' in patch) {
      this.syncRenderModeAttribute(this.state.renderMode);
      try {
        localStorage.setItem(STORAGE_RENDER_MODE_KEY, this.state.renderMode);
      } catch {
        // Ignore storage errors
      }
    }
    if ('isolationMode' in patch) {
      try {
        localStorage.setItem(STORAGE_ISOLATION_KEY, this.state.isolationMode);
      } catch {
        // Ignore storage errors
      }
    }
    if ('selectedCarId' in patch) {
      try {
        localStorage.setItem(STORAGE_CAR_ID_KEY, this.state.selectedCarId);
      } catch {
        // Ignore storage errors
      }
    }
    if ('selectedTransmission' in patch) {
      try {
        localStorage.setItem(STORAGE_TRANS_KEY, this.state.selectedTransmission);
      } catch {
        // Ignore storage errors
      }
    }
    if ('selectedEngineConfig' in patch) {
      try {
        localStorage.setItem(STORAGE_ENGINE_KEY, this.state.selectedEngineConfig);
      } catch {
        // Ignore storage errors
      }
    }
    if ('locale' in patch) {
      try {
        localStorage.setItem(STORAGE_LOCALE_KEY, this.state.locale);
      } catch {
        // Ignore storage errors
      }
    }
    if ('fontScale' in patch) {
      this.syncFontScaleAttribute(this.state.fontScale);
      try {
        localStorage.setItem(STORAGE_FONT_SCALE_KEY, this.state.fontScale);
      } catch {
        // Ignore storage errors
      }
    }
    if ('captionsEnabled' in patch) {
      try {
        localStorage.setItem(STORAGE_CAPTIONS_KEY, String(this.state.captionsEnabled));
      } catch {
        // Ignore storage errors
      }
    }
    if ('learningPath' in patch) {
      try {
        localStorage.setItem(STORAGE_LEARNING_PATH_KEY, this.state.learningPath);
      } catch {
        // Ignore storage errors
      }
    }
    if ('graphicsQuality' in patch) {
      try {
        localStorage.setItem(STORAGE_QUALITY_KEY, this.state.graphicsQuality);
      } catch {
        // Ignore storage errors
      }
    }
    if ('paintColor' in patch) {
      try {
        localStorage.setItem(STORAGE_PAINT_KEY, this.state.paintColor);
      } catch {
        // Ignore storage errors
      }
    }
    if ('hintDismissed' in patch && this.state.hintDismissed) {
      try {
        localStorage.setItem(STORAGE_HINT_KEY, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  saveQuizScore(
    systemId: SystemId,
    score: number,
    total: number,
    powertrain: Powertrain = this.state.activePowertrain,
    variant?: string,
  ): void {
    const resolvedVariant = variant ?? getActiveSystemVariant(this.state, systemId);
    const key = getQuizProgressKey(systemId, powertrain, resolvedVariant);
    const prev = this.state.quizProgress[key];
    const bestScore = prev ? Math.max(prev.bestScore, score) : score;
    const nextProgress = {
      ...this.state.quizProgress,
      [key]: {
        bestScore,
        total,
        completedAt: new Date().toISOString(),
      },
    };
    try {
      localStorage.setItem(STORAGE_QUIZ_KEY, JSON.stringify(nextProgress));
    } catch {
      // Ignore storage errors
    }
    this.update({ quizProgress: nextProgress });
  }

  private syncMotionAttribute(reduce: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-reduce-motion', reduce ? 'true' : 'false');
  }

  private syncRenderModeAttribute(mode: RenderMode): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-render-mode', mode);
  }

  private syncFontScaleAttribute(scale: 'normal' | 'large'): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-font-scale', scale);
  }
}

export const appStore = new AppStateStore();
