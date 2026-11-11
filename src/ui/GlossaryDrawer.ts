import { GLOSSARY_TERMS, type GlossaryTerm } from '../data/glossary';

export interface GlossaryDrawerHandle {
  open: (focusTermId?: string) => void;
  close: () => void;
  isOpen: () => boolean;
}

const CATEGORIES: ('All' | GlossaryTerm['category'])[] = [
  'All',
  'Engine',
  'Drivetrain',
  'Chassis',
  'Electrical',
  'Fluids & Emissions',
];

export function createGlossaryDrawer(uiRoot: HTMLElement): GlossaryDrawerHandle {
  const drawer = document.createElement('aside');
  drawer.className = 'glossary-drawer is-hidden';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'false');
  drawer.setAttribute('aria-label', 'Automotive Glossary');
  drawer.inert = true;

  drawer.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-eyebrow">BEGINNER REFERENCE</div>
        <h2 class="panel-title" style="font-size:1.35rem">Car Glossary</h2>
      </div>
      <button type="button" class="panel-close" id="glossary-close-btn" aria-label="Close glossary">✕</button>
    </div>

    <div class="glossary-search-wrap">
      <label class="sr-only" for="glossary-search-input">Search car terms</label>
      <input
        type="search"
        id="glossary-search-input"
        class="glossary-search-input"
        placeholder="Search terms (e.g. piston, torque, caliper)…"
      />
    </div>

    <div class="glossary-cat-row" role="group" aria-label="Filter by topic">
      ${CATEGORIES.map(
        (cat) => `
          <button
            type="button"
            class="key-part-chip glossary-cat-btn"
            data-cat="${cat}"
            aria-pressed="${cat === 'All'}"
          >${cat}</button>
        `,
      ).join('')}
    </div>

    <div class="glossary-list" id="glossary-list"></div>
  `;
  uiRoot.appendChild(drawer);

  const searchInput = drawer.querySelector<HTMLInputElement>('#glossary-search-input')!;
  const listEl = drawer.querySelector<HTMLElement>('#glossary-list')!;
  const catButtons = Array.from(drawer.querySelectorAll<HTMLButtonElement>('.glossary-cat-btn'));
  const closeBtn = drawer.querySelector<HTMLButtonElement>('#glossary-close-btn')!;

  let activeCat: 'All' | GlossaryTerm['category'] = 'All';
  let highlightedTermId: string | null = null;
  let lastFocusedEl: HTMLElement | null = null;
  let openState = false;

  const renderList = () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = GLOSSARY_TERMS.filter((item) => {
      const catMatch = activeCat === 'All' || item.category === activeCat;
      if (!catMatch) return false;
      if (!query) return true;
      return (
        item.term.toLowerCase().includes(query) ||
        item.shortDef.toLowerCase().includes(query) ||
        item.analogy.toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<p style="color:var(--text-secondary);font-size:0.85rem">No matching terms found.</p>`;
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (item) => `
          <article class="glossary-item ${item.id === highlightedTermId ? 'is-highlighted' : ''}" id="glossary-term-${item.id}">
            <div class="glossary-item-head">
              <h3>${item.term}</h3>
              <span>${item.category}</span>
            </div>
            <p>${item.shortDef}</p>
            <div class="glossary-analogy"><strong>Analogy:</strong> ${item.analogy}</div>
          </article>
        `,
      )
      .join('');
  };

  searchInput.addEventListener('input', () => {
    highlightedTermId = null;
    renderList();
  });

  for (const btn of catButtons) {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat as 'All' | GlossaryTerm['category'];
      for (const other of catButtons) {
        other.setAttribute('aria-pressed', String(other === btn));
      }
      highlightedTermId = null;
      renderList();
    });
  }

  const close = () => {
    openState = false;
    drawer.classList.add('is-hidden');
    drawer.inert = true;
    lastFocusedEl?.focus();
    lastFocusedEl = null;
  };

  closeBtn.addEventListener('click', close);

  const open = (focusTermId?: string) => {
    if (!openState) {
      lastFocusedEl = document.activeElement as HTMLElement | null;
    }
    openState = true;
    drawer.classList.remove('is-hidden');
    drawer.inert = false;
    if (focusTermId) {
      activeCat = 'All';
      searchInput.value = '';
      for (const b of catButtons) {
        b.setAttribute('aria-pressed', String(b.dataset.cat === 'All'));
      }
      highlightedTermId = focusTermId;
    } else {
      highlightedTermId = null;
    }
    renderList();

    if (focusTermId) {
      const target = drawer.querySelector<HTMLElement>(`#glossary-term-${focusTermId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      searchInput.focus();
    }
  };

  renderList();

  return {
    open,
    close,
    isOpen: () => openState,
  };
}

