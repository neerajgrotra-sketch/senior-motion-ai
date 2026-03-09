export type DebugState = {
  fps: number;
  tracking: 'idle' | 'active' | 'lost';
  personDetected: boolean;
  trackId: number | null;
  confidence: number;
  visibleKeypoints: number;
  exercisePhase: string;
  repCount: number;
  holdMs: number;
  statusText: string;
  currentLiftNorm: number;
  currentRepPeakLift: number;
  lastRepPeakLift: number | null;
  sessionPeakLift: number;
};

export type PosePoint = {
  x: number;
  y: number;
  score: number;
};

export type PoseKeypointMap = Record<string, PosePoint>;

export type PoseTrack = {
  id: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  keypoints: PoseKeypointMap;
};

export type ExerciseFrameFeatures = {
  timestamp: number;
  confidence: number;
  torsoLength: number;
  torsoLeanDeg: number;
  rightWristY: number;
  rightShoulderY: number;
  rightElbowY: number;
  rightWristScore: number;
  rightShoulderScore: number;
  rightElbowScore: number;
  rightHandAboveShoulder: boolean;
  rightHandClearlyDown: boolean;
  rightHandLiftNorm: number;
  postureStable: boolean;
};

export type ExercisePhase =
  | 'idle'
  | 'ready'
  | 'moving_up'
  | 'at_top'
  | 'holding'
  | 'moving_down'
  | 'rep_complete'
  | 'lost';

export type ExerciseMachine = {
  prompt: string;
  phase: ExercisePhase;
  repCount: number;
  holdMs: number;
  statusText: string;
  lastTimestamp: number | null;
  lastTransitionAt: number | null;
  lastCompletedAt: number | null;
  lastFeatures: ExerciseFrameFeatures | null;
  currentRepPeakLift: number;
  lastRepPeakLift: number | null;
  sessionPeakLift: number;
};
