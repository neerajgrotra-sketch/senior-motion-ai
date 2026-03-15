// lib/exercises/catalog/raiseBothHands.ts

import { ExerciseDefinition } from "../exerciseTypes";

export const raiseBothHandsExercise: ExerciseDefinition = {
  id: "raise-both-hands",
  slug: "raise-both-hands",
  title: "Raise Both Hands",
  description: "Lift both arms upward together and lower them back down with control.",
  category: "upper_body",
  sideMode: "bilateral",
  targetPosture: "either",
  repTargetDefault: 8,
  thresholds: {
    minLiftNormalized: 0.35,
    minShoulderFlexionDeg: 60,
    maxTorsoLeanDeg: 20,
    minElbowExtensionDeg: 120,
    minHoldMs: 150,
    minRepGapMs: 600,
  },
  coachingRules: [
    {
      code: "lift_higher",
      priority: 100,
      message: "Raise both arms a little higher.",
    },
    {
      code: "keep_torso_upright",
      priority: 90,
      message: "Keep your torso upright.",
    },
    {
      code: "straighten_elbow",
      priority: 80,
      message: "Try to keep both elbows straighter.",
    },
    {
      code: "hold_position",
      priority: 70,
      message: "Hold the top position briefly.",
    },
    {
      code: "lower_slowly",
      priority: 60,
      message: "Lower both arms slowly.",
    },
    {
      code: "good_rep",
      priority: 50,
      message: "Great rep.",
    },
    {
      code: "reset_position",
      priority: 40,
      message: "Return both arms to the starting position.",
    },
  ],
};
