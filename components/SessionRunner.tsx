"use client";

/**
 * SessionRunner.tsx
 *
 * Purpose
 * - Render the current exercise runner screen
 * - Use the new pose -> biomechanics -> runtime -> session engine path
 * - Accept a builder session from app/page.tsx
 * - Auto-start camera when the user starts the session
 * - Stay defensive if any exercise mapping is missing
 *
 * Notes
 * - This keeps the current runner architecture intact
 * - It falls back to the demo session if no builder session is provided
 * - onAbort returns to the builder
 * - onFinish is accepted for future wiring, but not yet fully emitted
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePosePipeline } from "../hooks/usePosePipeline";
import { createSessionRunnerEngine } from "../lib/session/createSessionRunnerEngine";
import { buildDemoSession } from "../lib/session/buildDemoSession";
import { convertBuilderSession } from "../lib/session/convertBuilderSession";
import type { SessionRunnerState } from "../lib/session/sessionTypes";
import type { RuntimeFrameResult } from "../lib/runtime/runtimeTypes";
import type { SessionDefinition, SessionResult } from "../lib/sessionTypes";

type Props = {
  session?: SessionDefinition;
  onFinish?: (result: SessionResult) => void;
  onAbort?: () => void;
};

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SessionRunner({ session, onFinish, onAbort }: Props) {
  const {
    videoRef,
    startCamera,
    stopCamera,
    isRunning,
    isCameraOn,
    detectorReady,
    error: pipelineError,
    latestBiomechanicsFrame,
  } = usePosePipeline();

  const engineRef = useRef(createSessionRunnerEngine());

  const runtimeSession = useMemo(() => {
    if (session && session.steps.length > 0) {
      return convertBuilderSession(session);
    }
    return buildDemoSession();
  }, [session]);

  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionState, setSessionState] = useState<SessionRunnerState>(
    engineRef.current.getState(),
  );
  const [runtimeResult, setRuntimeResult] = useState<RuntimeFrameResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);

  const loadSession = useCallback(() => {
    engineRef.current.loadSession(runtimeSession);
    setSessionLoaded(true);
    setSessionState(engineRef.current.getState());
    setRuntimeResult(null);
  }, [runtimeSession]);

  const startSession = useCallback(async () => {
    if (!detectorReady || isStartingSession) return;

    setIsStartingSession(true);

    try {
      if (!isCameraOn) {
        await startCamera();
      }

      engineRef.current.startSession(performance.now());
      setSessionState(engineRef.current.getState());
    } catch (error) {
      console.error("Failed to start session:", error);
    } finally {
      setIsStartingSession(false);
    }
  }, [detectorReady, isStartingSession, isCameraOn, startCamera]);

  const pauseSession = useCallback(() => {
    engineRef.current.pauseSession();
    setSessionState(engineRef.current.getState());
  }, []);

  const resumeSession = useCallback(() => {
    engineRef.current.resumeSession();
    setSessionState(engineRef.current.getState());
  }, []);

  const abortSession = useCallback(() => {
    engineRef.current.abortSession();
    setSessionState(engineRef.current.getState());
    if (onAbort) onAbort();
  }, [onAbort]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    engineRef.current.markCameraActive(isCameraOn);
    setSessionState(engineRef.current.getState());
  }, [isCameraOn]);

  useEffect(() => {
    if (!latestBiomechanicsFrame) return;

    const result = engineRef.current.processFrame(latestBiomechanicsFrame);
    setRuntimeResult(result.runtimeResult);
    setSessionState(result.sessionState);

    if (result.justCompletedSession && onFinish) {
      const finishedAt = Date.now();
      const startedAt =
        sessionState.progress.sessionStartedAtMs ?? finishedAt;

      const fallbackSessionName =
        session?.name?.trim() || runtimeSession.title || "Session";

      const resultPayload: SessionResult = {
        sessionName: fallbackSessionName,
        startedAt,
        finishedAt,
        totalDurationMs: Math.max(0, finishedAt - startedAt),
        steps:
          runtimeSession.items.map((item) => ({
            stepId: item.id,
            label: item.exercise?.title ?? item.exerciseId,
            targetReps: item.repTarget,
            completedReps:
              item.id === result.sessionState.currentItem?.id
                ? result.runtimeResult?.exerciseState?.repState.repCount ?? 0
                : item.repTarget,
            requiredPosture: "either",
            postureAtStart: "unknown",
            targetHoldSeconds: Math.round((item.holdMs ?? 0) / 1000),
            restSeconds: Math.round((item.restAfterMs ?? 0) / 1000),
            sessionPeakLift: 0,
            lastRepPeakLift: null,
            success: true,
          })) ?? [],
      };

      onFinish(resultPayload);
    }
  }, [latestBiomechanicsFrame, onFinish, runtimeSession, session, sessionState.progress.sessionStartedAtMs]);

  const currentExerciseTitle =
    sessionState.currentItem?.exercise?.title ?? "No exercise loaded";

  const currentRepCount = runtimeResult?.exerciseState?.repState.repCount ?? 0;

  const currentRepTarget =
    sessionState.currentItem?.repTarget ??
    sessionState.currentItem?.exercise?.repTargetDefault ??
    0;

  const coachingMessage =
    runtimeResult?.coachingMessage ??
    (sessionState.status === "ready"
      ? "Press Begin Session when you are ready."
      : sessionState.status === "running"
        ? isRunning
          ? "Tracking movement..."
          : "Camera is on. Waiting for pose pipeline..."
        : sessionState.status === "paused"
          ? "Session paused."
          : sessionState.status === "completed"
            ? "Session complete."
            : sessionState.status === "aborted"
              ? "Session aborted."
              : "Idle");

  const completedExercises = sessionState.progress.completedExerciseIds.length;
  const totalExercises = sessionState.progress.totalExercises;

  const currentPhase = runtimeResult?.exerciseState?.repState.phase
    ? formatStatusLabel(runtimeResult.exerciseState.repState.phase)
    : "n/a";

  const beginDisabled =
    !detectorReady || !sessionLoaded || isStartingSession;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div>
          <h1 style={styles.title}>AI Physiotherapy Session</h1>
          <p style={styles.subtitle}>
            Camera, pose tracking, exercise runtime, and live coaching.
          </p>
        </div>

        {pipelineError ? <div style={styles.errorBox}>{pipelineError}</div> : null}

        <div style={styles.mainGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Live Camera</h2>
                <p style={styles.panelSubtitle}>
                  The camera will start automatically when the session begins.
                </p>
              </div>

              <div style={styles.badgeRow}>
                <span style={styles.badge}>
                  {detectorReady ? "Detector Ready" : "Loading Detector"}
                </span>
                <span style={styles.badge}>
                  {isCameraOn ? "Camera Active" : "Camera Off"}
                </span>
                <span style={styles.badge}>
                  {isRunning ? "Pipeline Running" : "Pipeline Idle"}
                </span>
              </div>
            </div>

            <div style={styles.videoFrame}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={styles.video}
              />

              {!isCameraOn ? (
                <div style={styles.videoOverlay}>
                  <div>
                    <div style={styles.videoOverlayTitle}>Camera is off</div>
                    <div style={styles.videoOverlayText}>
                      Press Begin Session to start camera and tracking
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={styles.buttonRow}>
              <button
                onClick={startSession}
                disabled={beginDisabled}
                style={{
                  ...styles.primaryButton,
                  ...(beginDisabled ? styles.disabledButton : {}),
                }}
              >
                {isStartingSession
                  ? "Starting..."
                  : detectorReady
                    ? "Begin Session"
                    : "Loading Pose Detector..."}
              </button>

              <button onClick={stopCamera} style={styles.secondaryButton}>
                Stop Camera
              </button>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Session Guide</h2>
                <p style={styles.panelSubtitle}>
                  Live exercise progress and coaching feedback.
                </p>
              </div>

              <span style={styles.badge}>
                {formatStatusLabel(sessionState.status)}
              </span>
            </div>

            <div style={styles.infoCard}>
              <div style={styles.cardLabel}>Current Exercise</div>
              <div style={styles.exerciseTitle}>{currentExerciseTitle}</div>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.infoCard}>
                <div style={styles.cardLabel}>Reps</div>
                <div style={styles.statValue}>
                  {currentRepCount} / {currentRepTarget}
                </div>
              </div>

              <div style={styles.infoCard}>
                <div style={styles.cardLabel}>Progress</div>
                <div style={styles.statValue}>
                  {completedExercises} / {totalExercises}
                </div>
              </div>
            </div>

            <div style={styles.coachingCard}>
              <div style={styles.cardLabelBlue}>Coaching</div>
              <div style={styles.coachingText}>{coachingMessage}</div>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.infoCard}>
                <div style={styles.cardLabel}>Runtime Phase</div>
                <div style={styles.smallStat}>{currentPhase}</div>
              </div>

              <div style={styles.infoCard}>
                <div style={styles.cardLabel}>Pose Pipeline</div>
                <div style={styles.smallStat}>
                  {isRunning ? "Running" : isCameraOn ? "Camera on / waiting" : "Stopped"}
                </div>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button onClick={loadSession} style={styles.secondaryButton}>
                Reload Session
              </button>

              <button onClick={pauseSession} style={styles.secondaryButton}>
                Pause
              </button>

              <button onClick={resumeSession} style={styles.secondaryButton}>
                Resume
              </button>

              <button onClick={abortSession} style={styles.secondaryButton}>
                Abort
              </button>
            </div>
          </section>
        </div>

        <section style={styles.panel}>
          <div style={styles.debugHeader}>
            <h3 style={styles.panelTitle}>Debug Snapshot</h3>
            <button
              onClick={() => setShowDebug((prev) => !prev)}
              style={styles.secondaryButton}
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>

          {showDebug ? (
            <pre style={styles.debugBox}>
              {JSON.stringify(
                {
                  detectorReady,
                  isCameraOn,
                  isRunning,
                  sessionLoaded,
                  builderSessionName: session?.name ?? null,
                  builderStepCount: session?.steps.length ?? 0,
                  runtimeSessionTitle: sessionState.session?.title ?? null,
                  sessionStatus: sessionState.status,
                  currentExercise: sessionState.currentItem?.exercise?.title ?? null,
                  currentIndex: sessionState.progress.currentIndex,
                  totalExercises: sessionState.progress.totalExercises,
                  completedExerciseIds: sessionState.progress.completedExerciseIds,
                  totalRepsCompleted: sessionState.progress.totalRepsCompleted,
                  runtimeStatus: runtimeResult?.status ?? null,
                  repState: runtimeResult?.exerciseState?.repState ?? null,
                  coachingMessage,
                  latestTimestampMs: latestBiomechanicsFrame?.timestampMs ?? null,
                  leftLift:
                    latestBiomechanicsFrame?.arms.left.verticalLiftNormalized ?? null,
                  rightLift:
                    latestBiomechanicsFrame?.arms.right.verticalLiftNormalized ?? null,
                  torsoLean: latestBiomechanicsFrame?.torso.trunkLeanDeg ?? null,
                  debug: runtimeResult?.debug ?? null,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <div style={styles.debugCollapsedText}>
              Debug output is hidden for normal demo use.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  title: {
    margin: 0,
    fontSize: "36px",
    fontWeight: 700,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "#475569",
    fontSize: "15px",
  },
  errorBox: {
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "16px",
    padding: "16px",
    fontSize: "14px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.25fr 0.95fr",
    gap: "24px",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 600,
    color: "#0f172a",
  },
  panelSubtitle: {
    margin: "6px 0 0 0",
    fontSize: "14px",
    color: "#64748b",
  },
  badgeRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 600,
  },
  videoFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    borderRadius: "20px",
    background: "#020617",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  videoOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(2, 6, 23, 0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "#e2e8f0",
    padding: "24px",
  },
  videoOverlayTitle: {
    fontSize: "22px",
    fontWeight: 600,
  },
  videoOverlayText: {
    marginTop: "8px",
    fontSize: "14px",
    color: "#94a3b8",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "16px",
  },
  primaryButton: {
    border: "none",
    borderRadius: "16px",
    background: "#2563eb",
    color: "#ffffff",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  infoCard: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
  },
  cardLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
  },
  cardLabelBlue: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#1d4ed8",
  },
  exerciseTitle: {
    marginTop: "10px",
    fontSize: "30px",
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.15,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "16px",
  },
  statValue: {
    marginTop: "10px",
    fontSize: "34px",
    fontWeight: 700,
    color: "#0f172a",
  },
  smallStat: {
    marginTop: "10px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#0f172a",
  },
  coachingCard: {
    marginTop: "16px",
    background: "#eff6ff",
    borderRadius: "18px",
    padding: "16px",
  },
  coachingText: {
    marginTop: "10px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#172554",
    lineHeight: 1.4,
  },
  debugHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  debugCollapsedText: {
    marginTop: "16px",
    color: "#64748b",
    fontSize: "14px",
  },
  debugBox: {
    marginTop: "16px",
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
    fontSize: "12px",
    overflowX: "auto",
    color: "#0f172a",
  },
};
