"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePosePipeline } from "../hooks/usePosePipeline";
import { createSessionRunnerEngine } from "../lib/session/createSessionRunnerEngine";
import { buildDemoSession } from "../lib/session/buildDemoSession";
import type { SessionState } from "../lib/session/sessionTypes";
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
  const [sessionState, setSessionState] = useState<SessionState>(
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

  const currentRepCount =
    runtimeResult?.exerciseState?.repState.repCount ?? 0;

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
          ? "Tracking..."
          : "Camera is on. Waiting for pose pipeline..."
        : sessionState.status === "paused"
          ? "Session paused."
          : sessionState.status === "completed"
            ? "Session complete."
            : "Idle");

  const completedExercises = sessionState.progress.completedExerciseIds.length;
  const totalExercises = sessionState.progress.totalExercises;

  return (
    <div className="w-full p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Session Runner</h1>
          <p className="text-sm text-gray-600">
            Persistent camera + pose pipeline + session engine.
          </p>
        </div>

        {pipelineError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {pipelineError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Live Camera</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                  {detectorReady ? "Detector Ready" : "Loading Detector"}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                  {isCameraOn ? "Camera Active" : "Camera Off"}
                </span>
              </div>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void startCamera()}
                disabled={!detectorReady}
                className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {detectorReady ? "Start Camera" : "Loading Pose Detector..."}
              </button>

              <button
                onClick={stopCamera}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Stop Camera
              </button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Session Status</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize">
                {formatStatusLabel(sessionState.status)}
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Current Exercise
                </div>
                <div className="mt-1 text-xl font-semibold">
                  {currentExerciseTitle}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Reps
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {currentRepCount} / {currentRepTarget}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Progress
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {completedExercises} / {totalExercises}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <div className="text-xs uppercase tracking-wide text-blue-700">
                  Coaching
                </div>
                <div className="mt-1 text-base font-medium text-blue-900">
                  {coachingMessage}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Runtime Phase
                  </div>
                  <div className="mt-1 text-base font-medium">
                    {runtimeResult?.exerciseState?.repState.phase
                      ? formatStatusLabel(runtimeResult.exerciseState.repState.phase)
                      : "n/a"}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Pose Pipeline
                  </div>
                  <div className="mt-1 text-base font-medium">
                    {isRunning ? "Running" : isCameraOn ? "Camera on / waiting" : "Stopped"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={loadSession}
                  className="rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  Load Demo Session
                </button>

                <button
                  onClick={startSession}
                  disabled={!sessionLoaded || !isCameraOn}
                  className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Start Session
                </button>

                <button
                  onClick={pauseSession}
                  className="rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  Pause
                </button>

                <button
                  onClick={resumeSession}
                  className="rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  Resume
                </button>

                <button
                  onClick={abortSession}
                  className="rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  Abort
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-medium">Debug Snapshot</h3>
          <pre className="mt-3 overflow-auto rounded-xl bg-gray-50 p-4 text-xs">
            {JSON.stringify(
              {
                detectorReady,
                isCameraOn,
                isRunning,
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
                torsoLean:
                  latestBiomechanicsFrame?.torso.trunkLeanDeg ?? null,
                debug: runtimeResult?.debug ?? null,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
