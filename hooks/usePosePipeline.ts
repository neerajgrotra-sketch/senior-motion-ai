// hooks/usePosePipeline.ts

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

import { buildPoseFrame } from "../lib/pose/buildPoseFrame";
import { buildBiomechanicsFrame } from "../lib/biomechanics/buildBiomechanicsFrame";
import {
  PoseLandmarkName,
  RawPoseFrame,
  RawPoseKeypoint,
} from "../lib/pose/poseTypes";
import { BiomechanicsFrame } from "../lib/biomechanics/biomechanicsTypes";

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

type UsePosePipelineOptions = {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  modelType?: "lite" | "full" | "heavy";
  flipHorizontal?: boolean;
};

type UsePosePipelineResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  isRunning: boolean;
  isCameraOn: boolean;
  detectorReady: boolean;
  error: string | null;
  latestBiomechanicsFrame: BiomechanicsFrame | null;
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
  flipHorizontal: boolean,
): Promise<DetectorPoseResult | null> {
  const poses = await detector.estimatePoses(video, {
    flipHorizontal,
  });

  const pose = poses[0];
  if (!pose) {
    return null;
  }

  return mapDetectorPoseToResult(pose);
}

export function usePosePipeline(
  options: UsePosePipelineOptions = {},
): UsePosePipelineResult {
  const {
    facingMode = "user",
    width = 1280,
    height = 720,
    modelType = "full",
    flipHorizontal = false,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const previousBiomechFrameRef = useRef<BiomechanicsFrame | null>(null);

  const [detectorReady, setDetectorReady] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestBiomechanicsFrame, setLatestBiomechanicsFrame] =
    useState<BiomechanicsFrame | null>(null);

  const stopLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    processingRef.current = false;
    if (mountedRef.current) {
      setIsRunning(false);
    }
  }, []);

  const processLoop = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;

    if (!mountedRef.current) {
      return;
    }

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
      const detectorPose = await estimatePoseFromVideo(
        detector,
        video,
        flipHorizontal,
      );

      if (detectorPose) {
        const rawPose = mapDetectorKeypointsToRaw(detectorPose, video);
        const poseFrame = buildPoseFrame(rawPose);
        const biomechanicsFrame = buildBiomechanicsFrame(
          poseFrame,
          previousBiomechFrameRef.current,
        );

        previousBiomechFrameRef.current = biomechanicsFrame;

        if (mountedRef.current) {
          setLatestBiomechanicsFrame(biomechanicsFrame);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Pose processing failed.";
      if (mountedRef.current) {
        setError(message);
      }
    } finally {
      processingRef.current = false;
    }

    if (mountedRef.current && streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => {
        void processLoop();
      });
    }
  }, [flipHorizontal]);

  const startLoop = useCallback(() => {
    if (!mountedRef.current || !streamRef.current || !detectorRef.current) {
      return;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsRunning(true);

    animationFrameRef.current = requestAnimationFrame(() => {
      void processLoop();
    });
  }, [processLoop]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      if (!detectorRef.current) {
        throw new Error("Pose detector is not ready yet.");
      }

      if (streamRef.current) {
        if (!isRunning) {
          startLoop();
        }
        setIsCameraOn(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        throw new Error("Video element is not available.");
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      previousBiomechFrameRef.current = null;
      setLatestBiomechanicsFrame(null);
      setIsCameraOn(true);

      startLoop();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start video source.";
      setError(message);
      setIsCameraOn(false);
      stopLoop();
    }
  }, [facingMode, height, isRunning, startLoop, stopLoop, width]);

  const stopCamera = useCallback(() => {
    stopLoop();

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
    setLatestBiomechanicsFrame(null);
    setIsCameraOn(false);
  }, [stopLoop]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function initDetector() {
      try {
        setError(null);
        setDetectorReady(false);

        const detector = await posedetection.createDetector(
          posedetection.SupportedModels.BlazePose,
          {
            runtime: "mediapipe",
            modelType,
            enableSmoothing: true,
            solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/pose",
          },
        );

        if (cancelled || !mountedRef.current) {
          detector.dispose();
          return;
        }

        detectorRef.current = detector;
        setDetectorReady(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to initialize pose detector.";
        if (mountedRef.current) {
          setError(message);
          setDetectorReady(false);
        }
      }
    }

    void initDetector();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopLoop();

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, [modelType, stopLoop]);

  return {
    videoRef,
    startCamera,
    stopCamera,
    isRunning,
    isCameraOn,
    detectorReady,
    error,
    latestBiomechanicsFrame,
  };
}
