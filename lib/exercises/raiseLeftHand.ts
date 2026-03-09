import { createExerciseMachine, transitionMachine } from '../engine/exerciseStateMachine';
import type { ExerciseFrameFeatures, ExerciseMachine } from '../poseTypes';

const MIN_KEYPOINT_SCORE = 0.35;
const MIN_HOLD_MS = 500;
const UPWARD_VELOCITY_THRESHOLD = 0.008;
const DOWNWARD_VELOCITY_THRESHOLD = 0.008;

export function createRaiseLeftHandMachine(): ExerciseMachine {
  return {
    ...createExerciseMachine('Raise your left hand'),
    currentRepPeakLift: 0,
    lastRepPeakLift: null,
    sessionPeakLift: 0
  };
}

export function advanceRaiseLeftHand(
  machine: ExerciseMachine,
  features: ExerciseFrameFeatures
): ExerciseMachine {
  const prev = machine.lastFeatures;

  const lowConfidence =
    features.leftWristScore < MIN_KEYPOINT_SCORE ||
    features.leftShoulderScore < MIN_KEYPOINT_SCORE ||
    features.leftElbowScore < MIN_KEYPOINT_SCORE;

  const peakLift = Math.max(machine.currentRepPeakLift, features.leftHandLiftNorm);
  let next: ExerciseMachine = {
    ...machine,
    lastFeatures: features,
    lastTimestamp: features.timestamp,
    currentRepPeakLift: peakLift,
    sessionPeakLift: Math.max(machine.sessionPeakLift, peakLift)
  };

  if (lowConfidence) {
    return {
      ...next,
      phase: 'lost',
      holdMs: 0,
      statusText: 'Low confidence - keep your full body visible'
    };
  }

  const upwardVelocityNorm =
    prev ? (prev.leftWristY - features.leftWristY) / Math.max(1, features.torsoLength) : 0;

  const downwardVelocityNorm =
    prev ? (features.leftWristY - prev.leftWristY) / Math.max(1, features.torsoLength) : 0;

  if (next.phase === 'lost' || next.phase === 'idle') {
    if (features.leftHandClearlyDown) {
      return transitionMachine(next, 'ready', features.timestamp, 'Start with your left hand down', {
        holdMs: 0,
        currentRepPeakLift: Math.max(0, features.leftHandLiftNorm)
      });
    }

    return transitionMachine(next, 'idle', features.timestamp, 'Lower your left hand to begin', {
      holdMs: 0
    });
  }

  if (next.phase === 'ready') {
    if (!features.leftHandClearlyDown) {
      return transitionMachine(next, 'idle', features.timestamp, 'Lower your left hand to begin', {
        holdMs: 0
      });
    }

    if (upwardVelocityNorm > UPWARD_VELOCITY_THRESHOLD) {
      return transitionMachine(next, 'moving_up', features.timestamp, 'Good - lift your left hand', {
        currentRepPeakLift: Math.max(0, features.leftHandLiftNorm)
      });
    }

    return {
      ...next,
      holdMs: 0,
      statusText: 'Raise your left hand'
    };
  }

  if (next.phase === 'moving_up') {
    if (features.leftHandAboveShoulder) {
      return transitionMachine(next, 'at_top', features.timestamp, 'Great - reach the top', {
        holdMs: 0
      });
    }

    return {
      ...next,
      statusText: 'Keep lifting your left hand'
    };
  }

  if (next.phase === 'at_top') {
    if (!features.leftHandAboveShoulder) {
      return transitionMachine(next, 'moving_up', features.timestamp, 'Lift a little higher', {
        holdMs: 0
      });
    }

    return transitionMachine(next, 'holding', features.timestamp, 'Hold your hand up', {
      holdMs: 0
    });
  }

  if (next.phase === 'holding') {
    const holdMs = next.lastTransitionAt ? features.timestamp - next.lastTransitionAt : 0;

    if (!features.leftHandAboveShoulder) {
      if (holdMs >= MIN_HOLD_MS) {
        return transitionMachine(next, 'moving_down', features.timestamp, 'Nice - lower your hand', {
          holdMs
        });
      }

      return transitionMachine(next, 'moving_up', features.timestamp, 'Raise again and hold longer', {
        holdMs: 0
      });
    }

    return {
      ...next,
      holdMs,
      statusText: holdMs >= MIN_HOLD_MS ? 'Hold complete - now lower your hand' : 'Keep holding'
    };
  }

  if (next.phase === 'moving_down') {
    if (features.leftHandClearlyDown || downwardVelocityNorm > DOWNWARD_VELOCITY_THRESHOLD) {
      if (features.leftHandClearlyDown) {
        const completedPeak = next.currentRepPeakLift;

        return transitionMachine(next, 'rep_complete', features.timestamp, 'Rep complete', {
          repCount: next.repCount + 1,
          lastCompletedAt: features.timestamp,
          lastRepPeakLift: completedPeak,
          sessionPeakLift: Math.max(next.sessionPeakLift, completedPeak),
          currentRepPeakLift: 0
        });
      }

      return {
        ...next,
        statusText: 'Keep lowering your hand'
      };
    }

    return {
      ...next,
      statusText: 'Lower your hand back to the start'
    };
  }

  if (next.phase === 'rep_complete') {
    if (features.leftHandClearlyDown) {
      return transitionMachine(next, 'ready', features.timestamp, 'Ready for the next rep', {
        holdMs: 0,
        currentRepPeakLift: Math.max(0, features.leftHandLiftNorm)
      });
    }

    return transitionMachine(next, 'idle', features.timestamp, 'Lower your left hand to reset', {
      holdMs: 0
    });
  }

  return next;
}
