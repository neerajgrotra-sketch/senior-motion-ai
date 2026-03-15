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

function enoughLift(lift: number | null, shoulderDeg: number | null): boolean {
  if (typeof lift === "number" && lift > 0.35) return true;
  if (typeof shoulderDeg === "number" && shoulderDeg > 60) return true;
  return false;
}

function velocityUp(value: number | null | undefined): boolean {
  return typeof value === "number" && value > 0.02;
}

function velocityDown(value: number | null | undefined): boolean {
  return typeof value === "number" && value < -0.02;
}

export function evaluateArmRaise(
  context: ExerciseEvaluationContext,
): ExerciseEvaluationResult {
  const { exercise, frame, phase } = context;

  const mode = getMode(exercise);

  const leftLift = frame.arms.left.verticalLiftNormalized ?? 0;
  const rightLift = frame.arms.right.verticalLiftNormalized ?? 0;

  const leftShoulder = frame.arms.left.shoulderFlexionDeg ?? 0;
  const rightShoulder = frame.arms.right.shoulderFlexionDeg ?? 0;

  const torsoLean = frame.torso.trunkLeanDeg ?? 0;

  const goodPosture = Math.abs(torsoLean) < 20;

  const leftUp = enoughLift(leftLift, leftShoulder);
  const rightUp = enoughLift(rightLift, rightShoulder);

  const leftMovingUp = velocityUp(frame.arms.left.movementVelocity);
  const rightMovingUp = velocityUp(frame.arms.right.movementVelocity);

  const leftMovingDown = velocityDown(frame.arms.left.movementVelocity);
  const rightMovingDown = velocityDown(frame.arms.right.movementVelocity);

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
    else if (phase === "ready" && (leftMovingUp || rightMovingUp)) {
      nextPhase = "moving_up";
    } else if (phase === "moving_up" && bothUp) {
      nextPhase = "at_top";
    } else if (phase === "at_top" && (leftMovingDown || rightMovingDown)) {
      nextPhase = "moving_down";
    } else if (phase === "moving_down" && bothStart) {
      nextPhase = "rep_complete";
    }
  }

  const repJustCompleted = nextPhase === "rep_complete";

  const activeSide: PoseSide | null =
    mode === "left" ? "left" : mode === "right" ? "right" : null;

  const formFlags: ExerciseFormFlags = {
    goodPosture,
    enoughLift: leftUp || rightUp,
    elbowAcceptable: true,
    movementDetected:
      leftMovingUp || rightMovingUp || leftMovingDown || rightMovingDown || leftUp || rightUp,
    bodyVisible: true,
  };

  return {
    detected: true,
    phase: nextPhase,
    repIncrement: repJustCompleted ? 1 : 0,
    repJustCompleted,
    activeSide,
    formFlags,
    confidence: 0.9,
    coachingCodes: [],
    debug: {
      phase,
      nextPhase,
      leftLift,
      rightLift,
      torsoLean,
      leftMovingUp,
      rightMovingUp,
      leftMovingDown,
      rightMovingDown,
    },
  };
}
