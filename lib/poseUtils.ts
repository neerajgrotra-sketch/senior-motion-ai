import type { Keypoint } from '@tensorflow-models/pose-detection';
import type { SmoothedPose, SimplePoint } from './poseTypes';

const REQUIRED_NAMES = [
  'nose',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle'
];

export const SKELETON_EDGES: Array<[string, string]> = [
  ['nose', 'left_shoulder'],
  ['nose', 'right_shoulder'],
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

export function keypointsToMap(keypoints: Keypoint[]): Record<string, SimplePoint> {
  const map: Record<string, SimplePoint> = {};
  for (const kp of keypoints) {
    if (!kp.name || kp.x == null || kp.y == null) continue;
    map[kp.name] = {
      x: kp.x,
      y: kp.y,
      score: kp.score ?? 0
    };
  }
  return map;
}

export function computeBoundingBox(points: Record<string, SimplePoint>, minScore = 0.2) {
  const visible = Object.values(points).filter((p) => p.score >= minScore);
  if (!visible.length) return null;

  const xs = visible.map((p) => p.x);
  const ys = visible.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const padding = 24;

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };
}

export function visibleKeypointCount(points: Record<string, SimplePoint>, minScore = 0.3) {
  return Object.values(points).filter((p) => p.score >= minScore).length;
}

export function averageConfidence(points: Record<string, SimplePoint>) {
  const vals = REQUIRED_NAMES.filter((name) => points[name]).map((name) => points[name].score);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function smoothPose(current: SmoothedPose, previous: SmoothedPose | null, alpha = 0.35): SmoothedPose {
  if (!previous) return current;

  const keypoints: Record<string, SimplePoint> = {};
  const names = new Set([...Object.keys(current.keypoints), ...Object.keys(previous.keypoints)]);

  for (const name of names) {
    const c = current.keypoints[name];
    const p = previous.keypoints[name];
    if (c && p) {
      keypoints[name] = {
        x: p.x * (1 - alpha) + c.x * alpha,
        y: p.y * (1 - alpha) + c.y * alpha,
        score: p.score * (1 - alpha) + c.score * alpha
      };
    } else if (c) {
      keypoints[name] = c;
    } else if (p) {
      keypoints[name] = p;
    }
  }

  const bbox = {
    x: previous.bbox.x * (1 - alpha) + current.bbox.x * alpha,
    y: previous.bbox.y * (1 - alpha) + current.bbox.y * alpha,
    width: previous.bbox.width * (1 - alpha) + current.bbox.width * alpha,
    height: previous.bbox.height * (1 - alpha) + current.bbox.height * alpha
  };

  const center = {
    x: previous.center.x * (1 - alpha) + current.center.x * alpha,
    y: previous.center.y * (1 - alpha) + current.center.y * alpha
  };

  return {
    id: current.id,
    confidence: previous.confidence * (1 - alpha) + current.confidence * alpha,
    bbox,
    center,
    keypoints
  };
}

export function buildPoseTrack(id: number, points: Record<string, SimplePoint>): SmoothedPose | null {
  const bbox = computeBoundingBox(points);
  if (!bbox) return null;
  const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  return {
    id,
    confidence: averageConfidence(points),
    bbox,
    center,
    keypoints: points
  };
}
