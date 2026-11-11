import { POWERTRAIN_LABELS, type CarManifestEntry, type CarStyle } from '../data/cars';

export interface CarPickerActions {
  onSelectCar: (car: CarManifestEntry) => void;
  onVisibilityChange?: (open: boolean) => void;
}

export interface CarPickerHandle {
  isOpen: () => boolean;
  open: () => void;
  close: (restoreFocus?: boolean) => void;
  toggle: () => void;
  setCars: (nextCars: CarManifestEntry[]) => void;
  setActiveCarId: (carId: string) => void;
  destroy: () => void;
}

export interface ModelErrorCardHandle {
  show: (options: {
    carName: string;
    message: string;
    canFallback: boolean;
    onRetry: () => void;
    onFallback: () => void;
  }) => void;
  hide: () => void;
  destroy: () => void;
}

function getGridColumnCount(gridEl: HTMLElement): number {
  const buttons = Array.from(gridEl.querySelectorAll<HTMLButtonElement>('.car-card'));
  if (buttons.length < 2) return 1;
  const firstTop = buttons[0].getBoundingClientRect().top;
  let cols = 0;
  for (const btn of buttons) {
    if (Math.abs(btn.getBoundingClientRect().top - firstTop) < 6) {
      cols += 1;
    } else {
      break;
    }
  }
  return Math.max(1, cols);
}

export function createCarPicker(
  uiRoot: HTMLElement,
  initialCars: CarManifestEntry[],
  actions: CarPickerActions,
): CarPickerHandle {
  let cars = [...initialCars];
  let activeCarId = cars[0]?.id ?? '';
  let activeTab: CarStyle = 'realistic';
  let openState = false;

  const popover = document.createElement('div');
  popover.id = 'car-picker-popover';
  popover.className = 'car-picker-popover is-hidden';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Choose a car model');
  popover.setAttribute('aria-modal', 'false');
  popover.tabIndex = -1;

  const header = document.createElement('div');
  header.className = 'car-picker-header';

  const headerCopy = document.createElement('div');
  const titleEl = document.createElement('h3');
  titleEl.className = 'car-picker-title';
  titleEl.textContent = 'Select a Vehicle';

  const subEl = document.createElement('p');
  subEl.className = 'car-picker-subtitle';
  subEl.textContent = 'Switch body styles and powertrains';
  headerCopy.append(titleEl, subEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn car-picker-close';
  closeBtn.setAttribute('aria-label', 'Close car picker');
  closeBtn.textContent = '×';

  header.append(headerCopy, closeBtn);

  const tabBar = document.createElement('div');
  tabBar.className = 'car-picker-tabs';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', 'Vehicle style category');

  const STYLE_TABS: { id: CarStyle; label: string }[] = [
    { id: 'realistic', label: 'Realistic' },
    { id: 'stylized', label: 'Stylized' },
  ];

  const tabButtons = new Map<CarStyle, HTMLButtonElement>();
  for (const tabSpec of STYLE_TABS) {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.className = 'car-picker-tab';
    tabBtn.dataset.styleTab = tabSpec.id;
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('aria-selected', String(tabSpec.id === activeTab));
    tabBtn.innerHTML = `<span>${tabSpec.label}</span><span class="car-tab-count">0</span>`;
    tabBtn.addEventListener('click', () => {
      if (activeTab === tabSpec.id) return;
      activeTab = tabSpec.id;
      syncTabUI();
      renderGrid();
    });
    tabBar.appendChild(tabBtn);
    tabButtons.set(tabSpec.id, tabBtn);
  }

  tabBar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      activeTab = activeTab === 'realistic' ? 'stylized' : 'realistic';
      syncTabUI();
      renderGrid();
      tabButtons.get(activeTab)?.focus();
    }
  });

  const gridEl = document.createElement('div');
  gridEl.className = 'car-grid';
  gridEl.setAttribute('role', 'listbox');
  gridEl.setAttribute('aria-label', 'Car models');

  popover.append(header, tabBar, gridEl);
  uiRoot.appendChild(popover);

  const cardButtons = new Map<string, HTMLButtonElement>();

  const getCarStyle = (car: CarManifestEntry): CarStyle =>
    car.style ?? (car.id === 'coupe' ? 'realistic' : 'stylized');

  const syncTabUI = () => {
    for (const tabSpec of STYLE_TABS) {
      const btn = tabButtons.get(tabSpec.id);
      if (!btn) continue;
      const count = cars.filter((c) => getCarStyle(c) === tabSpec.id).length;
      btn.setAttribute('aria-selected', String(tabSpec.id === activeTab));
      const countEl = btn.querySelector('.car-tab-count');
      if (countEl) countEl.textContent = String(count);
    }
  };

  const updateActiveStyles = () => {
    for (const [id, btn] of cardButtons) {
      const isActive = id === activeCarId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      const checkEl = btn.querySelector<HTMLElement>('.car-active-check');
      if (checkEl) {
        checkEl.textContent = isActive ? 'Active' : '';
      }
    }
  };

  const renderGrid = () => {
    syncTabUI();
    gridEl.innerHTML = '';
    cardButtons.clear();

    const filtered = cars.filter((c) => getCarStyle(c) === activeTab);
    if (filtered.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'car-picker-empty';
      emptyEl.textContent =
        activeTab === 'realistic'
          ? 'No realistic models available yet.'
          : 'No stylized models available.';
      gridEl.appendChild(emptyEl);
      return;
    }

    for (const car of filtered) {
      const isActive = car.id === activeCarId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = isActive ? 'car-card is-active' : 'car-card';
      btn.dataset.carId = car.id;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(isActive));

      const topRow = document.createElement('div');
      topRow.className = 'car-card-top';

      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'car-card-badges';

      const badge = document.createElement('span');
      badge.className = `car-powertrain-badge badge--${car.powertrain}`;
      badge.textContent = POWERTRAIN_LABELS[car.powertrain];
      badgesWrap.appendChild(badge);

      if (getCarStyle(car) === 'stylized') {
        const styleBadge = document.createElement('span');
        styleBadge.className = 'car-style-badge badge--stylized';
        styleBadge.textContent = 'Stylized';
        badgesWrap.appendChild(styleBadge);
      }
      if (car.quality === 'outline-only') {
        const qualityBadge = document.createElement('span');
        qualityBadge.className = 'car-style-badge badge--outline-only';
        qualityBadge.textContent = 'Outline only';
        badgesWrap.appendChild(qualityBadge);
      }

      const activeTag = document.createElement('span');
      activeTag.className = 'car-active-check';
      activeTag.setAttribute('aria-hidden', 'true');
      activeTag.textContent = isActive ? 'Active' : '';

      topRow.append(badgesWrap, activeTag);

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'car-card-thumb';
      const img = document.createElement('img');
      img.src = car.thumbnail;
      img.alt = `${car.name} outline silhouette`;
      img.decoding = 'async';
      thumbWrap.appendChild(img);

      const metaWrap = document.createElement('div');
      metaWrap.className = 'car-card-meta';

      const nameEl = document.createElement('span');
      nameEl.className = 'car-card-name';
      nameEl.textContent = car.name;

      const bodyEl = document.createElement('span');
      bodyEl.className = 'car-card-body';
      bodyEl.textContent = car.bodyType;

      metaWrap.append(nameEl, bodyEl);
      btn.append(topRow, thumbWrap, metaWrap);

      btn.addEventListener('click', (e) => {
        const selected = cars.find((entry) => entry.id === car.id);
        close(e.detail === 0);
        if (selected) {
          actions.onSelectCar(selected);
        }
      });

      gridEl.appendChild(btn);
      cardButtons.set(car.id, btn);
    }
  };

  const open = () => {
    if (openState) return;
    openState = true;
    popover.classList.remove('is-hidden');
    actions.onVisibilityChange?.(true);

    const target =
      cardButtons.get(activeCarId) ?? gridEl.querySelector<HTMLButtonElement>('.car-card');
    target?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (openState && !popover.contains(document.activeElement)) {
        target?.focus({ preventScroll: true });
      }
    });
  };

  const close = (restoreFocus = false) => {
    if (!openState) return;
    openState = false;
    popover.classList.add('is-hidden');
    actions.onVisibilityChange?.(false);

    if (restoreFocus) {
      const trigger = document.getElementById('btn-car-picker') as HTMLElement | null;
      trigger?.focus();
    }
  };

  const toggle = () => {
    if (openState) {
      close(true);
    } else {
      open();
    }
  };

  const onGridKeyDown = (e: KeyboardEvent) => {
    const ordered = Array.from(gridEl.querySelectorAll<HTMLButtonElement>('.car-card'));
    if (ordered.length === 0) return;

    const currentIdx = ordered.indexOf(document.activeElement as HTMLButtonElement);
    const cols = getGridColumnCount(gridEl);
    let nextIdx = -1;

    switch (e.key) {
      case 'ArrowRight':
        nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % ordered.length;
        break;
      case 'ArrowLeft':
        nextIdx = currentIdx <= 0 ? ordered.length - 1 : currentIdx - 1;
        break;
      case 'ArrowDown':
        nextIdx = currentIdx < 0 ? 0 : (currentIdx + cols) % ordered.length;
        break;
      case 'ArrowUp':
        nextIdx =
          currentIdx < 0
            ? ordered.length - 1
            : (currentIdx - cols + ordered.length) % ordered.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = ordered.length - 1;
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      default:
        return;
    }

    e.preventDefault();
    ordered[nextIdx]?.focus();
  };

  const onDocPointerDown = (e: PointerEvent) => {
    if (!openState) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (popover.contains(target) || target.closest('#btn-car-picker')) return;
    close(false);
  };

  closeBtn.addEventListener('click', () => close(true));
  popover.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    onGridKeyDown(e);
  });
  document.addEventListener('pointerdown', onDocPointerDown);

  renderGrid();

  return {
    isOpen: () => openState,
    open,
    close,
    toggle,
    setCars: (nextCars) => {
      cars = [...nextCars];
      renderGrid();
    },
    setActiveCarId: (carId) => {
      activeCarId = carId;
      updateActiveStyles();
    },
    destroy: () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      popover.remove();
    },
  };
}

export function createModelErrorCard(uiRoot: HTMLElement): ModelErrorCardHandle {
  const card = document.createElement('div');
  card.id = 'model-error-card';
  card.className = 'model-error-card is-hidden';
  card.setAttribute('role', 'alert');
  card.setAttribute('aria-live', 'assertive');

  const title = document.createElement('h3');
  title.className = 'model-error-title';

  const desc = document.createElement('p');
  desc.className = 'model-error-message';

  const actionsRow = document.createElement('div');
  actionsRow.className = 'model-error-actions';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'btn btn-accent';
  retryBtn.textContent = 'Retry';

  const fallbackBtn = document.createElement('button');
  fallbackBtn.type = 'button';
  fallbackBtn.className = 'btn';
  fallbackBtn.textContent = 'Load Default Car';

  actionsRow.append(retryBtn, fallbackBtn);
  card.append(title, desc, actionsRow);
  uiRoot.appendChild(card);

  let retryHandler: (() => void) | null = null;
  let fallbackHandler: (() => void) | null = null;

  retryBtn.addEventListener('click', () => {
    retryHandler?.();
  });

  fallbackBtn.addEventListener('click', () => {
    fallbackHandler?.();
  });

  return {
    show: ({ carName, message, canFallback, onRetry, onFallback }) => {
      title.textContent = `Unable to load ${carName}`;
      desc.textContent = message;
      fallbackBtn.style.display = canFallback ? '' : 'none';
      retryHandler = onRetry;
      fallbackHandler = onFallback;
      card.classList.remove('is-hidden');
      retryBtn.focus();
    },
    hide: () => {
      card.classList.add('is-hidden');
      retryHandler = null;
      fallbackHandler = null;
    },
    destroy: () => {
      card.remove();
    },
  };
}

