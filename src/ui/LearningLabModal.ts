import { translate } from '../i18n/strings';
import {
  appStore,
  getActiveSystemVariant,
  getSavedQuizScore,
  type AppLocale,
  type LearningPathId,
  type SystemId,
} from '../state/appState';

type LabTabId = 'drive' | 'faults' | 'challenges' | 'paths';

export interface FaultScenario {
  id: string;
  title: string;
  systemId: SystemId;
  symptom: string;
  fix: string;
}

export const FAULT_SCENARIOS: FaultScenario[] = [
  {
    id: 'brake-air',
    title: 'Air Trapped in Brake Lines',
    systemId: 'brakes',
    symptom: 'Pedal sinks spongy toward the floor because air bubbles compress instead of pushing brake pads.',
    fix: 'Bleed hydraulic lines cleanly with fresh incompressible DOT fluid.',
  },
  {
    id: 'worn-clutch',
    title: 'Worn Friction Clutch Disc',
    systemId: 'transmission',
    symptom: 'Engine RPM flares upward on hills while wheel speed barely increases due to clutch slip.',
    fix: 'Replace friction disc, pressure plate, and release bearing.',
  },
  {
    id: 'stuck-thermostat',
    title: 'Stuck-Closed Thermostat',
    systemId: 'cooling',
    symptom: 'Coolant cannot circulate out to the front radiator, causing engine temperature to spike.',
    fix: 'Replace failed wax-pellet thermostat and flush coolant.',
  },
  {
    id: 'head-gasket',
    title: 'Blown Cylinder Head Gasket',
    systemId: 'engine',
    symptom: 'Combustion pressure leaks between cylinder & coolant passages; white steam & misfires appear.',
    fix: 'Resurface cylinder head deck and torque a new multi-layer steel gasket.',
  },
  {
    id: 'clogged-dpf',
    title: 'Clogged Diesel DPF / Catalyst',
    systemId: 'exhaust',
    symptom: 'Backpressure chokes engine breathing, dropping power and triggering limp mode.',
    fix: 'Perform highway active regeneration or clean/replace filter core.',
  },
  {
    id: 'weak-battery',
    title: 'Weak 12V / HV Cell Imbalance',
    systemId: 'electrical',
    symptom: 'Starter clicks rapidly without cranking (ICE) or BMS limits peak acceleration power (EV).',
    fix: 'Load-test battery health and balance/replace weak module.',
  },
];

const LEARNING_PATHS: Record<Exclude<LearningPathId, 'all'>, { title: string; subtitle: string; steps: SystemId[] }> = {
  beginner: {
    title: 'Beginner Foundation',
    subtitle: 'Understand how fuel, spark, gears, and brakes work together',
    steps: ['engine', 'transmission', 'brakes', 'steering'],
  },
  intermediate: {
    title: 'Intermediate Mechanics',
    subtitle: 'Add thermal, suspension geometry, electrical charging, and emissions',
    steps: ['cooling', 'suspension', 'electrical', 'exhaust'],
  },
  advanced: {
    title: 'Advanced Powertrain Master',
    subtitle: 'Master all 8 vehicle systems end-to-end',
    steps: ['engine', 'transmission', 'cooling', 'exhaust', 'brakes', 'suspension', 'steering', 'electrical'],
  },
};

export interface LearningLabActions {
  onOpenSystemLesson: (systemId: SystemId, faultId?: string | null) => void;
  onDriveUpdate?: (drive: { rpm: number; throttle: number; brake: number; speedKmh: number }) => void;
}

export interface LearningLabHandle {
  open: (initialTab?: LabTabId) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createLearningLabModal(
  uiRoot: HTMLElement,
  actions: LearningLabActions,
): LearningLabHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-hidden';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Learning Lab and Drive Simulator');
  backdrop.inert = true;
  backdrop.innerHTML = `<div class="modal-card modal-card--wide" id="lab-modal-card"></div>`;
  uiRoot.appendChild(backdrop);

  const card = backdrop.querySelector<HTMLElement>('#lab-modal-card')!;
  let openState = false;
  let activeTab: LabTabId = 'drive';
  let throttle = 35;
  let brake = 0;
  let grade = 0;
  let simSpeed = 42;
  let simRaf: number | null = null;

  // Challenge mini-game state
  let fourStrokeOrder: string[] = [];
  let challengeFeedback = '';

  const computeDriveState = () => {
    const snap = appStore.getSnapshot();
    const isEv = snap.activePowertrain === 'ev';
    const targetSpeed = Math.max(0, Math.min(210, throttle * 1.9 - brake * 1.6 - grade * 2.4));
    simSpeed += (targetSpeed - simSpeed) * 0.08;
    const gearNum = isEv ? 1 : Math.min(6, Math.max(1, Math.floor(simSpeed / 32) + 1));
    const ratioMap = [3.6, 2.2, 1.5, 1.15, 0.92, 0.74];
    const ratio = isEv ? 9.1 : ratioMap[gearNum - 1];
    const rpm = Math.round(
      isEv
        ? Math.min(14000, simSpeed * 95)
        : Math.max(800, Math.min(7200, 900 + simSpeed * 28 * ratio + throttle * 16)),
    );
    const brakeTempC = Math.round(55 + brake * 3.8 + (grade < 0 ? Math.abs(grade) * 8 : 0));
    const energyLabel = isEv
      ? brake > 15
        ? 'Regen Charging (+18 kW)'
        : `${(13 + throttle * 0.22).toFixed(1)} kWh/100km`
      : `${(5.5 + throttle * 0.14 + Math.max(0, grade) * 0.4).toFixed(1)} L/100km`;
    return {
      speedKmh: Math.round(simSpeed),
      gearLabel: isEv ? '1-Spd Drive' : snap.selectedTransmission === 'cvt' ? 'CVT' : `Gear ${gearNum}`,
      rpm,
      brakeTempC,
      energyLabel,
    };
  };

  const stopDriveTicker = () => {
    if (simRaf !== null) {
      cancelAnimationFrame(simRaf);
      simRaf = null;
    }
  };

  const startDriveTicker = () => {
    stopDriveTicker();
    const step = () => {
      if (!openState || activeTab !== 'drive') return;
      const d = computeDriveState();
      const sEl = card.querySelector('#lab-sim-speed');
      const gEl = card.querySelector('#lab-sim-gear');
      const rEl = card.querySelector('#lab-sim-rpm');
      const bEl = card.querySelector('#lab-sim-btemp');
      const eEl = card.querySelector('#lab-sim-econ');
      if (sEl) sEl.textContent = `${d.speedKmh} km/h`;
      if (gEl) gEl.textContent = d.gearLabel;
      if (rEl) rEl.textContent = `${d.rpm} RPM`;
      if (bEl) bEl.textContent = `${d.brakeTempC} °C`;
      if (eEl) eEl.textContent = d.energyLabel;
      actions.onDriveUpdate?.({
        rpm: d.rpm,
        throttle: throttle / 100,
        brake: brake / 100,
        speedKmh: d.speedKmh,
      });
      simRaf = requestAnimationFrame(step);
    };
    simRaf = requestAnimationFrame(step);
  };

  const close = () => {
    openState = false;
    stopDriveTicker();
    backdrop.classList.add('is-hidden');
    backdrop.inert = true;
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const render = () => {
    const snap = appStore.getSnapshot();
    const loc = snap.locale;

    let bodyHtml = '';
    if (activeTab === 'drive') {
      const d = computeDriveState();
      bodyHtml = `
        <div class="engine-stats-grid" style="margin-bottom:12px">
          <div><span class="stat-k">Vehicle Speed</span><strong id="lab-sim-speed">${d.speedKmh} km/h</strong></div>
          <div><span class="stat-k">Active Gear (${snap.selectedTransmission.toUpperCase()})</span><strong id="lab-sim-gear">${d.gearLabel}</strong></div>
          <div><span class="stat-k">Engine / Motor RPM</span><strong id="lab-sim-rpm">${d.rpm} RPM</strong></div>
          <div><span class="stat-k">Brake Rotor Temp</span><strong id="lab-sim-btemp">${d.brakeTempC} °C</strong></div>
          <div><span class="stat-k">Instant Consumption</span><strong id="lab-sim-econ">${d.energyLabel}</strong></div>
        </div>
        <div class="slider-block">
          <div class="slider-header"><label for="lab-throttle"><span>Throttle Pedal</span></label><output id="lab-throttle-out">${throttle}%</output></div>
          <input type="range" class="range-input" id="lab-throttle" min="0" max="100" value="${throttle}" />
        </div>
        <div class="slider-block">
          <div class="slider-header"><label for="lab-brake"><span>Brake Pedal</span></label><output id="lab-brake-out">${brake}%</output></div>
          <input type="range" class="range-input" id="lab-brake" min="0" max="100" value="${brake}" />
        </div>
        <div class="slider-block">
          <div class="slider-header"><label for="lab-grade"><span>Road Gradient</span></label><output id="lab-grade-out">${grade}%</output></div>
          <input type="range" class="range-input" id="lab-grade" min="-12" max="15" value="${grade}" />
        </div>
        <div class="cta-row">
          <button type="button" class="btn btn-accent" id="lab-open-live-trans">Inspect Gearbox Live →</button>
          <button type="button" class="btn" id="lab-open-live-brakes">Inspect Brakes Heat →</button>
        </div>
      `;
    } else if (activeTab === 'faults') {
      bodyHtml = `
        <div class="lab-cards-grid">
          ${FAULT_SCENARIOS.map(
            (f) => `
              <article class="lab-mini-card">
                <div class="panel-eyebrow" style="margin-bottom:2px">${f.systemId.toUpperCase()} FAULT</div>
                <h4>${f.title}</h4>
                <p><strong>Symptom:</strong> ${f.symptom}</p>
                <p><strong>Fix:</strong> ${f.fix}</p>
                <button type="button" class="btn btn-accent lab-fault-launch" data-sys="${f.systemId}" data-fault="${f.id}">
                  Inspect Fault in 3D →
                </button>
              </article>
            `,
          ).join('')}
        </div>
      `;
    } else if (activeTab === 'challenges') {
      bodyHtml = `
        <div class="engine-stats-card">
          <div class="section-label">CHALLENGE 1 · BUILD THE 4-STROKE ORDER</div>
          <p style="margin:0 0 8px;font-size:0.78rem;color:var(--text-secondary)">Tap the 4 strokes in the correct sequence from Suck → Squeeze → Bang → Blow:</p>
          <div class="variant-seg-row" style="display:flex;margin-bottom:8px">
            ${['Power', 'Intake', 'Exhaust', 'Compression']
              .map(
                (st) => `<button type="button" class="variant-seg-btn lab-stroke-pick" data-stroke="${st}" ${fourStrokeOrder.includes(st) ? 'disabled' : ''}>${st}</button>`,
              )
              .join('')}
            <button type="button" class="variant-seg-btn" id="lab-stroke-reset">Reset</button>
          </div>
          <div style="font-size:0.78rem;font-weight:600;margin-bottom:4px">
            Sequence: ${fourStrokeOrder.length > 0 ? fourStrokeOrder.join(' → ') : '(none yet)'}
          </div>
          ${challengeFeedback ? `<div class="quiz-feedback ${challengeFeedback.startsWith('✓') ? 'is-correct' : 'is-wrong'}"><span>${challengeFeedback}</span></div>` : ''}
        </div>

        <div class="engine-stats-card">
          <div class="section-label">CHALLENGE 2 · STEEP HILL CLIMB GEAR PICKER</div>
          <p style="margin:0 0 8px;font-size:0.78rem;color:var(--text-secondary)">You are towing uphill at +12% grade from 25 km/h. Which transmission ratio multiplies wheel torque best?</p>
          <div class="variant-seg-row" style="display:flex">
            <button type="button" class="variant-seg-btn lab-hill-btn" data-ok="true">1st Gear (3.60:1)</button>
            <button type="button" class="variant-seg-btn lab-hill-btn" data-ok="false">4th Gear (1.00:1)</button>
            <button type="button" class="variant-seg-btn lab-hill-btn" data-ok="false">6th Overdrive (0.72:1)</button>
          </div>
          <p id="lab-hill-result" style="margin:6px 0 0;font-size:0.76rem;font-weight:600"></p>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="lab-cards-grid">
          ${(Object.entries(LEARNING_PATHS) as [Exclude<LearningPathId, 'all'>, typeof LEARNING_PATHS['beginner']][]).map(
            ([id, p]) => {
              const completed = p.steps.filter((s) =>
                Boolean(
                  getSavedQuizScore(
                    snap.quizProgress,
                    s,
                    snap.activePowertrain,
                    getActiveSystemVariant(snap, s),
                  ),
                ),
              ).length;
              return `
                <article class="lab-mini-card">
                  <div class="panel-eyebrow">${completed}/${p.steps.length} QUIZZES COMPLETE</div>
                  <h4>${p.title}</h4>
                  <p>${p.subtitle}</p>
                  <div class="key-parts-row" style="margin-bottom:8px">
                    ${p.steps
                      .map((s) => `<button type="button" class="key-part-chip lab-path-jump" data-sys="${s}">${s}</button>`)
                      .join('')}
                  </div>
                  <button type="button" class="btn btn-accent lab-path-select" data-path="${id}" aria-pressed="${snap.learningPath === id}">
                    ${snap.learningPath === id ? '✓ Active Track' : 'Set Active Track'}
                  </button>
                </article>
              `;
            },
          ).join('')}
        </div>
        <div class="engine-stats-card" style="margin-top:10px">
          <div class="section-label">LANGUAGE & ACCESSIBILITY</div>
          <div class="variant-seg-row" style="display:flex;gap:6px;flex-wrap:wrap">
            ${(['en', 'es', 'de'] as AppLocale[])
              .map((l) => `<button type="button" class="variant-seg-btn lab-loc-btn" data-loc="${l}" aria-pressed="${snap.locale === l}">${l.toUpperCase()}</button>`)
              .join('')}
            <button type="button" class="variant-seg-btn" id="lab-font-toggle" aria-pressed="${snap.fontScale === 'large'}">Large Text (A+)</button>
            <button type="button" class="variant-seg-btn" id="lab-captions-toggle" aria-pressed="${snap.captionsEnabled}">Live Captions</button>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-eyebrow">INTERACTIVE STUDIO</div>
          <h2 class="panel-title">${translate(loc, 'labTitle')}</h2>
        </div>
        <button type="button" class="panel-close" id="lab-close-btn" aria-label="Close Learning Lab">✕</button>
      </div>
      <div class="variant-seg-row" style="display:flex;margin-bottom:12px">
        <button type="button" class="variant-seg-btn lab-tab-btn" data-tab="drive" aria-pressed="${activeTab === 'drive'}">${translate(loc, 'driveSim')}</button>
        <button type="button" class="variant-seg-btn lab-tab-btn" data-tab="faults" aria-pressed="${activeTab === 'faults'}">${translate(loc, 'troubleshoot')}</button>
        <button type="button" class="variant-seg-btn lab-tab-btn" data-tab="challenges" aria-pressed="${activeTab === 'challenges'}">${translate(loc, 'challenges')}</button>
        <button type="button" class="variant-seg-btn lab-tab-btn" data-tab="paths" aria-pressed="${activeTab === 'paths'}">${translate(loc, 'paths')}</button>
      </div>
      ${bodyHtml}
    `;

    card.querySelector('#lab-close-btn')!.addEventListener('click', close);
    for (const tb of card.querySelectorAll<HTMLButtonElement>('.lab-tab-btn')) {
      tb.addEventListener('click', () => {
        activeTab = tb.dataset.tab as LabTabId;
        render();
        if (activeTab === 'drive') startDriveTicker();
        else stopDriveTicker();
      });
    }

    if (activeTab === 'drive') {
      const thIn = card.querySelector<HTMLInputElement>('#lab-throttle')!;
      const brIn = card.querySelector<HTMLInputElement>('#lab-brake')!;
      const grIn = card.querySelector<HTMLInputElement>('#lab-grade')!;
      thIn.addEventListener('input', () => {
        throttle = Number(thIn.value);
        card.querySelector('#lab-throttle-out')!.textContent = `${throttle}%`;
      });
      brIn.addEventListener('input', () => {
        brake = Number(brIn.value);
        card.querySelector('#lab-brake-out')!.textContent = `${brake}%`;
      });
      grIn.addEventListener('input', () => {
        grade = Number(grIn.value);
        card.querySelector('#lab-grade-out')!.textContent = `${grade}%`;
      });
      card.querySelector('#lab-open-live-trans')!.addEventListener('click', () => {
        close();
        actions.onOpenSystemLesson('transmission', null);
      });
      card.querySelector('#lab-open-live-brakes')!.addEventListener('click', () => {
        close();
        actions.onOpenSystemLesson('brakes', null);
      });
      startDriveTicker();
    } else if (activeTab === 'faults') {
      for (const btn of card.querySelectorAll<HTMLButtonElement>('.lab-fault-launch')) {
        btn.addEventListener('click', () => {
          const sys = btn.dataset.sys as SystemId;
          const fId = btn.dataset.fault ?? null;
          close();
          actions.onOpenSystemLesson(sys, fId);
        });
      }
    } else if (activeTab === 'challenges') {
      const correct = ['Intake', 'Compression', 'Power', 'Exhaust'];
      for (const b of card.querySelectorAll<HTMLButtonElement>('.lab-stroke-pick')) {
        b.addEventListener('click', () => {
          const val = b.dataset.stroke!;
          fourStrokeOrder.push(val);
          if (fourStrokeOrder.length === 4) {
            const ok = fourStrokeOrder.every((s, idx) => s === correct[idx]);
            challengeFeedback = ok
              ? '✓ Perfect! Intake → Compression → Power → Exhaust drives the crankshaft smoothly.'
              : '✕ Not quite — remember: Suck (Intake), Squeeze (Compression), Bang (Power), Blow (Exhaust). Reset and try again!';
          }
          render();
        });
      }
      card.querySelector('#lab-stroke-reset')!.addEventListener('click', () => {
        fourStrokeOrder = [];
        challengeFeedback = '';
        render();
      });
      for (const hb of card.querySelectorAll<HTMLButtonElement>('.lab-hill-btn')) {
        hb.addEventListener('click', () => {
          const ok = hb.dataset.ok === 'true';
          const out = card.querySelector('#lab-hill-result')!;
          out.textContent = ok
            ? '✓ Correct! 1st gear multiplies crank torque 3.6× to climb steep hills smoothly.'
            : '✕ Overdrive or 1:1 stalls the engine uphill because torque isn’t multiplied enough.';
        });
      }
    } else {
      for (const jp of card.querySelectorAll<HTMLButtonElement>('.lab-path-jump')) {
        jp.addEventListener('click', () => {
          close();
          actions.onOpenSystemLesson(jp.dataset.sys as SystemId, null);
        });
      }
      for (const ps of card.querySelectorAll<HTMLButtonElement>('.lab-path-select')) {
        ps.addEventListener('click', () => {
          appStore.update({ learningPath: ps.dataset.path as LearningPathId });
          render();
        });
      }
      for (const lb of card.querySelectorAll<HTMLButtonElement>('.lab-loc-btn')) {
        lb.addEventListener('click', () => {
          appStore.update({ locale: lb.dataset.loc as AppLocale });
          render();
        });
      }
      card.querySelector('#lab-font-toggle')!.addEventListener('click', () => {
        const next = appStore.getSnapshot().fontScale === 'large' ? 'normal' : 'large';
        appStore.update({ fontScale: next });
        render();
      });
      card.querySelector('#lab-captions-toggle')!.addEventListener('click', () => {
        const next = !appStore.getSnapshot().captionsEnabled;
        appStore.update({ captionsEnabled: next });
        render();
      });
    }
  };

  return {
    open: (initialTab: LabTabId = 'drive') => {
      openState = true;
      activeTab = initialTab;
      backdrop.classList.remove('is-hidden');
      backdrop.inert = false;
      render();
    },
    close,
    isOpen: () => openState,
  };
}
