import { appStore, type RenderMode, type ViewMode } from '../state/appState';

export interface HeaderBarActions {
  onSelectMode: (mode: 'home' | 'tour' | 'compare') => void;
  onSelectRenderMode: (mode: RenderMode) => void;
  onToggleCarPicker: () => void;
  onOpenGlossary: () => void;
  onResetView: () => void;
  onToggleXRay: () => void;
  onToggleReduceMotion: () => void;
  onToggleQuality: () => void;
}

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'solid', label: 'Solid' },
];

const VIEW_MODES: { id: 'home' | 'tour' | 'compare'; label: string }[] = [
  { id: 'home', label: 'Explore' },
  { id: 'tour', label: 'Guided Tour' },
  { id: 'compare', label: 'Compare' },
];

const DEFAULT_CAR_THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 28' fill='none' stroke='%231c1b19' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 20h6m34 0h12l-2-5-11-3-10-6H20L11 12l-5 2v6z'/%3E%3Ccircle cx='17' cy='20' r='4.5' fill='%23fffdf8'/%3E%3Ccircle cx='47' cy='20' r='4.5' fill='%23fffdf8'/%3E%3C/svg%3E";

export interface HeaderBarHandle {
  setCarSummary: (name: string, thumbnailSrc?: string) => void;
  setCarPickerExpanded: (expanded: boolean) => void;
  setSolidEnabled: (enabled: boolean, tooltip?: string) => void;
  destroy: () => void;
}

export function createHeaderBar(parent: HTMLElement, actions: HeaderBarActions): HeaderBarHandle {
  const header = document.createElement('header');
  header.className = 'top-header';
  header.innerHTML = `
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17M3.5 12h17" />
        </svg>
      </div>
      <div class="brand-text">
        <h1>HowCarsWork</h1>
      </div>
    </div>

    <nav class="env-segmented mode-segmented" aria-label="App modes">
      ${VIEW_MODES.map(
        (m) => `
          <button
            type="button"
            class="env-seg-btn mode-seg-btn"
            data-view-mode="${m.id}"
            aria-pressed="${m.id === 'home'}"
          >${m.label}</button>
        `,
      ).join('')}
    </nav>

    <div class="header-controls">
      <button
        type="button"
        class="car-picker-btn"
        id="btn-car-picker"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-label="Choose car model"
      >
        <img class="car-picker-thumb" id="car-picker-thumb" src="${DEFAULT_CAR_THUMB}" alt="" aria-hidden="true" />
        <span id="car-picker-name">Sports Coupe</span>
        <svg class="car-picker-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M5 7.5 10 12.5 15 7.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <div class="env-segmented render-mode-seg" role="group" aria-label="3D rendering style">
        ${RENDER_MODES.map(
          (m) => `
            <button
              type="button"
              class="env-seg-btn render-mode-btn"
              data-render-mode="${m.id}"
              aria-pressed="${m.id === 'outline'}"
            >${m.label}</button>
          `,
        ).join('')}
      </div>

      <div class="header-icons-row">
        <button
          type="button"
          class="icon-action-btn"
          id="btn-open-glossary"
          aria-label="Open automotive glossary"
          data-tooltip="Glossary"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-action-btn"
          id="btn-xray"
          aria-pressed="false"
          aria-label="Toggle X-Ray body transparency"
          data-tooltip="X-Ray"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-action-btn"
          id="btn-reduce-motion"
          aria-pressed="false"
          aria-label="Toggle reduce motion"
          data-tooltip="Reduce Motion"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-action-btn quality-pill-btn"
          id="btn-quality"
          aria-pressed="true"
          aria-label="Toggle graphics quality"
          data-tooltip="Quality: High"
        >HQ</button>
        <button
          type="button"
          class="icon-action-btn"
          id="btn-reset-view"
          aria-label="Reset camera view"
          data-tooltip="Reset View"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
    </div>
  `;
  parent.appendChild(header);

  const modeButtons = Array.from(header.querySelectorAll<HTMLButtonElement>('.mode-seg-btn'));
  const renderModeSeg = header.querySelector<HTMLElement>('.render-mode-seg')!;
  const renderModeButtons = Array.from(header.querySelectorAll<HTMLButtonElement>('.render-mode-btn'));
  const solidModeBtn = renderModeButtons.find((b) => b.dataset.renderMode === 'solid');
  const btnCarPicker = header.querySelector<HTMLButtonElement>('#btn-car-picker')!;
  const carPickerName = header.querySelector<HTMLElement>('#car-picker-name')!;
  const carPickerThumb = header.querySelector<HTMLImageElement>('#car-picker-thumb')!;
  const btnGlossary = header.querySelector<HTMLButtonElement>('#btn-open-glossary')!;
  const btnXRay = header.querySelector<HTMLButtonElement>('#btn-xray')!;
  const btnMotion = header.querySelector<HTMLButtonElement>('#btn-reduce-motion')!;
  const btnQuality = header.querySelector<HTMLButtonElement>('#btn-quality')!;
  const btnReset = header.querySelector<HTMLButtonElement>('#btn-reset-view')!;

  for (const btn of modeButtons) {
    btn.addEventListener('click', () => {
      const m = btn.dataset.viewMode as 'home' | 'tour' | 'compare';
      actions.onSelectMode(m);
    });
  }

  for (const btn of renderModeButtons) {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.renderMode as RenderMode;
      actions.onSelectRenderMode(mode);
    });
  }

  btnCarPicker.addEventListener('click', actions.onToggleCarPicker);
  btnGlossary.addEventListener('click', actions.onOpenGlossary);
  btnXRay.addEventListener('click', actions.onToggleXRay);
  btnMotion.addEventListener('click', actions.onToggleReduceMotion);
  btnQuality.addEventListener('click', actions.onToggleQuality);
  btnReset.addEventListener('click', actions.onResetView);

  const isExploreOrLesson = (vm: ViewMode) => vm === 'home' || vm === 'lesson';

  const unsubscribe = appStore.subscribe((state) => {
    btnXRay.setAttribute('aria-pressed', String(state.xrayCar));
    btnMotion.setAttribute('aria-pressed', String(state.reduceMotion));
    const isHigh = state.graphicsQuality === 'high';
    btnQuality.textContent = isHigh ? 'HQ' : 'LQ';
    btnQuality.setAttribute('aria-pressed', String(isHigh));
    btnQuality.setAttribute(
      'data-tooltip',
      isHigh ? 'Quality: High (2× DPR & Soft Shadows)' : 'Quality: Low (Fast Mobile Mode)',
    );
    for (const btn of renderModeButtons) {
      btn.setAttribute('aria-pressed', String(btn.dataset.renderMode === state.renderMode));
    }
    for (const btn of modeButtons) {
      const target = btn.dataset.viewMode;
      const active =
        target === 'home' ? isExploreOrLesson(state.viewMode) : state.viewMode === target;
      btn.setAttribute('aria-pressed', String(active));
    }
  });

  return {
    setCarSummary: (name: string, thumbnailSrc?: string) => {
      carPickerName.textContent = name;
      if (thumbnailSrc) {
        carPickerThumb.src = thumbnailSrc;
      }
    },
    setCarPickerExpanded: (expanded: boolean) => {
      btnCarPicker.setAttribute('aria-expanded', String(expanded));
    },
    setSolidEnabled: (enabled: boolean, tooltip?: string) => {
      if (solidModeBtn) {
        solidModeBtn.disabled = !enabled;
        solidModeBtn.setAttribute('aria-disabled', String(!enabled));
        if (!enabled && tooltip) {
          solidModeBtn.title = tooltip;
          renderModeSeg.setAttribute('data-tooltip', tooltip);
        } else {
          solidModeBtn.removeAttribute('title');
          renderModeSeg.removeAttribute('data-tooltip');
        }
      }
    },
    destroy: () => {
      unsubscribe();
      header.remove();
    },
  };
}
