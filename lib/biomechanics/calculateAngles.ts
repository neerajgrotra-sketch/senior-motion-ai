// lib/biomechanics/calculateAngles.ts

import {
  AngleMeasurement,
  JointAngleName,
  SegmentMeasurement,
  SegmentName,
} from "./biomechanicsTypes";
import { NormalizedPoseKeypoint, PoseFrame } from "../pose/poseTypes";

interface Vec2 {
  x: number;
  y: number;
}

function isUsable(kp: NormalizedPoseKeypoint | undefined): kp is NormalizedPoseKeypoint {
  return Boolean(kp && kp.present && kp.visibility >= 0.2);
}

function vector(from: NormalizedPoseKeypoint, to: NormalizedPoseKeypoint): Vec2 {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
  };
}

function magnitude(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function angleBetween(a: Vec2, b: Vec2): number | null {
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (magA === 0 || magB === 0) {
    return null;
  }

  const cosTheta = dot(a, b) / (magA * magB);
  const clamped = Math.max(-1, Math.min(1, cosTheta));
  return (Math.acos(clamped) * 180) / Math.PI;
}

function jointAngle(
  a: NormalizedPoseKeypoint,
  b: NormalizedPoseKeypoint,
  c: NormalizedPoseKeypoint,
): number | null {
  const ba = vector(b, a);
  const bc = vector(b, c);
  return angleBetween(ba, bc);
}

function segmentLength(
  a: NormalizedPoseKeypoint,
  b: NormalizedPoseKeypoint,
): number | null {
  const v = vector(a, b);
  return magnitude(v);
}

function lineAngleDeg(
  a: NormalizedPoseKeypoint,
  b: NormalizedPoseKeypoint,
): number | null {
  const v = vector(a, b);
  if (magnitude(v) === 0) {
    return null;
  }

  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

function verticalAngleDeg(
  a: NormalizedPoseKeypoint,
  b: NormalizedPoseKeypoint,
): number | null {
  const v = vector(a, b);
  const vertical: Vec2 = { x: 0, y: -1 };
  return angleBetween(v, vertical);
}

function avgConfidence(...keypoints: NormalizedPoseKeypoint[]): number {
  if (keypoints.length === 0) {
    return 0;
  }
  return keypoints.reduce((sum, kp) => sum + kp.visibility, 0) / keypoints.length;
}

function makeAngle(name: JointAngleName, degrees: number | null, confidence: number): AngleMeasurement {
  return {
    name,
    degrees,
    confidence,
  };
}

function makeSegment(
  name: SegmentName,
  length: number | null,
  confidence: number,
): SegmentMeasurement {
  return {
    name,
    length,
    confidence,
  };
}

export function calculateAngles(
  pose: PoseFrame,
): Record<JointAngleName, AngleMeasurement> {
  const kp = pose.keypoints;

  const leftShoulder = kp.left_shoulder;
  const rightShoulder = kp.right_shoulder;
  const leftElbow = kp.left_elbow;
  const rightElbow = kp.right_elbow;
  const leftWrist = kp.left_wrist;
  const rightWrist = kp.right_wrist;
  const leftHip = kp.left_hip;
  const rightHip = kp.right_hip;
  const leftKnee = kp.left_knee;
  const rightKnee = kp.right_knee;

  const leftElbowDeg =
    isUsable(leftShoulder) && isUsable(leftElbow) && isUsable(leftWrist)
      ? jointAngle(leftShoulder, leftElbow, leftWrist)
      : null;

  const rightElbowDeg =
    isUsable(rightShoulder) && isUsable(rightElbow) && isUsable(rightWrist)
      ? jointAngle(rightShoulder, rightElbow, rightWrist)
      : null;

  const leftShoulderDeg =
    isUsable(leftElbow) && isUsable(leftShoulder) && isUsable(leftHip)
      ? jointAngle(leftElbow, leftShoulder, leftHip)
      : null;

  const rightShoulderDeg =
    isUsable(rightElbow) && isUsable(rightShoulder) && isUsable(rightHip)
      ? jointAngle(rightElbow, rightShoulder, rightHip)
      : null;

  const leftHipDeg =
    isUsable(leftShoulder) && isUsable(leftHip) && isUsable(leftKnee)
      ? jointAngle(leftShoulder, leftHip, leftKnee)
      : null;

  const rightHipDeg =
    isUsable(rightShoulder) && isUsable(rightHip) && isUsable(rightKnee)
      ? jointAngle(rightShoulder, rightHip, rightKnee)
      : null;

  const leftKneeDeg =
    isUsable(leftHip) && isUsable(leftKnee) && isUsable(kp.left_ankle)
      ? jointAngle(leftHip, leftKnee, kp.left_ankle)
      : null;

  const rightKneeDeg =
    isUsable(rightHip) && isUsable(rightKnee) && isUsable(kp.right_ankle)
      ? jointAngle(rightHip, rightKnee, kp.right_ankle)
      : null;

  const torsoInclineDeg =
    isUsable(leftShoulder) && isUsable(rightShoulder) && isUsable(leftHip) && isUsable(rightHip)
      ? verticalAngleDeg(
          {
            ...leftHip,
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2,
          },
          {
            ...leftShoulder,
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
          },
        )
      : null;

  const shoulderLineTiltDeg =
    isUsable(leftShoulder) && isUsable(rightShoulder)
      ? lineAngleDeg(leftShoulder, rightShoulder)
      : null;

  const hipLineTiltDeg =
    isUsable(leftHip) && isUsable(rightHip)
      ? lineAngleDeg(leftHip, rightHip)
      : null;

  return {
    left_elbow: makeAngle(
      "left_elbow",
      leftElbowDeg,
      isUsable(leftShoulder) && isUsable(leftElbow) && isUsable(leftWrist)
        ? avgConfidence(leftShoulder, leftElbow, leftWrist)
        : 0,
    ),
    right_elbow: makeAngle(
      "right_elbow",
      rightElbowDeg,
      isUsable(rightShoulder) && isUsable(rightElbow) && isUsable(rightWrist)
        ? avgConfidence(rightShoulder, rightElbow, rightWrist)
        : 0,
    ),
    left_shoulder: makeAngle(
      "left_shoulder",
      leftShoulderDeg,
      isUsable(leftElbow) && isUsable(leftShoulder) && isUsable(leftHip)
        ? avgConfidence(leftElbow, leftShoulder, leftHip)
        : 0,
    ),
    right_shoulder: makeAngle(
      "right_shoulder",
      rightShoulderDeg,
      isUsable(rightElbow) && isUsable(rightShoulder) && isUsable(rightHip)
        ? avgConfidence(rightElbow, rightShoulder, rightHip)
        : 0,
    ),
    left_hip: makeAngle(
      "left_hip",
      leftHipDeg,
      isUsable(leftShoulder) && isUsable(leftHip) && isUsable(leftKnee)
        ? avgConfidence(leftShoulder, leftHip, leftKnee)
        : 0,
    ),
    right_hip: makeAngle(
      "right_hip",
      rightHipDeg,
      isUsable(rightShoulder) && isUsable(rightHip) && isUsable(rightKnee)
        ? avgConfidence(rightShoulder, rightHip, rightKnee)
        : 0,
    ),
    left_knee: makeAngle(
      "left_knee",
      leftKneeDeg,
      isUsable(leftHip) && isUsable(leftKnee) && isUsable(kp.left_ankle)
        ? avgConfidence(leftHip, leftKnee, kp.left_ankle)
        : 0,
    ),
    right_knee: makeAngle(
      "right_knee",
      rightKneeDeg,
      isUsable(rightHip) && isUsable(rightKnee) && isUsable(kp.right_ankle)
        ? avgConfidence(rightHip, rightKnee, kp.right_ankle)
        : 0,
    ),
    torso_incline: makeAngle(
      "torso_incline",
      torsoInclineDeg,
      isUsable(leftShoulder) && isUsable(rightShoulder) && isUsable(leftHip) && isUsable(rightHip)
        ? avgConfidence(leftShoulder, rightShoulder, leftHip, rightHip)
        : 0,
    ),
    shoulder_line_tilt: makeAngle(
      "shoulder_line_tilt",
      shoulderLineTiltDeg,
      isUsable(leftShoulder) && isUsable(rightShoulder)
        ? avgConfidence(leftShoulder, rightShoulder)
        : 0,
    ),
    hip_line_tilt: makeAngle(
      "hip_line_tilt",
      hipLineTiltDeg,
      isUsable(leftHip) && isUsable(rightHip)
        ? avgConfidence(leftHip, rightHip)
        : 0,
    ),
  };
}

export function calculateSegments(
  pose: PoseFrame,
): Record<SegmentName, SegmentMeasurement> {
  const kp = pose.keypoints;

  const segment = (
    name: SegmentName,
    a: NormalizedPoseKeypoint,
    b: NormalizedPoseKeypoint,
  ): SegmentMeasurement =>
    makeSegment(
      name,
      isUsable(a) && isUsable(b) ? segmentLength(a, b) : null,
      isUsable(a) && isUsable(b) ? avgConfidence(a, b) : 0,
    );

  return {
    left_upper_arm: segment("left_upper_arm", kp.left_shoulder, kp.left_elbow),
    right_upper_arm: segment("right_upper_arm", kp.right_shoulder, kp.right_elbow),
    left_forearm: segment("left_forearm", kp.left_elbow, kp.left_wrist),
    right_forearm: segment("right_forearm", kp.right_elbow, kp.right_wrist),
    left_torso_side: segment("left_torso_side", kp.left_shoulder, kp.left_hip),
    right_torso_side: segment("right_torso_side", kp.right_shoulder, kp.right_hip),
    shoulder_line: segment("shoulder_line", kp.left_shoulder, kp.right_shoulder),
    hip_line: segment("hip_line", kp.left_hip, kp.right_hip),
  };
}
