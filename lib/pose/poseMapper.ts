// lib/pose/poseMapper.ts

import { PoseLandmarkName } from "./poseTypes";

export const REQUIRED_UPPER_BODY_LANDMARKS: PoseLandmarkName[] = [
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
];

export const REQUIRED_LOWER_BODY_LANDMARKS: PoseLandmarkName[] = [
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

export const ALL_BLAZEPOSE_LANDMARKS: PoseLandmarkName[] = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
];
