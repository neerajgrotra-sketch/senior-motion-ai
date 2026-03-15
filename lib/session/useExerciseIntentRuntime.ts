/**
 * useExerciseIntentRuntime.ts
 *
 * ------------------------------------------------------------------
 * PURPOSE
 * ------------------------------------------------------------------
 * This hook is part of the *legacy exercise intent runtime system*.
 *
 * It acts as a small state container around the old
 * `evaluateExerciseIntent()` evaluator so React components can:
 *
 *  - maintain exercise evaluation state across frames
 *  - feed pose landmarks into the evaluator
 *  - update the state machine returned by the evaluator
 *  - expose the latest runtime state to the UI
 *
 * ------------------------------------------------------------------
 * CONTEXT IN THE REPO
 * ------------------------------------------------------------------
 * The project is currently transitioning to a new architecture:
 *
 * Camera → PoseFrame → BiomechanicsFrame → RuntimeEngine → SessionRunner
 *
 * However, parts of the older intent-engine system still exist in the
 * repository. This hook is kept only to allow those legacy files to
 * compile and run while the new biomechanics engine is being built.
 *
 * Long-term this file will likely be removed once the new runtime
 * architecture fully replaces the intent-engine system.
 *
 * ------------------------------------------------------------------
 * KEY RESPONSIBILITIES
 * ------------------------------------------------------------------
 * 1. Hold the current LiveIntentState
 * 2. Provide a reset() function
 * 3. Provide evaluate() which feeds pose landmarks to the evaluator
 * 4. Track timestamps to compute deltaMs between frames
 */

import { useMemo, useRef, useState } from "react";

import {
  createInitialIntentState,
  evaluateExerciseIntent,
} from "../exercises/evaluateExerciseIntent";

import type {
  ExerciseIntentModel,
  IntentEvaluationResult,
  LiveIntentState,
  PoseLandmarks,
} from "../exercises/exerciseIntentTypes";


type UseExerciseIntentRuntimeArgs = {
  exercise: ExerciseIntentModel;
};

type EvaluateArgs = {
  landmarks: PoseLandmarks;
  timestampMs: number;
};

type UseExerciseIntentRuntimeResult = {
  state: LiveIntentState | null;
  reset: () => void;
  evaluate: (args: EvaluateArgs) => IntentEvaluationResult;
};


export function useExerciseIntentRuntime(
  args: UseExerciseIntentRuntimeArgs
): UseExerciseIntentRuntimeResult {

  const { exercise } = args;

  // React-visible state
  const [state, setState] = useState<LiveIntentState | null>(null);

  // Internal mutable refs
  const stateRef = useRef<LiveIntentState | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const api = useMemo<UseExerciseIntentRuntimeResult>(() => {

    return {

      state,

      /**
       * Reset the runtime completely.
       */
      reset: () => {
        stateRef.current = null;
        lastTimestampRef.current = null;
        setState(null);
      },

      /**
       * Evaluate one frame of pose data.
       */
      evaluate: ({ landmarks, timestampMs }: EvaluateArgs): IntentEvaluationResult => {

        /**
         * Ensure evaluator always receives a valid previous state.
         * If none exists yet we create the initial state.
         */
        const previousState =
          stateRef.current ?? createInitialIntentState(exercise, timestampMs);

        /**
         * Calculate frame delta time.
         */
        const previousTimestamp = lastTimestampRef.current ?? timestampMs;
        const deltaMs = Math.max(0, timestampMs - previousTimestamp);

        /**
         * Run the legacy evaluator.
         */
        const result = evaluateExerciseIntent({
          exercise,
          landmarks,
          previousState,
          nowMs: timestampMs,
          deltaMs,
        });

        /**
         * Evaluator may omit nextState so fallback safely.
         */
        const nextState: LiveIntentState =
          result.nextState ?? previousState;

        stateRef.current = nextState;
        lastTimestampRef.current = timestampMs;

        setState(nextState);

        return result;
      },
    };

  }, [exercise, state]);

  return api;
}
