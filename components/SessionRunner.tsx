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

  const coachMessage =
    intentFeedbackMessage || currentIntentExercise?.coaching.intro || 'Get ready.';
  const coachSupportText =
    runnerPhase === 'active'
      ? `Exercise ${currentStepIndex + 1} of ${session.steps.length} • Reps ${latestDebug?.repCount ?? 0}/${currentStep.targetReps}`
      : `Exercise ${currentStepIndex + 1} of ${session.steps.length} • Target reps ${currentStep.targetReps}`;

  const activeInstructionText =
    runnerPhase === 'active'
      ? `Exercise ${currentStepIndex + 1} of ${session.steps.length}: ${currentExercise.label} | Target reps: ${currentStep.targetReps} | Completed: ${latestDebug?.repCount ?? 0}`
      : undefined;

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#020817' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={headerStyle}>
          <HeaderMetric label="Session" value={session.name} align="left" />
          <HeaderMetric label="Progress" value={progressText} />
          <HeaderMetric label="Elapsed Time" value={formatElapsed(elapsedMs)} />
          <button onClick={onCancel} style={buttonStyle('#991b1b')}>
            Cancel Session
          </button>
        </div>

        <div style={heroGridStyle}>
          <section style={coachPanelStyle}>
            <div style={{ color: '#93c5fd', fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
              Coach
            </div>

            <div style={{ marginTop: 10, fontSize: 40, fontWeight: 900, lineHeight: 1.04 }}>
              {currentExercise.label}
            </div>

            <div style={{ marginTop: 14, color: '#cbd5e1', fontSize: 16, lineHeight: 1.5 }}>
              {coachSupportText}
            </div>

            <div style={coachMessageCardStyle}>
              <div style={coachMessageLabelStyle}>Live Guidance</div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, lineHeight: 1.14 }}>
                {coachMessage}
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div style={coachMetaChipStyle}>
                  State: <strong>{intentMotionState}</strong>
                </div>
                <div style={coachMetaChipStyle}>
                  Intent reps: <strong>{intentRepCount}</strong>
                </div>
                <div style={coachMetaChipStyle}>
                  Error: <strong>{intentLastErrorCode ?? 'none'}</strong>
                </div>
              </div>
            </div>

            <div style={coachFooterStyle}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Session Progress</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
                {latestDebug?.repCount ?? 0} / {currentStep.targetReps} reps completed
              </div>
              <div style={{ marginTop: 8, color: '#93c5fd', fontSize: 15 }}>
                Next: {nextExerciseLabel}
              </div>
            </div>
          </section>

          <section style={videoPanelStyle}>
            <div
              style={{
                ...cameraBannerStyle,
                borderColor: latestDebug?.framingStatus === 'good' ? '#14532d' : '#7c2d12',
                background: latestDebug?.framingStatus === 'good' ? '#052e16' : '#3f1d0b'
              }}
            >
              <span style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>
                CAMERA GUIDANCE
              </span>
              <span style={{ marginLeft: 10, fontSize: 16, fontWeight: 800 }}>
                {latestDebug?.framingMessage ?? 'Step into the frame'}
              </span>
            </div>

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
          </section>
        </div>

        <div style={debugSectionStyle}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Debug Panel</div>
          <div style={debugGridStyle}>
            <Metric label="Tracking State" value={latestDebug?.tracking ?? 'idle'} />
            <Metric label="Person Detected" value={latestDebug?.personDetected ? 'Yes' : 'No'} />
            <Metric label="Track ID" value={latestDebug?.trackId ?? '—'} />
            <Metric label="Visible Keypoints" value={latestDebug?.visibleKeypoints ?? 0} />
            <Metric
              label="Confidence"
              value={`${(((latestDebug?.confidence ?? 0) as number) * 100).toFixed(0)}%`}
            />
            <Metric label="FPS" value={latestDebug?.fps ?? 0} />
            <Metric label="Posture" value={latestDebug?.posture ?? 'unknown'} />
            <Metric label="Avg Knee Angle" value={Math.round(latestDebug?.avgKneeAngle ?? 0)} />
            <Metric label="Framing Status" value={latestDebug?.framingStatus ?? 'no_person'} />
            <Metric label="Exercise" value={currentExercise.label} />
            <Metric label="Exercise Phase" value={latestDebug?.exercisePhase ?? 'idle'} />
            <Metric label="Rep Count" value={latestDebug?.repCount ?? 0} />
            <Metric label="Hold (ms)" value={Math.round(latestDebug?.holdMs ?? 0)} />
            <Metric label="Current Lift" value={(latestDebug?.currentLiftNorm ?? 0).toFixed(3)} />
            <Metric
              label="Rep Peak Lift"
              value={(latestDebug?.currentRepPeakLift ?? 0).toFixed(3)}
            />
            <Metric
              label="Last Rep Peak"
              value={
                latestDebug?.lastRepPeakLift != null
                  ? latestDebug.lastRepPeakLift.toFixed(3)
                  : '—'
              }
            />
            <Metric
              label="Session Best Lift"
              value={(latestDebug?.sessionPeakLift ?? 0).toFixed(3)}
            />
          </div>
        </div>

        <CenteredOverlay
          visible={overlay.visible}
          title={overlay.title}
          subtitle={overlay.subtitle}
        />
      </div>
    </main>
  );
}

function HeaderMetric({
  label,
  value,
  align = 'center'
}: {
  label: string;
  value: string;
  align?: 'left' | 'center';
}) {
  return (
    <div style={{ textAlign: align, minWidth: 160 }}>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
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
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        background: 'rgba(2, 6, 23, 0.30)',
        zIndex: 50
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.96)',
          border: '2px solid #334155',
          borderRadius: 24,
          padding: '30px 40px',
          maxWidth: 760,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.08 }}>{title}</div>
        <div style={{ marginTop: 14, fontSize: 24, color: '#dbeafe', lineHeight: 1.35 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: '#0b1225',
        border: '1px solid #1f2942',
        borderRadius: 12,
        padding: '12px 14px'
      }}
    >
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
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

const headerStyle: CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1f2942',
  borderRadius: 18,
  padding: 18,
  marginBottom: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap'
};

const heroGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(360px, 0.88fr) minmax(700px, 1.12fr)',
  gap: 20,
  alignItems: 'start'
};

const coachPanelStyle: CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1f2942',
  borderRadius: 20,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  minHeight: 640
};

const videoPanelStyle: CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1f2942',
  borderRadius: 20,
  padding: 18
};

const coachMessageCardStyle: CSSProperties = {
  background: '#081224',
  border: '1px solid #1e3a5f',
  borderRadius: 18,
  padding: 20
};

const coachMessageLabelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.3
};

const coachMetaChipStyle: CSSProperties = {
  background: '#0b1225',
  border: '1px solid #1f2942',
  borderRadius: 999,
  padding: '8px 12px',
  fontSize: 14,
  color: '#cbd5e1'
};

const coachFooterStyle: CSSProperties = {
  marginTop: 'auto',
  background: '#0b1225',
  border: '1px solid #1f2942',
  borderRadius: 18,
  padding: 18
};

const cameraBannerStyle: CSSProperties = {
  border: '1px solid',
  borderRadius: 12,
  padding: '10px 14px',
  marginBottom: 14
};

const debugSectionStyle: CSSProperties = {
  marginTop: 20,
  background: '#0f172a',
  border: '1px solid #1f2942',
  borderRadius: 20,
  padding: 20
};

const debugGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 12
};
