import {
  DIFFERENTIAL_SUMMARIES,
  DRIVETRAIN_SPLITS,
  SUB_VARIANT_LABELS,
  SYSTEM_DEEP_DIVE_GUIDES,
} from '../data/extendedSystems';
import type { SystemFrameStatus, SystemSimulationState } from '../models/systems/types';
import {
  appStore,
  type BrakeType,
  type DifferentialMode,
  type DrivetrainLayout,
  type SteeringType,
  type SuspensionType,
  type SystemId,
} from '../state/appState';

export interface ExtendedSubTabsHandle {
  updateStatus: (status: SystemFrameStatus) => void;
}

export function renderExtendedSubTabs(
  slot: HTMLElement,
  systemId: SystemId,
  onSimChange: (patch: Partial<SystemSimulationState>) => void,
): ExtendedSubTabsHandle {
  const render = () => {
    const snap = appStore.getSnapshot();
    const guides = SYSTEM_DEEP_DIVE_GUIDES[systemId] ?? [];
    let controlsHtml = '';

    if (systemId === 'brakes') {
      controlsHtml = `
        <div class="engine-stats-card">
          <div class="section-label">BRAKE HARDWARE</div>
          <div class="variant-seg-row" style="display:flex;margin-bottom:8px">
            ${SUB_VARIANT_LABELS.brakes
              .map(
                (b) => `<button type="button" class="variant-seg-btn ext-brake-btn" data-val="${b.id}" aria-pressed="${snap.brakeType === b.id}">${b.label}</button>`,
              )
              .join('')}
          </div>
          <div class="slider-block" style="margin-bottom:4px">
            <div class="slider-header">
              <label for="ext-brake-load"><span>Brake Pressure & Heat Fade</span></label>
              <output id="ext-brake-temp">65 °C</output>
            </div>
            <input type="range" class="range-input" id="ext-brake-load" min="0" max="100" value="0" />
          </div>
        </div>
      `;
    } else if (systemId === 'suspension') {
      controlsHtml = `
        <div class="engine-stats-card">
          <div class="section-label">SUSPENSION GEOMETRY</div>
          <div class="variant-seg-row" style="display:flex;margin-bottom:8px">
            ${SUB_VARIANT_LABELS.suspension
              .map(
                (s) => `<button type="button" class="variant-seg-btn ext-susp-btn" data-val="${s.id}" aria-pressed="${snap.suspensionType === s.id}">${s.label}</button>`,
              )
              .join('')}
          </div>
          <div class="slider-block" style="margin-bottom:2px">
            <div class="slider-header">
              <label for="ext-bump-slider"><span>Road Bump Severity</span></label>
              <output id="ext-bump-out">1.0×</output>
            </div>
            <input type="range" class="range-input" id="ext-bump-slider" min="0" max="200" value="100" />
          </div>
        </div>
      `;
    } else if (systemId === 'steering') {
      controlsHtml = `
        <div class="engine-stats-card">
          <div class="section-label">POWER ASSIST & ACKERMANN</div>
          <div class="variant-seg-row" style="display:flex;margin-bottom:6px">
            ${SUB_VARIANT_LABELS.steering
              .map(
                (st) => `<button type="button" class="variant-seg-btn ext-steer-btn" data-val="${st.id}" aria-pressed="${snap.steeringType === st.id}">${st.label}</button>`,
              )
              .join('')}
          </div>
          <p style="margin:0;font-size:0.73rem;color:var(--text-secondary)">
            Notice how the inner wheel turns ~15% sharper than the outer wheel (Ackermann geometry) so all 4 tires roll smoothly around the same corner center.
          </p>
        </div>
      `;
    } else if (systemId === 'transmission') {
      const split = DRIVETRAIN_SPLITS[snap.drivetrainLayout];
      controlsHtml = `
        <div class="engine-stats-card">
          <div class="section-label">DRIVETRAIN LAYOUT</div>
          <div class="variant-seg-row" style="display:flex;margin-bottom:6px">
            ${(['fwd', 'rwd', 'awd', '4wd'] as DrivetrainLayout[])
              .map(
                (d) => `<button type="button" class="variant-seg-btn ext-dt-btn" data-val="${d}" aria-pressed="${snap.drivetrainLayout === d}">${d.toUpperCase()}</button>`,
              )
              .join('')}
          </div>
          <div class="engine-stats-grid" style="margin-bottom:6px">
            <div><span class="stat-k">Front Axle</span><strong>${split.frontPct}% Torque</strong></div>
            <div><span class="stat-k">Rear Axle</span><strong>${split.rearPct}% Torque</strong></div>
          </div>
          <div class="section-label">DIFFERENTIAL TYPE</div>
          <div class="variant-seg-row" style="display:flex;margin-bottom:6px">
            ${(['open', 'lsd', 'locking', 'torque-vectoring'] as DifferentialMode[])
              .map(
                (dm) => `<button type="button" class="variant-seg-btn ext-diff-btn" data-val="${dm}" aria-pressed="${snap.differentialMode === dm}">${dm === 'torque-vectoring' ? 'Vectoring' : dm.toUpperCase()}</button>`,
              )
              .join('')}
          </div>
          <p style="margin:0;font-size:0.72rem;color:var(--text-secondary)">${DIFFERENTIAL_SUMMARIES[snap.differentialMode]}</p>
        </div>
      `;
    }

    const guidesHtml = guides
      .map(
        (g) => `
        <details class="deep-dive-card">
          <summary><span class="compare-badge">${g.badge}</span> ${g.title}</summary>
          <ul class="deep-dive-list">
            ${g.items.map((it) => `<li><strong>${it.label}:</strong> ${it.detail}</li>`).join('')}
          </ul>
        </details>
      `,
      )
      .join('');

    slot.innerHTML = `${controlsHtml}${guidesHtml}`;

    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.ext-brake-btn')) {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val as BrakeType;
        appStore.update({ brakeType: val });
        onSimChange({ brakeType: val });
        render();
      });
    }
    const brakeSlider = slot.querySelector<HTMLInputElement>('#ext-brake-load');
    brakeSlider?.addEventListener('input', () => {
      onSimChange({ brake: Number(brakeSlider.value) / 100 });
    });

    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.ext-susp-btn')) {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val as SuspensionType;
        appStore.update({ suspensionType: val });
        onSimChange({ suspensionType: val });
        render();
      });
    }
    const bumpSlider = slot.querySelector<HTMLInputElement>('#ext-bump-slider');
    const bumpOut = slot.querySelector<HTMLOutputElement>('#ext-bump-out');
    bumpSlider?.addEventListener('input', () => {
      const scale = Number(bumpSlider.value) / 100;
      if (bumpOut) bumpOut.textContent = `${scale.toFixed(1)}×`;
      onSimChange({ roadBump: scale });
    });

    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.ext-steer-btn')) {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val as SteeringType;
        appStore.update({ steeringType: val });
        onSimChange({ steeringType: val });
        render();
      });
    }

    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.ext-dt-btn')) {
      btn.addEventListener('click', () => {
        appStore.update({ drivetrainLayout: btn.dataset.val as DrivetrainLayout });
        render();
      });
    }
    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.ext-diff-btn')) {
      btn.addEventListener('click', () => {
        appStore.update({ differentialMode: btn.dataset.val as DifferentialMode });
        render();
      });
    }
  };

  render();

  return {
    updateStatus: (status) => {
      const tempEl = slot.querySelector<HTMLElement>('#ext-brake-temp');
      if (tempEl && status.brakeTempC !== undefined) {
        const fade = status.brakeTempC > 320 ? ' · Heat Fade!' : '';
        tempEl.textContent = `${status.brakeTempC} °C${fade}`;
      }
    },
  };
}

