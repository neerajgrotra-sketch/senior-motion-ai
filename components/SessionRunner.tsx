// components/SessionRunner.tsx

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPoseFrame } from "../lib/pose/buildPoseFrame";
import { buildBiomechanicsFrame } from "../lib/biomechanics/buildBiomechanicsFrame";
import { createSessionRunnerEngine } from "../lib/session/createSessionRunnerEngine";
import { buildDemoSession } from "../lib/session/buildDemoSession";
import { SessionRunnerState } from "../lib/session/sessionTypes";
import { RuntimeFrameResult } from "../lib/runtime/runtimeTypes";
import { RawPoseFrame, RawPoseKeypoint } from "../lib/pose/poseTypes";

/**
 * IMPORTANT:
 * This component shows the integration pattern.
 * Replace `getMockPoseFrameFromVideo()` with your real BlazePose / MediaPipe detector call.
 */

type DetectorKeypoint = {
  name?: string;
  x: number;
  y: number;
  z?: number;
  score?: number;
};

type DetectorPoseResult = {
  keypoints: DetectorKeypoint[];
};

function mapDetectorKeypointsToRaw(
  detectorPose: DetectorPoseResult,
  video: HTMLVideoElement,
): RawPoseFrame {
  const keypoints: RawPoseKeypoint[] = detectorPose.keypoints
    .filter((kp) => typeof kp.name === "string")
    .map((kp) => ({
      name: kp.name as RawPoseKeypoint["name"],
      x: kp.x,
      y: kp.y,
      z: kp.z,
      score: kp.score,
    }));

  return {
    timestampMs: performance.now(),
    frameWidth: video.videoWidth || 1,
    frameHeight: video.videoHeight || 1,
    keypoints,
    source: "blazepose",
  };
}

/**
 * Replace this with real detector inference.
 * Example later:
 *   const poses = await detector.estimatePoses(video, { flipHorizontal: false });
 *   return poses[0] ?? null;
 */
async function getMockPoseFrameFromVideo(
  _video: HTMLVideoElement,
): Promise<DetectorPoseResult | null> {
  return null;
}

function formatStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export default function SessionRunner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const engineRef = useRef(createSessionRunnerEngine());
  const previousBiomechFrameRef = useRef<ReturnType<typeof buildBiomechanicsFrame> | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionState, setSessionState] = useState<SessionRunnerState>(
    engineRef.current.getState(),
  );
  const [runtimeResult, setRuntimeResult] = useState<RuntimeFrameResult | null>(null);

  const demoSession = useMemo(() => buildDemoSession(), []);

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
      ? "Tracking..."
      : "Idle");

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      if (streamRef.current) {
        setCameraStarted(true);
        engineRef.current.markCameraActive(true);
        setSessionState(engineRef.current.getState());
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Video element is not available.");
      }

      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      setCameraStarted(true);
      engineRef.current.markCameraActive(true);
      setSessionState(engineRef.current.getState());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start video source.";
      setError(message);
      setCameraStarted(false);
      engineRef.current.markCameraActive(false);
      setSessionState(engineRef.current.getState());
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
    engineRef.current.markCameraActive(false);
    setSessionState(engineRef.current.getState());
  }, []);

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

  const processLoop = useCallback(async () => {
    const video = videoRef.current;

    if (!video || !streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => {
        void processLoop();
      });
      return;
    }

    try {
      const detectorPose = await getMockPoseFrameFromVideo(video);

      if (detectorPose) {
        const rawPose = mapDetectorKeypointsToRaw(detectorPose, video);
        const poseFrame = buildPoseFrame(rawPose);
        const biomechanicsFrame = buildBiomechanicsFrame(
          poseFrame,
          previousBiomechFrameRef.current,
        );

        previousBiomechFrameRef.current = biomechanicsFrame;

        const result = engineRef.current.processFrame(biomechanicsFrame);

        setRuntimeResult(result.runtimeResult);
        setSessionState(result.sessionState);
      } else {
        setSessionState(engineRef.current.getState());
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Pose processing failed.";
      setError(message);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      void processLoop();
    });
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!cameraStarted) return;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      void processLoop();
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [cameraStarted, processLoop]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const completedExercises = sessionState.progress.completedExerciseIds.length;
  const totalExercises = sessionState.progress.totalExercises;

  return (
    <div className="w-full p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Session Runner</h1>
          <p className="text-sm text-gray-600">
            Minimal runner pattern with persistent camera and frame loop.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Live Camera</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                {cameraStarted ? "Camera Active" : "Camera Off"}
              </span>
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
                onClick={startCamera}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Start Camera
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

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={loadSession}
                  className="rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  Load Demo Session
                </button>

                <button
                  onClick={startSession}
                  disabled={!sessionLoaded}
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
                sessionStatus: sessionState.status,
                currentExercise: sessionState.currentItem?.exercise.title ?? null,
                currentIndex: sessionState.progress.currentIndex,
                totalExercises: sessionState.progress.totalExercises,
                completedExerciseIds: sessionState.progress.completedExerciseIds,
                totalRepsCompleted: sessionState.progress.totalRepsCompleted,
                runtimeStatus: runtimeResult?.status ?? null,
                repState: runtimeResult?.exerciseState?.repState ?? null,
                coachingMessage,
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
