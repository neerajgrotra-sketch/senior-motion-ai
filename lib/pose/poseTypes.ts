// lib/pose/poseTypes.ts

export type PoseLandmarkName =
  | "nose"
  | "left_eye_inner"
  | "left_eye"
  | "left_eye_outer"
  | "right_eye_inner"
  | "right_eye"
  | "right_eye_outer"
  | "left_ear"
  | "right_ear"
  | "mouth_left"
  | "mouth_right"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_pinky"
  | "right_pinky"
  | "left_index"
  | "right_index"
  | "left_thumb"
  | "right_thumb"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"
  | "left_heel"
  | "right_heel"
  | "left_foot_index"
  | "right_foot_index";

export type PoseSide = "left" | "right" | "center";
export type BodyOrientation = "front" | "left_profile" | "right_profile" | "unknown";
export type PostureType = "standing" | "sitting" | "unknown";

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface BoundingBox {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
}

export interface RawPoseKeypoint {
  name: PoseLandmarkName;
  x: number;
  y: number;
  z?: number;
  score?: number;
}

export interface RawPoseFrame {
  timestampMs: number;
  frameWidth: number;
  frameHeight: number;
  keypoints: RawPoseKeypoint[];
  source: "blazepose" | "mediapipe" | "unknown";
}

export interface NormalizedPoseKeypoint {
  name: PoseLandmarkName;
  x: number; // normalized 0..1 in image space
  y: number; // normalized 0..1 in image space
  z: number; // normalized depth estimate
  visibility: number; // 0..1
  present: boolean;
}

export interface JointVisibilitySummary {
  visibleCount: number;
  requiredVisibleCount: number;
  visibilityScore: number;
  isBodySufficientlyVisible: boolean;
}

export interface PoseCenterOfMassEstimate {
  x: number;
  y: number;
}

export interface PoseFrame {
  timestampMs: number;
  frameWidth: number;
  frameHeight: number;
  keypoints: Record<PoseLandmarkName, NormalizedPoseKeypoint>;
  bbox: BoundingBox | null;
  center: PoseCenterOfMassEstimate | null;
  orientation: BodyOrientation;
  posture: PostureType;
  visibility: JointVisibilitySummary;
  trackingStable: boolean;
}
