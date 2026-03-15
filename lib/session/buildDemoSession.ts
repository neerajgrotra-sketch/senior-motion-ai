// lib/session/buildDemoSession.ts

import { raiseBothHandsExercise, raiseLeftHandExercise, raiseRightHandExercise } from "../exercises/catalog";
import { SessionDefinition } from "./sessionTypes";

export function buildDemoSession(): SessionDefinition {
  return {
    id: "demo-session-001",
    title: "Upper Body Demo Session",
    description: "A simple demo session for validating right, left, and bilateral arm raises.",
    items: [
      {
        id: "item-raise-right",
        exerciseId: raiseRightHandExercise.id,
        exercise: raiseRightHandExercise,
        repTarget: 4,
        order: 1,
        sideOverride: "right",
        restAfterMs: 1000,
      },
      {
        id: "item-raise-left",
        exerciseId: raiseLeftHandExercise.id,
        exercise: raiseLeftHandExercise,
        repTarget: 4,
        order: 2,
        sideOverride: "left",
        restAfterMs: 1000,
      },
      {
        id: "item-raise-both",
        exerciseId: raiseBothHandsExercise.id,
        exercise: raiseBothHandsExercise,
        repTarget: 4,
        order: 3,
        sideOverride: "bilateral",
        restAfterMs: 1000,
      },
    ],
  };
}
