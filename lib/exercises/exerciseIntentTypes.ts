import type {
  NormalizedPoseKeypoint,
  PoseFrame,
  PoseLandmarkName,
} from "../pose/poseTypes";

/**
 * Legacy compatibility layer for the old exercise intent engine.
 * The new biomechanics architecture should eventually replace this.
 */

/* ------------------------------------------------ */
/* Pose Types */
/* ------------------------------------------------ */

export type LandmarkName = PoseLandmarkName;

export type PosePoint = {
  x: number;
  y: number;
  z?: number;
  score?: number;
  visibility?: number;
};

export type PoseLandmarks = Record<PoseLandmarkName, NormalizedPoseKeypoint>;

export type NormalizedPoseLandmarks = PoseFrame["keypoints"];

/* ------------------------------------------------ */
/* Signals */
/* ------------------------------------------------ */

export type SignalType =
  | "relative_y"
  | "relative_x"
  | "angle"
  | "distance"
  | "boolean"
  | "threshold"
  | string;

export type SignalDefinition = {
  id: string;
  key?: string;
  type: SignalType;
  label?: string;
  description?: string;
  config: Record<string, unknown>;
};

export type IntentSignalValue = number;
export type IntentSignalMap = Record<string, number>;

/* ------------------------------------------------ */
/* Errors */
/* ------------------------------------------------ */

export type IntentErrorCode =
  | "none"
  | "missing_pose"
  | "low_confidence"
  | "signal_missing"
  | "threshold_not_met"
  | "invalid_model"
  | "trunk_lean"
  | "wrong_side"
  | "no_hold"
  | "insufficient_range"
  | "too_fast"
  | "unknown";

/* ------------------------------------------------ */
/* Runtime State */
/* ------------------------------------------------ */

export type LiveIntentPhase =
  | "idle"
  | "ready"
  | "moving_up"
  | "at_top"
  | "moving_down"
  | "rep_complete"
  | "completed"
  | "error"
  | string;

export type LiveIntentState = {
  exerciseId?: string;
  phase?: LiveIntentPhase;
  motionState?: string;

  startedAtMs?: number;
  updatedAtMs?: number;

  repCount: number;
  repInProgress: boolean;
  repStartedAtMs?: number;
  reachedTargetAtMs?: number;
  returnStartedAtMs?: number;
  lastRepCompletedAtMs?: number;
  lastRepTimestampMs?: number | null;

  feedbackMessage?: string;

  latestSignals?: Record<string, number>;
  lastErrorCode?: IntentErrorCode;

  completed?: boolean;

  confidence?: number;
  activeSide?: "left" | "right" | "bilateral" | null;

  matchedRules?: string[];
  debug?: Record<string, unknown>;
};

/* ------------------------------------------------ */
/* Thresholds */
/* ------------------------------------------------ */

export type LegacyExerciseThresholds = {
  startMax: number;
  targetMin: number;
  holdDurationMs: number;
  minRepDurationMs: number;
  controlledReturnMinMs: number;
  maxRepDurationMs: number;

  returnMax?: number;
  minConfidence?: number;
  symmetryMaxDiff?: number;
  postureMin?: number;
  maxTrunkLeanDeg?: number;
  [key: string]: number | undefined;
};

/* ------------------------------------------------ */
/* Rules */
/* ------------------------------------------------ */

export type IntentThresholdRule = {
  signalId: string;
  operator?: ">" | ">=" | "<" | "<=" | "==" | "!=";
  value: number | boolean | string;
};

export type IntentTransitionRule = {
  from: string;
  to: string;
  when?: IntentThresholdRule[];
};

/* ------------------------------------------------ */
/* Exercise Intent Model */
/* ------------------------------------------------ */

export type ExerciseIntentModel = {
  id: string;
  name?: string;
  version?: string;

  signals: SignalDefinition[];
  signalDefinitions?: SignalDefinition[];

  signalRefs: {
    primaryLiftSignalId: string;
    oppositeLiftSignalId?: string;
    symmetrySignalId?: string;
    postureSignalId?: string;
    confidenceSignalId?: string;
    trunkLeanSignalId?: string;
    [key: string]: string | undefined;
  };

  thresholds: LegacyExerciseThresholds;

  errors: {
    detectTrunkLean?: boolean;
    detectAsymmetry?: boolean;
    detectLowConfidence?: boolean;
    detectWrongSide?: boolean;
    detectNoHold?: boolean;
    detectInsufficientRange?: boolean;
    detectTooFast?: boolean;
    [key: string]: boolean | undefined;
  };

  presentation: {
    targetReps: number;
    title?: string;
    description?: string;
    [key: string]: string | number | undefined;
  };

  transitions?: IntentTransitionRule[];

  metadata?: Record<string, unknown>;

  coaching: {
    intro?: string;
    success?: string;
    correction?: string;
    error?: string;
    trunkLean?: string;
    lowConfidence?: string;
    asymmetry?: string;
    wrongSide?: string;
    noHold?: string;
    insufficientRange?: string;
    tooFast?: string;
    completedExercise?: string;
    reset?: string;
    [key: string]: string | undefined;
  };
};

/* ------------------------------------------------ */
/* Evaluation Result */
/* ------------------------------------------------ */

export type IntentEvaluationResult = {
  nextState?: LiveIntentState;
  repCompleted?: boolean;
  detectedErrorCode?: IntentErrorCode;
  feedbackMessage?: string;

  ok?: boolean;
  errorCode?: IntentErrorCode;
  state?: LiveIntentState;
  signals?: Record<string, number>;
  matchedRules?: string[];
  confidence?: number;
  debug?: Record<string, unknown>;
};
