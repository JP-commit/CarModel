import type { SystemId } from '../state/appState';

export const SYSTEM_ICONS: Record<SystemId, string> = {
  engine: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="7" y="4" width="10" height="7" rx="1.5"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
    <circle cx="12" cy="19" r="2.2"/>
    <line x1="9" y1="7" x2="15" y2="7"/>
  </svg>`,
  transmission: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/>
    <circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/>
    <path d="M6 8v8M12 8v8M18 8v4H6"/>
  </svg>`,
  brakes: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M16.5 4.8A9.5 9.5 0 0 1 20 12h-3"/>
  </svg>`,
  suspension: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 3h6M9 21h6M12 3v3M12 18v3"/>
    <path d="M8 7l8 2.5-8 2.5 8 2.5-8 2.5"/>
  </svg>`,
  steering: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5"/>
    <circle cx="12" cy="12" r="2.2"/>
    <path d="M4 11h6M14 11h6M12 14.2V20"/>
  </svg>`,
  electrical: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="7" width="16" height="12" rx="2"/>
    <path d="M8 7V5M16 7V5M12.5 10l-2 3.5h3l-2 3.5"/>
  </svg>`,
  cooling: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="M12 10c0-3 2.5-5 4-4s1 4-2 5M14 12c3 0 5 2.5 4 4s-4 1-5-2M12 14c0 3-2.5 5-4 4s-1-4 2-5M10 12c-3 0-5-2.5-4-4s4-1 5 2"/>
  </svg>`,
  exhaust: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 14h4l2-2h7a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H9l-2-2H3z"/>
    <path d="M18 14h3M20 9c1.2 0 1.8-1 1.5-2"/>
  </svg>`,
};

