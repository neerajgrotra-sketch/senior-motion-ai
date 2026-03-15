import { evaluateAllRules } from './ruleEngine';
import type {
  BiomechanicsSignals,
  DetectedError,
  ExerciseDefinition,
  RuntimeAssessment,
  RuntimeState
} from './types';

function getActiveLift(signals: BiomechanicsSignals, definition: ExerciseDefinition): number {
  return definition.side === 'left' ? signals.leftHandLiftNorm : signals.rightHandLiftNorm;
}

function getOppositeLift(signals: BiomechanicsSignals, definition: ExerciseDefinition): number {
  return definition.side === 'left' ? signals.rightHandLiftNorm : signals.leftHandLiftNorm;
}

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
  const activeLift = getActiveLift(signals, definition);

  if (
    state.phase === 'ready' &&
    definition.thresholds.noResponseMs != null &&
    signals.timeSincePhaseStartMs >= definition.thresholds.noResponseMs &&
    activeLift < targetLiftNorm * 0.4
  ) {
    detected.push({
      code: 'no_response',
      severity: 'medium',
      message: definition.cues.corrections.no_response ?? 'Start when you are ready.'
    });
  }

  if (state.phase === 'ascending' && signals.timeSincePhaseStartMs > 2200 && activeLift < targetLiftNorm) {
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

  if (state.phase === 'descending' && signals.timeSincePhaseStartMs > 1800 && activeLift > returnLiftNorm) {
    detected.push({
      code: 'incomplete_return',
      severity: 'medium',
      message: definition.cues.corrections.incomplete_return ?? 'Lower all the way down.'
    });
  }

  return detected;
}

function sortErrorsForPhase(
  errors: DetectedError[],
  phase: RuntimeState['phase']
): DetectedError[] {
  const severityRank = { high: 3, medium: 2, low: 1 };

  const phasePriority = (code: DetectedError['code']) => {
    if (phase === 'ascending') {
      if (code === 'wrong_side') return 100;
      if (code === 'insufficient_range') return 95;
      if (code === 'excessive_speed') return 90;
      if (code === 'trunk_compensation') return 70;
      return 50;
    }

    if (phase === 'holding') {
      if (code === 'insufficient_hold') return 100;
      if (code === 'trunk_compensation') return 80;
      return 50;
    }

    if (phase === 'descending') {
      if (code === 'incomplete_return') return 100;
      if (code === 'excessive_speed') return 85;
      if (code === 'trunk_compensation') return 30;
      return 40;
    }

    if (phase === 'ready') {
      if (code === 'no_response') return 100;
      if (code === 'wrong_side') return 90;
      if (code === 'trunk_compensation') return 60;
      return 40;
    }

    return 50;
  };

  return [...errors].sort((a, b) => {
    const pa = phasePriority(a.code);
    const pb = phasePriority(b.code);
    if (pb !== pa) return pb - pa;
    return severityRank[b.severity] - severityRank[a.severity];
  });
}

function getPrimaryCue(
  definition: ExerciseDefinition,
  errors: DetectedError[],
  phase: RuntimeState['phase'],
  signals: BiomechanicsSignals
): string | null {
  const returnLiftNorm = definition.thresholds.returnLiftNorm ?? 0.12;
  const targetLiftNorm = definition.thresholds.targetLiftNorm ?? 0.55;
  const minHoldMs = definition.thresholds.minHoldMs ?? 0;

  const activeLift = getActiveLift(signals, definition);
  const oppositeLift = getOppositeLift(signals, definition);

  const prioritizedErrors = sortErrorsForPhase(errors, phase);
  const topError = prioritizedErrors[0];

  if (phase === 'descending') {
    if (topError?.code === 'incomplete_return') return topError.message;
    return definition.cues.descend;
  }

  if (phase === 'rep_complete' || phase === 'completed') {
    return definition.cues.success;
  }

  if (phase === 'holding') {
    if (signals.holdDurationMs < minHoldMs) {
      return definition.cues.hold;
    }
    return 'Great. Now lower slowly.';
  }

  if (phase === 'ascending') {
    if (topError && topError.code !== 'trunk_compensation') {
      return topError.message;
    }

    if (topError?.code === 'trunk_compensation' && activeLift < targetLiftNorm * 0.7) {
      return topError.message;
    }

    if (activeLift < targetLiftNorm) {
      return definition.cues.ascend;
    }

    return 'Good. Keep going.';
  }

  if (phase === 'ready') {
    if (activeLift > returnLiftNorm + 0.05) {
      return definition.side === 'left'
        ? 'Lower your left hand to start.'
        : 'Lower your right hand to start.';
    }

    if (oppositeLift > (definition.thresholds.wrongSideLiftNorm ?? 0.3)) {
      return definition.side === 'left' ? 'Use your left hand.' : 'Use your right hand.';
    }

    if (topError) return topError.message;
    return definition.cues.ready;
  }

  if (phase === 'idle') {
    return definition.cues.intro;
  }

  if (topError) return topError.message;
  return null;
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

  const activeLift = getActiveLift(signals, definition);
  const handDown = activeLift <= returnLiftNorm;
  const handRaisedEnough = activeLift >= targetLiftNorm;

  const postureAllowed =
    definition.allowedPostures.includes(signals.posture) || signals.posture === 'unknown';

  if (state.phase === 'idle') {
    if (postureAllowed) {
      goToPhase('ready');
    }
  }

  if (state.phase === 'ready') {
    if (!handDown) {
      state.repStartedAt = signals.timestamp;
      goToPhase('ascending');
    }
  }

  if (state.phase === 'ascending') {
    if (handRaisedEnough) {
      if (state.holdStartedAt == null) {
        state.holdStartedAt = signals.timestamp;
      }
      goToPhase('holding');
    }
  }

  if (state.phase === 'holding') {
    if (signals.holdDurationMs >= minHoldMs) {
      goToPhase('descending');
    }
  }

  if (state.phase === 'descending') {
    if (handDown) {
      state.repCount += 1;
      state.lastRepCompletedAt = signals.timestamp;
      state.repStartedAt = null;
      state.holdStartedAt = null;
      goToPhase('rep_complete');
    }
  }

  if (state.phase === 'rep_complete') {
    goToPhase('ready');
  }

  const errors = detectErrors(definition, signals, state);
  const currentLift = activeLift;
  const progress = Math.max(0, Math.min(1, currentLift / Math.max(targetLiftNorm, 0.01)));
  const primaryCue = getPrimaryCue(definition, errors, state.phase, signals);

  return {
    state,
    assessment: {
      phase: state.phase,
      repCount: state.repCount,
      progress,
      activeErrors: sortErrorsForPhase(errors, state.phase),
      primaryCue,
      currentLift,
      holdMs: signals.holdDurationMs
    }
  };
}
