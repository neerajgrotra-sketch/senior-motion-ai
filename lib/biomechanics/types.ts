export type BodyPosture = 'standing' | 'sitting' | 'unknown';

export type ExerciseSide = 'left' | 'right' | 'bilateral' | 'either';

export type RuntimePhase =
  | 'idle'
  | 'ready'
  | 'ascending'
  | 'holding'
  | 'descending'
  | 'rep_complete'
  | 'completed'
  | 'stalled'
  | 'lost_tracking';

export type ErrorCode =
  | 'no_response'
  | 'wrong_side'
  | 'insufficient_range'
  | 'insufficient_hold'
  | 'incomplete_return'
  | 'trunk_compensation'
  | 'excessive_speed'
  | 'tracking_unreliable'
  | 'posture_mismatch';

export type Severity = 'low' | 'medium' | 'high';

export type NumericOperator =
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | 'abs<'
  | 'abs<='
  | 'abs>'
  | 'abs>=';

export type SignalName =
  | 'confidence'
  | 'torsoLength'
  | 'torsoLeanDeg'
  | 'shoulderTiltDeg'
  | 'hipTiltDeg'
  | 'leftElbowAngleDeg'
  | 'rightElbowAngleDeg'
  | 'leftKneeAngleDeg'
  | 'rightKneeAngleDeg'
  | 'leftHandLiftNorm'
  | 'rightHandLiftNorm'
  | 'bothHandsLiftNorm'
  | 'rightKneeLiftNorm'
  | 'leftKneeLiftNorm'
  | 'leftHandVelocityY'
  | 'rightHandVelocityY'
  | 'leftKneeVelocityY'
  | 'rightKneeVelocityY'
  | 'movementSpeedNorm'
  | 'timeSinceRepStartMs'
  | 'timeSincePhaseStartMs'
  | 'holdDurationMs';

export type BiomechanicsSignals = {
  timestamp: number;
  posture: BodyPosture;
  postureStable: boolean;
  confidence: number;

  torsoLength: number;
  torsoLeanDeg: number;
  shoulderTiltDeg: number;
  hipTiltDeg: number;

  leftElbowAngleDeg: number | null;
  rightElbowAngleDeg: number | null;
  leftKneeAngleDeg: number | null;
  rightKneeAngleDeg: number | null;

  leftHandLiftNorm: number;
  rightHandLiftNorm: number;
  bothHandsLiftNorm: number;

  leftKneeLiftNorm: number;
  rightKneeLiftNorm: number;

  leftHandVelocityY: number;
  rightHandVelocityY: number;
  leftKneeVelocityY: number;
  rightKneeVelocityY: number;

  movementSpeedNorm: number;

  timeSinceRepStartMs: number;
  timeSincePhaseStartMs: number;
  holdDurationMs: number;

  leftHandAboveShoulder: boolean;
  rightHandAboveShoulder: boolean;
  bothHandsAboveShoulder: boolean;

  leftHandClearlyDown: boolean;
  rightHandClearlyDown: boolean;
  bothHandsClearlyDown: boolean;
};

export type NumericRule = {
  signal: SignalName;
  op: NumericOperator;
  value: number;
};

export type PostureRule = {
  kind: 'posture';
  allowed: BodyPosture[];
};

export type BooleanRule = {
  kind: 'boolean';
  signal:
    | 'postureStable'
    | 'leftHandAboveShoulder'
    | 'rightHandAboveShoulder'
    | 'bothHandsAboveShoulder'
    | 'leftHandClearlyDown'
    | 'rightHandClearlyDown'
    | 'bothHandsClearlyDown';
  equals: boolean;
};

export type Rule = NumericRule | PostureRule | BooleanRule;

export type ErrorDefinition = {
  code: ErrorCode;
  when: Rule[];
  severity: Severity;
  message: string;
};

export type ExerciseDefinition = {
  id: string;
  label: string;
  allowedPostures: BodyPosture[];
  side: ExerciseSide;

  thresholds: {
    targetLiftNorm?: number;
    returnLiftNorm?: number;
    wrongSideLiftNorm?: number;
    maxTorsoLeanDeg?: number;
    minHoldMs?: number;
    maxVelocityNorm?: number;
    noResponseMs?: number;
  };

  phases: {
    ready: Rule[];
    ascentStart: Rule[];
    peakReached: Rule[];
    returnReached: Rule[];
  };

  errors: ErrorDefinition[];

  cues: {
    intro: string;
    ready: string;
    ascend: string;
    hold: string;
    descend: string;
    success: string;
    corrections: Partial<Record<ErrorCode, string>>;
  };
};

export type DetectedError = {
  code: ErrorCode;
  severity: Severity;
  message: string;
};

export type RuntimeAssessment = {
  phase: RuntimePhase;
  repCount: number;
  progress: number;
  activeErrors: DetectedError[];
  primaryCue: string | null;
  currentLift: number;
  holdMs: number;
};

export type RuntimeState = {
  phase: RuntimePhase;
  repCount: number;
  phaseStartedAt: number;
  repStartedAt: number | null;
  holdStartedAt: number | null;
  lastRepCompletedAt: number | null;
};

export function createInitialRuntimeState(now: number): RuntimeState {
  return {
    phase: 'idle',
    repCount: 0,
    phaseStartedAt: now,
    repStartedAt: null,
    holdStartedAt: null,
    lastRepCompletedAt: null
  };
}
