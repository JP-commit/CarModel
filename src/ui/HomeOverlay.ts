import type * as THREE from 'three';
import type { CarManifestEntry } from '../data/cars';
import { getSystemMetadata, SYSTEMS } from '../data/systems';
import type { RigPartLabelEntry, RigPartMetadata } from '../models/rig';
import { isLessonImplemented } from '../models/systems/registry';
import type { ProjectedLabelEntry } from '../scene/LabelProjector';
import {
  appStore,
  getActiveSystemVariant,
  getSavedQuizScore,
  type IsolationMode,
  type LayerVisibility,
  type Powertrain,
  type SystemId,
} from '../state/appState';
import { SYSTEM_ICONS } from './icons';
import { bindMobileSheetGesture } from './mobileSheet';
import { bindVariantPickerEvents, renderVariantPickerMarkup } from './variantPicker';

export interface HomeOverlayActions {
  onSelectSystem: (id: SystemId) => void;
  onResetHome: () => void;
  onChangeExplode: (amount: number) => void;
  onChangeIsolation: (mode: IsolationMode) => void;
  onResetExplode?: () => void;
  onSelectExplodedPart?: (systemId: SystemId, partId: string) => void;
  onToggleLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
  onStartAnimation: (id: SystemId) => void;
  onChangeVariant?: (systemId: SystemId, variant: string) => void;
  onStartTour: () => void;
  onDismissHint: () => void;
  onChangePaintColor: (colorHex: string) => void;
  onOpenCredits: () => void;
  onOpenFeedback?: () => void;
  getSelectedPartInfo?: (systemId: SystemId, partId: string) => RigPartMetadata | null;
  getSystemBayWarning?: (systemId: SystemId) => string | undefined;
  onClearSelectedPart?: () => void;
}

const PAINT_SWATCHES: { id: string; label: string; color: string }[] = [
  { id: 'original', label: 'Factory Paint', color: 'original' },
  { id: '#c83726', label: 'Crimson Red', color: '#c83726' },
  { id: '#1d4ed8', label: 'Alpine Blue', color: '#1d4ed8' },
  { id: '#f1f5f9', label: 'Pearl White', color: '#f1f5f9' },
  { id: '#1f252d', label: 'Obsidian', color: '#1f252d' },
  { id: '#166534', label: 'British Green', color: '#166534' },
  { id: '#d97706', label: 'Solar Amber', color: '#d97706' },
  { id: '#64748b', label: 'Titanium Silver', color: '#64748b' },
];

export interface HomeOverlayHandle {
  setAvailableSystems: (
    ids: SystemId[],
    powertrain?: Powertrain,
    car?: CarManifestEntry | null,
  ) => void;
  createHotspotPins: (
    anchors: Partial<Record<SystemId, THREE.Vector3>>,
    outwardNormals: Partial<Record<SystemId, THREE.Vector3>>,
    anchorObjects?: Partial<Record<SystemId, THREE.Object3D>>,
  ) => ProjectedLabelEntry[];
  createExplodedPartPins: (
    systemId: SystemId,
    parts: RigPartLabelEntry[],
  ) => ProjectedLabelEntry[];
  setHoverPart: (info: { name: string; x: number; y: number } | null) => void;
  isMobileCollapsed: () => boolean;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

export function createHomeOverlay(
  uiRoot: HTMLElement,
  labelLayer: HTMLElement,
  actions: HomeOverlayActions,
): HomeOverlayHandle {
  const loaderBanner = document.createElement('div');
  loaderBanner.className = 'loader-banner';
  loaderBanner.setAttribute('role', 'status');
  loaderBanner.setAttribute('aria-live', 'polite');
  loaderBanner.innerHTML = `
    <div class="loader-row">
      <span id="loader-label">Preparing drafting studio…</span>
      <span id="loader-percent">0%</span>
    </div>
    <div class="loader-track">
      <div class="loader-fill" id="loader-fill"></div>
    </div>
  `;
  uiRoot.appendChild(loaderBanner);

  const main = document.createElement('main');
  main.id = 'main-ui';
  main.className = 'workspace-overlay';
  main.tabIndex = -1;
  main.innerHTML = `
    <!-- Left vertical system icon rail (Desktop) -->
    <nav class="system-rail" aria-label="Vehicle systems"></nav>

    <!-- Right slide-in Info Panel (Desktop 352px) / Draggable Bottom Sheet (Mobile) -->
    <aside
      class="side-panel is-hidden"
      id="home-info-panel"
      aria-live="polite"
      aria-label="Selected vehicle system details"
    >
      <div class="sheet-handle-row" id="sheet-grabber" title="Drag or tap to expand/collapse">
        <div class="sheet-handle" aria-hidden="true"></div>
        <button
          type="button"
          class="sheet-collapse-btn"
          id="btn-home-sheet-toggle"
          aria-expanded="true"
        >Hide ▾</button>
      </div>

      <div class="mobile-swipe-rail" aria-label="Vehicle systems"></div>

      <div id="panel-system-body">
        <div class="panel-header">
          <div>
            <div class="panel-eyebrow" id="panel-eyebrow">SYSTEM 01 OF 08</div>
            <h2 class="panel-title" id="panel-title">Engine</h2>
          </div>
          <button
            type="button"
            class="panel-close"
            id="btn-close-panel"
            aria-label="Close system panel and return to full car"
            title="Full Car (Esc)"
          >
            ✕
          </button>
        </div>

        <div id="home-variant-slot"></div>
        <div class="bay-warning-banner" id="home-bay-warning" hidden></div>

        <p class="panel-summary" id="panel-summary"></p>

        <div class="section-label">KEY PARTS</div>
        <div class="key-parts-row" id="panel-key-parts"></div>

        <div class="selected-part-card" id="selected-part-card" hidden>
          <div class="selected-part-header">
            <span class="selected-part-eyebrow">SELECTED PART</span>
            <button
              type="button"
              class="selected-part-clear"
              id="btn-clear-part"
              aria-label="Clear selected part"
            >
              Clear
            </button>
          </div>
          <h3 class="selected-part-name" id="selected-part-name"></h3>
          <p class="selected-part-desc" id="selected-part-desc"></p>
        </div>

        <div class="analogy-box">
          <strong>THINK OF IT LIKE</strong>
          <span id="panel-analogy"></span>
        </div>

        <div class="layer-checks" role="group" aria-label="3D rendering layers">
          <label class="layer-check-label">
            <input type="checkbox" id="chk-layer-outline" checked />
            <span>Outline</span>
          </label>
          <label class="layer-check-label">
            <input type="checkbox" id="chk-layer-mesh" checked />
            <span>Mesh</span>
          </label>
          <label class="layer-check-label">
            <input type="checkbox" id="chk-layer-inner" checked />
            <span>Inner systems</span>
          </label>
        </div>

        <div class="slider-block">
          <div class="slider-header">
            <label for="home-explode-slider"><span>Exploded</span></label>
            <div class="isolation-control" role="group" aria-label="System isolation mode">
              <button type="button" class="isolation-btn" data-isolation="isolate" aria-pressed="false">
                Isolate
              </button>
              <button type="button" class="isolation-btn" data-isolation="ghost" aria-pressed="true">
                Ghost
              </button>
              <button type="button" class="isolation-btn" data-isolation="all" aria-pressed="false">
                All
              </button>
            </div>
            <output id="home-explode-val" for="home-explode-slider">0%</output>
          </div>
          <input
            type="range"
            class="range-input"
            id="home-explode-slider"
            min="0"
            max="100"
            value="0"
            aria-label="Exploded view percentage"
          />
        </div>

        <div class="cta-row">
          <button type="button" class="btn btn-accent" id="btn-start-animation">
            ▶ Start animation
          </button>
          <button
            type="button"
            class="btn"
            id="btn-tour-shortcut"
            title="Launch guided vehicle tour"
          >
            Tour
          </button>
        </div>
      </div>
    </aside>

    <!-- Paint color selector (visible in Solid mode) -->
    <div class="paint-picker-bar is-hidden" id="paint-picker-bar" role="group" aria-label="Car paint color">
      <span class="paint-picker-label">Paint</span>
      <div class="paint-swatches">
        ${PAINT_SWATCHES.map(
    (sw) => `
            <button
              type="button"
              class="paint-swatch${sw.color === 'original' ? ' paint-swatch--factory' : ''}"
              data-paint-color="${sw.color}"
              aria-label="${sw.label}"
              title="${sw.label}"
              aria-pressed="false"
              ${sw.color !== 'original' ? `style="background:${sw.color}"` : ''}
            ></button>
          `,
  ).join('')}
      </div>
    </div>

    <!-- Visible open-license credits & feedback links -->
    <div class="footer-meta-actions" role="group" aria-label="Credits and Feedback">
      <button type="button" class="credits-trigger-btn" id="btn-credits" aria-label="Open 3D model credits and licenses">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 16v-4M12 8h.01" stroke-linecap="round" />
        </svg>
        <span>Credits</span>
      </button>

      <button type="button" class="credits-trigger-btn feedback-trigger-btn" id="btn-feedback" aria-label="Suggest a feature or send feedback">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
          <path d="M9 21h6" stroke-linecap="round" />
        </svg>
        <span>💡 Feedback</span>
      </button>
    </div>

    <!-- Full-car exploded bar when no system is selected -->
    <div class="fullcar-explode-bar" id="fullcar-explode-bar" role="region" aria-label="Full car exploded view">
      <label class="fullcar-explode-label" for="fullcar-explode-slider">Exploded</label>
      <input
        type="range"
        class="range-input fullcar-range"
        id="fullcar-explode-slider"
        min="0"
        max="100"
        value="0"
        aria-label="Full car exploded view percentage"
      />
      <output class="fullcar-explode-val" id="fullcar-explode-val" for="fullcar-explode-slider">0%</output>
      <button type="button" class="fullcar-reset-btn" id="btn-fullcar-reset" disabled>
        Reset
      </button>
    </div>

    <!-- One-time dismissible interaction hint -->
    <div class="hint-toast" id="hint-toast" role="note">
      <span>Drag to rotate · Scroll to zoom · Tap a dot to explore</span>
      <button
        type="button"
        class="hint-dismiss"
        id="btn-dismiss-hint"
        aria-label="Dismiss navigation hint"
      >
        ✕
      </button>
    </div>
    <div class="hover-part-pill" id="hover-part-pill" role="tooltip" hidden></div>
  `;
  uiRoot.appendChild(main);

  const loaderLabel = loaderBanner.querySelector<HTMLElement>('#loader-label')!;
  const loaderPercent = loaderBanner.querySelector<HTMLElement>('#loader-percent')!;
  const loaderFill = loaderBanner.querySelector<HTMLElement>('#loader-fill')!;

  const sidePanel = main.querySelector<HTMLElement>('#home-info-panel')!;
  const sheetGrabber = main.querySelector<HTMLElement>('#sheet-grabber')!;
  const btnHomeSheetToggle = main.querySelector<HTMLButtonElement>('#btn-home-sheet-toggle')!;
  const panelEyebrow = main.querySelector<HTMLElement>('#panel-eyebrow')!;
  const panelTitle = main.querySelector<HTMLElement>('#panel-title')!;
  const homeVariantSlot = main.querySelector<HTMLElement>('#home-variant-slot')!;
  const homeBayWarning = main.querySelector<HTMLElement>('#home-bay-warning')!;
  const panelSummary = main.querySelector<HTMLElement>('#panel-summary')!;
  const panelKeyParts = main.querySelector<HTMLElement>('#panel-key-parts')!;
  const selectedPartCard = main.querySelector<HTMLElement>('#selected-part-card')!;
  const selectedPartName = main.querySelector<HTMLElement>('#selected-part-name')!;
  const selectedPartDesc = main.querySelector<HTMLElement>('#selected-part-desc')!;
  const btnClearPart = main.querySelector<HTMLButtonElement>('#btn-clear-part')!;
  const panelAnalogy = main.querySelector<HTMLElement>('#panel-analogy')!;
  const chkOutline = main.querySelector<HTMLInputElement>('#chk-layer-outline')!;
  const chkMesh = main.querySelector<HTMLInputElement>('#chk-layer-mesh')!;
  const chkInner = main.querySelector<HTMLInputElement>('#chk-layer-inner')!;
  const explodeSlider = main.querySelector<HTMLInputElement>('#home-explode-slider')!;
  const explodeVal = main.querySelector<HTMLOutputElement>('#home-explode-val')!;
  const isolationBtns = Array.from(
    main.querySelectorAll<HTMLButtonElement>('.isolation-btn'),
  );
  const fullcarExplodeBar = main.querySelector<HTMLElement>('#fullcar-explode-bar')!;
  const fullcarExplodeSlider = main.querySelector<HTMLInputElement>('#fullcar-explode-slider')!;
  const fullcarExplodeVal = main.querySelector<HTMLOutputElement>('#fullcar-explode-val')!;
  const btnFullcarReset = main.querySelector<HTMLButtonElement>('#btn-fullcar-reset')!;
  const btnStartAnim = main.querySelector<HTMLButtonElement>('#btn-start-animation')!;
  const btnTourShortcut = main.querySelector<HTMLButtonElement>('#btn-tour-shortcut')!;
  const btnClosePanel = main.querySelector<HTMLButtonElement>('#btn-close-panel')!;
  const hintToast = main.querySelector<HTMLElement>('#hint-toast')!;
  const btnDismissHint = main.querySelector<HTMLButtonElement>('#btn-dismiss-hint')!;
  const hoverPartPill = main.querySelector<HTMLElement>('#hover-part-pill')!;
  const paintPickerBar = main.querySelector<HTMLElement>('#paint-picker-bar')!;
  const paintSwatchBtns = Array.from(main.querySelectorAll<HTMLButtonElement>('.paint-swatch'));
  const btnCredits = main.querySelector<HTMLButtonElement>('#btn-credits')!;
  const btnFeedback = main.querySelector<HTMLButtonElement>('#btn-feedback');

  btnCredits.addEventListener('click', actions.onOpenCredits);
  btnFeedback?.addEventListener('click', () => {
    actions.onOpenFeedback?.();
  });
  for (const btn of paintSwatchBtns) {
    btn.addEventListener('click', () => {
      const hex = btn.dataset.paintColor;
      if (hex) actions.onChangePaintColor(hex);
    });
  }

  btnClearPart.addEventListener('click', () => {
    actions.onClearSelectedPart?.();
  });

  const systemRailEl = main.querySelector<HTMLElement>('.system-rail')!;
  const mobileSwipeRailEl = main.querySelector<HTMLElement>('.mobile-swipe-rail')!;
  let availableIds: SystemId[] = SYSTEMS.map((s) => s.id);
  let currentPowertrain: Powertrain = 'petrol';
  let currentCar: CarManifestEntry | null = null;
  let lastVariantSignature = '';
  let railButtons: HTMLButtonElement[] = [];
  let swipeButtons: HTMLButtonElement[] = [];
  const hotspotWraps = new Map<SystemId, HTMLElement>();
  const explodedPartBtns: HTMLButtonElement[] = [];

  const bindSystemNav = (btn: HTMLButtonElement, list: HTMLButtonElement[], idx: number) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.systemId as SystemId;
      sheetBinding.setCollapsed(false);
      actions.onSelectSystem(id);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        list[(idx + 1) % list.length]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        list[(idx - 1 + list.length) % list.length]?.focus();
      }
    });
  };

  const renderSystemNavs = () => {
    const snap = appStore.getSnapshot();
    const orderedSystems = availableIds
      .map((id, idx) => ({
        meta: getSystemMetadata(id, currentPowertrain, getActiveSystemVariant(snap, id)),
        order: idx + 1,
      }))
      .filter((item) => Boolean(item.meta));

    systemRailEl.innerHTML = orderedSystems
      .map(
        ({ meta, order }) => `
          <button
            type="button"
            class="rail-btn"
            data-system-id="${meta.id}"
            aria-label="${order}. ${meta.name}: ${meta.tagline}"
            aria-pressed="false"
          >
            ${SYSTEM_ICONS[meta.id]}
            <span class="rail-tooltip" aria-hidden="true">${meta.name}</span>
          </button>
        `,
      )
      .join('');

    mobileSwipeRailEl.innerHTML = orderedSystems
      .map(
        ({ meta }) => `
          <button
            type="button"
            class="swipe-card"
            data-system-id="${meta.id}"
            aria-pressed="false"
          >
            ${SYSTEM_ICONS[meta.id]}
            <span>${meta.shortLabel}</span>
          </button>
        `,
      )
      .join('');

    railButtons = Array.from(systemRailEl.querySelectorAll<HTMLButtonElement>('.rail-btn'));
    swipeButtons = Array.from(mobileSwipeRailEl.querySelectorAll<HTMLButtonElement>('.swipe-card'));
    railButtons.forEach((b, i) => bindSystemNav(b, railButtons, i));
    swipeButtons.forEach((b, i) => bindSystemNav(b, swipeButtons, i));
  };

  renderSystemNavs();

  btnClosePanel.addEventListener('click', actions.onResetHome);
  btnDismissHint.addEventListener('click', actions.onDismissHint);

  chkOutline.addEventListener('change', () => actions.onToggleLayer('outline', chkOutline.checked));
  chkMesh.addEventListener('change', () => actions.onToggleLayer('mesh', chkMesh.checked));
  chkInner.addEventListener('change', () => actions.onToggleLayer('innerSystems', chkInner.checked));

  explodeSlider.addEventListener('input', () => {
    const val = Number(explodeSlider.value) / 100;
    actions.onChangeExplode(val);
  });

  fullcarExplodeSlider.addEventListener('input', () => {
    const val = Number(fullcarExplodeSlider.value) / 100;
    actions.onChangeExplode(val);
  });

  btnFullcarReset.addEventListener('click', () => {
    if (actions.onResetExplode) {
      actions.onResetExplode();
    } else {
      actions.onChangeExplode(0);
    }
  });

  for (const btn of isolationBtns) {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.isolation as IsolationMode | undefined;
      if (mode) actions.onChangeIsolation(mode);
    });
  }

  btnStartAnim.addEventListener('click', () => {
    const active = appStore.getSnapshot().selectedSystem;
    if (active && isLessonImplemented(active)) {
      actions.onStartAnimation(active);
    }
  });
  btnTourShortcut.addEventListener('click', actions.onStartTour);

  // Mobile draggable / tap bottom sheet gesture + explicit collapse toggle
  const sheetBinding = bindMobileSheetGesture(sidePanel, sheetGrabber, btnHomeSheetToggle, {
    collapsedLabel: 'Details ▴',
    expandedLabel: 'Hide ▾',
  });

  const syncPanelInert = () => {
    const snap = appStore.getSnapshot();
    const isHome = snap.viewMode === 'home';
    const showSidePanel = isHome && snap.selectedSystem !== null;
    const isMobile = window.innerWidth <= 768;
    sidePanel.inert = !isHome || (!showSidePanel && !isMobile);
  };
  window.addEventListener('resize', syncPanelInert);

  const syncPanelFields = () => {
    const state = appStore.getSnapshot();
    loaderLabel.textContent = state.loadingLabel;
    loaderPercent.textContent = `${state.loadingPercent}%`;
    loaderFill.style.width = `${state.loadingPercent}%`;
    loaderBanner.classList.toggle('is-done', state.carReady);

    const activeId = state.selectedSystem;
    const isHome = state.viewMode === 'home';

    main.style.display = isHome ? '' : 'none';

    const showSidePanel = isHome && activeId !== null;
    sidePanel.classList.toggle('is-hidden', !showSidePanel);
    const isMobile = window.innerWidth <= 768;
    sidePanel.inert = !isHome || (!showSidePanel && !isMobile);

    chkOutline.checked = state.layers.outline;
    chkMesh.checked = state.layers.mesh;
    chkInner.checked = state.layers.innerSystems;

    const pct = Math.round(state.homeExplode * 100);
    explodeSlider.value = String(pct);
    explodeVal.textContent = `${pct}%`;
    fullcarExplodeSlider.value = String(pct);
    fullcarExplodeVal.textContent = `${pct}%`;
    btnFullcarReset.disabled = state.homeExplode <= 0.001;

    const showFullcarBar = isHome && activeId === null;
    fullcarExplodeBar.classList.toggle('is-hidden', !showFullcarBar);
    fullcarExplodeBar.inert = !showFullcarBar;

    const showPaintPicker = isHome && state.renderMode === 'solid';
    paintPickerBar.classList.toggle('is-hidden', !showPaintPicker);
    paintPickerBar.inert = !showPaintPicker;
    for (const btn of paintSwatchBtns) {
      btn.setAttribute('aria-pressed', String(btn.dataset.paintColor === state.paintColor));
    }

    for (const btn of isolationBtns) {
      const match = btn.dataset.isolation === state.isolationMode;
      btn.setAttribute('aria-pressed', String(match));
    }

    for (const btn of explodedPartBtns) {
      btn.classList.toggle('is-active', btn.dataset.partId === state.selectedPartId);
    }

    if (activeId) {
      const variant = getActiveSystemVariant(state, activeId);
      const meta = getSystemMetadata(activeId, currentPowertrain, variant);
      const orderIdx = Math.max(1, availableIds.indexOf(activeId) + 1);
      const totalCount = Math.max(1, availableIds.length);
      const savedQuiz = getSavedQuizScore(state.quizProgress, activeId, currentPowertrain, variant);
      const scoreBadge = savedQuiz ? ` · Quiz ${savedQuiz.bestScore}/${savedQuiz.total}` : '';
      panelEyebrow.textContent = `SYSTEM ${String(orderIdx).padStart(2, '0')} OF ${String(totalCount).padStart(2, '0')}${scoreBadge}`;
      panelTitle.textContent = meta.name;

      const variantSig = `${currentCar?.id ?? 'default'}:${currentPowertrain}:${activeId}:${variant ?? ''}`;
      if (variantSig !== lastVariantSignature) {
        lastVariantSignature = variantSig;
        homeVariantSlot.innerHTML = renderVariantPickerMarkup('home', activeId, currentCar);
        bindVariantPickerEvents(homeVariantSlot, (nextVar) => {
          actions.onChangeVariant?.(activeId, nextVar);
        });
      }

      const bayWarn = actions.getSystemBayWarning?.(activeId);
      if (bayWarn) {
        homeBayWarning.textContent = bayWarn;
        homeBayWarning.hidden = false;
      } else {
        homeBayWarning.hidden = true;
      }

      panelSummary.textContent = meta.plainEnglish;
      panelAnalogy.textContent = meta.analogy;
      panelKeyParts.innerHTML = meta.keyParts
        .map((p) => `<span class="key-part-chip">${p}</span>`)
        .join('');

      const partInfo =
        state.selectedPartId && actions.getSelectedPartInfo
          ? actions.getSelectedPartInfo(activeId, state.selectedPartId)
          : null;
      if (partInfo) {
        selectedPartName.textContent = partInfo.name;
        selectedPartDesc.textContent = partInfo.description;
        selectedPartCard.hidden = false;
      } else {
        selectedPartCard.hidden = true;
      }

      const ready = isLessonImplemented(activeId, currentPowertrain);
      btnStartAnim.disabled = !ready;
      btnStartAnim.textContent = '▶ Start animation';
      btnStartAnim.title = `Open interactive 3D ${meta.name} cutaway`;
    } else {
      selectedPartCard.hidden = true;
      homeBayWarning.hidden = true;
      if (lastVariantSignature !== '') {
        lastVariantSignature = '';
        homeVariantSlot.innerHTML = '';
      }
    }

    if (!isHome) {
      hoverPartPill.hidden = true;
    }

    for (const btn of railButtons) {
      const isMatch = btn.dataset.systemId === activeId;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    }
    for (const btn of swipeButtons) {
      const isMatch = btn.dataset.systemId === activeId;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
      if (isMatch && isMobile) {
        btn.scrollIntoView({
          behavior: state.reduceMotion ? 'auto' : 'smooth',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    }

    for (const [id, wrap] of hotspotWraps.entries()) {
      const isMatch = id === activeId;
      wrap.classList.toggle('is-active', isMatch);
      wrap.style.display =
        activeId !== null && state.isolationMode === 'isolate' && !isMatch ? 'none' : '';
      const btn = wrap.querySelector('button');
      btn?.setAttribute('aria-pressed', String(isMatch));
    }

    hintToast.classList.toggle('is-hidden', state.hintDismissed || activeId !== null || !isHome);
    hintToast.inert = state.hintDismissed || activeId !== null || !isHome;
  };

  const unsubscribe = appStore.subscribe(() => syncPanelFields());

  const createHotspotPins = (
    anchors: Partial<Record<SystemId, THREE.Vector3>>,
    outwardNormals: Partial<Record<SystemId, THREE.Vector3>>,
    anchorObjects?: Partial<Record<SystemId, THREE.Object3D>>,
  ): ProjectedLabelEntry[] => {
    labelLayer.innerHTML = '';
    hotspotWraps.clear();
    explodedPartBtns.length = 0;

    const orderedIds = availableIds.filter((id) => anchors[id] && outwardNormals[id]);
    const totalCount = orderedIds.length;
    const entries: ProjectedLabelEntry[] = [];

    orderedIds.forEach((sysId, index) => {
      const snap = appStore.getSnapshot();
      const sys = getSystemMetadata(sysId, currentPowertrain, getActiveSystemVariant(snap, sysId));
      const anchor = anchorObjects?.[sysId] ?? anchors[sysId];
      const outwardNormal = outwardNormals[sysId];
      if (!sys || !anchor || !outwardNormal) return;

      const order = index + 1;
      const wrap = document.createElement('div');
      wrap.className = 'hotspot-dot-wrap';
      wrap.innerHTML = `
        <button
          type="button"
          class="hotspot-dot-btn"
          aria-label="Inspect ${sys.name} (${order} of ${totalCount})"
          aria-pressed="false"
        >
          ${order}
        </button>
        <div class="hotspot-expand-card" aria-hidden="true">
          <strong>${sys.name}</strong>
          <span>${order} of ${totalCount}</span>
        </div>
      `;

      const btn = wrap.querySelector<HTMLButtonElement>('.hotspot-dot-btn')!;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sheetBinding.setCollapsed(false);
        actions.onSelectSystem(sys.id);
      });

      labelLayer.appendChild(wrap);
      hotspotWraps.set(sys.id, wrap);

      entries.push({
        id: sys.id,
        anchor,
        outwardNormal,
        element: wrap,
      });
    });

    syncPanelFields();
    return entries;
  };

  const createExplodedPartPins = (
    systemId: SystemId,
    parts: RigPartLabelEntry[],
  ): ProjectedLabelEntry[] => {
    labelLayer.innerHTML = '';
    hotspotWraps.clear();
    explodedPartBtns.length = 0;

    const entries: ProjectedLabelEntry[] = [];
    for (const part of parts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'part-callout-pin';
      btn.dataset.partId = part.partId;
      btn.textContent = part.name;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        actions.onSelectExplodedPart?.(systemId, part.partId);
      });
      labelLayer.appendChild(btn);
      explodedPartBtns.push(btn);

      entries.push({
        id: `${systemId}:${part.partId}`,
        anchor: part.anchor,
        element: btn,
      });
    }

    syncPanelFields();
    return entries;
  };

  const setHoverPart = (info: { name: string; x: number; y: number } | null) => {
    if (!info || appStore.getSnapshot().viewMode !== 'home') {
      hoverPartPill.hidden = true;
      return;
    }
    hoverPartPill.textContent = info.name;
    const clampedX = Math.max(12, Math.min(window.innerWidth - 180, info.x + 14));
    const clampedY = Math.max(60, Math.min(window.innerHeight - 24, info.y - 10));
    hoverPartPill.style.left = `${Math.round(clampedX)}px`;
    hoverPartPill.style.top = `${Math.round(clampedY)}px`;
    hoverPartPill.hidden = false;
  };

  return {
    setAvailableSystems: (ids, powertrain = 'petrol', car = null) => {
      availableIds = ids.length > 0 ? [...ids] : SYSTEMS.map((s) => s.id);
      currentPowertrain = powertrain;
      currentCar = car;
      lastVariantSignature = '';
      renderSystemNavs();
      syncPanelFields();
    },
    createHotspotPins,
    createExplodedPartPins,
    setHoverPart,
    isMobileCollapsed: () => sidePanel.classList.contains('is-collapsed-mobile'),
    setVisible: (visible: boolean) => {
      main.style.display = visible ? '' : 'none';
    },
    destroy: () => {
      window.removeEventListener('resize', syncPanelInert);
      sheetBinding.destroy();
      unsubscribe();
      loaderBanner.remove();
      main.remove();
      labelLayer.innerHTML = '';
    },
  };
}
