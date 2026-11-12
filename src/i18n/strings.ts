import type { AppLocale } from '../state/appState';

const DICTIONARY: Record<AppLocale, Record<string, string>> = {
  en: {
    explore: 'Explore',
    tour: 'Guided Tour',
    compare: 'Compare',
    outline: 'Outline',
    solid: 'Solid',
    startAnimation: 'Start animation',
    labTitle: 'Learning Lab & Simulators',
    driveSim: 'Drive Sim',
    troubleshoot: 'What If...?',
    challenges: 'Challenges',
    paths: 'Learning Paths',
  },
  es: {
    explore: 'Explorar',
    tour: 'Tour Guiado',
    compare: 'Comparar',
    outline: 'Contorno',
    solid: 'Sólido',
    startAnimation: 'Iniciar animación',
    labTitle: 'Laboratorio y Simuladores',
    driveSim: 'Simulador',
    troubleshoot: '¿Qué pasa si...?',
    challenges: 'Retos',
    paths: 'Rutas',
  },
  de: {
    explore: 'Erkunden',
    tour: 'Geführte Tour',
    compare: 'Vergleichen',
    outline: 'Kontur',
    solid: 'Volumen',
    startAnimation: 'Animation starten',
    labTitle: 'Lernlabor & Simulatoren',
    driveSim: 'Fahrsimulator',
    troubleshoot: 'Was wäre wenn...?',
    challenges: 'Aufgaben',
    paths: 'Lernpfade',
  },
};

export function translate(locale: AppLocale, key: string): string {
  return DICTIONARY[locale]?.[key] ?? DICTIONARY.en[key] ?? key;
}

