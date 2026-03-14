import { PoseLandmarks } from '../exercises/exerciseIntentTypes'

export function extractIntentSignals(landmarks: PoseLandmarks) {
  const rs = landmarks.rightShoulder
  const rw = landmarks.rightWrist
  const ls = landmarks.leftShoulder
  const lw = landmarks.leftWrist
  const nose = landmarks.nose
  const midHip = landmarks.midHip

  let rightArmLift: number | null = null
  let leftArmLift: number | null = null
  let trunkLean: number | null = null

  if (rs && rw) {
    rightArmLift = rs.y - rw.y
  }

  if (ls && lw) {
    leftArmLift = ls.y - lw.y
  }

  if (nose && midHip) {
    trunkLean = Math.abs(nose.x - midHip.x)
  }

  return {
    right_arm_lift: rightArmLift,
    left_arm_lift: leftArmLift,
    trunk_lean: trunkLean
  }
}
