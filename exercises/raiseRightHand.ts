import { createExerciseMachine, transitionMachine } from '../engine/exerciseStateMachine';
import type { ExerciseFrameFeatures, ExerciseMachine } from '../poseTypes';

const MIN_KEYPOINT_SCORE = 0.35;
const MIN_HOLD_MS = 500;
const UPWARD_VELOCITY_THRESHOLD = 0.008;
const DOWNWARD_VELOCITY_THRESHOLD = 0.008;

export function createRaiseRightHandMachine(): ExerciseMachine {
  return createExerciseMachine('Raise your right hand');
}

export function advanceRaiseRightHand(
  machine: ExerciseMachine,
  features: ExerciseFrameFeatures
): ExerciseMachine {
  const prev = machine.lastFeatures;

  const lowConfidence =
    features.rightWristScore < MIN_KEYPOINT_SCORE ||
    features.rightShoulderScore < MIN_KEYPOINT_SCORE ||
    features.rightElbowScore < MIN_KEYPOINT_SCORE;

  if (lowConfidence) {
    return {
      ...machine,
      phase: 'lost',
      holdMs: 0,
      statusText: 'Low confidence - keep your full body visible',
      lastFeatures: features,
      lastTimestamp: features.timestamp
    };
  }

  const upwardVelocityNorm =
    prev ? (prev.rightWristY - features.rightWristY) / Math.max(1, features.torsoLength) : 0;

  const downwardVelocityNorm =
    prev ? (features.rightWristY - prev.rightWristY) / Math.max(1, features.torsoLength) : 0;

  let next = { ...machine, lastFeatures: features, lastTimestamp: features.timestamp };

  if (next.phase === 'lost' || next.phase === 'idle') {
    if (features.rightHandClearlyDown) {
      return transitionMachine(next, 'ready', features.timestamp, 'Start with your right hand down', {
        holdMs: 0
      });
    }

    return transitionMachine(next, 'idle', features.timestamp, 'Lower your right hand to begin', {
      holdMs: 0
    });
  }

  if (next.phase === 'ready') {
    if (!features.rightHandClearlyDown) {
      return transitionMachine(next, 'idle', features.timestamp, 'Lower your right hand to begin', {
        holdMs: 0
      });
    }

    if (upwardVelocityNorm > UPWARD_VELOCITY_THRESHOLD) {
      return transitionMachine(next, 'moving_up', features.timestamp, 'Good - lift your right hand');
    }

    return {
      ...next,
      holdMs: 0,
      statusText: 'Raise your right hand'
    };
  }

  if (next.phase === 'moving_up') {
    if (features.rightHandAboveShoulder) {
      return transitionMachine(next, 'at_top', features.timestamp, 'Great - reach the top', {
        holdMs: 0
      });
    }

    return {
      ...next,
      statusText: 'Keep lifting your right hand'
    };
  }

  if (next.phase === 'at_top') {
    if (!features.rightHandAboveShoulder) {
      return transitionMachine(next, 'moving_up', features.timestamp, 'Lift a little higher', {
        holdMs: 0
      });
    }

    return transitionMachine(next, 'holding', features.timestamp, 'Hold your hand up', {
      holdMs: 0
    });
  }

  if (next.phase === 'holding') {
    const holdMs = next.lastTransitionAt
      ? features.timestamp - next.lastTransitionAt
      : 0;

    if (!features.rightHandAboveShoulder) {
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
    if (features.rightHandClearlyDown || downwardVelocityNorm > DOWNWARD_VELOCITY_THRESHOLD) {
      if (features.rightHandClearlyDown) {
        return transitionMachine(next, 'rep_complete', features.timestamp, 'Rep complete', {
          repCount: next.repCount + 1,
          lastCompletedAt: features.timestamp
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
    if (features.rightHandClearlyDown) {
      return transitionMachine(next, 'ready', features.timestamp, 'Ready for the next rep', {
        holdMs: 0
      });
    }

    return transitionMachine(next, 'idle', features.timestamp, 'Lower your right hand to reset', {
      holdMs: 0
    });
  }

  return next;
}
