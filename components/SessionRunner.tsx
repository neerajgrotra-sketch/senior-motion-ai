'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import PoseTrackerPage from './PoseTrackerPage';
import { EXERCISE_REGISTRY } from '../lib/exercises/exerciseRegistry';
import { rightArmRaiseIntent } from '../lib/exercises/rightArmRaiseIntent';
import { leftArmRaiseIntent } from '../lib/exercises/leftArmRaiseIntent';
import { seatedKneeLiftIntent } from '../lib/exercises/seatedKneeLiftIntent';
import type { ExerciseIntentModel, PoseLandmarks } from '../lib/exercises/exerciseIntentTypes';
import { useExerciseIntentRuntime } from '../lib/session/useExerciseIntentRuntime';
import type {
  RunnerPhase,
  SessionControlSignal,
  SessionDefinition,
  SessionResult,
  SessionStepResult
} from '../lib/sessionTypes';
import type { DebugState } from '../lib/poseTypes';

type Props = {
  session: SessionDefinition;
  onComplete: (result: SessionResult) => void;
  onCancel: () => void;
};

function mapStepExerciseToIntent(exerciseId: string): ExerciseIntentModel | null {
  switch (exerciseId) {
    case 'raise_right_hand':
      return rightArmRaiseIntent;
    case 'raise_left_hand':
      return leftArmRaiseIntent;
    case 'raise_right_knee':
    case 'seated_right_knee_lift':
      return seatedKneeLiftIntent;
    default:
      return null;
  }
}

export default function SessionRunner({ session, onComplete, onCancel }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [runnerPhase, setRunnerPhase] = useState<RunnerPhase>('session_intro');
  const [latestDebug, setLatestDebug] = useState<DebugState | null>(null);
  const [gestureSignal, setGestureSignal] = useState<SessionControlSignal>({
    detected: false,
    holdMs: 0
  });
  const [countdownValue, setCountdownValue] = useState(3);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [results, setResults] = useState<SessionStepResult[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [showExerciseIntroOverlay, setShowExerciseIntroOverlay] = useState(false);

  const currentStepStartPostureRef = useRef<'standing' | 'sitting' | 'unknown'>('unknown');
  const finalResultRef = useRef<SessionResult | null>(null);
  const stepCompletionHandledRef = useRef(false);

  const currentStep = session.steps[currentStepIndex];
  const currentExercise = currentStep
    ? EXERCISE_REGISTRY[currentStep.exerciseId]
    : null;

  const currentIntentExercise = useMemo(() => {
    return currentStep ? mapStepExerciseToIntent(currentStep.exerciseId) : null;
  }, [currentStep]);

  const {
    start: startIntentRuntime,
    reset: resetIntentRuntime,
    processLandmarks,
    motionState: intentMotionState,
    feedbackMessage: intentFeedbackMessage,
    lastErrorCode: intentLastErrorCode,
    repCount: intentRepCount
  } = useExerciseIntentRuntime(currentIntentExercise);

  const progressText = useMemo(() => {
    return `${Math.min(currentStepIndex + 1, session.steps.length)} / ${session.steps.length}`;
  }, [currentStepIndex, session.steps.length]);

  const readiness = useMemo(() => {
    if (!latestDebug) {
      return { ready: false, message: 'Waiting for camera data...' };
    }

    if (!latestDebug.personDetected || latestDebug.tracking !== 'active') {
      return { ready: false, message: 'Step into the frame' };
    }

    if (
      currentStep.requiredPosture !== 'either' &&
      latestDebug.posture !== currentStep.requiredPosture
    ) {
      return {
        ready: false,
        message:
          currentStep.requiredPosture === 'standing'
            ? 'Please stand up to begin'
            : 'Please sit down to begin'
      };
    }

    return { ready: true, message: 'Ready to begin' };
  }, [latestDebug, currentStep]);

  useEffect(() => {
    if (!sessionStartedAt) return;
    if (runnerPhase === 'session_complete') return;

    setElapsedMs(Date.now() - sessionStartedAt);

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - sessionStartedAt);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionStartedAt, runnerPhase]);

  useEffect(() => {
    if (runnerPhase !== 'session_intro') return;
    if (!readiness.ready) return;

    if (gestureSignal.detected && gestureSignal.holdMs >= 1000) {
      const now = Date.now();
      setSessionStartedAt(now);
      setElapsedMs(0);
      setCountdownValue(3);
      setRunnerPhase('countdown');
    }
  }, [runnerPhase, readiness.ready, gestureSignal.detected, gestureSignal.holdMs]);

  useEffect(() => {
    if (runnerPhase !== 'precheck') return;

    if (readiness.ready) {
      setCountdownValue(3);
      setRunnerPhase('countdown');
    }
  }, [runnerPhase, readiness.ready]);

  useEffect(() => {
    if (runnerPhase !== 'countdown') return;

    if (!readiness.ready) {
      setRunnerPhase(sessionStartedAt ? 'precheck' : 'session_intro');
      return;
    }

    if (countdownValue <= 0) {
      currentStepStartPostureRef.current = latestDebug?.posture ?? 'unknown';
      stepCompletionHandledRef.current = false;
      setShowExerciseIntroOverlay(true);
      startIntentRuntime();
      setRunnerPhase('active');
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdownValue((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [
    runnerPhase,
    countdownValue,
    readiness.ready,
    sessionStartedAt,
    latestDebug?.posture,
    startIntentRuntime
  ]);

  useEffect(() => {
    if (!showExerciseIntroOverlay) return;

    const timer = window.setTimeout(() => {
      setShowExerciseIntroOverlay(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [showExerciseIntroOverlay]);

  useEffect(() => {
    if (runnerPhase !== 'active') return;
    if (!latestDebug) return;
    if (stepCompletionHandledRef.current) return;

    if (latestDebug.repCount >= currentStep.targetReps) {
      stepCompletionHandledRef.current = true;
      handleExerciseComplete({
        completedReps: latestDebug.repCount,
        sessionPeakLift: latestDebug.sessionPeakLift,
        lastRepPeakLift: latestDebug.lastRepPeakLift
      });
    }
  }, [runnerPhase, latestDebug, currentStep.targetReps]);

  useEffect(() => {
    if (runnerPhase !== 'exercise_complete') return;

    const timer = window.setTimeout(() => {
      if (currentStep.restSeconds > 0) {
        setRestSecondsLeft(currentStep.restSeconds);
        setRunnerPhase('rest');
      } else {
        advanceToNextStep();
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [runnerPhase, currentStep.restSeconds]);

  useEffect(() => {
    if (runnerPhase !== 'rest') return;

    if (restSecondsLeft <= 0) {
      advanceToNextStep();
      return;
    }

    const timer = window.setTimeout(() => {
      setRestSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [runnerPhase, restSecondsLeft]);

  useEffect(() => {
    if (runnerPhase !== 'session_complete') return;
    if (!finalResultRef.current) return;

    const timer = window.setTimeout(() => {
      onComplete(finalResultRef.current as SessionResult);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [runnerPhase, onComplete]);

  function handlePoseLandmarksChange(landmarks: PoseLandmarks) {
    if (runnerPhase !== 'active') return;
    if (!currentIntentExercise) return;

    processLandmarks(landmarks);
  }

  function advanceToNextStep() {
    const isLast = currentStepIndex >= session.steps.length - 1;

    if (isLast) {
      const finishedAt = Date.now();
      finalResultRef.current = {
        sessionName: session.name,
        startedAt: sessionStartedAt ?? finishedAt,
        finishedAt,
        totalDurationMs: sessionStartedAt ? finishedAt - sessionStartedAt : 0,
        steps: results
      };
      setRunnerPhase('session_complete');
      return;
    }

    resetIntentRuntime();
    setCurrentStepIndex((prev) => prev + 1);
    setRunnerPhase('precheck');
    setCountdownValue(3);
    setRestSecondsLeft(0);
    setLatestDebug(null);
    stepCompletionHandledRef.current = false;
  }

  function handleExerciseComplete(result: {
    completedReps: number;
    sessionPeakLift: number;
    lastRepPeakLift: number | null;
  }) {
    if (!currentExercise || !currentStep) return;

    const stepResult: SessionStepResult = {
      stepId: currentStep.id,
      exerciseId: currentStep.exerciseId,
      label: currentExercise.label,
      targetReps: currentStep.targetReps,
      completedReps: result.completedReps,
      targetHoldSeconds: currentStep.targetHoldSeconds,
      restSeconds: currentStep.restSeconds,
      requiredPosture: currentStep.requiredPosture,
      postureAtStart: currentStepStartPostureRef.current,
      sessionPeakLift: result.sessionPeakLift,
      lastRepPeakLift: result.lastRepPeakLift,
      success: result.completedReps >= currentStep.targetReps
    };

    const nextResults = [...results, stepResult];
    setResults(nextResults);

    const isLast = currentStepIndex >= session.steps.length - 1;
    if (isLast) {
      const finishedAt = Date.now();
      finalResultRef.current = {
        sessionName: session.name,
        startedAt: sessionStartedAt ?? finishedAt,
        finishedAt,
        totalDurationMs: sessionStartedAt ? finishedAt - sessionStartedAt : 0,
        steps: nextResults
      };
      setRunnerPhase('session_complete');
      return;
    }

    setRunnerPhase('exercise_complete');
  }

  if (!currentStep || !currentExercise) return null;

  const nextExerciseLabel = session.steps[currentStepIndex + 1]
    ? EXERCISE_REGISTRY[session.steps[currentStepIndex + 1].exerciseId]?.label ?? 'Next Exercise'
    : 'Session complete';

  const overlay = getOverlayContent({
    phase: runnerPhase,
    readinessMessage: readiness.message,
    countdownValue,
    restSecondsLeft,
    nextExerciseLabel,
    gestureHoldMs: gestureSignal.holdMs,
    showExerciseIntroOverlay,
    currentExerciseLabel: currentExercise.label,
    currentStepIndex,
    totalSteps: session.steps.length,
    targetReps: currentStep.targetReps
  });

  const activeInstructionText =
    runnerPhase === 'active'
      ? `Exercise ${currentStepIndex + 1} of ${session.steps.length}: ${currentExercise.label} | Target reps: ${currentStep.targetReps} | Completed: ${latestDebug?.repCount ?? 0}`
      : undefined;

  return (
    <main style={{ minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div
          style={{
            background: '#121a31',
            border: '1px solid #1f2942',
            borderRadius: 16,
            padding: 16,
            marginBottom: 18,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Session</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{session.name}</div>
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Progress</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{progressText}</div>
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Elapsed Time</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{formatElapsed(elapsedMs)}</div>
          </div>

          <button onClick={onCancel} style={buttonStyle('#7f1d1d')}>
            Cancel Session
          </button>
        </div>

        <section
          style={{
            background: '#121a31',
            border: '1px solid #1f2942',
            borderRadius: 16,
            padding: 18,
            marginBottom: 18
          }}
        >
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Current Step</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{currentExercise.label}</div>
          <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 18 }}>
            Target reps: {currentStep.targetReps} | Hold: {currentStep.targetHoldSeconds}s |
            Required posture: {currentStep.requiredPosture}
          </div>

          {currentIntentExercise ? (
            <div style={{ marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 12 }}>
              <div style={{ color: '#93c5fd', fontSize: 14, fontWeight: 700 }}>
                Intent-Aware Guidance
              </div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800 }}>
                {intentFeedbackMessage || currentIntentExercise.coaching.intro}
              </div>
              <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 14 }}>
                Intent state: {intentMotionState} | Intent reps: {intentRepCount}
              </div>
              <div style={{ marginTop: 4, color: '#fca5a5', fontSize: 14 }}>
                Intent error: {intentLastErrorCode ?? 'none'}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, color: '#fbbf24', fontSize: 14 }}>
              No intent model mapped for this exercise yet.
            </div>
          )}

          {latestDebug?.framingMessage ? (
            <div style={{ marginTop: 10, color: '#93c5fd', fontSize: 15 }}>
              Camera guidance: {latestDebug.framingMessage}
            </div>
          ) : null}
        </section>

        <div style={{ position: 'relative' }}>
          <PoseTrackerPage
            selectedExerciseId={currentStep.exerciseId}
            sessionMode
            targetReps={runnerPhase === 'active' ? currentStep.targetReps : undefined}
            targetHoldSeconds={currentStep.targetHoldSeconds}
            externalStatusText={
              runnerPhase === 'session_intro'
                ? readiness.ready
                  ? 'Raise either hand and hold for 1 second to begin the session'
                  : readiness.message
                : runnerPhase === 'precheck'
                  ? readiness.message
                  : runnerPhase === 'countdown'
                    ? `Starting in ${countdownValue}`
                    : runnerPhase === 'active'
                      ? activeInstructionText
                      : runnerPhase === 'exercise_complete'
                        ? 'Exercise completed successfully. Well done!'
                        : runnerPhase === 'rest'
                          ? `Rest: ${restSecondsLeft}s`
                          : runnerPhase === 'session_complete'
                            ? 'Session completed successfully. Great work today!'
                            : undefined
            }
            exerciseEnabled={runnerPhase === 'active'}
            onDebugStateChange={setLatestDebug}
            onControlGesture={setGestureSignal}
            onPoseLandmarksChange={handlePoseLandmarksChange}
          />

          <CenteredOverlay
            visible={overlay.visible}
            title={overlay.title}
            subtitle={overlay.subtitle}
          />
        </div>
      </div>
    </main>
  );
}

function getOverlayContent({
  phase,
  readinessMessage,
  countdownValue,
  restSecondsLeft,
  nextExerciseLabel,
  gestureHoldMs,
  showExerciseIntroOverlay,
  currentExerciseLabel,
  currentStepIndex,
  totalSteps,
  targetReps
}: {
  phase: RunnerPhase;
  readinessMessage: string;
  countdownValue: number;
  restSecondsLeft: number;
  nextExerciseLabel: string;
  gestureHoldMs: number;
  showExerciseIntroOverlay: boolean;
  currentExerciseLabel: string;
  currentStepIndex: number;
  totalSteps: number;
  targetReps: number;
}) {
  if (phase === 'session_intro') {
    return {
      visible: true,
      title: 'Ready to Begin Your Session',
      subtitle:
        readinessMessage === 'Ready to begin'
          ? `Raise either hand and hold for 1 second to begin (${Math.round(gestureHoldMs)} ms / 1000 ms)`
          : readinessMessage
    };
  }

  if (phase === 'countdown') {
    return {
      visible: true,
      title: String(countdownValue),
      subtitle: 'Get ready'
    };
  }

  if (showExerciseIntroOverlay && phase === 'active') {
    return {
      visible: true,
      title: `Exercise ${currentStepIndex + 1} of ${totalSteps}`,
      subtitle: `${currentExerciseLabel} • Target reps: ${targetReps}`
    };
  }

  if (phase === 'exercise_complete') {
    return {
      visible: true,
      title: '✓ Exercise Completed Successfully!',
      subtitle: `Well done! Next: ${nextExerciseLabel}`
    };
  }

  if (phase === 'rest') {
    return {
      visible: true,
      title: 'Rest',
      subtitle: `Next exercise starts in ${restSecondsLeft}s`
    };
  }

  if (phase === 'session_complete') {
    return {
      visible: true,
      title: '🎉 Session Completed Successfully!',
      subtitle: 'Great work today!'
    };
  }

  return {
    visible: false,
    title: '',
    subtitle: ''
  };
}

function CenteredOverlay({
  visible,
  title,
  subtitle
}: {
  visible: boolean;
  title: string;
  subtitle: string;
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        background: 'rgba(2, 6, 23, 0.45)',
        borderRadius: 16
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid #334155',
          borderRadius: 20,
          padding: '28px 34px',
          maxWidth: 760,
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
        }}
      >
        <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.1 }}>{title}</div>
        <div style={{ marginTop: 14, fontSize: 24, color: '#dbeafe', lineHeight: 1.35 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buttonStyle(bg: string): CSSProperties {
  return {
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 700,
    cursor: 'pointer'
  };
}
