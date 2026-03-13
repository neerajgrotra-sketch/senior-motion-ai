import { ExerciseIntentModel } from '@/lib/exercises/exerciseIntentTypes'

export const seatedKneeLiftIntent: ExerciseIntentModel = {
  id: 'seated-right-knee-lift',

  presentation: {
    name: 'Seated Right Knee Lift',
    instruction: 'Lift your right knee, hold briefly, and lower slowly.',
    targetReps: 8,
    posture: 'seated',
    side: 'right',
  },

  objective: {
    goal: 'Improve right hip flexion and lower-body control',
    targetJointArea: 'hip',
  },

  landmarks: {
    tracked: ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
  },

  signals: [
    {
      id: 'right_knee_relative_to_right_hip_y',
      type: 'relative_y',
      label: 'Right knee relative to right hip Y',
      config: {
        pointA: 'right_knee',
        pointB: 'right_hip',
      },
    },
    {
      id: 'left_knee_relative_to_left_hip_y',
      type: 'relative_y',
      label: 'Left knee relative to left hip Y',
      config: {
        pointA: 'left_knee',
        pointB: 'left_hip',
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
    primaryLiftSignalId: 'right_knee_relative_to_right_hip_y',
    oppositeLiftSignalId: 'left_knee_relative_to_left_hip_y',
    trunkLeanSignalId: 'trunk_lean_deg',
  },

  thresholds: {
    startMax: 0.16,
    targetMin: 0.05,
    holdDurationMs: 700,
    minRepDurationMs: 1000,
    maxRepDurationMs: 6000,
    maxTrunkLeanDeg: 15,
    controlledReturnMinMs: 500,
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
    start: 'Lift your right knee slowly.',
    wrongSide: 'Use your right leg.',
    insufficientRange: 'Lift your knee a little higher.',
    noHold: 'Hold briefly at the top.',
    tooFast: 'Move more slowly.',
    trunkLean: 'Try to stay tall in your chair.',
    success: 'Great job. That is one rep.',
    completedExercise: 'Excellent. Exercise complete.',
  },
}
