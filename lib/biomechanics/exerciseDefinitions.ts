import type { ExerciseDefinition } from './types';

export const RAISE_RIGHT_HAND_DEFINITION: ExerciseDefinition = {
  id: 'raise_right_hand_v2',
  label: 'Raise Right Hand',
  allowedPostures: ['sitting', 'standing'],
  side: 'right',

  thresholds: {
    targetLiftNorm: 0.55,
    returnLiftNorm: 0.12,
    wrongSideLiftNorm: 0.30,
    maxTorsoLeanDeg: 15,
    minHoldMs: 1200,
    maxVelocityNorm: 0.02,
    noResponseMs: 3000
  },

  phases: {
    ready: [
      { kind: 'posture', allowed: ['sitting', 'standing'] },
      { signal: 'rightHandLiftNorm', op: '<=', value: 0.12 },
      { signal: 'torsoLeanDeg', op: 'abs<=', value: 15 }
    ],
    ascentStart: [{ signal: 'rightHandLiftNorm', op: '>', value: 0.18 }],
    peakReached: [{ signal: 'rightHandLiftNorm', op: '>=', value: 0.55 }],
    returnReached: [{ signal: 'rightHandLiftNorm', op: '<=', value: 0.12 }]
  },

  errors: [
    {
      code: 'wrong_side',
      when: [{ signal: 'leftHandLiftNorm', op: '>=', value: 0.30 }],
      severity: 'high',
      message: 'Use your right hand.'
    },
    {
      code: 'trunk_compensation',
      when: [{ signal: 'torsoLeanDeg', op: 'abs>', value: 15 }],
      severity: 'high',
      message: 'Keep your body upright.'
    },
    {
      code: 'excessive_speed',
      when: [{ signal: 'movementSpeedNorm', op: '>', value: 0.02 }],
      severity: 'medium',
      message: 'Move more slowly.'
    }
  ],

  cues: {
    intro: 'Raise your right hand slowly.',
    ready: 'Get ready.',
    ascend: 'Lift your right hand.',
    hold: 'Hold it there.',
    descend: 'Lower slowly.',
    success: 'Great job.',
    corrections: {
      wrong_side: 'Use your right hand.',
      insufficient_range: 'Lift a little higher.',
      insufficient_hold: 'Hold it a bit longer.',
      incomplete_return: 'Lower all the way down.',
      trunk_compensation: 'Keep your body upright.',
      excessive_speed: 'Move more slowly.',
      no_response: 'Start when you are ready.'
    }
  }
};
