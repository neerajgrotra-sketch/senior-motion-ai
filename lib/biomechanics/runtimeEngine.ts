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
      message:
        definition.cues.corrections.insufficient_hold ?? 'Hold it a bit longer.'
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
  phase: RuntimeState['phase']
): string | null {
  if (errors.length > 0) return errors[0].message;

  switch (phase) {
    case 'idle':
      return definition.cues.intro;
    case 'ready':
      return definition.cues.ready;
    case 'ascending':
      return definition.cues.ascend;
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

  if (state.phase === 'idle' && evaluateAllRules(signals, definition.phases.ready)) {
    goToPhase('ready');
  }

  if (state.phase === 'ready' && evaluateAllRules(signals, definition.phases.ascentStart)) {
    state.repStartedAt = signals.timestamp;
    goToPhase('ascending');
  }

  if (state.phase === 'ascending' && evaluateAllRules(signals, definition.phases.peakReached)) {
    state.holdStartedAt = signals.timestamp;
    goToPhase('holding');
  }

  if (state.phase === 'holding') {
    const minHoldMs = definition.thresholds.minHoldMs ?? 0;
    if (signals.holdDurationMs >= minHoldMs) {
      goToPhase('descending');
    }
  }

  if (state.phase === 'descending' && evaluateAllRules(signals, definition.phases.returnReached)) {
    state.repCount += 1;
    state.lastRepCompletedAt = signals.timestamp;
    state.repStartedAt = null;
    state.holdStartedAt = null;
    goToPhase('rep_complete');
  }

  if (state.phase === 'rep_complete') {
    goToPhase('ready');
  }

  const errors = detectErrors(definition, signals, state);
  const currentLift = signals.rightHandLiftNorm;
  const targetLift = definition.thresholds.targetLiftNorm ?? 1;
  const progress = Math.max(0, Math.min(1, currentLift / targetLift));
  const primaryCue = getPrimaryCue(definition, errors, state.phase);

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
