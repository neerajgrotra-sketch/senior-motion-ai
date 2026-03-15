"use client";

/**
 * SessionRunner.tsx
 *
 * Purpose
 * - Render the current MVP exercise session screen
 * - Keep camera / pose pipeline separate from session orchestration
 * - Feed latest BiomechanicsFrame values into the session runner engine
 * - Show current exercise, rep progress, coaching, and lightweight debug info
 *
 * Notes
 * - This component uses the NEW architecture path:
 *   usePosePipeline -> biomechanics frame -> session runner engine -> UI
 * - It does NOT depend on the legacy intent-engine session hook.
 * - The camera should be started once and remain active while exercises switch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePosePipeline } from "../hooks/usePosePipeline";
import { createSessionRunnerEngine } from "../lib/session/createSessionRunnerEngine";
import { buildDemoSession } from "../lib/session/buildDemoSession";
import type { SessionRunnerState } from "../lib/session/sessionTypes";
import type { RuntimeFrameResult } from "../lib/runtime/runtimeTypes";

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SessionRunner() {
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

  const demoSession = useMemo(() => buildDemoSession(), []);
  const engineRef = useRef(createSessionRunnerEngine());

  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionState, setSessionState] = useState<SessionRunnerState>(
    engineRef.current.getState(),
  );
  const [runtimeResult, setRuntimeResult] = useState<RuntimeFrameResult | null>(null);

  const loadSession = useCallback(() => {
    engineRef.current.loadSession(demoSession);
    setSessionLoaded(true);
    setSessionState(engineRef.current.getState());
    setRuntimeResult(null);
  }, [demoSession]);

  const startSession = useCallback(() => {
    engineRef.current.startSession(performance.now());
    setSessionState(engineRef.current.getState());
  }, []);

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
  }, []);

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
  }, [latestBiomechanicsFrame]);

  const currentExerciseTitle =
    sessionState.currentItem?.exercise.title ?? "No exercise loaded";

  const currentRepCount = runtimeResult?.exerciseState?.repState.repCount ?? 0;

  const currentRepTarget =
    sessionState.currentItem?.repTarget ??
    sessionState.currentItem?.exercise.repTargetDefault ??
    0;

  const coachingMessage =
    runtimeResult?.coachingMessage ??
    (sessionState.status === "ready"
      ? "Press Start Session when you are ready."
      : sessionState.status === "running"
        ? isRunning
          ? "Tracking movement..."
          : "Camera is on. Waiting for pose pipeline..."
        : sessionState.status === "paused"
          ? "Session paused."
          : sessionState.status === "completed"
            ? "Session complete."
            : "Idle");

  const completedExercises = sessionState.progress.completedExerciseIds.length;
  const totalExercises = sessionState.progress.totalExercises;

  const currentPhase = runtimeResult?.exerciseState?.repState.phase
    ? formatStatusLabel(runtimeResult.exerciseState.repState.phase)
    : "n/a";

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            AI Physiotherapy Session
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Camera, pose tracking, exercise runtime, and live coaching.
          </p>
        </div>

        {pipelineError ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {pipelineError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Live Camera</h2>
                <p className="text-sm text-slate-500">
                  Start once and keep tracking across the full session.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {detectorReady ? "Detector Ready" : "Loading Detector"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {isCameraOn ? "Camera Active" : "Camera Off"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {isRunning ? "Pipeline Running" : "Pipeline Idle"}
                </span>
              </div>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              {!isCameraOn ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center text-slate-200">
                  <div>
                    <div className="text-lg font-medium">Camera is off</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Start camera to begin pose tracking
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => void startCamera()}
                disabled={!detectorReady}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {detectorReady ? "Start Camera" : "Loading Pose Detector..."}
              </button>

              <button
                onClick={stopCamera}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
              >
                Stop Camera
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Session Guide</h2>
                <p className="text-sm text-slate-500">
                  Live exercise progress and coaching feedback.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {formatStatusLabel(sessionState.status)}
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Current Exercise
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {currentExerciseTitle}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Reps
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {currentRepCount} / {currentRepTarget}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Progress
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {completedExercises} / {totalExercises}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="text-xs uppercase tracking-wide text-blue-700">
                  Coaching
                </div>
                <div className="mt-2 text-base font-medium text-blue-950">
                  {coachingMessage}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Runtime Phase
                  </div>
                  <div className="mt-2 text-base font-medium text-slate-900">
                    {currentPhase}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Pose Pipeline
                  </div>
                  <div className="mt-2 text-base font-medium text-slate-900">
                    {isRunning ? "Running" : isCameraOn ? "Camera on / waiting" : "Stopped"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={loadSession}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Load Demo Session
                </button>

                <button
                  onClick={startSession}
                  disabled={!sessionLoaded || !isCameraOn}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Session
                </button>

                <button
                  onClick={pauseSession}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Pause
                </button>

                <button
                  onClick={resumeSession}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Resume
                </button>

                <button
                  onClick={abortSession}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Abort
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Debug Snapshot</h3>

          <pre className="mt-4 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-800">
            {JSON.stringify(
              {
                detectorReady,
                isCameraOn,
                isRunning,
                sessionLoaded,
                sessionStatus: sessionState.status,
                currentExercise: sessionState.currentItem?.exercise.title ?? null,
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
        </section>
      </div>
    </div>
  );
}
