// lib/runtime/createRuntimeEngine.ts

import { BiomechanicsFrame } from "../biomechanics/biomechanicsTypes";
import { buildCoachingOutput } from "../coaching/buildCoachingOutput";
import { ExerciseDefinition, ExerciseEvaluationResult } from "../exercises/exerciseTypes";
import { evaluateArmRaise } from "./evaluateArmRaise";
import {
  RuntimeEngineConfig,
  RuntimeExerciseState,
  RuntimeFrameResult,
  RuntimeRepState,
  RuntimeStatus,
} from "./runtimeTypes";

interface RuntimeEngine {
  setExercise: (exercise: ExerciseDefinition | null, repTarget?: number) => void;
  resetExerciseState: () => void;
  processFrame: (frame: BiomechanicsFrame) => RuntimeFrameResult;
  getState: () => RuntimeExerciseState | null;
  getStatus: () => RuntimeStatus;
}

const DEFAULT_CONFIG: RuntimeEngineConfig = {
  enableDebug: true,
  minPoseConfidence: 0.35,
  cooldownBetweenRepsMs: 500,
};

function createInitialRepState(nowMs: number | null = null): RuntimeRepState {
  return {
    phase: "idle",
    repCount: 0,
    lastRepTimestampMs: null,
    startedAtMs: nowMs,
    updatedAtMs: nowMs,
    activeSide: null,
  };
}

export function createRuntimeEngine(
  config?: Partial<RuntimeEngineConfig>,
): RuntimeEngine {
  const mergedConfig: RuntimeEngineConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let currentExercise: ExerciseDefinition | null = null;
  let currentRepTarget: number | null = null;
  let currentState: RuntimeExerciseState | null = null;
  let status: RuntimeStatus = "idle";

  let phaseStartedAtMs: number | null = null;
  let exerciseStartedAtMs: number | null = null;

  function ensureState(frameTimestampMs: number): RuntimeExerciseState | null {
    if (!currentExercise) return null;

    if (!currentState) {
      currentState = {
        exercise: currentExercise,
        repState: createInitialRepState(frameTimestampMs),
        lastEvaluation: null,
        completed: false,
      };

      exerciseStartedAtMs = frameTimestampMs;
      phaseStartedAtMs = frameTimestampMs;
    }

    return currentState;
  }

  function setExercise(exercise: ExerciseDefinition | null, repTarget?: number) {
    currentExercise = exercise;
    currentRepTarget = repTarget ?? exercise?.repTargetDefault ?? null;
    currentState = exercise
      ? {
          exercise,
          repState: createInitialRepState(null),
          lastEvaluation: null,
          completed: false,
        }
      : null;

    exerciseStartedAtMs = null;
    phaseStartedAtMs = null;
    status = exercise ? "ready" : "idle";
  }

  function resetExerciseState() {
    if (!currentExercise) {
      currentState = null;
      exerciseStartedAtMs = null;
      phaseStartedAtMs = null;
      status = "idle";
      return;
    }

    currentState = {
      exercise: currentExercise,
      repState: createInitialRepState(null),
      lastEvaluation: null,
      completed: false,
    };

    exerciseStartedAtMs = null;
    phaseStartedAtMs = null;
    status = "ready";
  }

  function processFrame(frame: BiomechanicsFrame): RuntimeFrameResult {
    if (!currentExercise) {
      status = "idle";
      return {
        status,
        exerciseState: null,
        coachingMessage: null,
        debug: {
          reason: "no_exercise",
        },
      };
    }

    const state = ensureState(frame.timestampMs);

    if (!state) {
      status = "error";
      return {
        status,
        exerciseState: null,
        coachingMessage: "No exercise state available.",
        debug: {
          reason: "state_init_failed",
        },
      };
    }

    if (!exerciseStartedAtMs) {
      exerciseStartedAtMs = frame.timestampMs;
    }

    if (!phaseStartedAtMs) {
      phaseStartedAtMs = frame.timestampMs;
    }

    const poseConfidence = frame.pose.visibility.visibilityScore;
    const poseStable = frame.pose.trackingStable;

    if (!poseStable || poseConfidence < mergedConfig.minPoseConfidence) {
      status = "waiting_for_pose";

      return {
        status,
        exerciseState: state,
        coachingMessage: "Please stay visible to the camera.",
        debug: {
          reason: !poseStable ? "unstable_pose" : "low_pose_confidence",
          poseStable,
          poseConfidence,
        },
      };
    }

    status = "running";

    const phaseElapsedMs = frame.timestampMs - phaseStartedAtMs;

    const evaluation = evaluateArmRaise({
      exercise: currentExercise,
      side: state.repState.activeSide,
      frame,
      elapsedMs: phaseElapsedMs,
      repCount: state.repState.repCount,
      phase: state.repState.phase,
      lastRepTimestampMs: state.repState.lastRepTimestampMs,
    });

    const previousPhase = state.repState.phase;
    const phaseChanged = evaluation.phase !== previousPhase;

    if (phaseChanged) {
      phaseStartedAtMs = frame.timestampMs;
    }

    let repCount = state.repState.repCount;
    let lastRepTimestampMs = state.repState.lastRepTimestampMs;

    if (evaluation.repJustCompleted) {
      repCount += evaluation.repIncrement;
      lastRepTimestampMs = frame.timestampMs;
    }

    const completed =
      currentRepTarget !== null && repCount >= currentRepTarget;

    const nextRepState: RuntimeRepState = {
      phase: completed ? "completed" : evaluation.phase,
      repCount,
      lastRepTimestampMs,
      startedAtMs: exerciseStartedAtMs,
      updatedAtMs: frame.timestampMs,
      activeSide:
        evaluation.activeSide === "left" || evaluation.activeSide === "right"
          ? evaluation.activeSide
          : null,
    };

    const nextState: RuntimeExerciseState = {
      exercise: currentExercise,
      repState: nextRepState,
      lastEvaluation: evaluation,
      completed,
    };

    currentState = nextState;

    if (completed) {
      status = "completed";
    }

    const coaching = buildCoachingOutput({
      exercise: currentExercise,
      coachingCodes: evaluation.coachingCodes,
    });

    return {
      status,
      exerciseState: currentState,
      coachingMessage: coaching.primary?.message ?? null,
      debug: {
        ...(mergedConfig.enableDebug ? evaluation.debug : {}),
        phaseElapsedMs,
        poseConfidence,
        poseStable,
        repTarget: currentRepTarget,
        completed,
        status,
      },
    };
  }

  function getState(): RuntimeExerciseState | null {
    return currentState;
  }

  function getStatus(): RuntimeStatus {
    return status;
  }

  return {
    setExercise,
    resetExerciseState,
    processFrame,
    getState,
    getStatus,
  };
}
