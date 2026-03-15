// lib/pose/buildPoseFrame.ts

import {
  BoundingBox,
  BodyOrientation,
  JointVisibilitySummary,
  NormalizedPoseKeypoint,
  PoseCenterOfMassEstimate,
  PoseFrame,
  PoseLandmarkName,
  PostureType,
  RawPoseFrame,
} from "./poseTypes";
import { ALL_BLAZEPOSE_LANDMARKS } from "./poseMapper";

const DEFAULT_VISIBILITY = 0;
const DEFAULT_Z = 0;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createMissingKeypoint(name: PoseLandmarkName): NormalizedPoseKeypoint {
  return {
    name,
    x: 0,
    y: 0,
    z: DEFAULT_Z,
    visibility: DEFAULT_VISIBILITY,
    present: false,
  };
}

function estimateBoundingBox(
  keypoints: Record<PoseLandmarkName, NormalizedPoseKeypoint>,
): BoundingBox | null {
  const presentPoints = Object.values(keypoints).filter(
    (kp) => kp.present && kp.visibility > 0.15,
  );

  if (presentPoints.length === 0) {
    return null;
  }

  const xs = presentPoints.map((kp) => kp.x);
  const ys = presentPoints.map((kp) => kp.y);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  return {
    xMin,
    yMin,
    width: Math.max(0, xMax - xMin),
    height: Math.max(0, yMax - yMin),
  };
}

function estimateCenter(
  keypoints: Record<PoseLandmarkName, NormalizedPoseKeypoint>,
): PoseCenterOfMassEstimate | null {
  const weighted = Object.values(keypoints).filter(
    (kp) => kp.present && kp.visibility > 0.15,
  );

  if (weighted.length === 0) {
    return null;
  }

  let xSum = 0;
  let ySum = 0;
  let weightSum = 0;

  for (const kp of weighted) {
    const w = Math.max(0.01, kp.visibility);
    xSum += kp.x * w;
    ySum += kp.y * w;
    weightSum += w;
  }

  return {
    x: xSum / weightSum,
    y: ySum / weightSum,
  };
}

function inferOrientation(
  keypoints: Record<PoseLandmarkName, NormalizedPoseKeypoint>,
): BodyOrientation {
  const leftShoulder = keypoints.left_shoulder;
  const rightShoulder = keypoints.right_shoulder;

  if (!leftShoulder.present || !rightShoulder.present) {
    return "unknown";
  }

  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

  if (shoulderWidth > 0.08) {
    return "front";
  }

  const nose = keypoints.nose;
  if (!nose.present) {
    return "unknown";
  }

  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;

  return nose.x < shoulderMidX ? "left_profile" : "right_profile";
}

function inferPosture(
  keypoints: Record<PoseLandmarkName, NormalizedPoseKeypoint>,
): PostureType {
  const leftShoulder = keypoints.left_shoulder;
  const rightShoulder = keypoints.right_shoulder;
  const leftHip = keypoints.left_hip;
  const rightHip = keypoints.right_hip;
  const leftKnee = keypoints.left_knee;
  const rightKnee = keypoints.right_knee;

  const required = [
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
  ];

  if (required.some((kp) => !kp.present)) {
    return "unknown";
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const kneeY = (leftKnee.y + rightKnee.y) / 2;

  const torsoHeight = Math.abs(hipY - shoulderY);
  const upperLegHeight = Math.abs(kneeY - hipY);

  if (torsoHeight <= 0 || upperLegHeight <= 0) {
    return "unknown";
  }

  const ratio = torsoHeight / upperLegHeight;

  if (ratio > 0.85) {
    return "standing";
  }

  if (ratio <= 0.85) {
    return "sitting";
  }

  return "unknown";
}

function summarizeVisibility(
  keypoints: Record<PoseLandmarkName, NormalizedPoseKeypoint>,
): JointVisibilitySummary {
  const values = Object.values(keypoints);
  const visibleCount = values.filter((kp) => kp.present && kp.visibility >= 0.5).length;
  const requiredVisibleCount = 8;
  const visibilityScore =
    values.reduce((sum, kp) => sum + kp.visibility, 0) / values.length;

  return {
    visibleCount,
    requiredVisibleCount,
    visibilityScore,
    isBodySufficientlyVisible:
      visibleCount >= requiredVisibleCount && visibilityScore >= 0.35,
  };
}

function inferTrackingStable(
  bbox: BoundingBox | null,
  visibility: JointVisibilitySummary,
): boolean {
  if (!bbox) {
    return false;
  }

  const hasReasonableBodySize = bbox.height > 0.2 && bbox.width > 0.08;
  return visibility.isBodySufficientlyVisible && hasReasonableBodySize;
}

export function buildPoseFrame(raw: RawPoseFrame): PoseFrame {
  const keypoints = ALL_BLAZEPOSE_LANDMARKS.reduce(
    (acc, name) => {
      acc[name] = createMissingKeypoint(name);
      return acc;
    },
    {} as Record<PoseLandmarkName, NormalizedPoseKeypoint>,
  );

  for (const rawKp of raw.keypoints) {
    keypoints[rawKp.name] = {
      name: rawKp.name,
      x: clamp01(raw.frameWidth > 0 ? rawKp.x / raw.frameWidth : 0),
      y: clamp01(raw.frameHeight > 0 ? rawKp.y / raw.frameHeight : 0),
      z: rawKp.z ?? DEFAULT_Z,
      visibility: clamp01(rawKp.score ?? DEFAULT_VISIBILITY),
      present: true,
    };
  }

  const bbox = estimateBoundingBox(keypoints);
  const center = estimateCenter(keypoints);
  const orientation = inferOrientation(keypoints);
  const posture = inferPosture(keypoints);
  const visibility = summarizeVisibility(keypoints);
  const trackingStable = inferTrackingStable(bbox, visibility);

  return {
    timestampMs: raw.timestampMs,
    frameWidth: raw.frameWidth,
    frameHeight: raw.frameHeight,
    keypoints,
    bbox,
    center,
    orientation,
    posture,
    visibility,
    trackingStable,
  };
}
