'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import PoseTrackerPage from './PoseTrackerPage';
import { EXERCISE_REGISTRY } from '../lib/exercises/exerciseRegistry';
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

export default function SessionRunner({ session, onComplete, onCancel }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [runnerPhase, setRunnerPhase] = useState<RunnerPhase>('precheck');
  const [latestDebug, setLatestDebug] = useState<DebugState | null>(null);
  const [gestureSignal, setGestureSignal] = useState<SessionControlSignal>({
    detected: false,
    holdMs: 0
  });
  const [countdownValue, setCountdownValue] = useState(3);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [results, setResults] = useState<SessionStepResult[]>([]);
  const [startedAt] = useState(() => Date.now());

  const currentStep = session.steps[currentStepIndex];
  const currentExercise = currentStep
    ? EXERCISE_REGISTRY[currentStep.exerciseId]
    : null;

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

    if (latestDebug.framingStatus !== 'good') {
      return { ready: false, message: latestDebug.framingMessage };
    }

    if (currentStep.requiredPosture !== 'either' && latestDebug.posture !== currentStep.requiredPosture) {
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
    if (runnerPhase !== 'precheck') return;

    if (readiness.ready) {
      if (currentStep.startMode === 'auto') {
        setRunnerPhase('countdown');
        setCountdownValue(3);
      } else {
        setRunnerPhase('await_start_gesture');
      }
    }
  }, [runnerPhase, readiness, currentStep.startMode]);

  useEffect(() => {
    if (runnerPhase !== 'await_start_gesture') return;
    if (!readiness.ready) {
      setRunnerPhase('precheck');
      return;
    }

    if (gestureSignal.detected && gestureSignal.holdMs >= 1000) {
      setRunnerPhase('countdown');
      setCountdownValue(3);
    }
  }, [runnerPhase, gestureSignal, readiness]);

  useEffect(() => {
    if (runnerPhase !== 'countdown') return;

    if (!readiness.ready) {
      setRunnerPhase('precheck');
      return;
    }

    if (countdownValue <= 0) {
      setRunnerPhase('active');
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdownValue((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [runnerPhase, countdownValue, readiness]);

  useEffect(() => {
    if (runnerPhase !== 'exercise_complete') return;

    const timer = window.setTimeout(() => {
      if (currentStep.restSeconds > 0) {
        setRestSecondsLeft(currentStep.restSeconds);
        setRunnerPhase('rest');
      } else {
        moveToNextStepOrComplete();
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [runnerPhase, currentStep.restSeconds]);

  useEffect(() => {
    if (runnerPhase !== 'rest') return;

    if (restSecondsLeft <= 0) {
      moveToNextStepOrComplete();
      return;
    }

    const timer = window.setTimeout(() => {
      setRestSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [runnerPhase, restSecondsLeft]);

  function moveToNextStepOrComplete() {
    const isLast = currentStepIndex >= session.steps.length - 1;

    if (isLast) {
      const finishedAt = Date.now();
      setRunnerPhase('session_complete');
      onComplete({
        sessionName: session.name,
        startedAt,
        finishedAt,
        totalDurationMs: finishedAt - startedAt,
        steps: results
      });
      return;
    }

    setCurrentStepIndex((prev) => prev + 1);
    setRunnerPhase('precheck');
    setGestureSignal({ detected: false, holdMs: 0 });
    setCountdownValue(3);
    setRestSecondsLeft(0);
    setLatestDebug(null);
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
      postureAtStart: latestDebug?.posture ?? 'unknown',
      sessionPeakLift: result.sessionPeakLift,
      lastRepPeakLift: result.lastRepPeakLift,
      success: result.completedReps >= currentStep.targetReps
    };

    setResults((prev) => [...prev, stepResult]);
    setRunnerPhase('exercise_complete');
  }

  if (!currentStep || !currentExercise) return null;

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

          <button onClick={onCancel} style={buttonStyle('#7f1d1d')}>
            Cancel Session
          </button>
        </div>

        <RunnerBanner
          phase={runnerPhase}
          countdownValue={countdownValue}
          restSecondsLeft={restSecondsLeft}
          readinessMessage={readiness.message}
          currentExerciseLabel={currentExercise.label}
          currentStep={currentStep}
          gestureHoldMs={gestureSignal.holdMs}
          nextExerciseLabel={
            session.steps[currentStepIndex + 1]
              ? EXERCISE_REGISTRY[session.steps[currentStepIndex + 1].exerciseId]?.label ?? 'Next'
              : 'Session complete'
          }
        />

        <PoseTrackerPage
          selectedExerciseId={currentStep.exerciseId}
          sessionMode
          targetReps={runnerPhase === 'active' ? currentStep.targetReps : undefined}
          targetHoldSeconds={currentStep.targetHoldSeconds}
          externalStatusText={
            runnerPhase === 'precheck'
              ? readiness.message
              : runnerPhase === 'await_start_gesture'
              ? 'Raise either hand and hold for 1 second to begin'
              : runnerPhase === 'countdown'
              ? `Starting in ${countdownValue}`
              : runnerPhase === 'exercise_complete'
              ? `Exercise complete. Next: ${session.steps[currentStepIndex + 1] ? EXERCISE_REGISTRY[session.steps[currentStepIndex + 1].exerciseId]?.label : 'Session complete'}`
              : runnerPhase === 'rest'
              ? `Rest: ${restSecondsLeft}s`
              : undefined
          }
          exerciseEnabled={runnerPhase === 'active'}
          onExerciseComplete={handleExerciseComplete}
          onDebugStateChange={setLatestDebug}
          onControlGesture={setGestureSignal}
        />
      </div>
    </main>
  );
}

function RunnerBanner({
  phase,
  countdownValue,
  restSecondsLeft,
  readinessMessage,
  currentExerciseLabel,
  currentStep,
  gestureHoldMs,
  nextExerciseLabel
}: {
  phase: RunnerPhase;
  countdownValue: number;
  restSecondsLeft: number;
  readinessMessage: string;
  currentExerciseLabel: string;
  currentStep: SessionDefinition['steps'][number];
  gestureHoldMs: number;
  nextExerciseLabel: string;
}) {
  let title = currentExerciseLabel;
  let subtitle = '';

  if (phase === 'precheck') {
    subtitle = readinessMessage;
  } else if (phase === 'await_start_gesture') {
    subtitle = `Raise either hand to begin (${Math.round(gestureHoldMs)} ms / 1000 ms)`;
  } else if (phase === 'countdown') {
    subtitle = `Starting in ${countdownValue}`;
  } else if (phase === 'active') {
    subtitle = `Active | Target reps: ${currentStep.targetReps} | Hold: ${currentStep.targetHoldSeconds}s | Required posture: ${currentStep.requiredPosture}`;
  } else if (phase === 'exercise_complete') {
    subtitle = `Exercise complete. Next: ${nextExerciseLabel}`;
  } else if (phase === 'rest') {
    subtitle = `Rest: ${restSecondsLeft}s | Next: ${nextExerciseLabel}`;
  } else {
    subtitle = 'Session complete';
  }

  return (
    <section
      style={{
        background: '#121a31',
        border: '1px solid #1f2942',
        borderRadius: 16,
        padding: 18,
        marginBottom: 18
      }}
    >
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Runner Phase: {phase}</div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 18 }}>{subtitle}</div>
    </section>
  );
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
