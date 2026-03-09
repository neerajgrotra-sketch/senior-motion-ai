import { createExerciseMachine, transitionMachine } from '../engine/exerciseStateMachine';
import type { ExerciseFrameFeatures, ExerciseMachine } from '../poseTypes';

const MIN_KEYPOINT_SCORE = 0.35;
const MIN_HOLD_MS = 500;
const UPWARD_VELOCITY_THRESHOLD = 0.008;
const DOWNWARD_VELOCITY_THRESHOLD = 0.008;

export function createBothHandsUpMachine(): ExerciseMachine {
  return {
    ...createExerciseMachine('Raise both hands'),
    currentRepPeakLift: 0,
    lastRepPeakLift: null,
    sessionPeakLift: 0
  };
}

export function advanceBothHandsUp(
  machine: ExerciseMachine,
  features: ExerciseFrameFeatures
): ExerciseMachine {
  const prev = machine.lastFeatures;

  const lowConfidence =
    features.leftWristScore < MIN_KEYPOINT_SCORE ||
    features.rightWristScore < MIN_KEYPOINT_SCORE ||
    features.leftShoulderScore < MIN_KEYPOINT_SCORE ||
    features.rightShoulderScore < MIN_KEYPOINT_SCORE ||
    features.leftElbowScore < MIN_KEYPOINT_SCORE ||
    features.rightElbowScore < MIN_KEYPOINT_SCORE;

  const peakLift = Math.max(machine.currentRepPeakLift, features.bothHandsLiftNorm);
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

  const leftUpVel =
    prev ? (prev.leftWristY - features.leftWristY) / Math.max(1, features.torsoLength) : 0;
  const rightUpVel =
    prev ? (prev.rightWristY - features.rightWristY) / Math.max(1, features.torsoLength) : 0;

  const leftDownVel =
    prev ? (features.leftWristY - prev.leftWristY) / Math.max(1, features.torsoLength) : 0;
  const rightDownVel =
    prev ? (features.rightWristY - prev.rightWristY) / Math.max(1, features.torsoLength) : 0;

  const movingUp =
    leftUpVel > UPWARD_VELOCITY_THRESHOLD && rightUpVel > UPWARD_VELOCITY_THRESHOLD;

  const movingDown =
    leftDownVel > DOWNWARD_VELOCITY_THRESHOLD && rightDownVel > DOWNWARD_VELOCITY_THRESHOLD;

  if (next.phase === 'lost' || next.phase === 'idle') {
    if (features.bothHandsClearlyDown) {
      return transitionMachine(next, 'ready', features.timestamp, 'Start with both hands down', {
        holdMs: 0,
        currentRepPeakLift: Math.max(0, features.bothHandsLiftNorm)
      });
    }

    return transitionMachine(next, 'idle', features.timestamp, 'Lower both hands to begin', {
      holdMs: 0
    });
  }

  if (next.phase === 'ready') {
    if (!features.bothHandsClearlyDown) {
      return transitionMachine(next, 'idle', features.timestamp, 'Lower both hands to begin', {
        holdMs: 0
      });
    }

    if (movingUp) {
      return transitionMachine(next, 'moving_up', features.timestamp, 'Good - lift both hands', {
        currentRepPeakLift: Math.max(0, features.bothHandsLiftNorm)
      });
    }

    return {
      ...next,
      holdMs: 0,
      statusText: 'Raise both hands'
    };
  }

  if (next.phase === 'moving_up') {
    if (features.bothHandsAboveShoulder) {
      return transitionMachine(next, 'at_top', features.timestamp, 'Great - reach the top', {
        holdMs: 0
      });
    }

    return {
      ...next,
      statusText: 'Keep lifting both hands'
    };
  }

  if (next.phase === 'at_top') {
    if (!features.bothHandsAboveShoulder) {
      return transitionMachine(next, 'moving_up', features.timestamp, 'Lift a little higher', {
        holdMs: 0
      });
    }

    return transitionMachine(next, 'holding', features.timestamp, 'Hold both hands up', {
      holdMs: 0
    });
  }

  if (next.phase === 'holding') {
    const holdMs = next.lastTransitionAt ? features.timestamp - next.lastTransitionAt : 0;

    if (!features.bothHandsAboveShoulder) {
      if (holdMs >= MIN_HOLD_MS) {
        return transitionMachine(next, 'moving_down', features.timestamp, 'Nice - lower both hands', {
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
      statusText: holdMs >= MIN_HOLD_MS ? 'Hold complete - now lower both hands' : 'Keep holding'
    };
  }

  if (next.phase === 'moving_down') {
    if (features.bothHandsClearlyDown || movingDown) {
      if (features.bothHandsClearlyDown) {
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
        statusText: 'Keep lowering both hands'
      };
    }

    return {
      ...next,
      statusText: 'Lower both hands back to the start'
    };
  }

  if (next.phase === 'rep_complete') {
    if (features.bothHandsClearlyDown) {
      return transitionMachine(next, 'ready', features.timestamp, 'Ready for the next rep', {
        holdMs: 0,
        currentRepPeakLift: Math.max(0, features.bothHandsLiftNorm)
      });
    }

    return transitionMachine(next, 'idle', features.timestamp, 'Lower both hands to reset', {
      holdMs: 0
    });
  }

  return next;
}
