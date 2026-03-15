import { SessionDefinition as BuilderSession } from "../sessionTypes";
import { SessionDefinition as RuntimeSession } from "./sessionTypes";

import {
  raiseRightHandExercise,
  raiseLeftHandExercise,
  raiseBothHandsExercise
} from "../exercises/catalog";

const exerciseMap: Record<string, any> = {
  raise_right_hand: raiseRightHandExercise,
  raise_left_hand: raiseLeftHandExercise,
  raise_both_hands: raiseBothHandsExercise,
};

export function convertBuilderSession(
  builder: BuilderSession
): RuntimeSession {

  return {
    id: "builder-session",
    title: builder.name,
    description: "Generated from Session Builder",
    items: builder.steps.map((step, index) => {
      const exercise = exerciseMap[step.exerciseId];

      return {
        id: `item-${index}`,
        exerciseId: step.exerciseId,
        exercise,
        repTarget: step.targetReps ?? 4,
        holdMs: step.targetHoldSeconds
          ? step.targetHoldSeconds * 1000
          : undefined,
        restAfterMs: step.restSeconds
          ? step.restSeconds * 1000
          : 1000,
        sideOverride: null,
        order: index + 1,
      };
    }),
  };
}
