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

function loadInitialReduceMotion(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_MOTION_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
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

class AppStateStore {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor() {
    const reduceMotion = loadInitialReduceMotion();
    const renderMode = loadInitialRenderMode();
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
  ): void {
    const key = `${powertrain}:${systemId}`;
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
    document.documentElement.setAttribute('data-reduce-motion', reduce ? 'true' : 'false');
  }

  private syncRenderModeAttribute(mode: RenderMode): void {
    document.documentElement.setAttribute('data-render-mode', mode);
  }
}

export const appStore = new AppStateStore();
