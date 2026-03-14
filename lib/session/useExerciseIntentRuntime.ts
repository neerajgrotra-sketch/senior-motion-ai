'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ExerciseIntentModel,
  LiveIntentState,
  PoseLandmarks,
} from '../exercises/exerciseIntentTypes'
import {
  createInitialIntentState,
  evaluateExerciseIntent,
} from './evaluateExerciseIntent'

export function useExerciseIntentRuntime(exercise: ExerciseIntentModel | null) {
  const [state, setState] = useState<LiveIntentState | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  const start = useCallback(() => {
    if (!exercise) return
    const now = performance.now()
    lastFrameTimeRef.current = now
    setState(createInitialIntentState(exercise, now))
  }, [exercise])

  const reset = useCallback(() => {
    if (!exercise) return
    const now = performance.now()
    lastFrameTimeRef.current = now
    setState(createInitialIntentState(exercise, now))
  }, [exercise])

  const processLandmarks = useCallback(
    (landmarks: PoseLandmarks) => {
      if (!exercise || !state) return

      const now = performance.now()
      const lastFrameTime = lastFrameTimeRef.current ?? now
      const deltaMs = Math.max(1, now - lastFrameTime)
      lastFrameTimeRef.current = now

      const result = evaluateExerciseIntent({
        exercise,
        landmarks,
        previousState: state,
        nowMs: now,
        deltaMs,
      })

      setState(result.nextState)
      return result
    },
    [exercise, state],
  )

  const primaryLiftSignalId = exercise?.signalRefs.primaryLiftSignalId
  const oppositeLiftSignalId = exercise?.signalRefs.oppositeLiftSignalId
  const trunkLeanSignalId = exercise?.signalRefs.trunkLeanSignalId

  const derived = useMemo(() => {
    const latestSignals = state?.latestSignals ?? {}

    return {
      repCount: state?.repCount ?? 0,
      motionState: state?.motionState ?? 'ready',
      feedbackMessage: state?.feedbackMessage ?? exercise?.coaching.intro ?? '',
      lastErrorCode: state?.lastErrorCode,
      completed: state?.completed ?? false,
      latestSignals,
      debugSignals: {
        primary:
          primaryLiftSignalId && latestSignals[primaryLiftSignalId] != null
            ? latestSignals[primaryLiftSignalId]
            : null,
        opposite:
          oppositeLiftSignalId && latestSignals[oppositeLiftSignalId] != null
            ? latestSignals[oppositeLiftSignalId]
            : null,
        trunkLean:
          trunkLeanSignalId && latestSignals[trunkLeanSignalId] != null
            ? latestSignals[trunkLeanSignalId]
            : null,
      },
    }
  }, [exercise, state, primaryLiftSignalId, oppositeLiftSignalId, trunkLeanSignalId])

  return {
    state,
    start,
    reset,
    processLandmarks,
    ...derived,
  }
}
