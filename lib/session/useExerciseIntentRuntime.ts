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
  args: UseExerciseIntentRuntimeArgs,
): UseExerciseIntentRuntimeResult {
  const { exercise } = args;

  const [state, setState] = useState<LiveIntentState | null>(null);
  const stateRef = useRef<LiveIntentState | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const api = useMemo<UseExerciseIntentRuntimeResult>(() => {
    return {
      state,

      reset: () => {
        stateRef.current = null;
        lastTimestampRef.current = null;
        setState(null);
      },

      evaluate: ({ landmarks, timestampMs }: EvaluateArgs): IntentEvaluationResult => {
        const previousState =
          stateRef.current ?? createInitialIntentState(exercise, timestampMs);

        const previousTimestamp = lastTimestampRef.current ?? timestampMs;
        const deltaMs = Math.max(0, timestampMs - previousTimestamp);

        const result = evaluateExerciseIntent({
          exercise,
          landmarks,
          previousState,
          nowMs: timestampMs,
          deltaMs,
        });

        const nextState: LiveIntentState = result.nextState ?? previousState;

        stateRef.current = nextState;
        lastTimestampRef.current = timestampMs;
        setState(nextState);

        return result;
      },
    };
  }, [exercise, state]);

  return api;
}
