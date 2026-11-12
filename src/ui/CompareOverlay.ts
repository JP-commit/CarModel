import {
  DRIVETRAIN_SPECS,
  TRANSMISSION_COMPARE_SPECS,
  type CompareCategory,
  type CompareTransmissionId,
  type DrivetrainId,
} from '../data/compare';

export interface CompareOverlayActions {
  onThrottleChange: (value: number) => void;
  onTogglePlay: (playing: boolean) => void;
  onSelectMobileTab: (id: DrivetrainId) => void;
  onChangeCategory?: (category: CompareCategory) => void;
  onSelectMobileTransTab?: (id: CompareTransmissionId) => void;
  onChangeThirdTransSlot?: (slot: 'cvt' | 'dct') => void;
  onExitCompare: () => void;
}

export interface CompareOverlayHandle {
  open: (initialCategory?: CompareCategory) => void;
  close: () => void;
}

export function createCompareOverlay(
  uiRoot: HTMLElement,
  actions: CompareOverlayActions,
): CompareOverlayHandle {
  const overlay = document.createElement('section');
  overlay.className = 'compare-overlay is-hidden';
  overlay.setAttribute('aria-label', 'Drivetrain and transmission comparison');
  overlay.inert = true;
  uiRoot.appendChild(overlay);

  let category: CompareCategory = 'drivetrains';
  let isPlaying = true;
  let throttle = 45;
  let mobileActive: DrivetrainId = 'petrol';
  let mobileTransActive: CompareTransmissionId = 'manual';
  let thirdTransSlot: 'cvt' | 'dct' = 'cvt';

  const render = () => {
    const isTrans = category === 'transmissions';
    const desktopTransSpecs = TRANSMISSION_COMPARE_SPECS.filter(
      (t) => t.id === 'manual' || t.id === 'at' || t.id === thirdTransSlot,
    );

    overlay.innerHTML = `
      <div class="compare-toolbar">
        <div class="compare-toolbar-left">
          <button type="button" class="btn" id="compare-back-btn">← Back to Car</button>
          <div class="compare-category-seg" role="group" aria-label="Comparison topic">
            <button type="button" class="env-seg-btn compare-cat-btn" data-cat="drivetrains" aria-pressed="${!isTrans}">Drivetrains</button>
            <button type="button" class="env-seg-btn compare-cat-btn" data-cat="transmissions" aria-pressed="${isTrans}">Transmissions</button>
          </div>
          ${
            isTrans
              ? `<div class="compare-category-seg" role="group" aria-label="Third transmission slot">
                  <button type="button" class="env-seg-btn compare-slot-btn" data-slot="cvt" aria-pressed="${thirdTransSlot === 'cvt'}">vs CVT</button>
                  <button type="button" class="env-seg-btn compare-slot-btn" data-slot="dct" aria-pressed="${thirdTransSlot === 'dct'}">vs DCT</button>
                </div>`
              : ''
          }
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

        <div class="compare-mobile-tabs" role="tablist" aria-label="Choose comparison column on mobile">
          ${
            isTrans
              ? TRANSMISSION_COMPARE_SPECS.map(
                  (t) => `
                    <button
                      type="button"
                      class="env-seg-btn compare-mob-tab"
                      data-trans="${t.id}"
                      aria-pressed="${t.id === mobileTransActive}"
                    >${t.id.toUpperCase()}</button>
                  `,
                ).join('')
              : DRIVETRAIN_SPECS.map(
                  (d) => `
                    <button
                      type="button"
                      class="env-seg-btn compare-mob-tab"
                      data-dt="${d.id}"
                      aria-pressed="${d.id === mobileActive}"
                    >${d.id === 'electric' ? 'Electric' : d.id === 'diesel' ? 'Diesel' : 'Petrol'}</button>
                  `,
                ).join('')
          }
        </div>
      </div>

      <div class="compare-columns">
        ${
          isTrans
            ? (window.innerWidth <= 768 ? TRANSMISSION_COMPARE_SPECS : desktopTransSpecs)
                .map(
                  (t) => `
                    <article class="compare-col-card ${t.id === mobileTransActive ? 'is-mobile-active' : ''}">
                      <div class="compare-col-head">
                        <div>
                          <span class="compare-badge">${t.badge}</span>
                          <h3>${t.name}</h3>
                        </div>
                        <span class="compare-sub">${t.subtitle}</span>
                      </div>
                      <dl class="compare-specs">
                        <div><dt>Mechanism</dt><dd>${t.mechanism}</dd></div>
                        <div><dt>Shift Feel</dt><dd>${t.shiftFeel}</dd></div>
                        <div><dt>Efficiency</dt><dd>${t.efficiency}</dd></div>
                        <div><dt>Launch</dt><dd>${t.launchBehavior}</dd></div>
                        <div><dt>Service</dt><dd>${t.maintenance}</dd></div>
                      </dl>
                      <div class="analogy-box" style="margin:0;padding:8px 10px">
                        <strong>THINK OF IT LIKE</strong>
                        <span style="font-size:0.78rem">${t.analogy}</span>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : DRIVETRAIN_SPECS.map(
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
              ).join('')
        }
      </div>
    `;

    overlay.querySelector('#compare-back-btn')!.addEventListener('click', actions.onExitCompare);

    for (const btn of overlay.querySelectorAll<HTMLButtonElement>('.compare-cat-btn')) {
      btn.addEventListener('click', () => {
        const nextCat = btn.dataset.cat as CompareCategory;
        if (nextCat === category) return;
        category = nextCat;
        actions.onChangeCategory?.(category);
        render();
      });
    }

    for (const btn of overlay.querySelectorAll<HTMLButtonElement>('.compare-slot-btn')) {
      btn.addEventListener('click', () => {
        const nextSlot = btn.dataset.slot as 'cvt' | 'dct';
        if (nextSlot === thirdTransSlot) return;
        thirdTransSlot = nextSlot;
        actions.onChangeThirdTransSlot?.(nextSlot);
        render();
      });
    }

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
        if (isTrans) {
          mobileTransActive = tab.dataset.trans as CompareTransmissionId;
          actions.onSelectMobileTransTab?.(mobileTransActive);
        } else {
          mobileActive = tab.dataset.dt as DrivetrainId;
          actions.onSelectMobileTab(mobileActive);
        }
        render();
      });
    }
  };

  const open = (initialCategory: CompareCategory = 'drivetrains') => {
    category = initialCategory;
    isPlaying = true;
    throttle = 45;
    mobileActive = 'petrol';
    mobileTransActive = 'manual';
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
