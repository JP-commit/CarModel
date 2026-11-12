import { isEngineLayout, isTransmissionType, type Powertrain, type SystemId } from '../../state/appState';
import {
  DIESEL_ENGINE_LESSON,
  EV_COOLING_LESSON,
  EV_ELECTRICAL_LESSON,
  EV_ENGINE_LESSON,
  SYSTEM_LESSONS,
} from './coreSystems';
import { getEngineLessonVariant } from './engines';
import { TRANSMISSION_LESSONS } from './transmissions';
import type { SystemLessonData } from './types';

export type {
  CyclePhaseInfo,
  LessonPartData,
  QuizQuestion,
  SystemLessonData,
} from './types';
export { SYSTEM_LESSONS } from './coreSystems';

export function getSystemLesson(
  systemId: SystemId,
  powertrain: Powertrain = 'petrol',
  variant?: string,
): SystemLessonData {
  if (powertrain === 'ev') {
    if (systemId === 'engine') return EV_ENGINE_LESSON;
    if (systemId === 'electrical') return EV_ELECTRICAL_LESSON;
    if (systemId === 'cooling') return EV_COOLING_LESSON;
    if (systemId === 'transmission') {
      return TRANSMISSION_LESSONS['ev-reducer'];
    }
  }

  if (systemId === 'transmission' && variant && isTransmissionType(variant)) {
    return TRANSMISSION_LESSONS[variant];
  }

  if (systemId === 'engine' && variant && isEngineLayout(variant)) {
    return getEngineLessonVariant(variant, powertrain);
  }

  if (powertrain === 'diesel' && systemId === 'engine') {
    return DIESEL_ENGINE_LESSON;
  }

  return SYSTEM_LESSONS[systemId];
}

