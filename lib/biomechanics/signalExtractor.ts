import type { PoseTrack } from '../poseTypes';
import { distance, getPoint, midpoint } from '../poseUtils';
import { classifyPosture } from '../features/classifyPosture';
import { angleAtJoint, lineAngleDeg, safeNorm } from './math';
import type { BiomechanicsSignals } from './types';

type PreviousFrameState = {
  timestamp: number;
  leftWristY: number;
  rightWristY: number;
  leftKneeY: number;
  rightKneeY: number;
};

type RuntimeTiming = {
  repStartedAt: number | null;
  phaseStartedAt: number;
  holdStartedAt: number | null;
};

export function extractBiomechanicsSignals(params: {
  track: PoseTrack;
  timestamp: number;
  previousFrame: PreviousFrameState | null;
  runtime: RuntimeTiming;
}): { signals: BiomechanicsSignals; nextPreviousFrame: PreviousFrameState } {
  const { track, timestamp, previousFrame, runtime } = params;

  const leftShoulder = getPoint(track.keypoints, 'left_shoulder');
  const rightShoulder = getPoint(track.keypoints, 'right_shoulder');
  const leftHip = getPoint(track.keypoints, 'left_hip');
  const rightHip = getPoint(track.keypoints, 'right_hip');
  const leftElbow = getPoint(track.keypoints, 'left_elbow');
  const rightElbow = getPoint(track.keypoints, 'right_elbow');
  const leftWrist = getPoint(track.keypoints, 'left_wrist');
  const rightWrist = getPoint(track.keypoints, 'right_wrist');
  const leftKnee = getPoint(track.keypoints, 'left_knee');
  const rightKnee = getPoint(track.keypoints, 'right_knee');
  const leftAnkle = getPoint(track.keypoints, 'left_ankle');
  const rightAnkle = getPoint(track.keypoints, 'right_ankle');

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);

  const torsoLength = Math.max(1, distance(shoulderCenter, hipCenter));
  const torsoLeanDeg = lineAngleDeg(hipCenter, shoulderCenter) - 90;
  const shoulderTiltDeg = lineAngleDeg(leftShoulder, rightShoulder);
  const hipTiltDeg = lineAngleDeg(leftHip, rightHip);

  const postureInfo = classifyPosture({
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle
  });

  const rightHandLiftNorm = safeNorm(rightShoulder.y - rightWrist.y, torsoLength);
  const leftHandLiftNorm = safeNorm(leftShoulder.y - leftWrist.y, torsoLength);
  const bothHandsLiftNorm = Math.min(leftHandLiftNorm, rightHandLiftNorm);

  const rightKneeLiftNorm = safeNorm(rightHip.y - rightKnee.y, torsoLength);
  const leftKneeLiftNorm = safeNorm(leftHip.y - leftKnee.y, torsoLength);

  const dtMs = previousFrame ? Math.max(1, timestamp - previousFrame.timestamp) : 1;

  const rightHandVelocityY = previousFrame
    ? (previousFrame.rightWristY - rightWrist.y) / dtMs
    : 0;

  const leftHandVelocityY = previousFrame
    ? (previousFrame.leftWristY - leftWrist.y) / dtMs
    : 0;

  const rightKneeVelocityY = previousFrame
    ? (previousFrame.rightKneeY - rightKnee.y) / dtMs
    : 0;

  const leftKneeVelocityY = previousFrame
    ? (previousFrame.leftKneeY - leftKnee.y) / dtMs
    : 0;

  const movementSpeedNorm =
    (Math.abs(rightHandVelocityY) +
      Math.abs(leftHandVelocityY) +
      Math.abs(rightKneeVelocityY) +
      Math.abs(leftKneeVelocityY)) /
    4;

  const leftElbowAngleDeg = angleAtJoint(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngleDeg = angleAtJoint(rightShoulder, rightElbow, rightWrist);
  const leftKneeAngleDeg = angleAtJoint(leftHip, leftKnee, leftAnkle);
  const rightKneeAngleDeg = angleAtJoint(rightHip, rightKnee, rightAnkle);

  const postureStable = Math.abs(torsoLeanDeg) < 15;

  const signals: BiomechanicsSignals = {
    timestamp,
    posture: postureInfo.posture,
    postureStable,
    confidence: track.confidence,

    torsoLength,
    torsoLeanDeg,
    shoulderTiltDeg,
    hipTiltDeg,

    leftElbowAngleDeg,
    rightElbowAngleDeg,
    leftKneeAngleDeg,
    rightKneeAngleDeg,

    leftHandLiftNorm,
    rightHandLiftNorm,
    bothHandsLiftNorm,

    leftKneeLiftNorm,
    rightKneeLiftNorm,

    leftHandVelocityY,
    rightHandVelocityY,
    leftKneeVelocityY,
    rightKneeVelocityY,

    movementSpeedNorm,

    timeSinceRepStartMs: runtime.repStartedAt == null ? 0 : timestamp - runtime.repStartedAt,
    timeSincePhaseStartMs: Math.max(0, timestamp - runtime.phaseStartedAt),
    holdDurationMs: runtime.holdStartedAt == null ? 0 : timestamp - runtime.holdStartedAt,

    leftHandAboveShoulder: leftWrist.y < leftShoulder.y - torsoLength * 0.03,
    rightHandAboveShoulder: rightWrist.y < rightShoulder.y - torsoLength * 0.03,
    bothHandsAboveShoulder:
      leftWrist.y < leftShoulder.y - torsoLength * 0.03 &&
      rightWrist.y < rightShoulder.y - torsoLength * 0.03,

    leftHandClearlyDown: leftWrist.y > leftElbow.y + torsoLength * 0.03,
    rightHandClearlyDown: rightWrist.y > rightElbow.y + torsoLength * 0.03,
    bothHandsClearlyDown:
      leftWrist.y > leftElbow.y + torsoLength * 0.03 &&
      rightWrist.y > rightElbow.y + torsoLength * 0.03
  };

  return {
    signals,
    nextPreviousFrame: {
      timestamp,
      leftWristY: leftWrist.y,
      rightWristY: rightWrist.y,
      leftKneeY: leftKnee.y,
      rightKneeY: rightKnee.y
    }
  };
}
