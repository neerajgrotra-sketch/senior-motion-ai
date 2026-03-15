import { evaluateAllRules } from './ruleEngine';
import type {
  BiomechanicsSignals,
  DetectedError,
  ExerciseDefinition,
  RuntimeAssessment,
  RuntimeState
} from './types';

function detectErrors(
  definition: ExerciseDefinition,
  signals: BiomechanicsSignals,
  state: RuntimeState
): DetectedError[] {
  const detected: DetectedError[] = [];

  for (const error of definition.errors) {
    if (evaluateAllRules(signals, error.when)) {
      detected.push({
        code: error.code,
        severity: error.severity,
        message: error.message
      });
    }
  }

  if (
    state.phase === 'ready' &&
    definition.thresholds.noResponseMs != null &&
    signals.timeSincePhaseStartMs >= definition.thresholds.noResponseMs &&
    signals.rightHandLiftNorm < (definition.thresholds.targetLiftNorm ?? 0.55) * 0.4
  ) {
    detected.push({
      code: 'no_response',
      severity: 'medium',
      message: definition.cues.corrections.no_response ?? 'Start when you are ready.'
    });
  }

  if (
    state.phase === 'holding' &&
    definition.thresholds.minHoldMs != null &&
    signals.holdDurationMs < definition.thresholds.minHoldMs
  ) {
    detected.push({
      code: 'insufficient_hold',
      severity: 'medium',
      message: definition.cues.corrections.insufficient_hold ?? 'Hold it a bit longer.'
    });
  }

  if (
    state.phase === 'descending' &&
    definition.thresholds.returnLiftNorm != null &&
    signals.rightHandLiftNorm > definition.thresholds.returnLiftNorm &&
    signals.timeSincePhaseStartMs > 1800
  ) {
    detected.push({
      code: 'incomplete_return',
      severity: 'medium',
      message:
        definition.cues.corrections.incomplete_return ?? 'Lower all the way down.'
    });
  }

  if (
    state.phase === 'ascending' &&
    signals.timeSincePhaseStartMs > 2200 &&
    definition.thresholds.targetLiftNorm != null &&
    signals.rightHandLiftNorm < definition.thresholds.targetLiftNorm
  ) {
    detected.push({
      code: 'insufficient_range',
      severity: 'medium',
      message:
        definition.cues.corrections.insufficient_range ?? 'Lift a little higher.'
    });
  }

  return detected.sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 };
    return rank[b.severity] - rank[a.severity];
  });
}

function getPrimaryCue(
  definition: ExerciseDefinition,
  errors: DetectedError[],
  phase: RuntimeState['phase'],
  signals: BiomechanicsSignals
): string | null {
  if (errors.length > 0) return errors[0].message;

  const returnLiftNorm = definition.thresholds.returnLiftNorm ?? 0.12;
  const targetLiftNorm = definition.thresholds.targetLiftNorm ?? 0.55;

  switch (phase) {
    case 'idle':
      return definition.cues.intro;

    case 'ready':
      if (signals.rightHandLiftNorm > returnLiftNorm) {
        return 'Lower your right hand to start.';
      }
      return definition.cues.ready;

    case 'ascending':
      if (signals.rightHandLiftNorm < targetLiftNorm) {
        return definition.cues.ascend;
      }
      return 'Good. Keep going.';

    case 'holding':
      return definition.cues.hold;

    case 'descending':
      return definition.cues.descend;

    case 'rep_complete':
    case 'completed':
      return definition.cues.success;

    default:
      return null;
  }
}

export function advanceExerciseRuntime(params: {
  definition: ExerciseDefinition;
  signals: BiomechanicsSignals;
  state: RuntimeState;
}): { state: RuntimeState; assessment: RuntimeAssessment } {
  const { definition, signals } = params;
  let state = { ...params.state };

  const goToPhase = (phase: RuntimeState['phase']) => {
    state.phase = phase;
    state.phaseStartedAt = signals.timestamp;
  };

  const returnLiftNorm = definition.thresholds.returnLiftNorm ?? 0.12;
  const targetLiftNorm = definition.thresholds.targetLiftNorm ?? 0.55;
  const minHoldMs = definition.thresholds.minHoldMs ?? 0;

  const handDown = signals.rightHandLiftNorm <= returnLiftNorm;
  const handRaisedEnough = signals.rightHandLiftNorm >= targetLiftNorm;

  // Step 1: If posture is valid, move out of idle into ready.
  // Do NOT require hand-down just to become ready.
  if (state.phase === 'idle') {
    const postureAllowed = definition.allowedPostures.includes(signals.posture);
    if (postureAllowed || signals.posture === 'unknown') {
      goToPhase('ready');
    }
  }

  // Step 2: Ready means waiting for true start position.
  // If the hand is already up, stay in ready and coach the user to lower it first.
  if (state.phase === 'ready') {
    if (handDown) {
      // waiting for ascent
      if (signals.rightHandLiftNorm > returnLiftNorm + 0.08) {
        state.repStartedAt = signals.timestamp;
        goToPhase('ascending');
      }
    }
  }

  // Step 3: Ascending until target reached
  if (state.phase === 'ascending') {
    if (handRaisedEnough) {
      state.holdStartedAt = signals.timestamp;
      goToPhase('holding');
    }
  }

  // Step 4: Holding until minimum hold reached
  if (state.phase === 'holding') {
    if (signals.holdDurationMs >= minHoldMs) {
      goToPhase('descending');
    }
  }

  // Step 5: Descending until return-to-start
  if (state.phase === 'descending') {
    if (handDown) {
      state.repCount += 1;
      state.lastRepCompletedAt = signals.timestamp;
      state.repStartedAt = null;
      state.holdStartedAt = null;
      goToPhase('rep_complete');
    }
  }

  // Step 6: After rep complete, go back to ready
  if (state.phase === 'rep_complete') {
    goToPhase('ready');
  }

  const errors = detectErrors(definition, signals, state);
  const currentLift = signals.rightHandLiftNorm;
  const progress = Math.max(0, Math.min(1, currentLift / Math.max(targetLiftNorm, 0.01)));
  const primaryCue = getPrimaryCue(definition, errors, state.phase, signals);

  return {
    state,
    assessment: {
      phase: state.phase,
      repCount: state.repCount,
      progress,
      activeErrors: errors,
      primaryCue,
      currentLift,
      holdMs: signals.holdDurationMs
    }
  };
}
