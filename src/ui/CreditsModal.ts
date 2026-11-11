import type { CarManifestEntry } from '../data/cars';

export interface CreditsModalHandle {
  open: () => void;
  close: () => void;
  setCars: (cars: CarManifestEntry[]) => void;
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

function safeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // not a full URL
  }
  return null;
}

export function createCreditsModal(
  uiRoot: HTMLElement,
  initialCars: CarManifestEntry[],
): CreditsModalHandle {
  let cars = [...initialCars];
  let lastFocusedEl: HTMLElement | null = null;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-hidden';
  backdrop.id = 'credits-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'credits-modal-title');
  backdrop.inert = true;
  backdrop.innerHTML = `<div class="modal-card credits-modal-card" id="credits-modal-card"></div>`;
  uiRoot.appendChild(backdrop);

  const card = backdrop.querySelector<HTMLElement>('#credits-modal-card')!;

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

  const render = () => {
    const seenSources = new Set<string>();
    const modelCredits = cars
      .filter(
        (car): car is CarManifestEntry & { credits: NonNullable<CarManifestEntry['credits']> } =>
          Boolean(car.credits),
      )
      .filter((car) => {
        const key = `${car.modelFile}|${car.credits.author}`;
        if (seenSources.has(key)) return false;
        seenSources.add(key);
        return true;
      });

    card.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-eyebrow">OPEN ATTRIBUTION</div>
          <h2 class="panel-title" id="credits-modal-title">Credits &amp; 3D Model Licenses</h2>
        </div>
        <button type="button" class="panel-close" id="btn-close-credits" aria-label="Close credits modal">✕</button>
      </div>
      <p class="credits-intro">
        HowCarsWork gratefully uses open-licensed CC-BY and CC0 3D vehicle models alongside custom procedural mechanical rigs.
      </p>
      <div class="credits-list">
        ${modelCredits
          .map((car) => {
            const href = safeExternalUrl(car.credits.source);
            const sourceMarkup = href
              ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(car.credits.source)}</a>`
              : `<code>${escapeHtml(car.credits.source)}</code>`;
            return `
              <article class="credit-item">
                <div class="credit-item-head">
                  <strong>${escapeHtml(car.name)}</strong>
                  <span class="credit-license-badge">${escapeHtml(car.credits.license)}</span>
                </div>
                <div class="credit-meta">Author: ${escapeHtml(car.credits.author)}</div>
                <div class="credit-meta">Source: ${sourceMarkup}</div>
              </article>
            `;
          })
          .join('')}
        <article class="credit-item">
          <div class="credit-item-head">
            <strong>Mechanical Rigs, Studio HDR &amp; Cutaways</strong>
            <span class="credit-license-badge">CC0 / In-Repo</span>
          </div>
          <div class="credit-meta">Procedural internal engines, EV drives, transmissions, brakes, suspension, steering, electrical, cooling &amp; exhaust rigs authored for HowCarsWork.</div>
        </article>
        <article class="credit-item">
          <div class="credit-item-head">
            <strong>Libraries &amp; Tooling</strong>
            <span class="credit-license-badge">MIT / Apache-2.0</span>
          </div>
          <div class="credit-meta">Three.js, GSAP, glTF-Transform, Draco WASM decoder, and Meshoptimizer.</div>
        </article>
      </div>
      <div class="credits-footer">
        <button type="button" class="quiz-btn-primary" id="btn-credits-done">Done</button>
      </div>
    `;

    card.querySelector('#btn-close-credits')?.addEventListener('click', close);
    card.querySelector('#btn-credits-done')?.addEventListener('click', close);
  };

  render();

  return {
    open: () => {
      lastFocusedEl = document.activeElement as HTMLElement | null;
      render();
      backdrop.classList.remove('is-hidden');
      backdrop.inert = false;
      card.querySelector<HTMLButtonElement>('#btn-close-credits')?.focus();
    },
    close,
    setCars: (nextCars) => {
      cars = [...nextCars];
      if (!backdrop.classList.contains('is-hidden')) {
        render();
      }
    },
    isOpen: () => !backdrop.classList.contains('is-hidden'),
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    },
  };
}
