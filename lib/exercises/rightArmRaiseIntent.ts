import { ExerciseIntentModel } from './exerciseIntentTypes'

export const rightArmRaiseIntent: ExerciseIntentModel = {
  id: 'seated-right-arm-raise',

  presentation: {
    name: 'Seated Right Arm Raise',
    instruction: 'Raise your right arm, hold for one second, and lower slowly.',
    targetReps: 8,
    posture: 'seated',
    side: 'right',
  },

  objective: {
    goal: 'Improve right shoulder mobility and control',
    targetJointArea: 'shoulder',
  },

  landmarks: {
    tracked: [
      'left_shoulder',
      'right_shoulder',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hip',
      'right_hip',
    ],
  },

  signals: [
    {
      id: 'right_wrist_relative_to_right_shoulder_y',
      type: 'relative_y',
      label: 'Right wrist relative to right shoulder Y',
      config: {
        pointA: 'right_wrist',
        pointB: 'right_shoulder',
      },
    },
    {
      id: 'left_wrist_relative_to_left_shoulder_y',
      type: 'relative_y',
      label: 'Left wrist relative to left shoulder Y',
      config: {
        pointA: 'left_wrist',
        pointB: 'left_shoulder',
      },
    },
    {
      id: 'trunk_lean_deg',
      type: 'torso_lean',
      label: 'Trunk lean',
      config: {},
    },
  ],

  signalRefs: {
    primaryLiftSignalId: 'right_wrist_relative_to_right_shoulder_y',
    oppositeLiftSignalId: 'left_wrist_relative_to_left_shoulder_y',
    trunkLeanSignalId: 'trunk_lean_deg',
  },

  thresholds: {
    startMax: 0.02,
    targetMin: -0.03,
    holdDurationMs: 1000,
    minRepDurationMs: 1200,
    maxRepDurationMs: 6000,
    maxTrunkLeanDeg: 12,
    controlledReturnMinMs: 700,
  },

  errors: {
    detectWrongSide: true,
    detectInsufficientRange: true,
    detectNoHold: true,
    detectTooFast: true,
    detectTrunkLean: true,
  },

  coaching: {
    intro: 'Sit tall and get ready.',
    start: 'Raise your right arm slowly.',
    wrongSide: 'Use your right arm.',
    insufficientRange: 'Lift a little higher.',
    noHold: 'Hold for one second.',
    tooFast: 'Move more slowly.',
    trunkLean: 'Try to sit taller.',
    success: 'Great job. That is one rep.',
    completedExercise: 'Excellent. Exercise complete.',
  },
}
