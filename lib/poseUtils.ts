import type { PoseKeypointMap, PosePoint, PoseTrack } from './poseTypes';

const FALLBACK_KEYPOINT_NAMES = [
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
];

export const SKELETON_EDGES: Array<[string, string]> = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle']
];

type RawKeypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
};

export function keypointsToMap(keypoints: RawKeypoint[]): PoseKeypointMap {
  const map: PoseKeypointMap = {};

  keypoints.forEach((kp, index) => {
    const fallbackName = FALLBACK_KEYPOINT_NAMES[index] ?? `kp_${index}`;
    const name = (kp.name ?? fallbackName).toLowerCase().replace(/\s+/g, '_');

    map[name] = {
      x: kp.x,
      y: kp.y,
      score: kp.score ?? 0
    };
  });

  return map;
}

export function visibleKeypointCount(keypoints: PoseKeypointMap, minScore = 0.25): number {
  return Object.values(keypoints).filter((kp) => kp.score >= minScore).length;
}

export function buildPoseTrack(id: number, keypoints: PoseKeypointMap): PoseTrack | null {
  const visible = Object.values(keypoints).filter((kp) => kp.score >= 0.2);
  if (visible.length < 6) return null;

  const xs = visible.map((kp) => kp.x);
  const ys = visible.map((kp) => kp.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const confidence =
    visible.reduce((sum, kp) => sum + kp.score, 0) / Math.max(1, visible.length);

  return {
    id,
    bbox: {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    },
    confidence,
    keypoints
  };
}

export function smoothPose(
  current: PoseTrack,
  previous: PoseTrack | null,
  alpha = 0.35
): PoseTrack {
  if (!previous) return current;

  const smoothedKeypoints: PoseKeypointMap = {};

  const keys = new Set([
    ...Object.keys(current.keypoints),
    ...Object.keys(previous.keypoints)
  ]);

  for (const key of keys) {
    const curr = current.keypoints[key];
    const prev = previous.keypoints[key];

    if (!curr && prev) {
      smoothedKeypoints[key] = prev;
      continue;
    }

    if (curr && !prev) {
      smoothedKeypoints[key] = curr;
      continue;
    }

    if (!curr || !prev) continue;

    smoothedKeypoints[key] = {
      x: prev.x + alpha * (curr.x - prev.x),
      y: prev.y + alpha * (curr.y - prev.y),
      score: curr.score
    };
  }

  return {
    ...current,
    bbox: {
      x: previous.bbox.x + alpha * (current.bbox.x - previous.bbox.x),
      y: previous.bbox.y + alpha * (current.bbox.y - previous.bbox.y),
      width: previous.bbox.width + alpha * (current.bbox.width - previous.bbox.width),
      height: previous.bbox.height + alpha * (current.bbox.height - previous.bbox.height)
    },
    confidence: previous.confidence + alpha * (current.confidence - previous.confidence),
    keypoints: smoothedKeypoints
  };
}

export function getPoint(
  keypoints: PoseKeypointMap,
  name: string,
  fallback?: PosePoint
): PosePoint {
  return keypoints[name] ?? fallback ?? { x: 0, y: 0, score: 0 };
}

export function midpoint(a: PosePoint, b: PosePoint): PosePoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    score: Math.min(a.score, b.score)
  };
}

export function distance(a: PosePoint, b: PosePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleDeg(a: PosePoint, b: PosePoint): number {
  return (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI;
}
