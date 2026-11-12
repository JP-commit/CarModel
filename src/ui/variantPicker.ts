import type { CarManifestEntry } from '../data/cars';
import { getAllowedEngines, getAllowedTransmissions } from '../data/cars';
import {
  ENGINE_VARIANT_OPTIONS,
  TRANSMISSION_VARIANT_OPTIONS,
  type VariantOption,
} from '../data/systems';
import { appStore, getActiveSystemVariant, type SystemId } from '../state/appState';

export function getVariantOptionsForSystem(
  systemId: SystemId,
  car: CarManifestEntry | null | undefined,
): { label: string; options: VariantOption[]; activeId: string | undefined } {
  const snap = appStore.getSnapshot();
  const activeId = getActiveSystemVariant(snap, systemId);
  if (snap.activePowertrain === 'ev') {
    return { label: 'Type', options: [], activeId };
  }

  if (systemId === 'transmission') {
    const allowed = car
      ? getAllowedTransmissions(car)
      : (['manual', 'amt', 'at', 'cvt', 'dct'] as const);
    const allowedSet = new Set<string>(allowed);
    return {
      label: 'Gearbox Type',
      options: TRANSMISSION_VARIANT_OPTIONS.filter((o) => allowedSet.has(o.id)),
      activeId,
    };
  }

  if (systemId === 'engine') {
    const allowed = car
      ? getAllowedEngines(car)
      : (['single-cylinder', 'i3', 'i4', 'i6', 'v6', 'v8', 'flat-4', 'rotary'] as const);
    const allowedSet = new Set<string>(allowed);
    return {
      label: 'Engine Layout',
      options: ENGINE_VARIANT_OPTIONS.filter((o) => allowedSet.has(o.id)),
      activeId,
    };
  }

  return { label: 'Type', options: [], activeId };
}

export function renderVariantPickerMarkup(
  idPrefix: string,
  systemId: SystemId,
  car: CarManifestEntry | null | undefined,
): string {
  const { label, options, activeId } = getVariantOptionsForSystem(systemId, car);
  if (options.length <= 1) return '';

  return `
    <div class="variant-picker-block" data-variant-system="${systemId}">
      <div class="variant-picker-head">
        <span class="section-label" style="margin:0">${label.toUpperCase()}</span>
      </div>
      <div class="variant-seg-row" role="group" aria-label="${label}">
        ${options
          .map(
            (opt) => `
              <button
                type="button"
                class="variant-seg-btn"
                data-variant-id="${opt.id}"
                aria-pressed="${opt.id === activeId}"
                title="${opt.label}"
              >${opt.shortLabel}</button>
            `,
          )
          .join('')}
      </div>
      <select
        class="variant-mobile-select"
        id="${idPrefix}-variant-select"
        aria-label="${label}"
      >
        ${options
          .map(
            (opt) => `
              <option value="${opt.id}" ${opt.id === activeId ? 'selected' : ''}>${opt.label}</option>
            `,
          )
          .join('')}
      </select>
    </div>
  `;
}

export function bindVariantPickerEvents(
  container: HTMLElement,
  onSelect: (variantId: string) => void,
): void {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.variant-seg-btn'));
  const selectEl = container.querySelector<HTMLSelectElement>('.variant-mobile-select');

  const syncSelection = (nextId: string) => {
    for (const btn of buttons) {
      btn.setAttribute('aria-pressed', String(btn.dataset.variantId === nextId));
    }
    if (selectEl && selectEl.value !== nextId) {
      selectEl.value = nextId;
    }
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const nextId = btn.dataset.variantId;
      if (!nextId || btn.getAttribute('aria-pressed') === 'true') return;
      syncSelection(nextId);
      onSelect(nextId);
    });
  }

  selectEl?.addEventListener('change', () => {
    const nextId = selectEl.value;
    if (!nextId) return;
    syncSelection(nextId);
    onSelect(nextId);
  });
}

