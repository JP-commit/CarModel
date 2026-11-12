import type { SystemId } from '../../state/appState';

export interface LessonPartData {
  id: string;
  name: string;
  plainEnglish: string;
  analogy: string;
}

export interface CyclePhaseInfo {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface SystemLessonData {
  id: SystemId;
  variant?: string;
  title: string;
  subtitle: string;
  /** Supports [[glossary-id|display text]] inline tooltips */
  intro: string;
  animationLabel: string;
  phases?: CyclePhaseInfo[];
  parts: LessonPartData[];
  glossaryTerms?: string[];
  quiz: QuizQuestion[];
}

