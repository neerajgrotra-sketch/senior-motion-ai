import { PoseLandmarks } from '../exercises/exerciseIntentTypes'

export function extractIntentSignals(landmarks: PoseLandmarks) {
  const rs = landmarks.right_shoulder
  const rw = landmarks.right_wrist
  const ls = landmarks.left_shoulder
  const lw = landmarks.left_wrist
  const nose = landmarks.nose
  const lh = landmarks.left_hip
  const rh = landmarks.right_hip

  let rightArmLift: number | null = null
  let leftArmLift: number | null = null
  let trunkLean: number | null = null

  if (rs && rw) {
    rightArmLift = rs.y - rw.y
  }

  if (ls && lw) {
    leftArmLift = ls.y - lw.y
  }

  if (nose && lh && rh) {
    const midHipX = (lh.x + rh.x) / 2
    trunkLean = Math.abs(nose.x - midHipX)
  }

  return {
    right_arm_lift: rightArmLift,
    left_arm_lift: leftArmLift,
    trunk_lean: trunkLean,
  }
}
