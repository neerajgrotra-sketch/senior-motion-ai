import type { ExerciseFrameFeatures } from '../poseTypes';

const POSITION_ALPHA_HIGH_CONF = 0.35;
const POSITION_ALPHA_LOW_CONF = 0.15;
const TORSO_ALPHA = 0.2;
const MIN_CONFIDENCE = 0.35;

// Right-hand hysteresis
const RIGHT_ENTER_TOP_LIFT_NORM = 0.08;
const RIGHT_EXIT_TOP_LIFT_NORM = 0.04;
const RIGHT_ENTER_DOWN_MARGIN_NORM = 0.03;
const RIGHT_EXIT_DOWN_MARGIN_NORM = 0.01;

// Left-hand hysteresis
const LEFT_ENTER_TOP_LIFT_NORM = 0.08;
const LEFT_EXIT_TOP_LIFT_NORM = 0.04;
const LEFT_ENTER_DOWN_MARGIN_NORM = 0.03;
const LEFT_EXIT_DOWN_MARGIN_NORM = 0.01;

// Both-hands hysteresis
const BOTH_ENTER_TOP_LIFT_NORM = 0.08;
const BOTH_EXIT_TOP_LIFT_NORM = 0.04;
const BOTH_ENTER_DOWN_MARGIN_NORM = 0.03;
const BOTH_EXIT_DOWN_MARGIN_NORM = 0.01;

export function stabilizeFeatures(
  current: ExerciseFrameFeatures,
  previous: ExerciseFrameFeatures | null
): ExerciseFrameFeatures {
  if (!previous) {
    return recomputeDerivedFlags(current, null);
  }

  const rightWristAlpha =
    current.rightWristScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;
  const rightShoulderAlpha =
    current.rightShoulderScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;
  const rightElbowAlpha =
    current.rightElbowScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;

  const leftWristAlpha =
    current.leftWristScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;
  const leftShoulderAlpha =
    current.leftShoulderScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;
  const leftElbowAlpha =
    current.leftElbowScore >= 0.7 ? POSITION_ALPHA_HIGH_CONF : POSITION_ALPHA_LOW_CONF;

  const smoothed: ExerciseFrameFeatures = {
    ...current,
    rightWristY: lerp(previous.rightWristY, current.rightWristY, rightWristAlpha),
    rightShoulderY: lerp(previous.rightShoulderY, current.rightShoulderY, rightShoulderAlpha),
    rightElbowY: lerp(previous.rightElbowY, current.rightElbowY, rightElbowAlpha),

    leftWristY: lerp(previous.leftWristY, current.leftWristY, leftWristAlpha),
    leftShoulderY: lerp(previous.leftShoulderY, current.leftShoulderY, leftShoulderAlpha),
    leftElbowY: lerp(previous.leftElbowY, current.leftElbowY, leftElbowAlpha),

    torsoLeanDeg: lerp(previous.torsoLeanDeg, current.torsoLeanDeg, TORSO_ALPHA),
    torsoLength: lerp(previous.torsoLength, current.torsoLength, 0.25),
    confidence: lerp(previous.confidence, current.confidence, 0.25),

    rightWristScore: current.rightWristScore,
    rightShoulderScore: current.rightShoulderScore,
    rightElbowScore: current.rightElbowScore,

    leftWristScore: current.leftWristScore,
    leftShoulderScore: current.leftShoulderScore,
    leftElbowScore: current.leftElbowScore,

    timestamp: current.timestamp,

    posture: current.posture,
    leftKneeAngle: current.leftKneeAngle,
    rightKneeAngle: current.rightKneeAngle,
    avgKneeAngle: current.avgKneeAngle,
    hipToKneeNorm: current.hipToKneeNorm,
    kneeToAnkleNorm: current.kneeToAnkleNorm,
    bodySpanNorm: current.bodySpanNorm,

    rightHandAboveShoulder: current.rightHandAboveShoulder,
    rightHandClearlyDown: current.rightHandClearlyDown,
    rightHandLiftNorm: current.rightHandLiftNorm,

    leftHandAboveShoulder: current.leftHandAboveShoulder,
    leftHandClearlyDown: current.leftHandClearlyDown,
    leftHandLiftNorm: current.leftHandLiftNorm,

    bothHandsAboveShoulder: current.bothHandsAboveShoulder,
    bothHandsClearlyDown: current.bothHandsClearlyDown,
    bothHandsLiftNorm: current.bothHandsLiftNorm,

    postureStable: current.postureStable
  };

  return recomputeDerivedFlags(smoothed, previous);
}

function recomputeDerivedFlags(
  features: ExerciseFrameFeatures,
  previous: ExerciseFrameFeatures | null
): ExerciseFrameFeatures {
  const rightLiftNorm =
    (features.rightShoulderY - features.rightWristY) / Math.max(1, features.torsoLength);
  const leftLiftNorm =
    (features.leftShoulderY - features.leftWristY) / Math.max(1, features.torsoLength);

  const prevRightAbove = previous?.rightHandAboveShoulder ?? false;
  const prevRightDown = previous?.rightHandClearlyDown ?? true;

  const prevLeftAbove = previous?.leftHandAboveShoulder ?? false;
  const prevLeftDown = previous?.leftHandClearlyDown ?? true;

  let rightHandAboveShoulder: boolean;
  if (prevRightAbove) {
    rightHandAboveShoulder = rightLiftNorm > RIGHT_EXIT_TOP_LIFT_NORM;
  } else {
    rightHandAboveShoulder = rightLiftNorm > RIGHT_ENTER_TOP_LIFT_NORM;
  }

  let leftHandAboveShoulder: boolean;
  if (prevLeftAbove) {
    leftHandAboveShoulder = leftLiftNorm > LEFT_EXIT_TOP_LIFT_NORM;
  } else {
    leftHandAboveShoulder = leftLiftNorm > LEFT_ENTER_TOP_LIFT_NORM;
  }

  const rightDownMarginNorm =
    (features.rightWristY - features.rightElbowY) / Math.max(1, features.torsoLength);
  const leftDownMarginNorm =
    (features.leftWristY - features.leftElbowY) / Math.max(1, features.torsoLength);

  let rightHandClearlyDown: boolean;
  if (prevRightDown) {
    rightHandClearlyDown = rightDownMarginNorm > RIGHT_EXIT_DOWN_MARGIN_NORM;
  } else {
    rightHandClearlyDown = rightDownMarginNorm > RIGHT_ENTER_DOWN_MARGIN_NORM;
  }

  let leftHandClearlyDown: boolean;
  if (prevLeftDown) {
    leftHandClearlyDown = leftDownMarginNorm > LEFT_EXIT_DOWN_MARGIN_NORM;
  } else {
    leftHandClearlyDown = leftDownMarginNorm > LEFT_ENTER_DOWN_MARGIN_NORM;
  }

  const bothLiftNorm = Math.min(leftLiftNorm, rightLiftNorm);
  const bothDownMarginNorm = Math.min(leftDownMarginNorm, rightDownMarginNorm);

  const prevBothAbove = previous?.bothHandsAboveShoulder ?? false;
  const prevBothDown = previous?.bothHandsClearlyDown ?? true;

  let bothHandsAboveShoulder: boolean;
  if (prevBothAbove) {
    bothHandsAboveShoulder =
      bothLiftNorm > BOTH_EXIT_TOP_LIFT_NORM &&
      leftHandAboveShoulder &&
      rightHandAboveShoulder;
  } else {
    bothHandsAboveShoulder =
      bothLiftNorm > BOTH_ENTER_TOP_LIFT_NORM &&
      leftHandAboveShoulder &&
      rightHandAboveShoulder;
  }

  let bothHandsClearlyDown: boolean;
  if (prevBothDown) {
    bothHandsClearlyDown =
      bothDownMarginNorm > BOTH_EXIT_DOWN_MARGIN_NORM &&
      leftHandClearlyDown &&
      rightHandClearlyDown;
  } else {
    bothHandsClearlyDown =
      bothDownMarginNorm > BOTH_ENTER_DOWN_MARGIN_NORM &&
      leftHandClearlyDown &&
      rightHandClearlyDown;
  }

  const postureStable =
    Math.abs(features.torsoLeanDeg) < 15 &&
    features.rightWristScore >= MIN_CONFIDENCE &&
    features.rightShoulderScore >= MIN_CONFIDENCE &&
    features.rightElbowScore >= MIN_CONFIDENCE &&
    features.leftWristScore >= MIN_CONFIDENCE &&
    features.leftShoulderScore >= MIN_CONFIDENCE &&
    features.leftElbowScore >= MIN_CONFIDENCE;

  return {
    ...features,
    rightHandLiftNorm: rightLiftNorm,
    rightHandAboveShoulder,
    rightHandClearlyDown,

    leftHandLiftNorm: leftLiftNorm,
    leftHandAboveShoulder,
    leftHandClearlyDown,

    bothHandsLiftNorm: bothLiftNorm,
    bothHandsAboveShoulder,
    bothHandsClearlyDown,

    postureStable
  };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + alpha * (b - a);
}
