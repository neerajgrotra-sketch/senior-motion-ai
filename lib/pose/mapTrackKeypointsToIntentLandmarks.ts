import type { PoseLandmarks } from '../exercises/exerciseIntentTypes';

type TrackKeypoint = {
  x: number;
  y: number;
  z?: number;
  score: number;
  name?: string;
};

type TrackKeypointMap = Record<string, TrackKeypoint>;

const ALLOWED_NAMES = new Set([
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle'
]);

export function mapTrackKeypointsToIntentLandmarks(
  keypoints: TrackKeypointMap
): PoseLandmarks {
  const result: PoseLandmarks = {};

  for (const [name, kp] of Object.entries(keypoints)) {
    if (!ALLOWED_NAMES.has(name)) continue;
    if (!kp) continue;

    result[name as keyof PoseLandmarks] = {
      x: kp.x,
      y: kp.y,
      z: kp.z,
      score: kp.score
    };
  }

  return result;
}
