export const FEEDBACK_RECIPIENT_EMAIL = 'jayaprakashjp3232@gmail.com';

export type FeedbackCategory =
  | 'feature'
  | 'car-engine'
  | 'model-animation'
  | 'bug';

export interface FeedbackCategoryInfo {
  id: FeedbackCategory;
  label: string;
  tag: string;
  placeholder: string;
}

export const FEEDBACK_CATEGORIES: FeedbackCategoryInfo[] = [
  {
    id: 'feature',
    label: 'Feature Idea',
    tag: 'Feature Suggestion',
    placeholder: 'Describe the feature or learning tool you would like added or updated...',
  },
  {
    id: 'car-engine',
    label: 'New Car / Engine',
    tag: 'Car or Engine Request',
    placeholder: 'Which car model, engine layout, or transmission type should we add next?',
  },
  {
    id: 'model-animation',
    label: '3D & Animation',
    tag: '3D Model Improvement',
    placeholder: 'Which 3D cutaway part, animation, or label needs improvement?',
  },
  {
    id: 'bug',
    label: 'Bug Report',
    tag: 'Bug Report',
    placeholder: 'What happened, and what steps reproduce the issue?',
  },
];

export interface FeedbackModalContext {
  carName?: string;
  powertrain?: string;
  systemName?: string;
  variantName?: string;
  renderMode?: string;
  pageUrl?: string;
}

export interface FeedbackPayloadOptions {
  recipient?: string;
  category: FeedbackCategory;
  summary: string;
  details: string;
  includeContext: boolean;
  context?: FeedbackModalContext;
}

export interface FeedbackMailtoResult {
  recipient: string;
  subject: string;
  body: string;
  mailtoUrl: string;
  clipboardText: string;
}

export function buildFeedbackMailto(options: FeedbackPayloadOptions): FeedbackMailtoResult {
  const recipient = (options.recipient ?? FEEDBACK_RECIPIENT_EMAIL).trim();
  const catInfo =
    FEEDBACK_CATEGORIES.find((c) => c.id === options.category) ?? FEEDBACK_CATEGORIES[0];
  const cleanSummary = options.summary.trim() || `${catInfo.tag}`;
  const subject = `[HowCarsWork - ${catInfo.tag}] ${cleanSummary}`;

  const lines: string[] = [
    `Category: ${catInfo.tag}`,
    '',
    'Feedback / Request:',
    options.details.trim() || '(No additional details provided)',
  ];

  if (options.includeContext && options.context) {
    const c = options.context;
    lines.push('', '--- Viewing Context ---');
    if (c.carName) lines.push(`Car: ${c.carName}`);
    if (c.powertrain) lines.push(`Powertrain: ${c.powertrain}`);
    if (c.systemName) {
      lines.push(`System: ${c.systemName}${c.variantName ? ` (${c.variantName})` : ''}`);
    }
    if (c.renderMode) lines.push(`Render Mode: ${c.renderMode}`);
    if (c.pageUrl) lines.push(`Page URL: ${c.pageUrl}`);
  }

  const body = lines.join('\n');
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  const clipboardText = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;

  return {
    recipient,
    subject,
    body,
    mailtoUrl,
    clipboardText,
  };
}

export interface FeedbackModalHandle {
  open: (context?: FeedbackModalContext) => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createFeedbackModal(uiRoot: HTMLElement): FeedbackModalHandle {
  let currentContext: FeedbackModalContext = {};
  let selectedCategory: FeedbackCategory = 'feature';
  let lastFocusedEl: HTMLElement | null = null;
  let copyTimer: number | null = null;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-hidden';
  backdrop.id = 'feedback-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'feedback-modal-title');
  backdrop.inert = true;
  backdrop.innerHTML = `<div class="modal-card feedback-modal-card" id="feedback-modal-card"></div>`;
  uiRoot.appendChild(backdrop);

  const card = backdrop.querySelector<HTMLElement>('#feedback-modal-card')!;

  const close = () => {
    backdrop.classList.add('is-hidden');
    backdrop.inert = true;
    lastFocusedEl?.focus();
    lastFocusedEl = null;
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !backdrop.classList.contains('is-hidden')) {
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const buildContextSummaryLines = (ctx: FeedbackModalContext): string[] => {
    const out: string[] = [];
    if (ctx.carName) out.push(`Car: ${ctx.carName}`);
    if (ctx.powertrain) out.push(`Powertrain: ${ctx.powertrain}`);
    if (ctx.systemName) {
      out.push(`System: ${ctx.systemName}${ctx.variantName ? ` (${ctx.variantName})` : ''}`);
    }
    if (ctx.renderMode) out.push(`Mode: ${ctx.renderMode}`);
    return out;
  };

  const render = () => {
    const activeCat =
      FEEDBACK_CATEGORIES.find((c) => c.id === selectedCategory) ?? FEEDBACK_CATEGORIES[0];
    const ctxLines = buildContextSummaryLines(currentContext);

    card.innerHTML = `
      <div class="panel-header" style="margin-bottom:8px">
        <div>
          <span class="panel-eyebrow">HOWCARSWORK FEEDBACK</span>
          <h2 class="panel-title" id="feedback-modal-title">Suggest a Feature or Feedback</h2>
        </div>
        <button type="button" class="panel-close" id="btn-feedback-close" aria-label="Close feedback modal">✕</button>
      </div>

      <p class="feedback-subtitle">
        Help improve HowCarsWork! Your feedback opens pre-filled in your email app addressed to
        <code>${escapeHtml(FEEDBACK_RECIPIENT_EMAIL)}</code>.
      </p>

      <div class="feedback-field">
        <span class="feedback-label">Category</span>
        <div class="feedback-cat-group" role="group" aria-label="Feedback category">
          ${FEEDBACK_CATEGORIES.map(
            (cat) => `
              <button
                type="button"
                class="feedback-cat-btn${cat.id === selectedCategory ? ' is-selected' : ''}"
                data-cat-id="${cat.id}"
                aria-pressed="${cat.id === selectedCategory}"
              >${escapeHtml(cat.label)}</button>
            `,
          ).join('')}
        </div>
      </div>

      <div class="feedback-field">
        <label class="feedback-label" for="feedback-summary-input">Short Title</label>
        <input
          type="text"
          id="feedback-summary-input"
          class="feedback-input"
          maxlength="120"
          placeholder="e.g. Add Boxer-6 Porsche engine or Turbo lag gauge"
        />
      </div>

      <div class="feedback-field">
        <label class="feedback-label" for="feedback-details-input">Details</label>
        <textarea
          id="feedback-details-input"
          class="feedback-textarea"
          rows="4"
          placeholder="${escapeHtml(activeCat.placeholder)}"
        ></textarea>
        <div class="feedback-validation-msg" id="feedback-validation-msg" hidden>
          Please enter a quick description before sending.
        </div>
      </div>

      <label class="feedback-context-toggle">
        <input type="checkbox" id="chk-feedback-context" checked />
        <span>Include current viewing context (${escapeHtml(ctxLines.join(' · ') || 'Full Car')})</span>
      </label>

      <div class="feedback-actions">
        <button type="button" class="quiz-btn-primary feedback-send-btn" id="btn-feedback-mailto">
          Open in Email Client →
        </button>
        <button type="button" class="btn btn-subtle feedback-copy-btn" id="btn-feedback-copy">
          Copy Email Text
        </button>
      </div>

      <div class="feedback-hint-status" id="feedback-hint-status" aria-live="polite"></div>
    `;

    card.querySelector('#btn-feedback-close')?.addEventListener('click', close);

    const summaryInput = card.querySelector<HTMLInputElement>('#feedback-summary-input')!;
    const detailsInput = card.querySelector<HTMLTextAreaElement>('#feedback-details-input')!;
    const contextChk = card.querySelector<HTMLInputElement>('#chk-feedback-context')!;
    const validationMsg = card.querySelector<HTMLElement>('#feedback-validation-msg')!;
    const hintStatus = card.querySelector<HTMLElement>('#feedback-hint-status')!;
    const copyBtn = card.querySelector<HTMLButtonElement>('#btn-feedback-copy')!;
    const mailtoBtn = card.querySelector<HTMLButtonElement>('#btn-feedback-mailto')!;

    const catButtons = Array.from(card.querySelectorAll<HTMLButtonElement>('.feedback-cat-btn'));
    for (const btn of catButtons) {
      btn.addEventListener('click', () => {
        selectedCategory = (btn.dataset.catId as FeedbackCategory) || 'feature';
        for (const other of catButtons) {
          const match = other.dataset.catId === selectedCategory;
          other.classList.toggle('is-selected', match);
          other.setAttribute('aria-pressed', String(match));
        }
        const catMeta =
          FEEDBACK_CATEGORIES.find((c) => c.id === selectedCategory) ?? FEEDBACK_CATEGORIES[0];
        detailsInput.placeholder = catMeta.placeholder;
      });
    }

    const gatherPayload = (): FeedbackMailtoResult | null => {
      if (!detailsInput.value.trim() && !summaryInput.value.trim()) {
        validationMsg.hidden = false;
        detailsInput.focus();
        return null;
      }
      validationMsg.hidden = true;
      return buildFeedbackMailto({
        category: selectedCategory,
        summary: summaryInput.value,
        details: detailsInput.value,
        includeContext: contextChk.checked,
        context: currentContext,
      });
    };

    detailsInput.addEventListener('input', () => {
      if (!validationMsg.hidden && detailsInput.value.trim()) {
        validationMsg.hidden = true;
      }
    });

    summaryInput.addEventListener('input', () => {
      if (!validationMsg.hidden && summaryInput.value.trim()) {
        validationMsg.hidden = true;
      }
    });

    mailtoBtn.addEventListener('click', () => {
      const payload = gatherPayload();
      if (!payload) return;
      hintStatus.textContent =
        'Opening your default email app. If it does not open automatically, click "Copy Email Text" and paste into webmail.';
      window.location.href = payload.mailtoUrl;
    });

    copyBtn.addEventListener('click', async () => {
      const payload = gatherPayload();
      if (!payload) return;
      try {
        await navigator.clipboard.writeText(payload.clipboardText);
      } catch {
        const helper = document.createElement('textarea');
        helper.value = payload.clipboardText;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
      copyBtn.textContent = '✓ Copied to Clipboard!';
      hintStatus.textContent = `Copied email for ${FEEDBACK_RECIPIENT_EMAIL}.`;
      if (copyTimer !== null) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        copyBtn.textContent = 'Copy Email Text';
      }, 2400);
    });
  };

  return {
    open(context: FeedbackModalContext = {}) {
      lastFocusedEl = document.activeElement as HTMLElement | null;
      currentContext = context;
      selectedCategory = 'feature';
      render();
      backdrop.classList.remove('is-hidden');
      backdrop.inert = false;
      window.setTimeout(() => {
        card.querySelector<HTMLInputElement>('#feedback-summary-input')?.focus();
      }, 40);
    },
    close,
    isOpen() {
      return !backdrop.classList.contains('is-hidden');
    },
    destroy() {
      if (copyTimer !== null) window.clearTimeout(copyTimer);
      window.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    },
  };
}

