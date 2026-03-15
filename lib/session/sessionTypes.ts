// lib/session/sessionTypes.ts

import { ExerciseDefinition } from "../exercises/exerciseTypes";

export type SessionStatus =
  | "draft"
  | "ready"
  | "countdown"
  | "running"
  | "paused"
  | "completed"
  | "aborted";

export interface SessionExerciseItem {
  id: string;
  exerciseId: string;
  exercise: ExerciseDefinition;
  repTarget: number;
  holdMs?: number;
  restAfterMs?: number;
  sideOverride?: "left" | "right" | "bilateral" | null;
  order: number;
}

export interface SessionDefinition {
  id: string;
  title: string;
  description?: string;
  items: SessionExerciseItem[];
}

export interface SessionProgress {
  currentIndex: number;
  completedExerciseIds: string[];
  totalExercises: number;
  totalRepsCompleted: number;
  currentExerciseStartedAtMs: number | null;
  sessionStartedAtMs: number | null;
  sessionEndedAtMs: number | null;
}

export interface SessionTransitionState {
  isTransitioning: boolean;
  transitionReason:
    | "next_exercise"
    | "exercise_completed"
    | "session_completed"
    | "manual_skip"
    | "none";
  startedAtMs: number | null;
}

export interface SessionRunnerState {
  status: SessionStatus;
  session: SessionDefinition | null;
  progress: SessionProgress;
  currentItem: SessionExerciseItem | null;
  transition: SessionTransitionState;
  cameraActive: boolean;
  poseLoopActive: boolean;
}
