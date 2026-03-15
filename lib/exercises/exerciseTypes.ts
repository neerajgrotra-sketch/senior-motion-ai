// lib/exercises/exerciseTypes.ts

import { PostureType, PoseSide } from "../pose/poseTypes";
import { BiomechanicsFrame } from "../biomechanics/biomechanicsTypes";

export type ExerciseCategory =
  | "upper_body"
  | "lower_body"
  | "balance"
  | "mobility"
  | "posture"
  | "rehab";

export type ExerciseSideMode = "left" | "right" | "bilateral" | "either" | "none";

export type ExerciseIntentPhase =
  | "idle"
  | "ready"
  | "moving_up"
  | "at_top"
  | "moving_down"
  | "rep_complete"
  | "completed"
  | "error";

export interface ExerciseThresholds {
  minLiftNormalized?: number;
  minShoulderFlexionDeg?: number;
  maxTorsoLeanDeg?: number;
  minElbowExtensionDeg?: number;
  minHoldMs?: number;
  minRepGapMs?: number;
}

export interface ExerciseCoachingRule {
  code:
    | "lift_higher"
    | "lower_slowly"
    | "keep_torso_upright"
    | "straighten_elbow"
    | "hold_position"
    | "good_rep"
    | "switch_side"
    | "reset_position";
  priority: number;
  message: string;
}

export interface ExerciseDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ExerciseCategory;
  sideMode: ExerciseSideMode;
  targetPosture: PostureType | "either";
  repTargetDefault: number;
  thresholds: ExerciseThresholds;
  coachingRules: ExerciseCoachingRule[];
}

export interface ExerciseEvaluationContext {
  exercise: ExerciseDefinition;
  side: "left" | "right" | null;
  frame: BiomechanicsFrame;
  elapsedMs: number;
  repCount: number;
  phase: ExerciseIntentPhase;
  lastRepTimestampMs: number | null;
}

export interface ExerciseFormFlags {
  goodPosture: boolean;
  enoughLift: boolean;
  elbowAcceptable: boolean;
  movementDetected: boolean;
  bodyVisible: boolean;
}

export interface ExerciseEvaluationResult {
  detected: boolean;
  phase: ExerciseIntentPhase;
  repIncrement: 0 | 1;
  repJustCompleted: boolean;
  formFlags: ExerciseFormFlags;
  activeSide: PoseSide | null;
  confidence: number;
  coachingCodes: string[];
  debug: Record<string, number | string | boolean | null>;
}
