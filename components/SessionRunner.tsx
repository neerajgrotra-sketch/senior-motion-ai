'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import PoseTrackerPage from './PoseTrackerPage';
import { EXERCISE_REGISTRY } from '../lib/exercises/exerciseRegistry';
import type { PoseLandmarks } from '../lib/exercises/exerciseIntentTypes';
import { useExerciseIntentRuntime } from '../lib/session/useExerciseIntentRuntime';
import { rightArmRaiseIntent } from '../lib/exercises/rightArmRaiseIntent';
import { leftArmRaiseIntent } from '../lib/exercises/leftArmRaiseIntent';
import { seatedKneeLiftIntent } from '../lib/exercises/seatedKneeLiftIntent';
import type { ExerciseIntentModel } from '../lib/exercises/exerciseIntentTypes';
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

function getExerciseInstructionCopy(currentExerciseLabel: string) {
  const label = currentExerciseLabel.toLowerCase();

  if (label.includes('both hands')) {
    return {
      action: 'Raise both hands slowly.',
      continue: 'Good. Keep raising both hands.',
      hold: 'Hold both hands there.',
      lower: 'Lower both hands slowly.'
    };
  }

  if (label.includes('left')) {
    return {
      action: 'Raise your left hand slowly.',
      continue: 'Good. Keep raising your left hand.',
      hold: 'Hold your left hand there.',
      lower: 'Lower your left hand slowly.'
    };
  }

  if (label.includes('right')) {
    return {
      action: 'Raise your right hand slowly.',
      continue: 'Good. Keep raising your right hand.',
      hold: 'Hold your right hand there.',
      lower: 'Lower your right hand slowly.'
    };
  }

  if (label.includes('knee')) {
    return {
      action: 'Lift your knee slowly.',
      continue: 'Good. Keep lifting your knee.',
      hold: 'Hold your knee there.',
      lower: 'Lower your knee slowly.'
    };
  }

  if (label.includes('sit to stand')) {
    return {
      action: 'Stand up slowly.',
      continue: 'Good. Keep standing up.',
      hold: 'Hold steady.',
      lower: 'Lower slowly back down.'
    };
  }

  return {
    action: 'Begin the movement slowly.',
    continue: 'Good. Keep going.',
    hold: 'Hold there.',
    lower: 'Lower slowly.'
  };
}

function getCoachMessage(params: {
  phase: RunnerPhase;
  debug: DebugState | null;
  currentExerciseLabel: string;
  currentStepIndex: number;
  totalSteps: number;
  targetReps: number;
  targetHoldSeconds?: number;
}) {
  const {
    phase,
    debug,
    currentExerciseLabel,
    currentStepIndex,
    totalSteps,
    targetReps,
    targetHoldSeconds
  } = params;

  const instructionCopy = getExerciseInstructionCopy(currentExerciseLabel);
  const holdTargetMs = Math.max(0, Math.round((targetHoldSeconds ?? 0) * 1000));

  if (phase === 'session_intro') {
    return {
      headline: 'Raise either hand to begin.',
      subline: `Exercise ${currentStepIndex + 1} of ${totalSteps} • Target ${targetReps} reps`,
      status: 'waiting'
    };
  }

  if (phase === 'precheck') {
    return {
      headline: 'Get into position.',
      subline: `Exercise ${currentStepIndex + 1} of ${totalSteps} • ${currentExerciseLabel}`,
      status: 'precheck'
    };
  }

  if (phase === 'countdown') {
    return {
      headline: 'Get ready.',
      subline: `Starting ${currentExerciseLabel}`,
      status: 'countdown'
    };
  }

  if (phase === 'rest') {
    return {
      headline: 'Take a short rest.',
      subline: 'Recover before the next step',
      status: 'rest'
    };
  }

  if (phase === 'exercise_complete') {
    return {
      headline: 'Great job.',
      subline: 'Exercise completed successfully.',
      status: 'complete'
    };
  }

  if (phase === 'session_complete') {
    return {
      headline: 'Session complete.',
      subline: 'Excellent work today.',
      status: 'complete'
    };
  }

  if (!debug) {
    return {
      headline: 'Waiting for camera data.',
      subline: `Exercise ${currentStepIndex + 1} of ${totalSteps}`,
      status: 'waiting'
    };
  }

  if (!debug.personDetected || debug.tracking !== 'active') {
    return {
      headline: 'Step into the frame.',
      subline: 'We need to see you clearly before we begin',
      status: 'tracking'
    };
  }

  const completed = Math.min(debug.repCount ?? 0, targetReps);
  const holdMs = debug.holdMs ?? 0;
  const phaseName = debug.exercisePhase ?? 'idle';
  const runtimeHeadline =
    debug.statusText && debug.statusText.trim().length > 0 ? debug.statusText : null;

  if (phaseName === 'idle') {
    return {
      headline: runtimeHeadline ?? instructionCopy.action,
      subline:
        holdTargetMs > 0
          ? `Exercise ${currentStepIndex + 1} of ${totalSteps} • Reps ${completed}/${targetReps} • Hold ${targetHoldSeconds}s`
          : `Exercise ${currentStepIndex + 1} of ${totalSteps} • Reps ${completed}/${targetReps}`,
      status: 'ready'
    };
  }

  if (phaseName === 'moving_up') {
    return {
      headline: instructionCopy.continue,
      subline:
        holdTargetMs > 0
          ? `Reps ${completed}/${targetReps} • Hold target ${targetHoldSeconds}s`
          : `Reps ${completed}/${targetReps}`,
      status: 'lifting'
    };
  }

  if (phaseName === 'holding') {
    if (holdTargetMs > 0) {
      const remainingMs = Math.max(0, holdTargetMs - holdMs);
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      if (remainingMs > 0) {
        return {
          headline: instructionCopy.hold,
          subline: `${remainingSeconds}s remaining`,
          status: 'holding'
        };
      }
    }

    return {
      headline: 'Great. Now lower slowly.',
      subline: `Reps ${completed}/${targetReps}`,
      status: 'holding'
    };
  }

  if (phaseName === 'moving_down') {
    return {
      headline: instructionCopy.lower,
      subline: `Reps ${completed}/${targetReps}`,
      status: 'lowering'
    };
  }

  if (phaseName === 'rep_complete') {
    return {
      headline: 'Great job. That is one rep.',
      subline: `Reps ${completed}/${targetReps}`,
      status: 'rep_complete'
    };
  }

  if (phaseName === 'lost') {
    return {
      headline: 'Please come back into view.',
      subline: 'We lost tracking for a moment',
      status: 'tracking'
    };
  }

  return {
    headline: runtimeHeadline ?? instructionCopy.action,
    subline: `Reps ${completed}/${targetReps}`,
    status: 'active'
  };
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
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const currentStepStartPostureRef = useRef<'standing' | 'sitting' | 'unknown'>('unknown');
  const finalResultRef = useRef<SessionResult | null>(null);
  const stepCompletionHandledRef = useRef(false);

  const currentStep = session.steps[currentStepIndex];
  const currentExercise = currentStep ? EXERCISE_REGISTRY[currentStep.exerciseId] : null;

  const currentIntentExercise = useMemo(() => {
    return currentStep ? mapStepExerciseToIntent(currentStep.exerciseId) : null;
  }, [currentStep]);

  const { start: startIntentRuntime, reset: resetIntentRuntime, processLandmarks } =
    useExerciseIntentRuntime(currentIntentExercise);

  const progressText = useMemo(() => {
    return `${Math.min(currentStepIndex + 1, session.steps.length)} / ${session.steps.length}`;
  }, [currentStepIndex, session.steps.length]);

  const readiness = useMemo(() => {
    if (!currentStep) {
      return { ready: false, message: 'No active step.' };
    }

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

  const coach = useMemo(() => {
    if (!currentExercise || !currentStep) {
      return {
        headline: 'Get ready.',
        subline: '',
        status: 'idle'
      };
    }

    return getCoachMessage({
      phase: runnerPhase,
      debug: latestDebug,
      currentExerciseLabel: currentExercise.label,
      currentStepIndex,
      totalSteps: session.steps.length,
      targetReps: currentStep.targetReps,
      targetHoldSeconds: currentStep.targetHoldSeconds
    });
  }, [runnerPhase, latestDebug, currentExercise, currentStep, currentStepIndex, session.steps.length]);

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
    if (!currentStep) return;
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
  }, [runnerPhase, currentStep]);

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

  function maybeCompleteCurrentStep(debug: DebugState) {
    if (!currentStep) return;
    if (runnerPhase !== 'active') return;
    if (stepCompletionHandledRef.current) return;

    if (debug.repCount >= currentStep.targetReps) {
      stepCompletionHandledRef.current = true;
      handleExerciseComplete({
        completedReps: currentStep.targetReps,
        sessionPeakLift: debug.sessionPeakLift,
        lastRepPeakLift: debug.lastRepPeakLift
      });
    }
  }

  function handleDebugStateChange(debug: DebugState) {
    setLatestDebug(debug);
    maybeCompleteCurrentStep(debug);
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
    setLatestDebug(null);
    setGestureSignal({ detected: false, holdMs: 0 });
    setCurrentStepIndex((prev) => prev + 1);
    setRunnerPhase('precheck');
    setCountdownValue(3);
    setRestSecondsLeft(0);
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

  const safeRepCount = Math.min(latestDebug?.repCount ?? 0, currentStep.targetReps);

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

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#020817' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={headerStyle}>
          <HeaderMetric label="Session" value={session.name} align="left" />
          <HeaderMetric label="Progress" value={progressText} />
          <HeaderMetric label="Elapsed Time" value={formatElapsed(elapsedMs)} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowDebugPanel((prev) => !prev)} style={secondaryButtonStyle}>
              {showDebugPanel ? 'Hide Debug' : 'Show Debug'}
            </button>
            <button onClick={onCancel} style={buttonStyle('#991b1b')}>
              Cancel Session
            </button>
          </div>
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
              Exercise {currentStepIndex + 1} of {session.steps.length} • Reps {safeRepCount}/{currentStep.targetReps}
            </div>

            <div style={coachMessageCardStyle}>
              <div style={coachMessageLabelStyle}>Live Guidance</div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, lineHeight: 1.14 }}>
                {coach.headline}
              </div>

              <div style={{ marginTop: 12, color: '#cbd5e1', fontSize: 15 }}>
                {coach.subline}
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div style={coachMetaChipStyle}>
                  State: <strong>{latestDebug?.exercisePhase ?? 'idle'}</strong>
                </div>
                <div style={coachMetaChipStyle}>
                  Reps: <strong>{safeRepCount}</strong>
                </div>
                <div style={coachMetaChipStyle}>
                  Lift: <strong>{(latestDebug?.currentLiftNorm ?? 0).toFixed(3)}</strong>
                </div>
              </div>
            </div>

            <div style={coachFooterStyle}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Session Progress</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
                {safeRepCount} / {currentStep.targetReps} reps completed
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
          : runnerPhase === 'exercise_complete'
            ? 'Exercise completed successfully. Well done!'
            : runnerPhase === 'rest'
              ? `Rest: ${restSecondsLeft}s`
              : runnerPhase === 'session_complete'
                ? 'Session completed successfully. Great work today!'
                : undefined
  }
  exerciseEnabled={runnerPhase === 'active'}
  onDebugStateChange={handleDebugStateChange}
  onControlGesture={setGestureSignal}
  onPoseLandmarksChange={handlePoseLandmarksChange}
/>
          </section>
        </div>

        {showDebugPanel ? (
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
              <Metric label="Status Text" value={latestDebug?.statusText ?? '—'} />
            </div>
          </div>
        ) : null}

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

const secondaryButtonStyle: CSSProperties = {
  background: '#1e293b',
  color: 'white',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer'
};

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
