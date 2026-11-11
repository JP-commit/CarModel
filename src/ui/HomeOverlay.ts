import type * as THREE from 'three';
import { getSystemMetadata, SYSTEMS } from '../data/systems';
import { isLessonImplemented } from '../models/systems/registry';
import type { ProjectedLabelEntry } from '../scene/LabelProjector';
import {
  appStore,
  type LayerVisibility,
  type Powertrain,
  type SystemId,
} from '../state/appState';
import { SYSTEM_ICONS } from './icons';

export interface HomeOverlayActions {
  onSelectSystem: (id: SystemId) => void;
  onResetHome: () => void;
  onChangeExplode: (amount: number) => void;
  onToggleLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
  onStartAnimation: (id: SystemId) => void;
  onStartTour: () => void;
  onDismissHint: () => void;
}

export interface HomeOverlayHandle {
  setAvailableSystems: (ids: SystemId[], powertrain?: Powertrain) => void;
  createHotspotPins: (
    anchors: Partial<Record<SystemId, THREE.Vector3>>,
    outwardNormals: Partial<Record<SystemId, THREE.Vector3>>,
  ) => ProjectedLabelEntry[];
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

        <p class="panel-summary" id="panel-summary"></p>

        <div class="section-label">KEY PARTS</div>
        <div class="key-parts-row" id="panel-key-parts"></div>

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
            <label for="home-explode-slider"><span>Exploded view</span></label>
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
  `;
  uiRoot.appendChild(main);

  const loaderLabel = loaderBanner.querySelector<HTMLElement>('#loader-label')!;
  const loaderPercent = loaderBanner.querySelector<HTMLElement>('#loader-percent')!;
  const loaderFill = loaderBanner.querySelector<HTMLElement>('#loader-fill')!;

  const sidePanel = main.querySelector<HTMLElement>('#home-info-panel')!;
  const sheetGrabber = main.querySelector<HTMLElement>('#sheet-grabber')!;
  const panelEyebrow = main.querySelector<HTMLElement>('#panel-eyebrow')!;
  const panelTitle = main.querySelector<HTMLElement>('#panel-title')!;
  const panelSummary = main.querySelector<HTMLElement>('#panel-summary')!;
  const panelKeyParts = main.querySelector<HTMLElement>('#panel-key-parts')!;
  const panelAnalogy = main.querySelector<HTMLElement>('#panel-analogy')!;
  const chkOutline = main.querySelector<HTMLInputElement>('#chk-layer-outline')!;
  const chkMesh = main.querySelector<HTMLInputElement>('#chk-layer-mesh')!;
  const chkInner = main.querySelector<HTMLInputElement>('#chk-layer-inner')!;
  const explodeSlider = main.querySelector<HTMLInputElement>('#home-explode-slider')!;
  const explodeVal = main.querySelector<HTMLOutputElement>('#home-explode-val')!;
  const btnStartAnim = main.querySelector<HTMLButtonElement>('#btn-start-animation')!;
  const btnTourShortcut = main.querySelector<HTMLButtonElement>('#btn-tour-shortcut')!;
  const btnClosePanel = main.querySelector<HTMLButtonElement>('#btn-close-panel')!;
  const hintToast = main.querySelector<HTMLElement>('#hint-toast')!;
  const btnDismissHint = main.querySelector<HTMLButtonElement>('#btn-dismiss-hint')!;

  const systemRailEl = main.querySelector<HTMLElement>('.system-rail')!;
  const mobileSwipeRailEl = main.querySelector<HTMLElement>('.mobile-swipe-rail')!;
  let availableIds: SystemId[] = SYSTEMS.map((s) => s.id);
  let currentPowertrain: Powertrain = 'petrol';
  let railButtons: HTMLButtonElement[] = [];
  let swipeButtons: HTMLButtonElement[] = [];
  const hotspotWraps = new Map<SystemId, HTMLElement>();

  const bindSystemNav = (btn: HTMLButtonElement, list: HTMLButtonElement[], idx: number) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.systemId as SystemId;
      sidePanel.classList.remove('is-collapsed-mobile');
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
    const orderedSystems = availableIds
      .map((id, idx) => ({ meta: getSystemMetadata(id, currentPowertrain), order: idx + 1 }))
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

  btnStartAnim.addEventListener('click', () => {
    const active = appStore.getSnapshot().selectedSystem;
    if (active && isLessonImplemented(active)) {
      actions.onStartAnimation(active);
    }
  });
  btnTourShortcut.addEventListener('click', actions.onStartTour);

  // Mobile draggable / tap bottom sheet gesture
  let dragStartY = 0;
  let draggingSheet = false;
  sheetGrabber.addEventListener('pointerdown', (e) => {
    draggingSheet = true;
    dragStartY = e.clientY;
    sheetGrabber.setPointerCapture(e.pointerId);
  });
  sheetGrabber.addEventListener('pointerup', (e) => {
    if (!draggingSheet) return;
    draggingSheet = false;
    const dy = e.clientY - dragStartY;
    if (dy > 28) {
      sidePanel.classList.add('is-collapsed-mobile');
    } else if (dy < -28) {
      sidePanel.classList.remove('is-collapsed-mobile');
    } else {
      sidePanel.classList.toggle('is-collapsed-mobile');
    }
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

    if (activeId) {
      const meta = getSystemMetadata(activeId, currentPowertrain);
      const orderIdx = Math.max(1, availableIds.indexOf(activeId) + 1);
      const totalCount = Math.max(1, availableIds.length);
      const savedQuiz =
        state.quizProgress[`${currentPowertrain}:${activeId}`] ??
        (currentPowertrain === 'petrol' ? state.quizProgress[activeId] : undefined);
      const scoreBadge = savedQuiz ? ` · Quiz ${savedQuiz.bestScore}/${savedQuiz.total}` : '';
      panelEyebrow.textContent = `SYSTEM ${String(orderIdx).padStart(2, '0')} OF ${String(totalCount).padStart(2, '0')}${scoreBadge}`;
      panelTitle.textContent = meta.name;
      panelSummary.textContent = meta.plainEnglish;
      panelAnalogy.textContent = meta.analogy;
      panelKeyParts.innerHTML = meta.keyParts
        .map((p) => `<span class="key-part-chip">${p}</span>`)
        .join('');

      const ready = isLessonImplemented(activeId, currentPowertrain);
      btnStartAnim.disabled = !ready;
      btnStartAnim.textContent = '▶ Start animation';
      btnStartAnim.title = `Open interactive 3D ${meta.name} cutaway`;
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
  ): ProjectedLabelEntry[] => {
    labelLayer.innerHTML = '';
    hotspotWraps.clear();

    const orderedIds = availableIds.filter((id) => anchors[id] && outwardNormals[id]);
    const totalCount = orderedIds.length;
    const entries: ProjectedLabelEntry[] = [];

    orderedIds.forEach((sysId, index) => {
      const sys = getSystemMetadata(sysId, currentPowertrain);
      const anchor = anchors[sysId];
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
        sidePanel.classList.remove('is-collapsed-mobile');
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

  return {
    setAvailableSystems: (ids, powertrain = 'petrol') => {
      availableIds = ids.length > 0 ? [...ids] : SYSTEMS.map((s) => s.id);
      currentPowertrain = powertrain;
      renderSystemNavs();
      syncPanelFields();
    },
    createHotspotPins,
    isMobileCollapsed: () => sidePanel.classList.contains('is-collapsed-mobile'),
    setVisible: (visible: boolean) => {
      main.style.display = visible ? '' : 'none';
    },
    destroy: () => {
      window.removeEventListener('resize', syncPanelInert);
      unsubscribe();
      loaderBanner.remove();
      main.remove();
      labelLayer.innerHTML = '';
    },
  };
}
