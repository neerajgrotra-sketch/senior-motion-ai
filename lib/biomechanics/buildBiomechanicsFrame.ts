// lib/biomechanics/buildBiomechanicsFrame.ts

import { PoseFrame } from "../pose/poseTypes";
import {
  ArmMetrics,
  BiomechanicsFrame,
  SymmetryMetrics,
  TorsoMetrics,
} from "./biomechanicsTypes";
import { calculateAngles, calculateSegments } from "./calculateAngles";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toNullableNumber(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildArmMetrics(
  pose: PoseFrame,
  side: "left" | "right",
  previousFrame?: BiomechanicsFrame | null,
): ArmMetrics {
  const shoulder = pose.keypoints[`${side}_shoulder`];
  const elbow = pose.keypoints[`${side}_elbow`];
  const wrist = pose.keypoints[`${side}_wrist`];

  const shoulderAngle = previousFrame
    ? null
    : null;

  const currentLift =
    shoulder.present && wrist.present
      ? clamp01((shoulder.y - wrist.y) / 0.35)
      : null;

  const horizontalAbduction =
    shoulder.present && wrist.present
      ? clamp01(Math.abs(wrist.x - shoulder.x) / 0.35)
      : null;

  let movementVelocity: number | null = null;

  if (previousFrame) {
    const previousWrist = previousFrame.pose.keypoints[`${side}_wrist`];
    const dtMs = pose.timestampMs - previousFrame.timestampMs;

    if (previousWrist.present && wrist.present && dtMs > 0) {
      const dy = previousWrist.y - wrist.y;
      movementVelocity = dy / (dtMs / 1000);
    }
  }

  return {
    side,
    shoulderFlexionDeg: toNullableNumber(
      previousFrame ? null : null,
    ) ?? null,
    elbowFlexionDeg: null,
    wristAboveShoulder:
      shoulder.present && wrist.present ? wrist.y < shoulder.y : false,
    wristAboveElbow:
      elbow.present && wrist.present ? wrist.y < elbow.y : false,
    verticalLiftNormalized: currentLift,
    horizontalAbductionNormalized: horizontalAbduction,
    movementVelocity,
  };
}

export function buildBiomechanicsFrame(
  pose: PoseFrame,
  previousFrame?: BiomechanicsFrame | null,
): BiomechanicsFrame {
  const angles = calculateAngles(pose);
  const segments = calculateSegments(pose);

  const leftArmBase = buildArmMetrics(pose, "left", previousFrame);
  const rightArmBase = buildArmMetrics(pose, "right", previousFrame);

  const leftArm: ArmMetrics = {
    ...leftArmBase,
    shoulderFlexionDeg: angles.left_shoulder.degrees,
    elbowFlexionDeg: angles.left_elbow.degrees,
  };

  const rightArm: ArmMetrics = {
    ...rightArmBase,
    shoulderFlexionDeg: angles.right_shoulder.degrees,
    elbowFlexionDeg: angles.right_elbow.degrees,
  };

  const torso: TorsoMetrics = {
    trunkLeanDeg: angles.torso_incline.degrees,
    shoulderTiltDeg: angles.shoulder_line_tilt.degrees,
    hipTiltDeg: angles.hip_line_tilt.degrees,
    uprightConfidence:
      pose.visibility.isBodySufficientlyVisible && angles.torso_incline.degrees !== null
        ? clamp01(1 - Math.abs(angles.torso_incline.degrees) / 40)
        : 0,
  };

  const leftShoulder = pose.keypoints.left_shoulder;
  const rightShoulder = pose.keypoints.right_shoulder;
  const leftWrist = pose.keypoints.left_wrist;
  const rightWrist = pose.keypoints.right_wrist;

  const symmetry: SymmetryMetrics = {
    shoulderHeightDifference:
      leftShoulder.present && rightShoulder.present
        ? Math.abs(leftShoulder.y - rightShoulder.y)
        : null,
    wristHeightDifference:
      leftWrist.present && rightWrist.present
        ? Math.abs(leftWrist.y - rightWrist.y)
        : null,
    leftRightArmLiftDifference:
      leftArm.verticalLiftNormalized !== null &&
      rightArm.verticalLiftNormalized !== null
        ? Math.abs(
            leftArm.verticalLiftNormalized - rightArm.verticalLiftNormalized,
          )
        : null,
  };

  return {
    timestampMs: pose.timestampMs,
    pose,
    angles,
    segments,
    arms: {
      left: leftArm,
      right: rightArm,
    },
    torso,
    symmetry,
  };
}
