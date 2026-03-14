import type { PoseLandmarks } from '../exercises/exerciseIntentTypes'

type TrackKeypoint = {
  x: number
  y: number
  z?: number
  score?: number
}

type TrackKeypointMap = Record<string, TrackKeypoint | undefined>

export function mapTrackKeypointsToIntentLandmarks(
  keypoints: TrackKeypointMap,
): PoseLandmarks {
  return {
    nose: keypoints.nose
      ? {
          x: keypoints.nose.x,
          y: keypoints.nose.y,
          z: keypoints.nose.z,
          score: keypoints.nose.score,
        }
      : undefined,

    left_shoulder: keypoints.leftShoulder
      ? {
          x: keypoints.leftShoulder.x,
          y: keypoints.leftShoulder.y,
          z: keypoints.leftShoulder.z,
          score: keypoints.leftShoulder.score,
        }
      : undefined,

    right_shoulder: keypoints.rightShoulder
      ? {
          x: keypoints.rightShoulder.x,
          y: keypoints.rightShoulder.y,
          z: keypoints.rightShoulder.z,
          score: keypoints.rightShoulder.score,
        }
      : undefined,

    left_elbow: keypoints.leftElbow
      ? {
          x: keypoints.leftElbow.x,
          y: keypoints.leftElbow.y,
          z: keypoints.leftElbow.z,
          score: keypoints.leftElbow.score,
        }
      : undefined,

    right_elbow: keypoints.rightElbow
      ? {
          x: keypoints.rightElbow.x,
          y: keypoints.rightElbow.y,
          z: keypoints.rightElbow.z,
          score: keypoints.rightElbow.score,
        }
      : undefined,

    left_wrist: keypoints.leftWrist
      ? {
          x: keypoints.leftWrist.x,
          y: keypoints.leftWrist.y,
          z: keypoints.leftWrist.z,
          score: keypoints.leftWrist.score,
        }
      : undefined,

    right_wrist: keypoints.rightWrist
      ? {
          x: keypoints.rightWrist.x,
          y: keypoints.rightWrist.y,
          z: keypoints.rightWrist.z,
          score: keypoints.rightWrist.score,
        }
      : undefined,

    left_hip: keypoints.leftHip
      ? {
          x: keypoints.leftHip.x,
          y: keypoints.leftHip.y,
          z: keypoints.leftHip.z,
          score: keypoints.leftHip.score,
        }
      : undefined,

    right_hip: keypoints.rightHip
      ? {
          x: keypoints.rightHip.x,
          y: keypoints.rightHip.y,
          z: keypoints.rightHip.z,
          score: keypoints.rightHip.score,
        }
      : undefined,

    left_knee: keypoints.leftKnee
      ? {
          x: keypoints.leftKnee.x,
          y: keypoints.leftKnee.y,
          z: keypoints.leftKnee.z,
          score: keypoints.leftKnee.score,
        }
      : undefined,

    right_knee: keypoints.rightKnee
      ? {
          x: keypoints.rightKnee.x,
          y: keypoints.rightKnee.y,
          z: keypoints.rightKnee.z,
          score: keypoints.rightKnee.score,
        }
      : undefined,

    left_ankle: keypoints.leftAnkle
      ? {
          x: keypoints.leftAnkle.x,
          y: keypoints.leftAnkle.y,
          z: keypoints.leftAnkle.z,
          score: keypoints.leftAnkle.score,
        }
      : undefined,

    right_ankle: keypoints.rightAnkle
      ? {
          x: keypoints.rightAnkle.x,
          y: keypoints.rightAnkle.y,
          z: keypoints.rightAnkle.z,
          score: keypoints.rightAnkle.score,
        }
      : undefined,
  }
}
