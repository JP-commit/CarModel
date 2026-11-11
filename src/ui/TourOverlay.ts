import { getTourSteps, TOUR_STEPS, type TourStep } from '../data/tour';
import type { Powertrain, SystemId } from '../state/appState';

export interface TourOverlayActions {
  onSelectStep: (index: number) => void;
  onExitTour: () => void;
}

export interface TourOverlayHandle {
  open: (startIndex?: number, powertrain?: Powertrain, availableSystems?: SystemId[]) => void;
  setStep: (index: number) => void;
  close: () => void;
  stopAutoPlay: () => void;
}

export function createTourOverlay(
  uiRoot: HTMLElement,
  actions: TourOverlayActions,
): TourOverlayHandle {
  const card = document.createElement('section');
  card.className = 'tour-card is-hidden';
  card.setAttribute('aria-label', 'Guided vehicle tour');
  card.inert = true;
  uiRoot.appendChild(card);

  let activeSteps: TourStep[] = TOUR_STEPS;
  let currentIdx = 0;
  let autoTimer: number | null = null;
  let isAutoPlaying = false;

  const stopAutoPlay = () => {
    isAutoPlaying = false;
    if (autoTimer !== null) {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }
  };

  const render = () => {
    const step = activeSteps[currentIdx] ?? activeSteps[0];
    if (!step) return;
    card.innerHTML = `
      <div class="tour-chain" role="tablist" aria-label="Tour sequence">
        ${activeSteps
          .map(
            (s, i) => `
            <button
              type="button"
              class="tour-chain-step ${i === currentIdx ? 'is-active' : i < currentIdx ? 'is-done' : ''}"
              data-step-idx="${i}"
              role="tab"
              aria-selected="${i === currentIdx}"
            >
              <span>${i + 1}. ${s.stageLabel}</span>
            </button>
          `,
          )
          .join('<span class="tour-arrow" aria-hidden="true">→</span>')}
      </div>

      <div class="tour-body">
        <div class="panel-header" style="margin-bottom:4px">
          <div>
            <div class="panel-eyebrow">GUIDED TOUR · STEP ${currentIdx + 1} OF ${activeSteps.length}</div>
            <h2 class="panel-title" style="font-size:1.25rem">${step.title}</h2>
          </div>
          <button type="button" class="panel-close" id="tour-exit-btn" aria-label="Exit guided tour">✕</button>
        </div>
        <p class="panel-summary" style="margin-bottom:10px">${step.narration}</p>
        <div class="analogy-box" style="margin-bottom:12px">
          <strong>THINK OF IT LIKE</strong>
          <span>${step.analogy}</span>
        </div>
      </div>

      <div class="tour-footer">
        <button type="button" class="btn" id="tour-prev-btn" ${currentIdx === 0 ? 'disabled' : ''}>← Prev</button>
        <button type="button" class="btn btn-toggle" id="tour-auto-btn" aria-pressed="${isAutoPlaying}">
          ${isAutoPlaying ? '⏸ Auto-Play' : '▶ Auto-Play'}
        </button>
        <button type="button" class="btn btn-accent" id="tour-next-btn">
          ${currentIdx < activeSteps.length - 1 ? 'Next →' : 'Finish Tour ✓'}
        </button>
      </div>
    `;

    card.querySelector('#tour-exit-btn')!.addEventListener('click', () => {
      stopAutoPlay();
      actions.onExitTour();
    });

    for (const stepBtn of card.querySelectorAll<HTMLButtonElement>('.tour-chain-step')) {
      stepBtn.addEventListener('click', () => {
        stopAutoPlay();
        const idx = Number(stepBtn.dataset.stepIdx);
        actions.onSelectStep(idx);
      });
    }

    card.querySelector('#tour-prev-btn')?.addEventListener('click', () => {
      stopAutoPlay();
      if (currentIdx > 0) actions.onSelectStep(currentIdx - 1);
    });

    card.querySelector('#tour-next-btn')!.addEventListener('click', () => {
      stopAutoPlay();
      if (currentIdx < activeSteps.length - 1) {
        actions.onSelectStep(currentIdx + 1);
      } else {
        actions.onExitTour();
      }
    });

    card.querySelector('#tour-auto-btn')!.addEventListener('click', () => {
      if (isAutoPlaying) {
        stopAutoPlay();
        render();
      } else {
        isAutoPlaying = true;
        render();
        autoTimer = window.setInterval(() => {
          if (currentIdx < activeSteps.length - 1) {
            actions.onSelectStep(currentIdx + 1);
          } else {
            stopAutoPlay();
            render();
          }
        }, 4200);
      }
    });
  };

  const setStep = (index: number) => {
    currentIdx = Math.max(0, Math.min(activeSteps.length - 1, index));
    render();
  };

  const open = (
    startIndex = 0,
    powertrain: Powertrain = 'petrol',
    availableSystems?: SystemId[],
  ) => {
    stopAutoPlay();
    activeSteps = getTourSteps(powertrain, availableSystems);
    currentIdx = Math.max(0, Math.min(activeSteps.length - 1, startIndex));
    card.classList.remove('is-hidden');
    card.inert = false;
    render();
  };

  const close = () => {
    stopAutoPlay();
    card.classList.add('is-hidden');
    card.inert = true;
  };

  return {
    open,
    setStep,
    close,
    stopAutoPlay,
  };
}

