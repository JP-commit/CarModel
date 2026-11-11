export interface MobileSheetOptions {
  collapsedLabel?: string;
  expandedLabel?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export interface MobileSheetBinding {
  syncLabel: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isCollapsed: () => boolean;
  destroy: () => void;
}

/**
 * Wires drag-down/drag-up touch & pointer gestures plus an explicit collapse toggle
 * button for mobile bottom sheets without blocking internal vertical/horizontal scrolling.
 */
export function bindMobileSheetGesture(
  panel: HTMLElement,
  grabber: HTMLElement,
  toggleBtn: HTMLButtonElement | null,
  options: MobileSheetOptions = {},
): MobileSheetBinding {
  const collapsedLabel = options.collapsedLabel ?? 'Show ▴';
  const expandedLabel = options.expandedLabel ?? 'Hide ▾';

  let dragStartX = 0;
  let dragStartY = 0;
  let dragActive = false;
  let suppressNextClick = false;
  let startScrollTop = 0;

  const isCollapsed = () => panel.classList.contains('is-collapsed-mobile');

  const syncLabel = () => {
    const collapsed = isCollapsed();
    if (toggleBtn) {
      toggleBtn.textContent = collapsed ? collapsedLabel : expandedLabel;
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    }
  };

  const setCollapsed = (collapsed: boolean) => {
    const prev = isCollapsed();
    panel.classList.toggle('is-collapsed-mobile', collapsed);
    if (!collapsed) {
      panel.scrollTop = 0;
    }
    syncLabel();
    if (prev !== collapsed) {
      options.onCollapsedChange?.(collapsed);
    }
  };

  const beginDrag = (x: number, y: number, fromGrabber: boolean) => {
    if (!fromGrabber && panel.scrollTop > 4 && !isCollapsed()) {
      dragActive = false;
      return;
    }
    dragActive = true;
    dragStartX = x;
    dragStartY = y;
    startScrollTop = panel.scrollTop;
  };

  const endDrag = (x: number, y: number, fromGrabber: boolean) => {
    if (!dragActive) return;
    dragActive = false;
    const dx = x - dragStartX;
    const dy = y - dragStartY;
    const absY = Math.abs(dy);
    const absX = Math.abs(dx);

    // Require clear vertical intent so horizontal rail swipes never misfire
    if (absY >= 24 && absY > absX * 1.1) {
      if (dy > 0 && (fromGrabber || startScrollTop <= 4)) {
        setCollapsed(true);
        suppressNextClick = true;
        return;
      }
      if (dy < 0 && isCollapsed()) {
        setCollapsed(false);
        suppressNextClick = true;
        return;
      }
    }

    if (fromGrabber && Math.hypot(dx, dy) < 8) {
      setCollapsed(!isCollapsed());
      suppressNextClick = true;
    }
  };

  const onGrabberPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button') === toggleBtn) return;
    beginDrag(e.clientX, e.clientY, true);
    try {
      grabber.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointer
    }
  };

  const onGrabberPointerUp = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button') === toggleBtn) return;
    endDrag(e.clientX, e.clientY, true);
  };

  const onGrabberTouchStart = (e: TouchEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button') === toggleBtn) return;
    const t = e.touches[0];
    if (t) beginDrag(t.clientX, t.clientY, true);
  };

  const onGrabberTouchEnd = (e: TouchEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button') === toggleBtn) return;
    const t = e.changedTouches[0];
    if (t) endDrag(t.clientX, t.clientY, true);
  };

  const onPanelTouchStart = (e: TouchEvent) => {
    if (window.innerWidth > 768) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input[type="range"]')) return;
    if (grabber.contains(target)) return;
    const t = e.touches[0];
    if (t) beginDrag(t.clientX, t.clientY, false);
  };

  const onPanelTouchEnd = (e: TouchEvent) => {
    if (window.innerWidth > 768) return;
    const target = e.target as HTMLElement | null;
    if (grabber.contains(target)) return;
    const t = e.changedTouches[0];
    if (t) endDrag(t.clientX, t.clientY, false);
  };

  const onGrabberClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button') === toggleBtn) return;
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    setCollapsed(!isCollapsed());
  };

  const onToggleClick = (e: MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!isCollapsed());
  };

  grabber.addEventListener('pointerdown', onGrabberPointerDown);
  grabber.addEventListener('pointerup', onGrabberPointerUp);
  grabber.addEventListener('touchstart', onGrabberTouchStart, { passive: true });
  grabber.addEventListener('touchend', onGrabberTouchEnd, { passive: true });
  grabber.addEventListener('click', onGrabberClick);
  panel.addEventListener('touchstart', onPanelTouchStart, { passive: true });
  panel.addEventListener('touchend', onPanelTouchEnd, { passive: true });
  toggleBtn?.addEventListener('click', onToggleClick);

  syncLabel();

  return {
    syncLabel,
    setCollapsed,
    isCollapsed,
    destroy: () => {
      grabber.removeEventListener('pointerdown', onGrabberPointerDown);
      grabber.removeEventListener('pointerup', onGrabberPointerUp);
      grabber.removeEventListener('touchstart', onGrabberTouchStart);
      grabber.removeEventListener('touchend', onGrabberTouchEnd);
      grabber.removeEventListener('click', onGrabberClick);
      panel.removeEventListener('touchstart', onPanelTouchStart);
      panel.removeEventListener('touchend', onPanelTouchEnd);
      toggleBtn?.removeEventListener('click', onToggleClick);
    },
  };
}

