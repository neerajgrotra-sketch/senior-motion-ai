// lib/tracking/trackingTypes.ts

import { PoseLandmarkName, PoseFrame } from "../pose/poseTypes";

export interface SmoothingConfig {
  positionAlpha: number; // 0..1
  depthAlpha: number; // 0..1
  visibilityAlpha: number; // 0..1
}

export interface VisibilityRule {
  requiredLandmarks: PoseLandmarkName[];
  minVisibleLandmarks: number;
  minVisibilityScore: number;
}

export interface FrameStabilityMetrics {
  averageVisibility: number;
  trackedLandmarks: number;
  jitterScore: number;
  stable: boolean;
}

export interface TrackingContext {
  previousFrame: PoseFrame | null;
  smoothedFrame: PoseFrame | null;
  stability: FrameStabilityMetrics | null;
}

export interface TrackingQualityGate {
  canEvaluateExercise: boolean;
  reason:
    | "ok"
    | "no_pose"
    | "low_visibility"
    | "unstable_tracking"
    | "out_of_frame";
}
