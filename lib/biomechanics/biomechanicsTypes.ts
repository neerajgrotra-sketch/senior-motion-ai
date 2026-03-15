// lib/biomechanics/biomechanicsTypes.ts

import { PoseFrame, PoseSide } from "../pose/poseTypes";

export type JointAngleName =
  | "left_elbow"
  | "right_elbow"
  | "left_shoulder"
  | "right_shoulder"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "torso_incline"
  | "shoulder_line_tilt"
  | "hip_line_tilt";

export type SegmentName =
  | "left_upper_arm"
  | "right_upper_arm"
  | "left_forearm"
  | "right_forearm"
  | "left_torso_side"
  | "right_torso_side"
  | "shoulder_line"
  | "hip_line";

export interface AngleMeasurement {
  name: JointAngleName;
  degrees: number | null;
  confidence: number; // 0..1
}

export interface SegmentMeasurement {
  name: SegmentName;
  length: number | null;
  confidence: number; // 0..1
}

export interface ArmMetrics {
  side: PoseSide;
  shoulderFlexionDeg: number | null;
  elbowFlexionDeg: number | null;
  wristAboveShoulder: boolean;
  wristAboveElbow: boolean;
  verticalLiftNormalized: number | null; // 0..1
  horizontalAbductionNormalized: number | null; // 0..1
  movementVelocity: number | null;
}

export interface TorsoMetrics {
  trunkLeanDeg: number | null;
  shoulderTiltDeg: number | null;
  hipTiltDeg: number | null;
  uprightConfidence: number;
}

export interface SymmetryMetrics {
  shoulderHeightDifference: number | null;
  wristHeightDifference: number | null;
  leftRightArmLiftDifference: number | null;
}

export interface BiomechanicsFrame {
  timestampMs: number;
  pose: PoseFrame;
  angles: Record<JointAngleName, AngleMeasurement>;
  segments: Record<SegmentName, SegmentMeasurement>;
  arms: {
    left: ArmMetrics;
    right: ArmMetrics;
  };
  torso: TorsoMetrics;
  symmetry: SymmetryMetrics;
}
