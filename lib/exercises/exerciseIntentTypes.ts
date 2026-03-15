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

export type SignalDefinition = {
  key: string;
  label?: string;
  description?: string;
};

export type IntentSignalValue =
  | number
  | boolean
  | string
  | null
  | undefined;

export type IntentSignalMap = Record<string, IntentSignalValue>;
