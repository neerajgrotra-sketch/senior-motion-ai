export type ExercisePosture = 'seated' | 'standing'
export type ExerciseSide = 'left' | 'right' | 'bilateral'
export type TargetJointArea = 'shoulder' | 'hip' | 'knee' | 'trunk'

export type LandmarkName =
  | 'nose'
  | 'left_eye'
  | 'right_eye'
  | 'left_ear'
  | 'right_ear'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle'

export type PosePoint = {
  x: number
  y: number
  z?: number
  score?: number
}

export type PoseLandmarks = Partial<Record<LandmarkName, PosePoint>>

export type SignalType =
  | 'relative_y'
  | 'relative_x'
  | 'distance'
  | 'joint_angle'
  | 'torso_lean'
  | 'velocity'

export type SignalDefinition = {
  id: string
  type: SignalType
  label: string
  config: Record<string, unknown>
}

export type ExerciseIntentModel = {
  id: string

  presentation: {
    name: string
    instruction: string
    targetReps: number
    posture: ExercisePosture
    side: ExerciseSide
  }

  objective: {
    goal: string
    targetJointArea: TargetJointArea
  }

  landmarks: {
    tracked: LandmarkName[]
  }

  signals: SignalDefinition[]

  signalRefs: {
    primaryLiftSignalId: string
    oppositeLiftSignalId?: string
    trunkLeanSignalId?: string
  }

  thresholds: {
    startMax: number
    targetMin: number
    holdDurationMs: number
    minRepDurationMs: number
    maxRepDurationMs: number
    maxTrunkLeanDeg?: number
    controlledReturnMinMs: number
  }

  errors: {
    detectWrongSide: boolean
    detectInsufficientRange: boolean
    detectNoHold: boolean
    detectTooFast: boolean
    detectTrunkLean: boolean
  }

  coaching: {
    intro: string
    start: string
    wrongSide: string
    insufficientRange: string
    noHold: string
    tooFast: string
    trunkLean: string
    success: string
    completedExercise: string
  }
}

export type ExerciseMotionState =
  | 'ready'
  | 'lifting'
  | 'at_target'
  | 'holding'
  | 'lowering'
  | 'completed'

export type IntentErrorCode =
  | 'wrong_side'
  | 'insufficient_range'
  | 'no_hold'
  | 'too_fast'
  | 'trunk_lean'

export type LiveIntentState = {
  exerciseId: string
  motionState: ExerciseMotionState
  repCount: number
  repInProgress: boolean
  repStartedAtMs?: number
  reachedTargetAtMs?: number
  returnStartedAtMs?: number
  lastRepCompletedAtMs?: number
  feedbackMessage: string
  latestSignals: Record<string, number>
  lastErrorCode?: IntentErrorCode
  completed: boolean
}

export type IntentEvaluationResult = {
  nextState: LiveIntentState
  repCompleted: boolean
  detectedErrorCode?: IntentErrorCode
  feedbackMessage: string
  signals: Record<string, number>
}
