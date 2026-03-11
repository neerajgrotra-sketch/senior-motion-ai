import type { ExerciseController } from '../poseTypes';

import {
  advanceRaiseRightHand,
  createRaiseRightHandMachine
} from './raiseRightHand';

import {
  advanceRaiseLeftHand,
  createRaiseLeftHandMachine
} from './raiseLeftHand';

import {
  advanceBothHandsUp,
  createBothHandsUpMachine
} from './bothHandsUp';

export const EXERCISE_REGISTRY: Record<string, ExerciseController> = {
  raise_right_hand: {
    id: 'raise_right_hand',
    label: 'Raise Right Hand',
    createMachine: createRaiseRightHandMachine,
    advance: advanceRaiseRightHand,
    getCurrentLift: (features) => features.rightHandLiftNorm
  },

  raise_left_hand: {
    id: 'raise_left_hand',
    label: 'Raise Left Hand',
    createMachine: createRaiseLeftHandMachine,
    advance: advanceRaiseLeftHand,
    getCurrentLift: (features) => features.leftHandLiftNorm
  },

  both_hands_up: {
    id: 'both_hands_up',
    label: 'Both Hands Up',
    createMachine: createBothHandsUpMachine,
    advance: advanceBothHandsUp,
    getCurrentLift: (features) => features.bothHandsLiftNorm
  }
};

export const EXERCISE_OPTIONS = Object.values(EXERCISE_REGISTRY);
