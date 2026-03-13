import { deriveIntentSignals } from './deriveIntentSignals'
import {
  ExerciseIntentModel,
  IntentErrorCode,
  IntentEvaluationResult,
  LiveIntentState,
  PoseLandmarks,
} from './exerciseIntentTypes'

function isPrimaryRaised(currentValue: number, targetMin: number): boolean {
  return currentValue <= targetMin
}

function isBackAtStart(currentValue: number, startMax: number): boolean {
  return currentValue >= startMax
}

function isOppositeSideRaised(currentValue: number, targetMin: number): boolean {
  return currentValue <= targetMin
}

export function createInitialIntentState(
  exercise: ExerciseIntentModel,
  startedAtMs: number,
): LiveIntentState {
  return {
    exerciseId: exercise.id,
    motionState: 'ready',
    repCount: 0,
    repInProgress: false,
    repStartedAtMs: undefined,
    reachedTargetAtMs: undefined,
    returnStartedAtMs: undefined,
    lastRepCompletedAtMs: undefined,
    feedbackMessage: exercise.coaching.intro,
    latestSignals: {},
    lastErrorCode: undefined,
    completed: false,
  }
}

export function evaluateExerciseIntent(params: {
  exercise: ExerciseIntentModel
  landmarks: PoseLandmarks
  previousState: LiveIntentState
  nowMs: number
  deltaMs: number
}): IntentEvaluationResult {
  const { exercise, landmarks, previousState, nowMs, deltaMs } = params

  const signals = deriveIntentSignals({
    landmarks,
    signalDefinitions: exercise.signals,
    previousSignals: previousState.latestSignals,
    deltaMs,
  })

  const nextState: LiveIntentState = {
    ...previousState,
    latestSignals: signals,
    lastErrorCode: undefined,
  }

  const primary = signals[exercise.signalRefs.primaryLiftSignalId] ?? 0
  const opposite = exercise.signalRefs.oppositeLiftSignalId
    ? (signals[exercise.signalRefs.oppositeLiftSignalId] ?? 0)
    : undefined
  const trunkLean = exercise.signalRefs.trunkLeanSignalId
    ? (signals[exercise.signalRefs.trunkLeanSignalId] ?? 0)
    : undefined

  let repCompleted = false
  let detectedErrorCode: IntentErrorCode | undefined
  let feedbackMessage = nextState.feedbackMessage

  const {
    startMax,
    targetMin,
    holdDurationMs,
    minRepDurationMs,
    maxRepDurationMs,
    maxTrunkLeanDeg,
    controlledReturnMinMs,
  } = exercise.thresholds

  if (
    exercise.errors.detectTrunkLean &&
    trunkLean !== undefined &&
    maxTrunkLeanDeg !== undefined &&
    trunkLean > maxTrunkLeanDeg
  ) {
    detectedErrorCode = 'trunk_lean'
    nextState.lastErrorCode = detectedErrorCode
    nextState.feedbackMessage = exercise.coaching.trunkLean

    return {
      nextState,
      repCompleted: false,
      detectedErrorCode,
      feedbackMessage: exercise.coaching.trunkLean,
      signals,
    }
  }

  if (
    !nextState.repInProgress &&
    exercise.errors.detectWrongSide &&
    opposite !== undefined &&
    isOppositeSideRaised(opposite, targetMin) &&
    !isPrimaryRaised(primary, targetMin)
  ) {
    detectedErrorCode = 'wrong_side'
    nextState.lastErrorCode = detectedErrorCode
    nextState.feedbackMessage = exercise.coaching.wrongSide

    return {
      nextState,
      repCompleted: false,
      detectedErrorCode,
      feedbackMessage: exercise.coaching.wrongSide,
      signals,
    }
  }

  if (!nextState.repInProgress && isBackAtStart(primary, startMax)) {
    nextState.feedbackMessage = exercise.coaching.start
  }

  if (!nextState.repInProgress && !isBackAtStart(primary, startMax)) {
    nextState.repInProgress = true
    nextState.repStartedAtMs = nowMs
    nextState.motionState = 'lifting'
    feedbackMessage = exercise.coaching.start
  }

  if (nextState.repInProgress && nextState.motionState === 'lifting') {
    if (isPrimaryRaised(primary, targetMin)) {
      nextState.motionState = 'at_target'
      nextState.reachedTargetAtMs = nowMs
      feedbackMessage = 'Hold...'
    }
  }

  if (nextState.repInProgress && nextState.motionState === 'at_target') {
    const heldForMs =
      nextState.reachedTargetAtMs !== undefined ? nowMs - nextState.reachedTargetAtMs : 0

    if (heldForMs >= holdDurationMs) {
      nextState.motionState = 'holding'
      feedbackMessage = 'Lower slowly.'
    } else {
      feedbackMessage = 'Hold...'
    }
  }

  if (
    nextState.repInProgress &&
    (nextState.motionState === 'at_target' || nextState.motionState === 'holding') &&
    !isPrimaryRaised(primary, targetMin)
  ) {
    if (nextState.motionState !== 'holding' && exercise.errors.detectNoHold) {
      detectedErrorCode = 'no_hold'
      nextState.lastErrorCode = detectedErrorCode
      nextState.repInProgress = false
      nextState.repStartedAtMs = undefined
      nextState.reachedTargetAtMs = undefined
      nextState.motionState = 'ready'
      nextState.feedbackMessage = exercise.coaching.noHold

      return {
        nextState,
        repCompleted: false,
        detectedErrorCode,
        feedbackMessage: exercise.coaching.noHold,
        signals,
      }
    }

    nextState.motionState = 'lowering'
    nextState.returnStartedAtMs = nowMs
    feedbackMessage = 'Lower slowly.'
  }

  if (nextState.repInProgress && nextState.motionState === 'lifting') {
    const repElapsed = nextState.repStartedAtMs ? nowMs - nextState.repStartedAtMs : 0

    if (
      repElapsed > Math.max(minRepDurationMs / 2, 800) &&
      exercise.errors.detectInsufficientRange
    ) {
      detectedErrorCode = 'insufficient_range'
      nextState.lastErrorCode = detectedErrorCode
      nextState.feedbackMessage = exercise.coaching.insufficientRange
    }
  }

  if (
    nextState.repInProgress &&
    nextState.motionState === 'lowering' &&
    isBackAtStart(primary, startMax)
  ) {
    const totalRepMs = nextState.repStartedAtMs ? nowMs - nextState.repStartedAtMs : 0
    const returnDurationMs = nextState.returnStartedAtMs ? nowMs - nextState.returnStartedAtMs : 0

    if (exercise.errors.detectTooFast && totalRepMs < minRepDurationMs) {
      detectedErrorCode = 'too_fast'
      nextState.lastErrorCode = detectedErrorCode
      nextState.repInProgress = false
      nextState.repStartedAtMs = undefined
      nextState.reachedTargetAtMs = undefined
      nextState.returnStartedAtMs = undefined
      nextState.motionState = 'ready'
      nextState.feedbackMessage = exercise.coaching.tooFast

      return {
        nextState,
        repCompleted: false,
        detectedErrorCode,
        feedbackMessage: exercise.coaching.tooFast,
        signals,
      }
    }

    if (exercise.errors.detectTooFast && returnDurationMs < controlledReturnMinMs) {
      detectedErrorCode = 'too_fast'
      nextState.lastErrorCode = detectedErrorCode
      nextState.repInProgress = false
      nextState.repStartedAtMs = undefined
      nextState.reachedTargetAtMs = undefined
      nextState.returnStartedAtMs = undefined
      nextState.motionState = 'ready'
      nextState.feedbackMessage = exercise.coaching.tooFast

      return {
        nextState,
        repCompleted: false,
        detectedErrorCode,
        feedbackMessage: exercise.coaching.tooFast,
        signals,
      }
    }

    if (totalRepMs > maxRepDurationMs) {
      nextState.repInProgress = false
      nextState.repStartedAtMs = undefined
      nextState.reachedTargetAtMs = undefined
      nextState.returnStartedAtMs = undefined
      nextState.motionState = 'ready'
      nextState.feedbackMessage = exercise.coaching.start

      return {
        nextState,
        repCompleted: false,
        detectedErrorCode,
        feedbackMessage: nextState.feedbackMessage,
        signals,
      }
    }

    nextState.repCount += 1
    nextState.repInProgress = false
    nextState.repStartedAtMs = undefined
    nextState.reachedTargetAtMs = undefined
    nextState.returnStartedAtMs = undefined
    nextState.lastRepCompletedAtMs = nowMs
    nextState.motionState = 'completed'
    nextState.feedbackMessage = exercise.coaching.success
    repCompleted = true
    feedbackMessage = exercise.coaching.success
  }

  if (repCompleted && nextState.repCount >= exercise.presentation.targetReps) {
    nextState.completed = true
    nextState.feedbackMessage = exercise.coaching.completedExercise
    feedbackMessage = exercise.coaching.completedExercise
  } else if (!nextState.repInProgress && nextState.motionState === 'completed' && !nextState.completed) {
    nextState.motionState = 'ready'
  }

  return {
    nextState,
    repCompleted,
    detectedErrorCode,
    feedbackMessage,
    signals,
  }
}
