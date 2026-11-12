import { buildEngineConfigForOptions, computeEngineStats } from '../models/systems/engines/specs';
import type { SystemSimulationState } from '../models/systems/types';
import {
  appStore,
  type EngineAspiration,
  type EngineHybrid,
  type EngineInjection,
  type EngineLayout,
} from '../state/appState';

const ASPIRATION_OPTS: { id: EngineAspiration; label: string }[] = [
  { id: 'na', label: 'NA' },
  { id: 'turbo', label: 'Turbo' },
  { id: 'twin-turbo', label: 'Twin-Turbo' },
  { id: 'supercharged', label: 'Supercharged' },
];

const HYBRID_OPTS: { id: EngineHybrid; label: string }[] = [
  { id: 'none', label: 'Pure ICE' },
  { id: 'mild-48v', label: '48V Mild' },
  { id: 'full-hybrid', label: 'Full Hybrid' },
  { id: 'phev', label: 'PHEV' },
];

function buildTorqueSvg(points: number[]): string {
  const w = 220;
  const h = 56;
  const coords = points.map((v, i) => {
    const x = 8 + (i / (points.length - 1)) * (w - 16);
    const y = h - 8 - v * (h - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaCoords = [`8,${h - 8}`, ...coords, `${w - 8},${h - 8}`].join(' ');
  return `
    <svg class="engine-torque-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Engine torque curve across RPM range">
      <polygon points="${areaCoords}" fill="rgba(217, 58, 30, 0.14)" />
      <polyline points="${coords.join(' ')}" fill="none" stroke="#d93a1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

export interface EngineStatsPanelHandle {
  updateTelemetry: (firingCylinder?: number, rpm?: number) => void;
}

export function renderEngineStatsWidget(
  slot: HTMLElement,
  layout: EngineLayout,
  initialSim: SystemSimulationState,
  onSimChange: (patch: Partial<SystemSimulationState>) => void,
): EngineStatsPanelHandle {
  const render = () => {
    const snap = appStore.getSnapshot();
    const cfg = buildEngineConfigForOptions(
      layout,
      snap.activePowertrain,
      snap.engineAspiration,
      snap.engineInjection,
      snap.engineHybrid,
    );
    const stats = computeEngineStats(cfg);
    const isDiesel = snap.activePowertrain === 'diesel';
    const currentRpm = initialSim.rpmOverride ?? 1800;

    slot.innerHTML = `
      <div class="engine-stats-card">
        <div class="engine-stats-grid">
          <div><span class="stat-k">Displacement</span><strong>${stats.displacementL} L (${stats.displacementCc} cc)</strong></div>
          <div><span class="stat-k">Compression</span><strong>${stats.compressionRatio}</strong></div>
          <div><span class="stat-k">Peak Output</span><strong>${stats.peakPowerHp} hp · ${stats.peakTorqueNm} Nm</strong></div>
          <div><span class="stat-k">Firing Interval</span><strong>${stats.firingIntervalDeg}° crank</strong></div>
        </div>
        <div class="engine-balance-note">${stats.balanceRating}</div>

        <div class="section-label" style="margin-top:6px">FIRING ORDER</div>
        <div class="firing-order-strip" id="engine-firing-strip">
          ${cfg.firingOrder
            .map((cyl) => `<span class="firing-cyl-pill" data-cyl="${cyl}">#${cyl}</span>`)
            .join('')}
        </div>

        <div class="section-label" style="margin-top:8px">TORQUE CURVE & RPM CONTROL</div>
        ${buildTorqueSvg(stats.torqueCurveNormalized)}
        <div class="slider-block" style="margin-bottom:6px">
          <div class="slider-header">
            <label for="engine-rpm-slider"><span>Engine RPM</span></label>
            <output id="engine-rpm-out" for="engine-rpm-slider">${currentRpm} RPM</output>
          </div>
          <input
            type="range"
            class="range-input"
            id="engine-rpm-slider"
            min="700"
            max="${stats.redlineRpm}"
            step="100"
            value="${currentRpm}"
          />
        </div>

        <div class="section-label" style="margin-top:8px">ASPIRATION</div>
        <div class="variant-seg-row" style="display:flex;margin-bottom:6px">
          ${ASPIRATION_OPTS.map(
            (o) => `
              <button
                type="button"
                class="variant-seg-btn engine-asp-btn"
                data-asp="${o.id}"
                aria-pressed="${snap.engineAspiration === o.id}"
              >${o.label}</button>
            `,
          ).join('')}
        </div>

        ${
          !isDiesel
            ? `<div class="section-label">FUEL INJECTION</div>
               <div class="variant-seg-row" style="display:flex;margin-bottom:6px">
                 ${(['mpfi', 'gdi'] as EngineInjection[])
                   .map(
                     (inj) => `
                       <button
                         type="button"
                         class="variant-seg-btn engine-inj-btn"
                         data-inj="${inj}"
                         aria-pressed="${snap.engineInjection === inj}"
                       >${inj.toUpperCase()}</button>
                     `,
                   )
                   .join('')}
               </div>`
            : ''
        }

        <div class="section-label">HYBRID ASSIST</div>
        <div class="variant-seg-row" style="display:flex">
          ${HYBRID_OPTS.map(
            (h) => `
              <button
                type="button"
                class="variant-seg-btn engine-hyb-btn"
                data-hyb="${h.id}"
                aria-pressed="${snap.engineHybrid === h.id}"
              >${h.label}</button>
            `,
          ).join('')}
        </div>
      </div>
    `;

    const rpmSlider = slot.querySelector<HTMLInputElement>('#engine-rpm-slider')!;
    const rpmOut = slot.querySelector<HTMLOutputElement>('#engine-rpm-out')!;
    rpmSlider.addEventListener('input', () => {
      const val = Number(rpmSlider.value);
      rpmOut.textContent = `${val} RPM`;
      onSimChange({ rpmOverride: val });
    });

    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.engine-asp-btn')) {
      btn.addEventListener('click', () => {
        const next = btn.dataset.asp as EngineAspiration;
        appStore.update({ engineAspiration: next });
        onSimChange({ aspiration: next });
        render();
      });
    }
    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.engine-inj-btn')) {
      btn.addEventListener('click', () => {
        const next = btn.dataset.inj as EngineInjection;
        appStore.update({ engineInjection: next });
        onSimChange({ injection: next });
        render();
      });
    }
    for (const btn of slot.querySelectorAll<HTMLButtonElement>('.engine-hyb-btn')) {
      btn.addEventListener('click', () => {
        const next = btn.dataset.hyb as EngineHybrid;
        appStore.update({ engineHybrid: next });
        onSimChange({ hybrid: next });
        render();
      });
    }
  };

  render();

  return {
    updateTelemetry: (firingCylinder?: number) => {
      if (firingCylinder === undefined) return;
      for (const pill of slot.querySelectorAll<HTMLElement>('.firing-cyl-pill')) {
        pill.classList.toggle('is-firing', Number(pill.dataset.cyl) === firingCylinder);
      }
    },
  };
}

