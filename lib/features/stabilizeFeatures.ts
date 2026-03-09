import type { ExerciseFrameFeatures } from '../poseTypes';

const POSITION_ALPHA_HIGH_CONF = 0.35;
const POSITION_ALPHA_LOW_CONF = 0.15;
const TORSO_ALPHA = 0.2;

const MIN_CONFIDENCE = 0.35;

// Hysteresis thresholds for normalized hand lift
// liftNorm = (shoulderY - wristY) / torsoLength
const ENTER_TOP_LIFT_NORM = 0.08;
const EXIT_TOP_LIFT_NORM = 0.04;

const ENTER_DOWN_MARGIN_NORM = 0.03;
const EXIT_DOWN_MARGIN_NORM = 0.01;

export function stabilizeFeatures(
  current: ExerciseFrameFeatures,
  previous: ExerciseFrameFeatures | null
): ExerciseFrameFeatures {
  if (!previous) {
    return recomputeDerivedFlags(current, null);
  }

  const wristAlpha =
    current.rightWristScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;

  const shoulderAlpha =
    current.rightShoulderScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;

  const elbowAlpha =
    current.rightElbowScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;

  const smoothed: ExerciseFrameFeatures = {
    ...current,
    rightWristY: lerp(previous.rightWristY, current.rightWristY, wristAlpha),
    rightShoulderY: lerp(previous.rightShoulderY, current.rightShoulderY, shoulderAlpha),
    rightElbowY: lerp(previous.rightElbowY, current.rightElbowY, elbowAlpha),
    torsoLeanDeg: lerp(previous.torsoLeanDeg, current.torsoLeanDeg, TORSO_ALPHA),
    torsoLength: lerp(previous.torsoLength, current.torsoLength, 0.25),
    confidence: lerp(previous.confidence, current.confidence, 0.25),
    rightWristScore: current.rightWristScore,
    rightShoulderScore: current.rightShoulderScore,
    rightElbowScore: current.rightElbowScore,
    timestamp: current.timestamp,
    rightHandAboveShoulder: current.rightHandAboveShoulder,
    rightHandClearlyDown: current.rightHandClearlyDown,
    rightHandLiftNorm: current.rightHandLiftNorm,
    postureStable: current.postureStable
  };

  return recomputeDerivedFlags(smoothed, previous);
}

function recomputeDerivedFlags(
  features: ExerciseFrameFeatures,
  previous: ExerciseFrameFeatures | null
): ExerciseFrameFeatures {
  const liftNorm =
    (features.rightShoulderY - features.rightWristY) / Math.max(1, features.torsoLength);

  const prevAbove = previous?.rightHandAboveShoulder ?? false;
  const prevDown = previous?.rightHandClearlyDown ?? true;

  let rightHandAboveShoulder: boolean;
  if (prevAbove) {
    rightHandAboveShoulder = liftNorm > EXIT_TOP_LIFT_NORM;
  } else {
    rightHandAboveShoulder = liftNorm > ENTER_TOP_LIFT_NORM;
  }

  // positive value means wrist is below elbow by that normalized margin
  const downMarginNorm =
    (features.rightWristY - features.rightElbowY) / Math.max(1, features.torsoLength);

  let rightHandClearlyDown: boolean;
  if (prevDown) {
    rightHandClearlyDown = downMarginNorm > EXIT_DOWN_MARGIN_NORM;
  } else {
    rightHandClearlyDown = downMarginNorm > ENTER_DOWN_MARGIN_NORM;
  }

  const postureStable =
    Math.abs(features.torsoLeanDeg) < 15 &&
    features.rightWristScore >= MIN_CONFIDENCE &&
    features.rightShoulderScore >= MIN_CONFIDENCE &&
    features.rightElbowScore >= MIN_CONFIDENCE;

  return {
    ...features,
    rightHandLiftNorm: liftNorm,
    rightHandAboveShoulder,
    rightHandClearlyDown,
    postureStable
  };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + alpha * (b - a);
}
