// lib/coaching/buildCoachingOutput.ts

import { CoachingCue, CoachingOutput } from "./coachingTypes";
import { ExerciseDefinition } from "../exercises/exerciseTypes";

function toneForCode(code: string): CoachingCue["tone"] {
  switch (code) {
    case "good_rep":
      return "celebratory";
    case "lift_higher":
    case "keep_torso_upright":
    case "straighten_elbow":
    case "hold_position":
    case "lower_slowly":
    case "reset_position":
    case "switch_side":
      return "corrective";
    default:
      return "neutral";
  }
}

function speakForCode(code: string): boolean {
  switch (code) {
    case "good_rep":
    case "lift_higher":
    case "keep_torso_upright":
    case "switch_side":
      return true;
    default:
      return false;
  }
}

export function buildCoachingOutput(params: {
  exercise: ExerciseDefinition | null;
  coachingCodes: string[];
}): CoachingOutput {
  const { exercise, coachingCodes } = params;

  if (!exercise || coachingCodes.length === 0) {
    return {
      primary: null,
      secondary: [],
    };
  }

  const matchedRules = coachingCodes
    .map((code) => {
      const rule = exercise.coachingRules.find((r) => r.code === code);
      if (!rule) return null;

      const cue: CoachingCue = {
        code: rule.code,
        message: rule.message,
        tone: toneForCode(rule.code),
        priority: rule.priority,
        speak: speakForCode(rule.code),
      };

      return cue;
    })
    .filter((cue): cue is CoachingCue => Boolean(cue))
    .sort((a, b) => b.priority - a.priority);

  return {
    primary: matchedRules[0] ?? null,
    secondary: matchedRules.slice(1),
  };
}
