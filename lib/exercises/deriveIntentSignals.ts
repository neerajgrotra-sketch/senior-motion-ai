import {
  LandmarkName,
  PoseLandmarks,
  PosePoint,
  SignalDefinition,
} from './exerciseIntentTypes'

function getPoint(landmarks: PoseLandmarks, name: LandmarkName): PosePoint | null {
  return landmarks[name] ?? null
}

function midpoint(a: PosePoint, b: PosePoint): PosePoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: a.z !== undefined && b.z !== undefined ? (a.z + b.z) / 2 : undefined,
    score: a.score !== undefined && b.score !== undefined ? (a.score + b.score) / 2 : undefined,
  }
}

function distance(a: PosePoint, b: PosePoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function angleDeg(a: PosePoint, b: PosePoint, c: PosePoint): number {
  const abx = a.x - b.x
  const aby = a.y - b.y
  const abz = (a.z ?? 0) - (b.z ?? 0)

  const cbx = c.x - b.x
  const cby = c.y - b.y
  const cbz = (c.z ?? 0) - (b.z ?? 0)

  const dot = abx * cbx + aby * cby + abz * cbz
  const magAB = Math.sqrt(abx * abx + aby * aby + abz * abz)
  const magCB = Math.sqrt(cbx * cbx + cby * cby + cbz * cbz)

  if (magAB === 0 || magCB === 0) return 0

  const cosTheta = Math.max(-1, Math.min(1, dot / (magAB * magCB)))
  return (Math.acos(cosTheta) * 180) / Math.PI
}

function torsoLeanDeg(landmarks: PoseLandmarks): number {
  const leftShoulder = getPoint(landmarks, 'left_shoulder')
  const rightShoulder = getPoint(landmarks, 'right_shoulder')
  const leftHip = getPoint(landmarks, 'left_hip')
  const rightHip = getPoint(landmarks, 'right_hip')

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 0

  const shouldersMid = midpoint(leftShoulder, rightShoulder)
  const hipsMid = midpoint(leftHip, rightHip)

  const dx = shouldersMid.x - hipsMid.x
  const dy = shouldersMid.y - hipsMid.y

  return Math.abs((Math.atan2(dx, -dy) * 180) / Math.PI)
}

export function deriveIntentSignals(params: {
  landmarks: PoseLandmarks
  signalDefinitions: SignalDefinition[]
  previousSignals?: Record<string, number>
  deltaMs?: number
}): Record<string, number> {
  const { landmarks, signalDefinitions, previousSignals = {}, deltaMs = 0 } = params
  const result: Record<string, number> = {}

  for (const signal of signalDefinitions) {
    switch (signal.type) {
      case 'relative_y': {
        const pointA = signal.config.pointA as LandmarkName | undefined
        const pointB = signal.config.pointB as LandmarkName | undefined

        if (!pointA || !pointB) {
          result[signal.id] = 0
          break
        }

        const a = getPoint(landmarks, pointA)
        const b = getPoint(landmarks, pointB)
        result[signal.id] = a && b ? a.y - b.y : 0
        break
      }

      case 'relative_x': {
        const pointA = signal.config.pointA as LandmarkName | undefined
        const pointB = signal.config.pointB as LandmarkName | undefined

        if (!pointA || !pointB) {
          result[signal.id] = 0
          break
        }

        const a = getPoint(landmarks, pointA)
        const b = getPoint(landmarks, pointB)
        result[signal.id] = a && b ? a.x - b.x : 0
        break
      }

      case 'distance': {
        const pointA = signal.config.pointA as LandmarkName | undefined
        const pointB = signal.config.pointB as LandmarkName | undefined

        if (!pointA || !pointB) {
          result[signal.id] = 0
          break
        }

        const a = getPoint(landmarks, pointA)
        const b = getPoint(landmarks, pointB)
        result[signal.id] = a && b ? distance(a, b) : 0
        break
      }

      case 'joint_angle': {
        const pointA = signal.config.pointA as LandmarkName | undefined
        const vertex = signal.config.vertex as LandmarkName | undefined
        const pointC = signal.config.pointC as LandmarkName | undefined

        if (!pointA || !vertex || !pointC) {
          result[signal.id] = 0
          break
        }

        const a = getPoint(landmarks, pointA)
        const b = getPoint(landmarks, vertex)
        const c = getPoint(landmarks, pointC)
        result[signal.id] = a && b && c ? angleDeg(a, b, c) : 0
        break
      }

      case 'torso_lean': {
        result[signal.id] = torsoLeanDeg(landmarks)
        break
      }

      case 'velocity': {
        const sourceSignalId = signal.config.sourceSignalId as string | undefined

        if (!sourceSignalId || deltaMs <= 0) {
          result[signal.id] = 0
          break
        }

        const currentValue = result[sourceSignalId] ?? previousSignals[sourceSignalId] ?? 0
        const previousValue = previousSignals[sourceSignalId] ?? currentValue
        result[signal.id] = (currentValue - previousValue) / (deltaMs / 1000)
        break
      }

      default: {
        result[signal.id] = 0
      }
    }
  }

  return result
}
