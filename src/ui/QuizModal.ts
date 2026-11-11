import { getSystemLesson } from '../data/lessons';
import { getSystemMetadata } from '../data/systems';
import { appStore, type SystemId } from '../state/appState';

export interface QuizModalHandle {
  open: (systemId: SystemId) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createQuizModal(uiRoot: HTMLElement): QuizModalHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-hidden';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'quiz-modal-title');
  backdrop.inert = true;
  backdrop.innerHTML = `<div class="modal-card" id="quiz-modal-card"></div>`;
  uiRoot.appendChild(backdrop);

  const card = backdrop.querySelector<HTMLElement>('#quiz-modal-card')!;

  let activeSystem: SystemId | null = null;
  let lastFocusedEl: HTMLElement | null = null;
  let currentIdx = 0;
  let score = 0;
  let answeredIdx: number | null = null;

  const close = () => {
    activeSystem = null;
    backdrop.classList.add('is-hidden');
    backdrop.inert = true;
    lastFocusedEl?.focus();
    lastFocusedEl = null;
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const renderQuestion = () => {
    if (!activeSystem) return;
    const powertrain = appStore.getSnapshot().activePowertrain;
    const lesson = getSystemLesson(activeSystem, powertrain);
    const meta = getSystemMetadata(activeSystem, powertrain);
    const questions = lesson.quiz;

    if (currentIdx >= questions.length) {
      appStore.saveQuizScore(activeSystem, score, questions.length, powertrain);
      const pct = Math.round((score / questions.length) * 100);
      const praise =
        score === questions.length
          ? 'Perfect score! You mastered this system.'
          : score >= 3
            ? 'Great job! You have a solid grasp of the fundamentals.'
            : 'Good try! Review the cutaway parts and try again anytime.';

      card.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-eyebrow">${meta.name.toUpperCase()} QUIZ COMPLETE</div>
            <h2 class="panel-title" id="quiz-modal-title">You scored ${score} / ${questions.length} (${pct}%)</h2>
          </div>
          <button type="button" class="panel-close" id="quiz-close-btn" aria-label="Close quiz">✕</button>
        </div>
        <p class="panel-summary">${praise}</p>
        <div class="analogy-box">
          <strong>SAVED PROGRESS</strong>
          <span>Your best score for ${meta.name} is saved in this browser so you can track mastery across this vehicle's systems.</span>
        </div>
        <div class="cta-row">
          <button type="button" class="btn btn-accent" id="quiz-done-btn">Back to Lesson</button>
          <button type="button" class="btn" id="quiz-retry-btn">Retry Quiz</button>
        </div>
      `;
      card.querySelector('#quiz-close-btn')!.addEventListener('click', close);
      card.querySelector('#quiz-done-btn')!.addEventListener('click', close);
      card.querySelector('#quiz-retry-btn')!.addEventListener('click', () => {
        currentIdx = 0;
        score = 0;
        answeredIdx = null;
        renderQuestion();
      });
      return;
    }

    const q = questions[currentIdx];
    const answered = answeredIdx !== null;
    const isCorrect = answered && answeredIdx === q.correctIndex;

    card.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-eyebrow">${meta.name.toUpperCase()} · QUESTION ${currentIdx + 1} OF ${questions.length}</div>
          <h2 class="panel-title" id="quiz-modal-title" style="font-size:1.22rem">${q.question}</h2>
        </div>
        <button type="button" class="panel-close" id="quiz-close-btn" aria-label="Close quiz">✕</button>
      </div>

      <div class="quiz-progress-bar" aria-hidden="true">
        <div class="quiz-progress-fill" style="width:${((currentIdx + (answered ? 1 : 0)) / questions.length) * 100}%"></div>
      </div>

      <div class="quiz-options" role="radiogroup" aria-label="Answer choices">
        ${q.options
          .map((opt, idx) => {
            let stateClass = '';
            if (answered) {
              if (idx === q.correctIndex) stateClass = 'is-correct';
              else if (idx === answeredIdx) stateClass = 'is-wrong';
            }
            return `
              <button
                type="button"
                class="quiz-option-btn ${stateClass}"
                data-opt-idx="${idx}"
                ${answered ? 'disabled' : ''}
              >
                <span class="quiz-opt-num">${idx + 1}</span>
                <span>${opt}</span>
              </button>
            `;
          })
          .join('')}
      </div>

      ${
        answered
          ? `
            <div class="quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}" role="status">
              <strong>${isCorrect ? '✓ Spot on!' : '✕ Not quite'}</strong>
              <span>${q.explanation}</span>
            </div>
            <div class="cta-row">
              <button type="button" class="btn btn-accent" id="quiz-next-btn">
                ${currentIdx + 1 < questions.length ? 'Next Question →' : 'See Final Score →'}
              </button>
            </div>
          `
          : ''
      }
    `;

    card.querySelector('#quiz-close-btn')!.addEventListener('click', close);

    for (const btn of card.querySelectorAll<HTMLButtonElement>('.quiz-option-btn')) {
      btn.addEventListener('click', () => {
        if (answeredIdx !== null) return;
        const chosen = Number(btn.dataset.optIdx);
        answeredIdx = chosen;
        if (chosen === q.correctIndex) {
          score += 1;
        }
        renderQuestion();
        card.querySelector<HTMLButtonElement>('#quiz-next-btn')?.focus();
      });
    }

    card.querySelector('#quiz-next-btn')?.addEventListener('click', () => {
      currentIdx += 1;
      answeredIdx = null;
      renderQuestion();
    });
  };

  const open = (systemId: SystemId) => {
    lastFocusedEl = document.activeElement as HTMLElement | null;
    activeSystem = systemId;
    currentIdx = 0;
    score = 0;
    answeredIdx = null;
    backdrop.classList.remove('is-hidden');
    backdrop.inert = false;
    renderQuestion();
    card.querySelector<HTMLButtonElement>('.quiz-option-btn')?.focus();
  };

  return {
    open,
    close,
    isOpen: () => activeSystem !== null,
  };
}

