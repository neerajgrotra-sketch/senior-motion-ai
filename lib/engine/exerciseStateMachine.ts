import type { ExerciseMachine, ExercisePhase } from '../poseTypes';

export function createExerciseMachine(prompt: string): ExerciseMachine {
  return {
    prompt,
    phase: 'idle',
    repCount: 0,
    holdMs: 0,
    statusText: 'Get ready',
    lastTimestamp: null,
    lastTransitionAt: null,
    lastCompletedAt: null,
    lastFeatures: null,
    currentRepPeakLift: 0,
    lastRepPeakLift: null,
    sessionPeakLift: 0
  };
}

export function transitionMachine(
  machine: ExerciseMachine,
  nextPhase: ExercisePhase,
  timestamp: number,
  statusText: string,
  extra?: Partial<ExerciseMachine>
): ExerciseMachine {
  return {
    ...machine,
    phase: nextPhase,
    statusText,
    lastTransitionAt: timestamp,
    ...extra
  };
}
