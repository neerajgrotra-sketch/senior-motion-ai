import type { ExerciseFrameFeatures, PoseTrack } from '../poseTypes';
import { angleDeg, distance, getPoint, midpoint } from '../poseUtils';

export function extractFeatures(track: PoseTrack, timestamp: number): ExerciseFrameFeatures {
  const leftShoulder = getPoint(track.keypoints, 'left_shoulder');
  const rightShoulder = getPoint(track.keypoints, 'right_shoulder');
  const leftHip = getPoint(track.keypoints, 'left_hip');
  const rightHip = getPoint(track.keypoints, 'right_hip');

  const leftWrist = getPoint(track.keypoints, 'left_wrist');
  const leftElbow = getPoint(track.keypoints, 'left_elbow');

  const rightWrist = getPoint(track.keypoints, 'right_wrist');
  const rightElbow = getPoint(track.keypoints, 'right_elbow');

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);

  const torsoLength = Math.max(1, distance(shoulderCenter, hipCenter));
  const torsoLeanDeg = angleDeg(hipCenter, shoulderCenter) - 90;

  const rightHandLiftNorm = (rightShoulder.y - rightWrist.y) / torsoLength;
  const rightHandAboveShoulder = rightWrist.y < rightShoulder.y - torsoLength * 0.03;
  const rightHandClearlyDown = rightWrist.y > rightElbow.y + torsoLength * 0.03;

  const leftHandLiftNorm = (leftShoulder.y - leftWrist.y) / torsoLength;
  const leftHandAboveShoulder = leftWrist.y < leftShoulder.y - torsoLength * 0.03;
  const leftHandClearlyDown = leftWrist.y > leftElbow.y + torsoLength * 0.03;

  const bothHandsLiftNorm = Math.min(leftHandLiftNorm, rightHandLiftNorm);
  const bothHandsAboveShoulder = leftHandAboveShoulder && rightHandAboveShoulder;
  const bothHandsClearlyDown = leftHandClearlyDown && rightHandClearlyDown;

  const postureStable = Math.abs(torsoLeanDeg) < 15;

  return {
    timestamp,
    confidence: track.confidence,
    torsoLength,
    torsoLeanDeg,

    rightWristY: rightWrist.y,
    rightShoulderY: rightShoulder.y,
    rightElbowY: rightElbow.y,
    rightWristScore: rightWrist.score,
    rightShoulderScore: rightShoulder.score,
    rightElbowScore: rightElbow.score,
    rightHandAboveShoulder,
    rightHandClearlyDown,
    rightHandLiftNorm,

    leftWristY: leftWrist.y,
    leftShoulderY: leftShoulder.y,
    leftElbowY: leftElbow.y,
    leftWristScore: leftWrist.score,
    leftShoulderScore: leftShoulder.score,
    leftElbowScore: leftElbow.score,
    leftHandAboveShoulder,
    leftHandClearlyDown,
    leftHandLiftNorm,

    bothHandsAboveShoulder,
    bothHandsClearlyDown,
    bothHandsLiftNorm,

    postureStable
  };
}
