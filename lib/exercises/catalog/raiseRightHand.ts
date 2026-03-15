// lib/exercises/catalog/raiseRightHand.ts

import { ExerciseDefinition } from "../exerciseTypes";

export const raiseRightHandExercise: ExerciseDefinition = {
  id: "raise-right-hand",
  slug: "raise-right-hand",
  title: "Raise Right Hand",
  description: "Lift your right arm upward and lower it back down with control.",
  category: "upper_body",
  sideMode: "right",
  targetPosture: "either",
  repTargetDefault: 8,
  thresholds: {
    minLiftNormalized: 0.35,
    minShoulderFlexionDeg: 60,
    maxTorsoLeanDeg: 20,
    minElbowExtensionDeg: 120,
    minHoldMs: 150,
    minRepGapMs: 500,
  },
  coachingRules: [
    {
      code: "lift_higher",
      priority: 100,
      message: "Raise your right arm a little higher.",
    },
    {
      code: "keep_torso_upright",
      priority: 90,
      message: "Keep your torso upright.",
    },
    {
      code: "straighten_elbow",
      priority: 80,
      message: "Try to keep your right elbow straighter.",
    },
    {
      code: "hold_position",
      priority: 70,
      message: "Hold the top position briefly.",
    },
    {
      code: "lower_slowly",
      priority: 60,
      message: "Lower your arm slowly.",
    },
    {
      code: "good_rep",
      priority: 50,
      message: "Good rep.",
    },
    {
      code: "reset_position",
      priority: 40,
      message: "Return to the starting position.",
    },
  ],
};
