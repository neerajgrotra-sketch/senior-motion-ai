// components/SessionRunner.tsx

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

import { buildPoseFrame } from "../lib/pose/buildPoseFrame";
import { buildBiomechanicsFrame } from "../lib/biomechanics/buildBiomechanicsFrame";
import { createSessionRunnerEngine } from "../lib/session/createSessionRunnerEngine";
import { buildDemoSession } from "../lib/session/buildDemoSession";
import { SessionRunnerState } from "../lib/session/sessionTypes";
import { RuntimeFrameResult } from "../lib/runtime/runtimeTypes";
import { RawPoseFrame, RawPoseKeypoint, PoseLandmarkName } from "../lib/pose/poseTypes";

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

const BLAZEPOSE_KEYPOINT_NAMES: PoseLandmarkName[] = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
];

function formatStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function mapDetectorPoseToResult(
  pose: posedetection.Pose,
): DetectorPoseResult | null {
  if (!pose.keypoints || pose.keypoints.length === 0) {
    return null;
  }

  const keypoints: DetectorKeypoint[] = pose.keypoints.map((kp, index) => ({
    name:
      typeof kp.name === "string"
        ? kp.name
        : BLAZEPOSE_KEYPOINT_NAMES[index],
    x: kp.x,
    y: kp.y,
    z: kp.z,
    score: kp.score,
  }));

  return { keypoints };
}

function mapDetectorKeypointsToRaw(
  detectorPose: DetectorPoseResult,
  video: HTMLVideoElement,
): RawPoseFrame {
  const keypoints: RawPoseKeypoint[] = detectorPose.keypoints
    .filter(
      (
        kp,
      ): kp is Required<Pick<DetectorKeypoint, "x" | "y">> &
        DetectorKeypoint & { name: PoseLandmarkName } =>
        typeof kp.name === "string" &&
        BLAZEPOSE_KEYPOINT_NAMES.includes(kp.name as PoseLandmarkName),
    )
    .map((kp) => ({
      name: kp.name,
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

async function estimatePoseFromVideo(
  detector: posedetection.PoseDetector,
  video: HTMLVideoElement,
): Promise<DetectorPoseResult | null> {
  const poses = await detector.estimatePoses(video, {
    flipHorizontal: false,
  });

  const pose = poses[0];
  if (!pose) {
    return null;
  }

  return mapDetectorPoseToResult(pose);
}

export default function SessionRunner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processingRef = useRef(false);

  const engineRef = useRef(createSessionRunnerEngine());
  const previousBiomechFrameRef = useRef<ReturnType<typeof buildBiomechanicsFrame> | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);
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

    processingRef.current = false;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    previousBiomechFrameRef.current = null;
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
    const detector = detectorRef.current;

    if (!video || !streamRef.current || !detector) {
      animationFrameRef.current = requestAnimationFrame(() => {
        void processLoop();
      });
      return;
    }

    if (processingRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => {
        void processLoop();
      });
      return;
    }

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(() => {
        void processLoop();
      });
      return;
    }

    processingRef.current = true;

    try {
      const detectorPose = await estimatePoseFromVideo(detector, video);

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
    } finally {
      processingRef.current = false;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      void processLoop();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initDetector() {
      try {
        setError(null);
        setDetectorReady(false);

        const detector = await posedetection.createDetector(
          posedetection.SupportedModels.BlazePose,
          {
            runtime: "mediapipe",
            modelType: "full",
            enableSmoothing: true,
            solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/pose",
          },
        );

        if (cancelled) {
          detector.dispose();
          return;
        }

        detectorRef.current = detector;
        setDetectorReady(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to initialize pose detector.";
        setError(message);
        setDetectorReady(false);
      }
    }

    void initDetector();

    return () => {
      cancelled = true;
      detectorRef.current?.dispose();
      detectorRef.current = null;
      setDetectorReady(false);
    };
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!cameraStarted || !detectorReady) {
      return;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      void processLoop();
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      processingRef.current = false;
    };
  }, [cameraStarted, detectorReady, processLoop]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      processingRef.current = false;

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      detectorRef.current?.dispose();
      detectorRef.current = null;
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
            Persistent camera + BlazePose + session engine.
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
                detectorReady,
                cameraStarted,
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
