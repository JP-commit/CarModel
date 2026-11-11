import { GLOSSARY_TERMS } from '../data/glossary';
import { SYSTEMS } from '../data/systems';

export function renderWebGLFallback(container: HTMLElement, reason: string): void {
  container.innerHTML = `
    <div class="fallback-shell" role="main">
      <div class="fallback-container">
        <div class="fallback-banner">
          <strong>3D WebGL View Unavailable</strong> — ${reason}
          You can still explore all 8 vehicle systems, analogies, and glossary terms below.
        </div>
        <h1 style="margin:0 0 12px;color:#1c1b19">HowCarsWork — Interactive System Guide</h1>
        <svg viewBox="0 0 800 260" width="100%" role="img" aria-label="2D cross-section diagram of a car showing the engine, cooling, transmission, brakes, suspension, steering, electrical, and exhaust locations" style="background:#fffdf8;border-radius:18px;border:1px solid #dcdcd8;box-shadow:0 12px 30px rgba(28,27,25,0.06)">
          <title>Car Cross-Section Schematic</title>
          <path d="M90 175 L120 120 L255 110 L360 65 L575 65 L675 115 L720 132 L720 175 Z" fill="rgba(217,58,30,0.08)" stroke="#1c1b19" stroke-width="2.5"/>
          <circle cx="215" cy="180" r="42" fill="#fffdf8" stroke="#1c1b19" stroke-width="4"/>
          <circle cx="600" cy="180" r="42" fill="#fffdf8" stroke="#1c1b19" stroke-width="4"/>
          <rect x="135" y="126" width="85" height="36" rx="6" fill="rgba(217,58,30,0.22)" stroke="#d93a1e" stroke-width="2"/>
          <text x="177" y="149" fill="#1c1b19" font-size="12" font-weight="600" text-anchor="middle">1. Engine</text>
          <rect x="235" y="138" width="115" height="22" rx="5" fill="#f5f4ef" stroke="#5e584e"/>
          <text x="292" y="153" fill="#1c1b19" font-size="11" text-anchor="middle">2. Transmission</text>
          <rect x="98" y="128" width="22" height="34" rx="4" fill="#f5f4ef" stroke="#5e584e"/>
          <text x="64" y="114" fill="#5e584e" font-size="11" font-weight="600">7. Cooling</text>
          <rect x="355" y="156" width="290" height="10" rx="4" fill="rgba(217,58,30,0.14)" stroke="#d93a1e"/>
          <text x="500" y="150" fill="#5e584e" font-size="11" text-anchor="middle">8. Exhaust</text>
        </svg>
        <div class="fallback-grid">
          ${SYSTEMS.map(
            (sys) => `
              <article class="fallback-card" style="border-top: 3px solid var(--accent)">
                <div style="font-size:0.7rem;color:var(--accent);font-weight:700;letter-spacing:0.08em">SYSTEM 0${sys.order} OF 08</div>
                <h2 style="margin:2px 0 6px;font-size:1.08rem;color:#1c1b19">${sys.name}</h2>
                <p style="margin:0 0 8px;color:#5e584e;font-size:0.86rem">${sys.plainEnglish}</p>
                <p style="margin:0 0 8px;color:#1c1b19;font-size:0.8rem"><strong>Key Parts:</strong> ${sys.keyParts.join(', ')}</p>
                <p style="margin:0;color:#d93a1e;font-size:0.82rem"><strong>Analogy:</strong> ${sys.analogy}</p>
              </article>
            `,
          ).join('')}
        </div>
        <h2 style="margin:28px 0 10px;color:#1c1b19">Key Glossary Terms</h2>
        <div class="fallback-grid">
          ${GLOSSARY_TERMS.slice(0, 6)
            .map(
              (t) => `
                <article class="fallback-card">
                  <h3 style="margin:0 0 4px;font-size:0.95rem;color:#1c1b19">${t.term}</h3>
                  <p style="margin:0;color:#5e584e;font-size:0.82rem">${t.shortDef}</p>
                </article>
              `,
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}
