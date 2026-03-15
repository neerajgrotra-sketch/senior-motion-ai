import { BiomechanicsFrame } from "../biomechanics/biomechanicsTypes";
import { createRuntimeEngine } from "../runtime/createRuntimeEngine";
import { RuntimeFrameResult } from "../runtime/runtimeTypes";
import {
  SessionDefinition,
  SessionProgress,
  SessionRunnerState,
} from "./sessionTypes";

interface SessionRunnerFrameResult {
  sessionState: SessionRunnerState;
  runtimeResult: RuntimeFrameResult | null;
  justAdvancedExercise: boolean;
  justCompletedSession: boolean;
}

interface SessionRunnerEngine {
  loadSession: (session: SessionDefinition) => void;
  startSession: (startTimestampMs?: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  abortSession: () => void;
  processFrame: (frame: BiomechanicsFrame) => SessionRunnerFrameResult;
  getState: () => SessionRunnerState;
  markCameraActive: (active: boolean) => void;
}

function createEmptyProgress(): SessionProgress {
  return {
    currentIndex: 0,
    completedExerciseIds: [],
    totalExercises: 0,
    totalRepsCompleted: 0,
    currentExerciseStartedAtMs: null,
    sessionStartedAtMs: null,
    sessionEndedAtMs: null,
  };
}

function createInitialState(): SessionRunnerState {
  return {
    status: "draft",
    session: null,
    progress: createEmptyProgress(),
    currentItem: null,
    transition: {
      isTransitioning: false,
      transitionReason: "none",
      startedAtMs: null,
    },
    cameraActive: false,
    poseLoopActive: false,
  };
}

export function createSessionRunnerEngine(): SessionRunnerEngine {
  const runtime = createRuntimeEngine();

  let state: SessionRunnerState = createInitialState();
  let lastCountedRepTotal = 0;

  function syncCurrentItemFromIndex() {
    const session = state.session;
    if (!session) {
      state.currentItem = null;
      return;
    }

    state.currentItem = session.items[state.progress.currentIndex] ?? null;
  }

  function loadSession(session: SessionDefinition) {
    const sortedItems = [...session.items].sort((a, b) => a.order - b.order);

    state = {
      ...state,
      status: "ready",
      session: {
        ...session,
        items: sortedItems,
      },
      progress: {
        currentIndex: 0,
        completedExerciseIds: [],
        totalExercises: sortedItems.length,
        totalRepsCompleted: 0,
        currentExerciseStartedAtMs: null,
        sessionStartedAtMs: null,
        sessionEndedAtMs: null,
      },
      transition: {
        isTransitioning: false,
        transitionReason: "none",
        startedAtMs: null,
      },
      poseLoopActive: state.cameraActive,
    };

    syncCurrentItemFromIndex();

    const currentItem = state.currentItem;
    if (currentItem) {
      runtime.setExercise(currentItem.exercise, currentItem.repTarget);
    }

    lastCountedRepTotal = 0;
  }

  function startSession(_startTimestampMs?: number) {
    const currentItem = state.currentItem;
    if (!state.session || !currentItem) return;

    const startedAt = Date.now();

    state = {
      ...state,
      status: "running",
      progress: {
        ...state.progress,
        sessionStartedAtMs: startedAt,
        currentExerciseStartedAtMs: startedAt,
      },
      poseLoopActive: true,
      transition: {
        isTransitioning: false,
        transitionReason: "none",
        startedAtMs: null,
      },
    };

    runtime.setExercise(currentItem.exercise, currentItem.repTarget);
    lastCountedRepTotal = 0;
  }

  function pauseSession() {
    if (state.status !== "running") return;

    state = {
      ...state,
      status: "paused",
    };
  }

  function resumeSession() {
    if (state.status !== "paused") return;

    state = {
      ...state,
      status: "running",
    };
  }

  function abortSession() {
    state = {
      ...state,
      status: "aborted",
      progress: {
        ...state.progress,
        sessionEndedAtMs: Date.now(),
      },
      transition: {
        isTransitioning: false,
        transitionReason: "none",
        startedAtMs: null,
      },
    };
  }

  function advanceToNextExercise(): boolean {
    if (!state.session || !state.currentItem) return false;

    const completedId = state.currentItem.id;
    const nextIndex = state.progress.currentIndex + 1;
    const nextItem = state.session.items[nextIndex] ?? null;
    const now = Date.now();

    if (!nextItem) {
      state = {
        ...state,
        status: "completed",
        currentItem: null,
        progress: {
          ...state.progress,
          completedExerciseIds: [
            ...state.progress.completedExerciseIds,
            completedId,
          ],
          currentIndex: nextIndex,
          sessionEndedAtMs: now,
        },
        transition: {
          isTransitioning: true,
          transitionReason: "session_completed",
          startedAtMs: now,
        },
        poseLoopActive: true,
      };

      return false;
    }

    state = {
      ...state,
      currentItem: nextItem,
      progress: {
        ...state.progress,
        completedExerciseIds: [
          ...state.progress.completedExerciseIds,
          completedId,
        ],
        currentIndex: nextIndex,
        currentExerciseStartedAtMs: now,
      },
      transition: {
        isTransitioning: true,
        transitionReason: "next_exercise",
        startedAtMs: now,
      },
      poseLoopActive: true,
    };

    runtime.setExercise(nextItem.exercise, nextItem.repTarget);
    lastCountedRepTotal = 0;

    return true;
  }

  function processFrame(frame: BiomechanicsFrame): SessionRunnerFrameResult {
    if (!state.session || !state.currentItem) {
      return {
        sessionState: state,
        runtimeResult: null,
        justAdvancedExercise: false,
        justCompletedSession: state.status === "completed",
      };
    }

    if (state.status !== "running") {
      return {
        sessionState: state,
        runtimeResult: null,
        justAdvancedExercise: false,
        justCompletedSession: state.status === "completed",
      };
    }

    const runtimeResult = runtime.processFrame(frame);
    const exerciseState = runtimeResult.exerciseState;

    if (exerciseState) {
      const currentRepCount = exerciseState.repState.repCount;
      const delta = Math.max(0, currentRepCount - lastCountedRepTotal);

      if (delta > 0) {
        state = {
          ...state,
          progress: {
            ...state.progress,
            totalRepsCompleted: state.progress.totalRepsCompleted + delta,
          },
        };
        lastCountedRepTotal = currentRepCount;
      }
    }

    let justAdvancedExercise = false;
    let justCompletedSession = false;

    if (runtimeResult.status === "completed") {
      const advanced = advanceToNextExercise();
      justAdvancedExercise = advanced;
      justCompletedSession = !advanced && state.status === "completed";
    } else {
      state = {
        ...state,
        transition: {
          isTransitioning: false,
          transitionReason: "none",
          startedAtMs: null,
        },
      };
    }

    return {
      sessionState: state,
      runtimeResult,
      justAdvancedExercise,
      justCompletedSession,
    };
  }

  function getState(): SessionRunnerState {
    return state;
  }

  function markCameraActive(active: boolean) {
    state = {
      ...state,
      cameraActive: active,
      poseLoopActive: active ? state.poseLoopActive || state.status === "running" : false,
    };
  }

  return {
    loadSession,
    startSession,
    pauseSession,
    resumeSession,
    abortSession,
    processFrame,
    getState,
    markCameraActive,
  };
}
