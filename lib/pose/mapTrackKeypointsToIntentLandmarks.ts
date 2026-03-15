import type { PoseLandmarks, LandmarkName } from "../exercises/exerciseIntentTypes";
import type { NormalizedPoseKeypoint, PoseLandmarkName } from "./poseTypes";

type TrackKeypointLike = {
  x: number;
  y: number;
  z?: number;
  score?: number;
  visibility?: number;
};

type TrackKeypointMap = Partial<Record<PoseLandmarkName, TrackKeypointLike>>;

const ALL_LANDMARK_NAMES: PoseLandmarkName[] = [
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

function buildMissingKeypoint(name: PoseLandmarkName): NormalizedPoseKeypoint {
  return {
    name,
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
    present: false,
  };
}

function buildMappedKeypoint(
  name: PoseLandmarkName,
  keypoint?: TrackKeypointLike,
): NormalizedPoseKeypoint {
  if (!keypoint) {
    return buildMissingKeypoint(name);
  }

  return {
    name,
    x: keypoint.x,
    y: keypoint.y,
    z: keypoint.z ?? 0,
    visibility: keypoint.visibility ?? keypoint.score ?? 0,
    present: true,
  };
}

export function mapTrackKeypointsToIntentLandmarks(
  keypoints: TrackKeypointMap,
): PoseLandmarks {
  const result = {} as PoseLandmarks;

  for (const name of ALL_LANDMARK_NAMES) {
    result[name] = buildMappedKeypoint(name, keypoints[name]);
  }

  return result;
}

/**
 * Optional alias for older callers that pass a looser record shape.
 */
export function mapTrackKeypointsToLandmarks(
  keypoints: Partial<Record<LandmarkName, TrackKeypointLike>>,
): PoseLandmarks {
  return mapTrackKeypointsToIntentLandmarks(
    keypoints as Partial<Record<PoseLandmarkName, TrackKeypointLike>>,
  );
}
