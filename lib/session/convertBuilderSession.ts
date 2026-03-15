import { SessionDefinition as BuilderSession } from "../sessionTypes";
import { SessionDefinition as RuntimeSession } from "./sessionTypes";
import type { ExerciseDefinition } from "../exercises/exerciseTypes";

import {
  raiseRightHandExercise,
  raiseLeftHandExercise,
  raiseBothHandsExercise,
} from "../exercises/catalog";

/**
 * Maps builder exercise ids to runtime exercise definitions.
 *
 * Important:
 * SessionBuilder currently emits:
 * - raise_right_hand
 * - raise_left_hand
 * - both_hands_up
 *
 * The previous version incorrectly used "raise_both_hands", which caused
 * the bilateral exercise to resolve to undefined and later crash the runner.
 */
const exerciseMap: Record<string, ExerciseDefinition> = {
  raise_right_hand: raiseRightHandExercise,
  raise_left_hand: raiseLeftHandExercise,
  both_hands_up: raiseBothHandsExercise,
};

export function convertBuilderSession(
  builder: BuilderSession,
): RuntimeSession {
  return {
    id: "builder-session",
    title: builder.name?.trim() || "Custom Session",
    description: "Generated from Session Builder",
    items: builder.steps.map((step, index) => {
      const exercise = exerciseMap[step.exerciseId];

      if (!exercise) {
        throw new Error(
          `Unsupported exerciseId in builder session: ${step.exerciseId}`,
        );
      }

      return {
        id: step.id || `item-${index + 1}`,
        exerciseId: step.exerciseId,
        exercise,
        repTarget: Math.max(1, step.targetReps ?? 3),
        holdMs:
          typeof step.targetHoldSeconds === "number"
            ? Math.max(0, step.targetHoldSeconds) * 1000
            : undefined,
        restAfterMs:
          typeof step.restSeconds === "number"
            ? Math.max(0, step.restSeconds) * 1000
            : 1000,
        sideOverride:
          step.exerciseId === "raise_right_hand"
            ? "right"
            : step.exerciseId === "raise_left_hand"
              ? "left"
              : step.exerciseId === "both_hands_up"
                ? "bilateral"
                : null,
        order: index + 1,
      };
    }),
  };
}
