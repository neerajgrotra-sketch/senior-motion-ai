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

interface SideSnapshot {
  side: "left" | "right";
  visible: boolean;
  lift: number | null;
  shoulderFlexionDeg: number | null;
  elbowFlexionDeg: number | null;
  wristAboveShoulder: boolean;
  movingUp: boolean;
  movingDown: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getMode(exercise: ExerciseDefinition): ArmRaiseMode {
  if (exercise.sideMode === "left") return "left";
  if (exercise.sideMode === "right") return "right";
  return "bilateral";
}

function readSide(frame: BiomechanicsFrame, side: "left" | "right"): SideSnapshot {
  const arm = frame.arms[side];
  const wrist = frame.pose.keypoints[`${side}_wrist`];
  const shoulder = frame.pose.keypoints[`${side}_shoulder`];
  const elbow = frame.pose.keypoints[`${side}_elbow`];

  const visible =
    wrist.present &&
    shoulder.present &&
    elbow.present &&
    wrist.visibility >= 0.2 &&
    shoulder.visibility >= 0.2 &&
    elbow.visibility >= 0.2;

  const velocity = arm.movementVelocity;

  return {
    side,
    visible,
    lift: arm.verticalLiftNormalized,
    shoulderFlexionDeg: arm.shoulderFlexionDeg,
    elbowFlexionDeg: arm.elbowFlexionDeg,
    wristAboveShoulder: arm.wristAboveShoulder,
    movingUp: isFiniteNumber(velocity) ? velocity > 0.02 : false,
    movingDown: isFiniteNumber(velocity) ? velocity < -0.02 : false,
  };
}

function computeEnoughLift(
  snapshot: SideSnapshot,
  minLiftNormalized: number,
  minShoulderFlexionDeg: number,
): boolean {
  const byLift =
    isFiniteNumber(snapshot.lift) && snapshot.lift >= minLiftNormalized;

  const byShoulder =
    isFiniteNumber(snapshot.shoulderFlexionDeg) &&
    snapshot.shoulderFlexionDeg >= minShoulderFlexionDeg;

  return byLift || byShoulder || snapshot.wristAboveShoulder;
}

function computeElbowAcceptable(
  snapshot: SideSnapshot,
  minElbowExtensionDeg: number,
): boolean {
  if (!isFiniteNumber(snapshot.elbowFlexionDeg)) {
    return false;
  }

  return snapshot.elbowFlexionDeg >= minElbowExtensionDeg;
}

function getDominantCoachingCodes(input: {
  enoughLift: boolean;
  goodPosture: boolean;
  elbowAcceptable: boolean;
  atTop: boolean;
  lowering: boolean;
  repJustCompleted: boolean;
  phase: ExerciseIntentPhase;
}): string[] {
  if (!input.goodPosture) {
    return ["keep_torso_upright"];
  }

  if (!input.enoughLift) {
    return ["lift_higher"];
  }

  if (!input.elbowAcceptable) {
    return ["straighten_elbow"];
  }

  if (input.atTop && input.phase === "at_top") {
    return ["hold_position"];
  }

  if (input.lowering && input.phase === "moving_down") {
    return ["lower_slowly"];
  }

  if (input.repJustCompleted) {
    return ["good_rep"];
  }

  if (input.phase === "idle" || input.phase === "ready") {
    return ["reset_position"];
  }

  return [];
}

function resolvePhaseSingleSide(params: {
  previousPhase: ExerciseIntentPhase;
  enoughLift: boolean;
  movingUp: boolean;
  movingDown: boolean;
  inStartZone: boolean;
  holdSatisfied: boolean;
}): ExerciseIntentPhase {
  const {
    previousPhase,
    enoughLift,
    movingUp,
    movingDown,
    inStartZone,
    holdSatisfied,
  } = params;

  switch (previousPhase) {
    case "idle":
      return inStartZone ? "ready" : "idle";

    case "ready":
      if (enoughLift && movingUp) return "moving_up";
      if (!inStartZone) return "idle";
      return "ready";

    case "moving_up":
      if (enoughLift) return holdSatisfied ? "at_top" : "moving_up";
      if (inStartZone) return "ready";
      return "moving_up";

    case "at_top":
      if (movingDown) return "moving_down";
      if (!enoughLift) return "moving_down";
      return "at_top";

    case "moving_down":
      if (inStartZone) return "rep_complete";
      return "moving_down";

    case "rep_complete":
      return inStartZone ? "ready" : "idle";

    case "completed":
    case "error":
    default:
      return previousPhase;
  }
}

function resolvePhaseBilateral(params: {
  previousPhase: ExerciseIntentPhase;
  leftEnoughLift: boolean;
  rightEnoughLift: boolean;
  leftMovingUp: boolean;
  rightMovingUp: boolean;
  leftMovingDown: boolean;
  rightMovingDown: boolean;
  bothInStartZone: boolean;
  holdSatisfied: boolean;
}): ExerciseIntentPhase {
  const {
    previousPhase,
    leftEnoughLift,
    rightEnoughLift,
    leftMovingUp,
    rightMovingUp,
    leftMovingDown,
    rightMovingDown,
    bothInStartZone,
    holdSatisfied,
  } = params;

  const bothRaised = leftEnoughLift && rightEnoughLift;
  const bothMovingUp = leftMovingUp || rightMovingUp;
  const bothMovingDown = leftMovingDown || rightMovingDown;

  switch (previousPhase) {
    case "idle":
      return bothInStartZone ? "ready" : "idle";

    case "ready":
      if (bothRaised && bothMovingUp) return "moving_up";
      if (!bothInStartZone) return "idle";
      return "ready";

    case "moving_up":
      if (bothRaised) return holdSatisfied ? "at_top" : "moving_up";
      if (bothInStartZone) return "ready";
      return "moving_up";

    case "at_top":
      if (bothMovingDown || !bothRaised) return "moving_down";
      return "at_top";

    case "moving_down":
      if (bothInStartZone) return "rep_complete";
      return "moving_down";

    case "rep_complete":
      return bothInStartZone ? "ready" : "idle";

    case "completed":
    case "error":
    default:
      return previousPhase;
  }
}

export function evaluateArmRaise(
  context: ExerciseEvaluationContext,
): ExerciseEvaluationResult {
  const { exercise, frame, phase, lastRepTimestampMs } = context;
  const thresholds = exercise.thresholds;

  const minLiftNormalized = thresholds.minLiftNormalized ?? 0.35;
  const minShoulderFlexionDeg = thresholds.minShoulderFlexionDeg ?? 60;
  const maxTorsoLeanDeg = thresholds.maxTorsoLeanDeg ?? 20;
  const minElbowExtensionDeg = thresholds.minElbowExtensionDeg ?? 120;
  const minHoldMs = thresholds.minHoldMs ?? 150;
  const minRepGapMs = thresholds.minRepGapMs ?? 500;

  const mode = getMode(exercise);

  const left = readSide(frame, "left");
  const right = readSide(frame, "right");

  const leftEnoughLift = computeEnoughLift(
    left,
    minLiftNormalized,
    minShoulderFlexionDeg,
  );
  const rightEnoughLift = computeEnoughLift(
    right,
    minLiftNormalized,
    minShoulderFlexionDeg,
  );

  const leftElbowAcceptable = computeElbowAcceptable(left, minElbowExtensionDeg);
  const rightElbowAcceptable = computeElbowAcceptable(
    right,
    minElbowExtensionDeg,
  );

  const torsoLean = frame.torso.trunkLeanDeg;
  const goodPosture =
    isFiniteNumber(torsoLean) ? Math.abs(torsoLean) <= maxTorsoLeanDeg : false;

  const leftInStartZone =
    isFiniteNumber(left.lift) ? left.lift <= 0.12 : false;
  const rightInStartZone =
    isFiniteNumber(right.lift) ? right.lift <= 0.12 : false;

  const nowAtTop =
    phase === "moving_up" || phase === "at_top" ? context.elapsedMs : 0;
  const holdSatisfied = nowAtTop >= minHoldMs;

  let nextPhase: ExerciseIntentPhase = phase;
  let activeSide: PoseSide | null = null;
  let detected = false;
  let enoughLift = false;
  let elbowAcceptable = false;
  let movementDetected = false;
  let bodyVisible = false;

  if (mode === "left") {
    activeSide = "left";
    detected = left.visible;
    enoughLift = leftEnoughLift;
    elbowAcceptable = leftElbowAcceptable;
    movementDetected = left.movingUp || left.movingDown || leftEnoughLift;
    bodyVisible = left.visible && frame.pose.visibility.isBodySufficientlyVisible;

    nextPhase = resolvePhaseSingleSide({
      previousPhase: phase,
      enoughLift: leftEnoughLift,
      movingUp: left.movingUp,
      movingDown: left.movingDown,
      inStartZone: leftInStartZone,
      holdSatisfied,
    });
  } else if (mode === "right") {
    activeSide = "right";
    detected = right.visible;
    enoughLift = rightEnoughLift;
    elbowAcceptable = rightElbowAcceptable;
    movementDetected = right.movingUp || right.movingDown || rightEnoughLift;
    bodyVisible = right.visible && frame.pose.visibility.isBodySufficientlyVisible;

    nextPhase = resolvePhaseSingleSide({
      previousPhase: phase,
      enoughLift: rightEnoughLift,
      movingUp: right.movingUp,
      movingDown: right.movingDown,
      inStartZone: rightInStartZone,
      holdSatisfied,
    });
  } else {
    activeSide = null;
    detected = left.visible && right.visible;
    enoughLift = leftEnoughLift && rightEnoughLift;
    elbowAcceptable = leftElbowAcceptable && rightElbowAcceptable;
    movementDetected =
      left.movingUp ||
      right.movingUp ||
      left.movingDown ||
      right.movingDown ||
      enoughLift;
    bodyVisible =
      left.visible &&
      right.visible &&
      frame.pose.visibility.isBodySufficientlyVisible;

    nextPhase = resolvePhaseBilateral({
      previousPhase: phase,
      leftEnoughLift,
      rightEnoughLift,
      leftMovingUp: left.movingUp,
      rightMovingUp: right.movingUp,
      leftMovingDown: left.movingDown,
      rightMovingDown: right.movingDown,
      bothInStartZone: leftInStartZone && rightInStartZone,
      holdSatisfied,
    });
  }

  const cooldownOk =
    lastRepTimestampMs === null ||
    frame.timestampMs - lastRepTimestampMs >= minRepGapMs;

  const repJustCompleted = nextPhase === "rep_complete" && cooldownOk;
  const repIncrement: 0 | 1 = repJustCompleted ? 1 : 0;

  const formFlags: ExerciseFormFlags = {
    goodPosture,
    enoughLift,
    elbowAcceptable,
    movementDetected,
    bodyVisible,
  };

  const coachingCodes = getDominantCoachingCodes({
    enoughLift,
    goodPosture,
    elbowAcceptable,
    atTop: nextPhase === "at_top",
    lowering: nextPhase === "moving_down",
    repJustCompleted,
    phase: nextPhase,
  });

  const confidence = (() => {
    let score = 0;

    if (detected) score += 0.25;
    if (bodyVisible) score += 0.2;
    if (movementDetected) score += 0.15;
    if (enoughLift) score += 0.2;
    if (elbowAcceptable) score += 0.1;
    if (goodPosture) score += 0.1;

    return Math.max(0, Math.min(1, score));
  })();

  return {
    detected,
    phase: nextPhase,
    repIncrement,
    repJustCompleted,
    formFlags,
    activeSide,
    confidence,
    coachingCodes,
    debug: {
      mode,
      currentPhase: phase,
      nextPhase,
      cooldownOk,
      torsoLean,
      minLiftNormalized,
      minShoulderFlexionDeg,
      minElbowExtensionDeg,
      leftLift: left.lift,
      rightLift: right.lift,
      leftShoulderFlexionDeg: left.shoulderFlexionDeg,
      rightShoulderFlexionDeg: right.shoulderFlexionDeg,
      leftElbowFlexionDeg: left.elbowFlexionDeg,
      rightElbowFlexionDeg: right.elbowFlexionDeg,
      leftEnoughLift,
      rightEnoughLift,
      leftElbowAcceptable,
      rightElbowAcceptable,
      leftMovingUp: left.movingUp,
      rightMovingUp: right.movingUp,
      leftMovingDown: left.movingDown,
      rightMovingDown: right.movingDown,
      leftInStartZone,
      rightInStartZone,
      holdSatisfied,
      detected,
      bodyVisible,
      enoughLift,
      elbowAcceptable,
      goodPosture,
      repJustCompleted,
    },
  };
}
