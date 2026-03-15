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

  const targetLiftNorm = definition.thresholds.targetLiftNorm ?? 0.55;
  const returnLiftNorm = definition.thresholds.returnLiftNorm ?? 0.12;

  if (
    state.phase === 'ready' &&
    definition.thresholds.noResponseMs != null &&
    signals.timeSincePhaseStartMs >= definition.thresholds.noResponseMs &&
    signals.rightHandLiftNorm < targetLiftNorm * 0.4
  ) {
    detected.push({
      code: 'no_response',
      severity: 'medium',
      message: definition.cues.corrections.no_response ?? 'Start when you are ready.'
    });
  }

  if (
    state.phase === 'ascending' &&
    signals.timeSincePhaseStartMs > 2200 &&
    signals.rightHandLiftNorm < targetLiftNorm
  ) {
    detected.push({
      code: 'insufficient_range',
      severity: 'medium',
      message: definition.cues.corrections.insufficient_range ?? 'Lift a little higher.'
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
    signals.timeSincePhaseStartMs > 1800 &&
    signals.rightHandLiftNorm > returnLiftNorm
  ) {
    detected.push({
      code: 'incomplete_return',
      severity: 'medium',
      message: definition.cues.corrections.incomplete_return ?? 'Lower all the way down.'
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
  const minHoldMs = definition.thresholds.minHoldMs ?? 0;

  switch (phase) {
    case 'idle':
      return definition.cues.intro;

    case 'ready':
      if (signals.rightHandLiftNorm > returnLiftNorm + 0.05) {
        return 'Lower your right hand to start.';
      }
      return definition.cues.ready;

    case 'ascending':
      if (signals.rightHandLiftNorm < targetLiftNorm) {
        return definition.cues.ascend;
      }
      return 'Good. Keep going.';

    case 'holding':
      if (signals.holdDurationMs < minHoldMs) {
        return definition.cues.hold;
      }
      return 'Great. Now lower slowly.';

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

  const targetLiftNorm = definition.thresholds.targetLiftNorm ?? 0.55;
  const returnLiftNorm = definition.thresholds.returnLiftNorm ?? 0.12;
  const minHoldMs = definition.thresholds.minHoldMs ?? 0;

  const handDown = signals.rightHandLiftNorm <= returnLiftNorm;
  const handRaisedEnough = signals.rightHandLiftNorm >= targetLiftNorm;

  const postureAllowed =
    definition.allowedPostures.includes(signals.posture) || signals.posture === 'unknown';

  // Phase 1: idle -> ready
  if (state.phase === 'idle') {
    if (postureAllowed) {
      goToPhase('ready');
    }
  }

  // Phase 2: ready -> ascending
  // We start ascending whenever the hand is no longer in the down zone.
  // This fixes the old impossible transition.
  if (state.phase === 'ready') {
    if (!handDown) {
      state.repStartedAt = signals.timestamp;
      goToPhase('ascending');
    }
  }

  // Phase 3: ascending -> holding
  if (state.phase === 'ascending') {
    if (handRaisedEnough) {
      if (state.holdStartedAt == null) {
        state.holdStartedAt = signals.timestamp;
      }
      goToPhase('holding');
    }
  }

  // Phase 4: holding -> descending
  if (state.phase === 'holding') {
    if (signals.holdDurationMs >= minHoldMs) {
      goToPhase('descending');
    }
  }

  // Phase 5: descending -> rep_complete
  if (state.phase === 'descending') {
    if (handDown) {
      state.repCount += 1;
      state.lastRepCompletedAt = signals.timestamp;
      state.repStartedAt = null;
      state.holdStartedAt = null;
      goToPhase('rep_complete');
    }
  }

  // Phase 6: rep_complete -> ready
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
