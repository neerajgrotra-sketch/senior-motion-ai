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

/**
 * Small bias so movement guidance wins over posture correction when both
 * are present at similar priority. This helps avoid the UI getting stuck on
 * "Keep your torso upright" during the whole rep.
 */
function coachingBias(code: string): number {
  switch (code) {
    case "good_rep":
      return 40;
    case "lift_higher":
      return 25;
    case "lower_slowly":
      return 18;
    case "hold_position":
      return 15;
    case "reset_position":
      return 10;
    case "switch_side":
      return 8;
    case "straighten_elbow":
      return 5;
    case "keep_torso_upright":
      return -5;
    default:
      return 0;
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

  const dedupedCodes = [...new Set(coachingCodes)];

  const matchedRules = dedupedCodes
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
    .sort((a, b) => {
      const aScore = a.priority + coachingBias(a.code);
      const bScore = b.priority + coachingBias(b.code);
      return bScore - aScore;
    });

  return {
    primary: matchedRules[0] ?? null,
    secondary: matchedRules.slice(1),
  };
}
