// lib/exercises/exerciseIntentTypes.ts

import type { PoseFrame, NormalizedPoseKeypoint, PoseLandmarkName } from "../pose/poseTypes";

/**
 * Legacy compatibility type.
 * Old components such as PoseTrackerPage.tsx may still import PoseLandmarks.
 * In the new architecture, landmarks live on PoseFrame["keypoints"].
 */
export type PoseLandmarks = Record<PoseLandmarkName, NormalizedPoseKeypoint>;

/**
 * Optional helper alias for legacy code that wants a full normalized pose object.
 */
export type NormalizedPoseLandmarks = PoseFrame["keypoints"];
