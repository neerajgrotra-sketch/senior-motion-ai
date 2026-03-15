// lib/exercises/exerciseIntentTypes.ts

import type {
  NormalizedPoseKeypoint,
  PoseFrame,
  PoseLandmarkName,
} from "../pose/poseTypes";

/**
 * Legacy compatibility layer for older intent/exercise files.
 * New architecture uses pose/poseTypes.ts as the source of truth.
 */

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

export type IntentSignalValue =
  | number
  | boolean
  | string
  | null
  | undefined;

export type IntentSignalMap = Record<string, IntentSignalValue>;

export type IntentErrorCode =
  | "none"
  | "missing_pose"
  | "low_confidence"
  | "signal_missing"
  | "threshold_not_met"
  | "invalid_model"
  | "unknown";

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

  repCount?: number;
  repInProgress?: boolean;
  repStartedAtMs?: number | undefined;
  reachedTargetAtMs?: number | undefined;
  returnStartedAtMs?: number | undefined;
  lastRepCompletedAtMs?: number | undefined;
  lastRepTimestampMs?: number | null;

  feedbackMessage?: string;
  latestSignals?: IntentSignalMap;
  lastErrorCode?: IntentErrorCode | undefined;
  completed?: boolean;

  confidence?: number;
  activeSide?: "left" | "right" | "bilateral" | null;
  matchedRules?: string[];
  debug?: Record<string, unknown>;
};

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

export type ExerciseIntentModel = {
  id: string;
  name?: string;
  version?: string;
  signalDefinitions: SignalDefinition[];
  thresholds?: IntentThresholdRule[];
  transitions?: IntentTransitionRule[];
  metadata?: Record<string, unknown>;
};

export type IntentEvaluationResult = {
  ok: boolean;
  errorCode?: IntentErrorCode;
  state: LiveIntentState;
  signals: IntentSignalMap;
  matchedRules?: string[];
  confidence?: number;
  debug?: Record<string, unknown>;
};
