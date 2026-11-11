import { DRIVETRAIN_SPECS, type DrivetrainId } from '../data/compare';

export interface CompareOverlayActions {
  onThrottleChange: (value: number) => void;
  onTogglePlay: (playing: boolean) => void;
  onSelectMobileTab: (id: DrivetrainId) => void;
  onExitCompare: () => void;
}

export interface CompareOverlayHandle {
  open: () => void;
  close: () => void;
}

export function createCompareOverlay(
  uiRoot: HTMLElement,
  actions: CompareOverlayActions,
): CompareOverlayHandle {
  const overlay = document.createElement('section');
  overlay.className = 'compare-overlay is-hidden';
  overlay.setAttribute('aria-label', 'Petrol vs Diesel vs Electric drivetrain comparison');
  overlay.inert = true;
  uiRoot.appendChild(overlay);

  let isPlaying = true;
  let throttle = 45;
  let mobileActive: DrivetrainId = 'petrol';

  const render = () => {
    overlay.innerHTML = `
      <div class="compare-toolbar">
        <div class="compare-toolbar-left">
          <button type="button" class="btn" id="compare-back-btn">← Back to Car</button>
          <span class="panel-eyebrow" style="margin:0">PETROL VS DIESEL VS ELECTRIC</span>
        </div>

        <div class="compare-toolbar-controls">
          <button type="button" class="btn btn-accent" id="compare-play-btn" aria-pressed="${isPlaying}">
            ${isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <div class="compare-throttle">
            <label for="compare-throttle-slider">Throttle</label>
            <input
              type="range"
              class="range-input"
              id="compare-throttle-slider"
              min="0"
              max="100"
              value="${throttle}"
            />
            <output id="compare-throttle-out" for="compare-throttle-slider">${throttle}%</output>
          </div>
        </div>

        <div class="compare-mobile-tabs" role="tablist" aria-label="Choose drivetrain on mobile">
          ${DRIVETRAIN_SPECS.map(
            (d) => `
              <button
                type="button"
                class="env-seg-btn compare-mob-tab"
                data-dt="${d.id}"
                aria-pressed="${d.id === mobileActive}"
              >${d.id === 'electric' ? 'Electric' : d.id === 'diesel' ? 'Diesel' : 'Petrol'}</button>
            `,
          ).join('')}
        </div>
      </div>

      <div class="compare-columns">
        ${DRIVETRAIN_SPECS.map(
          (d) => `
            <article class="compare-col-card ${d.id === mobileActive ? 'is-mobile-active' : ''}">
              <div class="compare-col-head">
                <div>
                  <span class="compare-badge">${d.badge}</span>
                  <h3>${d.name}</h3>
                </div>
                <span class="compare-sub">${d.subtitle}</span>
              </div>
              <dl class="compare-specs">
                <div><dt>Ignition</dt><dd>${d.ignition}</dd></div>
                <div><dt>Moving Parts</dt><dd>${d.movingParts}</dd></div>
                <div><dt>Gearbox</dt><dd>${d.gearbox}</dd></div>
                <div><dt>Power & Torque</dt><dd>${d.torqueCurve}</dd></div>
                <div><dt>Efficiency</dt><dd>${d.efficiency}</dd></div>
                <div><dt>Emissions</dt><dd>${d.emissions}</dd></div>
              </dl>
              <div class="analogy-box" style="margin:0;padding:8px 10px">
                <strong>THINK OF IT LIKE</strong>
                <span style="font-size:0.78rem">${d.analogy}</span>
              </div>
            </article>
          `,
        ).join('')}
      </div>
    `;

    overlay.querySelector('#compare-back-btn')!.addEventListener('click', actions.onExitCompare);

    const playBtn = overlay.querySelector<HTMLButtonElement>('#compare-play-btn')!;
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.setAttribute('aria-pressed', String(isPlaying));
      playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
      actions.onTogglePlay(isPlaying);
    });

    const slider = overlay.querySelector<HTMLInputElement>('#compare-throttle-slider')!;
    const out = overlay.querySelector<HTMLOutputElement>('#compare-throttle-out')!;
    slider.addEventListener('input', () => {
      throttle = Number(slider.value);
      out.textContent = `${throttle}%`;
      actions.onThrottleChange(throttle / 100);
    });

    for (const tab of overlay.querySelectorAll<HTMLButtonElement>('.compare-mob-tab')) {
      tab.addEventListener('click', () => {
        mobileActive = tab.dataset.dt as DrivetrainId;
        actions.onSelectMobileTab(mobileActive);
        render();
      });
    }
  };

  const open = () => {
    isPlaying = true;
    throttle = 45;
    mobileActive = 'petrol';
    overlay.classList.remove('is-hidden');
    overlay.inert = false;
    render();
    actions.onThrottleChange(throttle / 100);
    actions.onTogglePlay(true);
  };

  const close = () => {
    overlay.classList.add('is-hidden');
    overlay.inert = true;
  };

  return { open, close };
}
