'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const stateRef = useRef<LiveIntentState | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const start = useCallback(() => {
    if (!exercise) return
    const now = performance.now()
    const initialState = createInitialIntentState(exercise, now)
    lastFrameTimeRef.current = now
    stateRef.current = initialState
    setState(initialState)
  }, [exercise])

  const reset = useCallback(() => {
    if (!exercise) return
    const now = performance.now()
    const initialState = createInitialIntentState(exercise, now)
    lastFrameTimeRef.current = now
    stateRef.current = initialState
    setState(initialState)
  }, [exercise])

  const processLandmarks = useCallback(
    (landmarks: PoseLandmarks) => {
      if (!exercise) return

      const currentState = stateRef.current
      if (!currentState) return

      const now = performance.now()
      const lastFrameTime = lastFrameTimeRef.current ?? now
      const deltaMs = Math.max(1, now - lastFrameTime)
      lastFrameTimeRef.current = now

      const result = evaluateExerciseIntent({
        exercise,
        landmarks,
        previousState: currentState,
        nowMs: now,
        deltaMs,
      })

      stateRef.current = result.nextState
      setState(result.nextState)
      return result
    },
    [exercise],
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
