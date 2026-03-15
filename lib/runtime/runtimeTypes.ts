// lib/runtime/runtimeTypes.ts

import {
  ExerciseDefinition,
  ExerciseEvaluationResult,
  ExerciseIntentPhase,
} from "../exercises/exerciseTypes";

export type RuntimeStatus =
  | "idle"
  | "waiting_for_pose"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "error";

export type RuntimeActiveSide = "left" | "right" | null;

export interface RuntimeRepState {
  phase: ExerciseIntentPhase;
  repCount: number;
  lastRepTimestampMs: number | null;
  startedAtMs: number | null;
  updatedAtMs: number | null;
  activeSide: RuntimeActiveSide;
}

export interface RuntimeExerciseState {
  exercise: ExerciseDefinition;
  repState: RuntimeRepState;
  lastEvaluation: ExerciseEvaluationResult | null;
  completed: boolean;
}

export interface RuntimeEngineConfig {
  enableDebug: boolean;
  minPoseConfidence: number;
  cooldownBetweenRepsMs: number;
}

export interface RuntimeFrameResult {
  status: RuntimeStatus;
  exerciseState: RuntimeExerciseState | null;
  coachingMessage: string | null;
  debug: Record<string, unknown>;
}
