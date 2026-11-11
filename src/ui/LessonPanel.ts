import { getSystemLesson, type SystemLessonData } from '../data/lessons';
import { getSystemMetadata } from '../data/systems';
import type { SystemLabelAnchor, SystemSimulationState } from '../models/systems/types';
import type { ProjectedLabelEntry } from '../scene/LabelProjector';
import { appStore, type SystemId } from '../state/appState';
import { renderJargonMarkup } from './JargonText';
import { bindMobileSheetGesture, type MobileSheetBinding } from './mobileSheet';

export interface LessonPanelActions {
  onBackToCar: () => void;
  onSelectPart: (partId: string | null) => void;
  onSimChange: (patch: Partial<SystemSimulationState>) => void;
  onToggleLabels: (visible: boolean) => void;
  onOpenQuiz: (systemId: SystemId) => void;
  onOpenGlossary: (termId?: string) => void;
}

export interface LessonPanelHandle {
  open: (
    systemId: SystemId,
    initialSim: SystemSimulationState,
    labelAnchors: SystemLabelAnchor[],
  ) => ProjectedLabelEntry[];
  setPhaseStatus: (phaseIndex?: number) => void;
  highlightPartUI: (partId: string | null) => void;
  isMobileCollapsed: () => boolean;
  close: () => void;
}

export function createLessonPanel(
  uiRoot: HTMLElement,
  labelLayer: HTMLElement,
  actions: LessonPanelActions,
): LessonPanelHandle {
  const panel = document.createElement('aside');
  panel.className = 'side-panel is-hidden';
  panel.id = 'lesson-side-panel';
  panel.setAttribute('aria-label', 'Interactive system lesson');
  panel.inert = true;
  uiRoot.appendChild(panel);

  let currentLesson: SystemLessonData | null = null;
  let unsubQuiz: (() => void) | null = null;
  let phasePills: HTMLElement[] = [];
  let phaseCaption: HTMLElement | null = null;
  let partChipEls = new Map<string, HTMLButtonElement>();
  let partCalloutEls = new Map<string, HTMLButtonElement>();
  let inspectorBox: HTMLElement | null = null;
  let labelsVisible = true;
  let sheetBinding: MobileSheetBinding | null = null;

  const updateInspector = (partId: string | null) => {
    if (!inspectorBox || !currentLesson) return;
    if (!partId) {
      inspectorBox.innerHTML = `
        <div class="section-label">PART INSPECTOR</div>
        <p style="margin:0;color:var(--text-secondary)">
          Click any 3D part or choose a component above to see its plain-English role and analogy.
        </p>
      `;
      return;
    }
    const part = currentLesson.parts.find((p) => p.id === partId);
    if (!part) return;
    inspectorBox.innerHTML = `
      <div class="section-label">SELECTED PART</div>
      <h3>${part.name}</h3>
      <p>${part.plainEnglish}</p>
      <div class="analogy-box" style="margin-bottom:0">
        <strong>THINK OF IT LIKE</strong>
        <span>${part.analogy}</span>
      </div>
    `;
  };

  const highlightPartUI = (partId: string | null) => {
    for (const [id, chip] of partChipEls.entries()) {
      chip.setAttribute('aria-pressed', String(id === partId));
    }
    for (const [id, pin] of partCalloutEls.entries()) {
      pin.classList.toggle('is-active', id === partId);
    }
    updateInspector(partId);
  };

  const open = (
    systemId: SystemId,
    initialSim: SystemSimulationState,
    labelAnchors: SystemLabelAnchor[],
  ): ProjectedLabelEntry[] => {
    const powertrain = appStore.getSnapshot().activePowertrain;
    const lesson = getSystemLesson(systemId, powertrain);
    const meta = getSystemMetadata(systemId, powertrain);
    if (!lesson) return [];

    unsubQuiz?.();
    unsubQuiz = null;
    sheetBinding?.destroy();
    sheetBinding = null;
    currentLesson = lesson;
    labelsVisible = true;
    panel.classList.remove('is-hidden', 'is-collapsed-mobile');
    panel.inert = false;

    panel.innerHTML = `
      <div class="sheet-handle-row" id="lesson-grabber" title="Drag or tap to expand/collapse">
        <div class="sheet-handle" aria-hidden="true"></div>
        <button
          type="button"
          class="sheet-collapse-btn"
          id="btn-lesson-sheet-toggle"
          aria-expanded="true"
        >Hide ▾</button>
      </div>

      <div class="lesson-back-row">
        <button type="button" class="btn" id="btn-lesson-back">← Full Car</button>
        <button
          type="button"
          class="btn btn-accent lesson-mini-play"
          id="btn-lesson-mini-play"
          aria-pressed="${initialSim.playing}"
        >${initialSim.playing ? '⏸ Pause' : '▶ Play'}</button>
        <span class="panel-eyebrow lesson-eyebrow-text" style="margin:0">LESSON 0${meta.order} · ${meta.name.toUpperCase()}</span>
      </div>

      <div class="lesson-collapsible">
        <h2 class="panel-title" style="margin-bottom:6px">${lesson.title}</h2>
        <p class="panel-summary" id="lesson-intro-slot"></p>

      ${
        lesson.phases
          ? `
            <div class="section-label">${lesson.animationLabel}</div>
            <div class="phase-strip" id="phase-strip">
              ${lesson.phases
                .map((ph, idx) => `<div class="phase-pill" data-phase="${idx}">${ph.label}</div>`)
                .join('')}
            </div>
            <p class="phase-caption" id="phase-caption"></p>
          `
          : ''
      }

      <div class="playback-row">
        <button
          type="button"
          class="btn btn-accent"
          id="btn-play-pause"
          aria-pressed="${initialSim.playing}"
        >
          ${initialSim.playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <div class="speed-group" role="group" aria-label="Animation speed">
          ${[0.25, 0.5, 1, 2]
            .map(
              (spd) => `
                <button
                  type="button"
                  class="speed-btn"
                  data-speed="${spd}"
                  aria-pressed="${initialSim.speed === spd}"
                >${spd}×</button>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="slider-block">
        <div class="slider-header">
          <label for="lesson-explode"><span>Exploded view</span></label>
          <output id="lesson-explode-out" for="lesson-explode">${Math.round(initialSim.explode * 100)}%</output>
        </div>
        <input
          type="range"
          class="range-input"
          id="lesson-explode"
          min="0"
          max="100"
          value="${Math.round(initialSim.explode * 100)}"
        />
      </div>

      <div class="toggle-pair">
        <button
          type="button"
          class="btn btn-toggle"
          id="btn-lesson-xray"
          aria-pressed="${initialSim.xray}"
        >X-Ray Casing</button>
        <button
          type="button"
          class="btn btn-toggle"
          id="btn-lesson-labels"
          aria-pressed="true"
        >Part Labels</button>
      </div>

      <div class="section-label">KEY COMPONENTS</div>
      <div class="key-parts-row" id="lesson-parts-chips">
        ${lesson.parts
          .map(
            (part) => `
              <button
                type="button"
                class="key-part-chip"
                data-part-id="${part.id}"
                aria-pressed="false"
              >${part.name}</button>
            `,
          )
          .join('')}
      </div>

      <div class="part-inspector-card" id="lesson-inspector"></div>

      <div class="cta-row" style="margin-top:4px">
        <button type="button" class="btn btn-accent" id="btn-lesson-quiz">
          Take 5-Question Quiz →
        </button>
      </div>
      </div>
    `;

    // Render interactive beginner jargon tooltips in the lesson intro
    const introSlot = panel.querySelector<HTMLElement>('#lesson-intro-slot')!;
    introSlot.appendChild(
      renderJargonMarkup(lesson.intro, (termId) => actions.onOpenGlossary(termId)),
    );

    const quizBtn = panel.querySelector<HTMLButtonElement>('#btn-lesson-quiz')!;
    const syncQuizBtn = () => {
      const snap = appStore.getSnapshot();
      const progress = snap.quizProgress;
      const savedQuiz =
        progress[`${powertrain}:${systemId}`] ??
        (powertrain === 'petrol' ? progress[systemId] : undefined);
      quizBtn.textContent = savedQuiz
        ? `Take Quiz (Best: ${savedQuiz.bestScore}/${savedQuiz.total}) →`
        : 'Take 5-Question Quiz →';
    };
    syncQuizBtn();
    quizBtn.addEventListener('click', () => actions.onOpenQuiz(systemId));
    unsubQuiz = appStore.subscribe(() => {
      if (currentLesson?.id === systemId) syncQuizBtn();
    });

    phasePills = Array.from(panel.querySelectorAll<HTMLElement>('.phase-pill'));
    phaseCaption = panel.querySelector<HTMLElement>('#phase-caption');
    inspectorBox = panel.querySelector<HTMLElement>('#lesson-inspector')!;

    partChipEls.clear();
    for (const chip of panel.querySelectorAll<HTMLButtonElement>('.key-part-chip')) {
      const id = chip.dataset.partId!;
      partChipEls.set(id, chip);
      chip.addEventListener('click', () => {
        const alreadyActive = chip.getAttribute('aria-pressed') === 'true';
        actions.onSelectPart(alreadyActive ? null : id);
      });
    }

    panel.querySelector('#btn-lesson-back')!.addEventListener('click', actions.onBackToCar);

    const grabber = panel.querySelector<HTMLElement>('#lesson-grabber')!;
    const toggleBtn = panel.querySelector<HTMLButtonElement>('#btn-lesson-sheet-toggle');
    sheetBinding = bindMobileSheetGesture(panel, grabber, toggleBtn, {
      collapsedLabel: 'Details ▴',
      expandedLabel: 'Hide ▾',
    });
    if (window.innerWidth <= 768) {
      sheetBinding.setCollapsed(true);
    }

    const btnPlay = panel.querySelector<HTMLButtonElement>('#btn-play-pause')!;
    const btnMiniPlay = panel.querySelector<HTMLButtonElement>('#btn-lesson-mini-play')!;
    let isPlaying = initialSim.playing;
    const togglePlay = () => {
      isPlaying = !isPlaying;
      for (const b of [btnPlay, btnMiniPlay]) {
        b.setAttribute('aria-pressed', String(isPlaying));
        b.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
      }
      actions.onSimChange({ playing: isPlaying });
    };
    btnPlay.addEventListener('click', togglePlay);
    btnMiniPlay.addEventListener('click', togglePlay);

    const speedBtns = Array.from(panel.querySelectorAll<HTMLButtonElement>('.speed-btn'));
    for (const sb of speedBtns) {
      sb.addEventListener('click', () => {
        const speed = Number(sb.dataset.speed);
        for (const other of speedBtns) {
          other.setAttribute('aria-pressed', String(other === sb));
        }
        actions.onSimChange({ speed });
      });
    }

    const explodeInput = panel.querySelector<HTMLInputElement>('#lesson-explode')!;
    const explodeOut = panel.querySelector<HTMLOutputElement>('#lesson-explode-out')!;
    explodeInput.addEventListener('input', () => {
      const pct = Number(explodeInput.value);
      explodeOut.textContent = `${pct}%`;
      actions.onSimChange({ explode: pct / 100 });
    });

    const btnXray = panel.querySelector<HTMLButtonElement>('#btn-lesson-xray')!;
    let isXray = initialSim.xray;
    btnXray.addEventListener('click', () => {
      isXray = !isXray;
      btnXray.setAttribute('aria-pressed', String(isXray));
      actions.onSimChange({ xray: isXray });
    });

    const btnLabels = panel.querySelector<HTMLButtonElement>('#btn-lesson-labels')!;
    btnLabels.addEventListener('click', () => {
      labelsVisible = !labelsVisible;
      btnLabels.setAttribute('aria-pressed', String(labelsVisible));
      actions.onToggleLabels(labelsVisible);
    });

    updateInspector(null);

    // Create 3D projected callout pins inside #label-layer
    labelLayer.innerHTML = '';
    partCalloutEls.clear();
    return labelAnchors.map((item) => {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'part-callout-pin';
      pin.textContent = item.name;
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        actions.onSelectPart(item.partId);
      });
      labelLayer.appendChild(pin);
      partCalloutEls.set(item.partId, pin);
      return {
        id: `part-${item.partId}`,
        anchor: item.anchor,
        element: pin,
      };
    });
  };

  let lastPhase = -1;
  const setPhaseStatus = (phaseIndex?: number) => {
    if (phaseIndex === undefined || phaseIndex === lastPhase || !currentLesson?.phases) return;
    lastPhase = phaseIndex;
    for (let i = 0; i < phasePills.length; i++) {
      phasePills[i].classList.toggle('is-current', i === phaseIndex);
    }
    if (phaseCaption && currentLesson.phases[phaseIndex]) {
      phaseCaption.textContent = currentLesson.phases[phaseIndex].description;
    }
  };

  const close = () => {
    unsubQuiz?.();
    unsubQuiz = null;
    sheetBinding?.destroy();
    sheetBinding = null;
    currentLesson = null;
    lastPhase = -1;
    panel.classList.add('is-hidden');
    panel.classList.remove('is-collapsed-mobile');
    panel.inert = true;
    panel.innerHTML = '';
    partChipEls.clear();
    partCalloutEls.clear();
  };

  return {
    open,
    setPhaseStatus,
    highlightPartUI,
    isMobileCollapsed: () => panel.classList.contains('is-collapsed-mobile'),
    close,
  };
}

