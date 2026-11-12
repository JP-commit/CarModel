import type { Powertrain, TransmissionType } from '../../state/appState';
import type { SystemModelInstance } from './types';
import { createAmtTransmissionModel } from './transmissions/amt';
import { createAtTransmissionModel } from './transmissions/at';
import { createCvtTransmissionModel } from './transmissions/cvt';
import { createDctTransmissionModel } from './transmissions/dct';
import { createEvReducerTransmissionModel } from './transmissions/evReducer';
import { createManualTransmissionModel } from './transmissions/manual';

export function createSystemModel(
  powertrain: Powertrain = 'petrol',
  variant: string = 'manual',
): SystemModelInstance {
  if (powertrain === 'ev' || variant === 'ev-reducer') {
    return createEvReducerTransmissionModel();
  }
  switch (variant as TransmissionType) {
    case 'amt':
      return createAmtTransmissionModel();
    case 'at':
      return createAtTransmissionModel();
    case 'cvt':
      return createCvtTransmissionModel();
    case 'dct':
      return createDctTransmissionModel();
    case 'manual':
    default:
      return createManualTransmissionModel();
  }
}
