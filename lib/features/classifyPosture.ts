import type { PosePoint } from '../poseTypes';
import { distance, midpoint } from '../poseUtils';

export type PostureState = 'standing' | 'sitting' | 'unknown';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function angleAtJoint(a: PosePoint, b: PosePoint, c: PosePoint): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);

  if (magAB === 0 || magCB === 0) return 180;

  const cosTheta = clamp(dot / (magAB * magCB), -1, 1);
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

export function computeLegAngles(
  leftHip: PosePoint,
  leftKnee: PosePoint,
  leftAnkle: PosePoint,
  rightHip: PosePoint,
  rightKnee: PosePoint,
  rightAnkle: PosePoint
) {
  const leftKneeAngle = angleAtJoint(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = angleAtJoint(rightHip, rightKnee, rightAnkle);
  return { leftKneeAngle, rightKneeAngle };
}

export function classifyPosture(input: {
  leftShoulder: PosePoint;
  rightShoulder: PosePoint;
  leftHip: PosePoint;
  rightHip: PosePoint;
  leftKnee: PosePoint;
  rightKnee: PosePoint;
  leftAnkle: PosePoint;
  rightAnkle: PosePoint;
}) {
  const {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle
  } = input;

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const kneeCenter = midpoint(leftKnee, rightKnee);
  const ankleCenter = midpoint(leftAnkle, rightAnkle);

  const torsoLength = Math.max(1, distance(shoulderCenter, hipCenter));
  const hipToKneeNorm = (kneeCenter.y - hipCenter.y) / torsoLength;
  const kneeToAnkleNorm = (ankleCenter.y - kneeCenter.y) / torsoLength;
  const bodySpanNorm = (ankleCenter.y - shoulderCenter.y) / torsoLength;

  const { leftKneeAngle, rightKneeAngle } = computeLegAngles(
    leftHip,
    leftKnee,
    leftAnkle,
    rightHip,
    rightKnee,
    rightAnkle
  );

  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  const confidenceMin = Math.min(
    leftShoulder.score,
    rightShoulder.score,
    leftHip.score,
    rightHip.score,
    leftKnee.score,
    rightKnee.score,
    leftAnkle.score,
    rightAnkle.score
  );

  if (confidenceMin < 0.25) {
    return {
      posture: 'unknown' as PostureState,
      leftKneeAngle,
      rightKneeAngle,
      avgKneeAngle,
      hipToKneeNorm,
      kneeToAnkleNorm,
      bodySpanNorm
    };
  }

  const looksStanding =
    avgKneeAngle > 145 &&
    hipToKneeNorm > 0.32 &&
    kneeToAnkleNorm > 0.28 &&
    bodySpanNorm > 2.1;

  const looksSitting =
    avgKneeAngle < 135 &&
    hipToKneeNorm < 0.4 &&
    bodySpanNorm < 2.2;

  let posture: PostureState = 'unknown';
  if (looksStanding) posture = 'standing';
  else if (looksSitting) posture = 'sitting';

  return {
    posture,
    leftKneeAngle,
    rightKneeAngle,
    avgKneeAngle,
    hipToKneeNorm,
    kneeToAnkleNorm,
    bodySpanNorm
  };
}
