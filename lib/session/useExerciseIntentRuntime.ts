import { useMemo, useRef, useState } from "react";
import { evaluateExerciseIntent } from "../exercises/evaluateExerciseIntent";
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

  const api = useMemo<UseExerciseIntentRuntimeResult>(() => {
    return {
      state,

      reset: () => {
        stateRef.current = null;
        setState(null);
      },

      evaluate: ({ landmarks, timestampMs }: EvaluateArgs): IntentEvaluationResult => {
        const result = evaluateExerciseIntent({
          exercise,
          landmarks,
          previousState: stateRef.current,
          timestampMs,
        });

        const nextState: LiveIntentState | null = result.nextState ?? null;

        stateRef.current = nextState;
        setState(nextState);

        return result;
      },
    };
  }, [exercise, state]);

  return api;
}
