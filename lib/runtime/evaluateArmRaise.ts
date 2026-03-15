// lib/runtime/evaluateArmRaise.ts

import { BiomechanicsFrame } from "../biomechanics/biomechanicsTypes";
import {
  ExerciseDefinition,
  ExerciseEvaluationContext,
  ExerciseEvaluationResult,
  ExerciseFormFlags,
  ExerciseIntentPhase,
} from "../exercises/exerciseTypes";
import { PoseSide } from "../pose/poseTypes";

type ArmRaiseMode = "left" | "right" | "bilateral";

function getMode(exercise: ExerciseDefinition): ArmRaiseMode {
  if (exercise.sideMode === "left") return "left";
  if (exercise.sideMode === "right") return "right";
  return "bilateral";
}

function enoughLift(lift: number | null, shoulderDeg: number | null) {
  if (lift !== null && lift > 0.35) return true;
  if (shoulderDeg !== null && shoulderDeg > 60) return true;
  return false;
}

export function evaluateArmRaise(
  context: ExerciseEvaluationContext
): ExerciseEvaluationResult {

  const { exercise, frame, phase, lastRepTimestampMs } = context;

  const mode = getMode(exercise);

  const leftLift = frame.arms.left.verticalLiftNormalized ?? 0;
  const rightLift = frame.arms.right.verticalLiftNormalized ?? 0;

  const leftShoulder = frame.arms.left.shoulderFlexionDeg ?? 0;
  const rightShoulder = frame.arms.right.shoulderFlexionDeg ?? 0;

  const torsoLean = frame.torso.trunkLeanDeg ?? 0;

  const goodPosture = Math.abs(torsoLean) < 20;

  const leftUp = enoughLift(leftLift, leftShoulder);
  const rightUp = enoughLift(rightLift, rightShoulder);

  const leftMovingUp = frame.arms.left.movementVelocity > 0.02;
  const rightMovingUp = frame.arms.right.movementVelocity > 0.02;

  const leftMovingDown = frame.arms.left.movementVelocity < -0.02;
  const rightMovingDown = frame.arms.right.movementVelocity < -0.02;

  const leftStart = leftLift < 0.12;
  const rightStart = rightLift < 0.12;

  let nextPhase: ExerciseIntentPhase = phase;

  if (mode === "right") {

    if (phase === "idle" && rightStart) nextPhase = "ready";

    else if (phase === "ready" && rightMovingUp) nextPhase = "moving_up";

    else if (phase === "moving_up" && rightUp) nextPhase = "at_top";

    else if (phase === "at_top" && rightMovingDown) nextPhase = "moving_down";

    else if (phase === "moving_down" && rightStart) nextPhase = "rep_complete";

  }

  if (mode === "left") {

    if (phase === "idle" && leftStart) nextPhase = "ready";

    else if (phase === "ready" && leftMovingUp) nextPhase = "moving_up";

    else if (phase === "moving_up" && leftUp) nextPhase = "at_top";

    else if (phase === "at_top" && leftMovingDown) nextPhase = "moving_down";

    else if (phase === "moving_down" && leftStart) nextPhase = "rep_complete";

  }

  if (mode === "bilateral") {

    const bothUp = leftUp && rightUp;
    const bothStart = leftStart && rightStart;

    if (phase === "idle" && bothStart) nextPhase = "ready";

    else if (phase === "ready" && (leftMovingUp || rightMovingUp))
      nextPhase = "moving_up";

    else if (phase === "moving_up" && bothUp)
      nextPhase = "at_top";

    else if (phase === "at_top" && (leftMovingDown || rightMovingDown))
      nextPhase = "moving_down";

    else if (phase === "moving_down" && bothStart)
      nextPhase = "rep_complete";

  }

  const repJustCompleted = nextPhase === "rep_complete";

  const formFlags: ExerciseFormFlags = {
    goodPosture,
    enoughLift: leftUp || rightUp,
    elbowAcceptable: true,
    movementDetected: true,
    bodyVisible: true,
  };

  return {
    detected: true,
    phase: nextPhase,
    repIncrement: repJustCompleted ? 1 : 0,
    repJustCompleted,
    activeSide: mode === "left" ? "left" : mode === "right" ? "right" : null,
    formFlags,
    confidence: 0.9,
    coachingCodes: [],
    debug: {
      phase,
      nextPhase,
      leftLift,
      rightLift,
      torsoLean,
    },
  };
}
