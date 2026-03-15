'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, useCallback } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@mediapipe/pose';

import type { DebugState } from '../lib/poseTypes';
import type { PoseLandmarks } from '../lib/exercises/exerciseIntentTypes';
import type { SessionControlSignal } from '../lib/sessionTypes';

import {
  buildPoseTrack,
  keypointsToMap,
  SKELETON_EDGES,
  smoothPose,
  visibleKeypointCount
} from '../lib/poseUtils';

import {
  computeTargetFrame,
  createDefaultFrame,
  mapPointFromVideoToFrame,
  mapRectFromVideoToFrame,
  smoothFrame,
  type FrameRect
} from '../lib/framing/autoFramer';
import { assessFraming } from '../lib/framing/framingAdvisor';
import { mapTrackKeypointsToIntentLandmarks } from '../lib/pose/mapTrackKeypointsToIntentLandmarks';

import { extractBiomechanicsSignals } from '../lib/biomechanics/signalExtractor';
import { advanceExerciseRuntime } from '../lib/biomechanics/runtimeEngine';
import {
  createInitialRuntimeState,
  type ExerciseDefinition,
  type RuntimeAssessment,
  type RuntimeState
} from '../lib/biomechanics/types';
import { RAISE_RIGHT_HAND_DEFINITION } from '../lib/biomechanics/exerciseDefinitions';

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 720;
const DETECTION_INTERVAL_MS = 50;
const PERSON_ID = 1;
const LOST_AFTER_MS = 2000;

type Props = {
  selectedExerciseId?: string;
  sessionMode?: boolean;
  targetReps?: number;
  targetHoldSeconds?: number;
  onExerciseComplete?: (result: {
    completedReps: number;
    sessionPeakLift: number;
    lastRepPeakLift: number | null;
  }) => void;
  externalStatusText?: string;
  exerciseEnabled?: boolean;
  onDebugStateChange?: (debug: DebugState) => void;
  onControlGesture?: (signal: SessionControlSignal) => void;
  onPoseLandmarksChange?: (landmarks: PoseLandmarks) => void;
};

type PreviousFrameState = {
  timestamp: number;
  leftWristY: number;
  rightWristY: number;
  leftKneeY: number;
  rightKneeY: number;
};

type RuntimeStats = {
  sessionPeakLift: number;
  currentRepPeakLift: number;
  lastRepPeakLift: number | null;
};

function getDefinitionForExerciseId(_exerciseId?: string): ExerciseDefinition {
  // Temporary during migration to the new biomechanics engine.
  // Extend this when you add more biomechanics-backed exercise definitions.
  return RAISE_RIGHT_HAND_DEFINITION;
}

function getInitialDebugState(exerciseId: string): DebugState {
  return {
    fps: 0,
    tracking: 'idle',
    personDetected: false,
    trackId: null,
    confidence: 0,
    visibleKeypoints: 0,
    posture: 'unknown',
    avgKneeAngle: 0,
    exerciseId,
    exercisePhase: 'idle',
    repCount: 0,
    holdMs: 0,
    statusText: 'Get ready',
    currentLiftNorm: 0,
    currentRepPeakLift: 0,
    lastRepPeakLift: null,
    sessionPeakLift: 0,
    framingStatus: 'no_person',
    framingMessage: 'Step into the frame'
  };
}

function mapCameraError(err: unknown): string {
  const error = err as { name?: string; message?: string };

  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Please allow camera access in your browser and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Could not start video source. The camera may already be in use by another app, tab, or browser window.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'The selected camera settings are not supported by this device.';
    case 'AbortError':
      return 'Camera startup was interrupted. Please try again.';
    case 'SecurityError':
      return 'Camera access is blocked by browser security settings.';
    default:
      return error?.message || 'Could not start camera.';
  }
}

function mapRuntimePhaseToLegacyPhase(phase: RuntimeAssessment['phase']): DebugState['exercisePhase'] {
  switch (phase) {
    case 'idle':
      return 'idle';
    case 'ready':
      return 'idle';
    case 'ascending':
      return 'moving_up';
    case 'holding':
      return 'holding';
    case 'descending':
      return 'moving_down';
    case 'rep_complete':
    case 'completed':
      return 'rep_complete';
    case 'stalled':
      return 'idle';
    case 'lost_tracking':
      return 'lost';
    default:
      return 'idle';
  }
}

export default function PoseTrackerPage({
  selectedExerciseId,
  sessionMode = false,
  targetReps,
  targetHoldSeconds,
  onExerciseComplete,
  externalStatusText,
  exerciseEnabled = true,
  onDebugStateChange,
  onControlGesture,
  onPoseLandmarksChange
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationRef = useRef<number | null>(null);

  const lastRunRef = useRef<number>(0);
  const lastFpsTickRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastSeenRef = useRef<number>(0);
  const activeTrackRef = useRef<ReturnType<typeof buildPoseTrack> | null>(null);
  const autoFrameRef = useRef<FrameRect | null>(null);
  const startGestureSinceRef = useRef<number | null>(null);
  const isStartingRef = useRef(false);
  const completedCalledRef = useRef(false);
  const autoStartedRef = useRef(false);

  const previousFrameRef = useRef<PreviousFrameState | null>(null);
  const runtimeStateRef = useRef<RuntimeState>(createInitialRuntimeState(performance.now()));
  const runtimeStatsRef = useRef<RuntimeStats>({
    sessionPeakLift: 0,
    currentRepPeakLift: 0,
    lastRepPeakLift: null
  });

  const onPoseLandmarksChangeRef = useRef<Props['onPoseLandmarksChange']>(onPoseLandmarksChange);
  const onControlGestureRef = useRef<Props['onControlGesture']>(onControlGesture);
  const onExerciseCompleteRef = useRef<Props['onExerciseComplete']>(onExerciseComplete);
  const externalStatusTextRef = useRef(externalStatusText);
  const exerciseEnabledRef = useRef(exerciseEnabled);
  const targetHoldSecondsRef = useRef(targetHoldSeconds);

  useEffect(() => {
    onPoseLandmarksChangeRef.current = onPoseLandmarksChange;
  }, [onPoseLandmarksChange]);

  useEffect(() => {
    onControlGestureRef.current = onControlGesture;
  }, [onControlGesture]);

  useEffect(() => {
    onExerciseCompleteRef.current = onExerciseComplete;
  }, [onExerciseComplete]);

  useEffect(() => {
    externalStatusTextRef.current = externalStatusText;
  }, [externalStatusText]);

  useEffect(() => {
    exerciseEnabledRef.current = exerciseEnabled;
  }, [exerciseEnabled]);

  useEffect(() => {
    targetHoldSecondsRef.current = targetHoldSeconds;
  }, [targetHoldSeconds]);

  const exerciseDefinition = useMemo(() => {
    return getDefinitionForExerciseId(selectedExerciseId);
  }, [selectedExerciseId]);

  const [isRunning, setIsRunning] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [autoFramingEnabled, setAutoFramingEnabled] = useState(false);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState<DebugState>(getInitialDebugState(exerciseDefinition.id));

  const resetRuntimeState = useCallback((definition: ExerciseDefinition) => {
    activeTrackRef.current = null;
    autoFrameRef.current = null;
    previousFrameRef.current = null;
    startGestureSinceRef.current = null;
    completedCalledRef.current = false;

    runtimeStateRef.current = createInitialRuntimeState(performance.now());
    runtimeStatsRef.current = {
      sessionPeakLift: 0,
      currentRepPeakLift: 0,
      lastRepPeakLift: null
    };

    lastSeenRef.current = performance.now();
    lastRunRef.current = 0;
    frameCountRef.current = 0;
    lastFpsTickRef.current = performance.now();

    setDebug(getInitialDebugState(definition.id));
  }, []);

  useEffect(() => {
    resetRuntimeState(exerciseDefinition);
    setDebug((prev) => ({
      ...getInitialDebugState(exerciseDefinition.id),
      fps: prev.fps,
      tracking: prev.tracking
    }));
  }, [exerciseDefinition, resetRuntimeState]);

  useEffect(() => {
    if (!sessionMode || completedCalledRef.current) return;
    if (!targetReps) return;

    if (debug.repCount >= targetReps) {
      completedCalledRef.current = true;
      onExerciseCompleteRef.current?.({
        completedReps: debug.repCount,
        sessionPeakLift: debug.sessionPeakLift,
        lastRepPeakLift: debug.lastRepPeakLift
      });
    }
  }, [debug.repCount, debug.sessionPeakLift, debug.lastRepPeakLift, targetReps, sessionMode]);

  useEffect(() => {
    onDebugStateChange?.(debug);
  }, [debug, onDebugStateChange]);

  const releaseMediaResources = useCallback(() => {
    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // no-op
        }
      }
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        // no-op
      }
      video.srcObject = null;
      video.load?.();
    }
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  async function ensureDetector() {
    if (!detectorRef.current) {
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose,
        {
          runtime: 'mediapipe',
          modelType: 'full',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose'
        }
      );
    }

    return detectorRef.current;
  }

  async function getCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser.');
    }

    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: 'user',
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT }
        },
        audio: false
      },
      {
        video: {
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT }
        },
        audio: false
      },
      {
        video: true,
        audio: false
      }
    ];

    let lastError: unknown = null;

    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastError = err;
        console.error('Camera attempt failed:', constraints, err);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Could not access camera.');
  }

  const stopCamera = useCallback(() => {
    releaseMediaResources();
    resetRuntimeState(exerciseDefinition);
    setIsRunning(false);
    clearCanvas();
  }, [releaseMediaResources, resetRuntimeState, exerciseDefinition, clearCanvas]);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;

    isStartingRef.current = true;

    try {
      setError('');
      releaseMediaResources();
      resetRuntimeState(exerciseDefinition);
      clearCanvas();

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not available.');
      }

      const stream = await getCameraStream();
      streamRef.current = stream;

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      await video.play();
      await ensureDetector();

      setIsRunning(true);
      animationRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      console.error(err);
      releaseMediaResources();
      resetRuntimeState(exerciseDefinition);
      clearCanvas();
      setIsRunning(false);
      setError(mapCameraError(err));
    } finally {
      isStartingRef.current = false;
    }
  }, [releaseMediaResources, resetRuntimeState, exerciseDefinition, clearCanvas]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  function handleToggleAutoFraming() {
    setAutoFramingEnabled((prev) => {
      autoFrameRef.current = null;
      return !prev;
    });
  }

  async function renderLoop(ts: number) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;

    if (!video || !canvas || !detector || !streamRef.current) {
      animationRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    if (video.readyState < 2) {
      animationRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    let trackForDraw = activeTrackRef.current;

    if (ts - lastRunRef.current >= DETECTION_INTERVAL_MS) {
      lastRunRef.current = ts;

      const poses = await detector.estimatePoses(video, { flipHorizontal: false });
      const pose = poses[0];

      if (pose?.keypoints?.length) {
        const pointMap = keypointsToMap(pose.keypoints as any[]);
        const built = buildPoseTrack(PERSON_ID, pointMap);

        if (built) {
          const smoothedPose = smoothPose(built, activeTrackRef.current, 0.35);
          activeTrackRef.current = smoothedPose;
          trackForDraw = smoothedPose;
          lastSeenRef.current = ts;

          const intentLandmarks = mapTrackKeypointsToIntentLandmarks(
            smoothedPose.keypoints as Record<
              string,
              {
                x: number;
                y: number;
                z?: number;
                score?: number;
              }
            >
          );

          onPoseLandmarksChangeRef.current?.(intentLandmarks);

          const { signals, nextPreviousFrame } = extractBiomechanicsSignals({
            track: smoothedPose,
            timestamp: ts,
            previousFrame: previousFrameRef.current,
            runtime: {
              repStartedAt: runtimeStateRef.current.repStartedAt,
              phaseStartedAt: runtimeStateRef.current.phaseStartedAt,
              holdStartedAt: runtimeStateRef.current.holdStartedAt
            }
          });

          previousFrameRef.current = nextPreviousFrame;

          const eitherHandUp =
            signals.leftHandLiftNorm > 0.18 || signals.rightHandLiftNorm > 0.18;

          let gestureHoldMs = 0;

          if (eitherHandUp) {
            if (startGestureSinceRef.current == null) {
              startGestureSinceRef.current = ts;
            }
            gestureHoldMs = ts - startGestureSinceRef.current;
          } else {
            startGestureSinceRef.current = null;
          }

          onControlGestureRef.current?.({
            detected: eitherHandUp,
            holdMs: gestureHoldMs
          });

          let assessment: RuntimeAssessment = {
            phase: runtimeStateRef.current.phase,
            repCount: runtimeStateRef.current.repCount,
            progress: 0,
            activeErrors: [],
            primaryCue: exerciseDefinition.cues.ready,
            currentLift: 0,
            holdMs: 0
          };

          if (exerciseEnabledRef.current) {
            const runtimeDefinition: ExerciseDefinition = {
              ...exerciseDefinition,
              thresholds: {
                ...exerciseDefinition.thresholds,
                minHoldMs:
                  targetHoldSecondsRef.current != null
                    ? Math.max(0, Math.round(targetHoldSecondsRef.current * 1000))
                    : exerciseDefinition.thresholds.minHoldMs
              }
            };

            const runtimeResult = advanceExerciseRuntime({
              definition: runtimeDefinition,
              signals,
              state: runtimeStateRef.current
            });

            runtimeStateRef.current = runtimeResult.state;
            assessment = runtimeResult.assessment;
          }

          const currentLift = assessment.currentLift;
          runtimeStatsRef.current.sessionPeakLift = Math.max(
            runtimeStatsRef.current.sessionPeakLift,
            currentLift
          );
          runtimeStatsRef.current.currentRepPeakLift = Math.max(
            runtimeStatsRef.current.currentRepPeakLift,
            currentLift
          );

          if (assessment.phase === 'rep_complete') {
            runtimeStatsRef.current.lastRepPeakLift = runtimeStatsRef.current.currentRepPeakLift;
            runtimeStatsRef.current.currentRepPeakLift = 0;
          }

          const framing = assessFraming({
            track: smoothedPose,
            frameWidth: video.videoWidth,
            frameHeight: video.videoHeight,
            overheadMode: true
          });

          const avgKneeAngle =
            ((signals.leftKneeAngleDeg ?? 0) + (signals.rightKneeAngleDeg ?? 0)) / 2;

          setDebug((prev) => ({
            ...prev,
            tracking: 'active',
            personDetected: true,
            trackId: smoothedPose.id,
            confidence: smoothedPose.confidence,
            visibleKeypoints: visibleKeypointCount(smoothedPose.keypoints),
            posture: signals.posture,
            avgKneeAngle,
            exerciseId: exerciseDefinition.id,
            exercisePhase: mapRuntimePhaseToLegacyPhase(assessment.phase),
            repCount: assessment.repCount,
            holdMs: assessment.holdMs,
            statusText: externalStatusTextRef.current
              ? externalStatusTextRef.current
              : assessment.primaryCue ?? exerciseDefinition.cues.ready,
            currentLiftNorm: assessment.currentLift,
            currentRepPeakLift: runtimeStatsRef.current.currentRepPeakLift,
            lastRepPeakLift: runtimeStatsRef.current.lastRepPeakLift,
            sessionPeakLift: runtimeStatsRef.current.sessionPeakLift,
            framingStatus: framing.status,
            framingMessage: framing.message
          }));
        }
      } else {
        if (ts - lastSeenRef.current > LOST_AFTER_MS) {
          activeTrackRef.current = null;
          autoFrameRef.current = null;
          previousFrameRef.current = null;
          startGestureSinceRef.current = null;
          runtimeStateRef.current = createInitialRuntimeState(ts);
          trackForDraw = null;

          onControlGestureRef.current?.({ detected: false, holdMs: 0 });

          setDebug((prev) => ({
            ...prev,
            tracking: 'lost',
            personDetected: false,
            trackId: null,
            confidence: 0,
            visibleKeypoints: 0,
            posture: 'unknown',
            avgKneeAngle: 0,
            exerciseId: exerciseDefinition.id,
            exercisePhase: 'lost',
            holdMs: 0,
            statusText: externalStatusTextRef.current ?? 'Person lost - step back into frame',
            currentLiftNorm: 0,
            currentRepPeakLift: 0,
            framingStatus: 'no_person',
            framingMessage: 'Step into the frame'
          }));
        }
      }
    }

    drawScene(ctx, video, trackForDraw, canvas.width, canvas.height);

    frameCountRef.current += 1;
    if (ts - lastFpsTickRef.current >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / (ts - lastFpsTickRef.current));
      frameCountRef.current = 0;
      lastFpsTickRef.current = ts;
      setDebug((prev) => ({ ...prev, fps }));
    }

    animationRef.current = requestAnimationFrame(renderLoop);
  }

  function drawScene(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    track: NonNullable<typeof activeTrackRef.current> | null,
    outputWidth: number,
    outputHeight: number
  ) {
    ctx.clearRect(0, 0, outputWidth, outputHeight);

    const fallbackFrame = createDefaultFrame(video.videoWidth, video.videoHeight);
    let frame = fallbackFrame;

    if (autoFramingEnabled && track) {
      const targetFrame = computeTargetFrame({
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        bbox: track.bbox
      });

      const smoothedFrame = smoothFrame(targetFrame, autoFrameRef.current);
      autoFrameRef.current = smoothedFrame;
      frame = smoothedFrame;
    } else {
      autoFrameRef.current = null;
      frame = fallbackFrame;
    }

    ctx.drawImage(
      video,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      outputWidth,
      outputHeight
    );

    if (!track) return;

    drawOverlay(ctx, track, frame, outputWidth, outputHeight, outputHeight);
  }

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    track: NonNullable<typeof activeTrackRef.current>,
    frame: FrameRect,
    outputWidth: number,
    outputHeight: number,
    canvasHeight: number
  ) {
    ctx.save();

    if (showBox) {
      const mappedBox = mapRectFromVideoToFrame(track.bbox, frame, outputWidth, outputHeight);

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(mappedBox.x, mappedBox.y, mappedBox.width, mappedBox.height);

      ctx.fillStyle = '#22c55e';
      ctx.font = '18px Arial';
      ctx.fillText(`ID ${track.id}`, mappedBox.x, Math.max(20, mappedBox.y - 8));
    }

    if (showSkeleton) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;

      for (const [a, b] of SKELETON_EDGES) {
        const p1 = track.keypoints[a];
        const p2 = track.keypoints[b];
        if (!p1 || !p2 || p1.score < 0.25 || p2.score < 0.25) continue;

        const mp1 = mapPointFromVideoToFrame(p1, frame, outputWidth, outputHeight);
        const mp2 = mapPointFromVideoToFrame(p2, frame, outputWidth, outputHeight);

        ctx.beginPath();
        ctx.moveTo(mp1.x, mp1.y);
        ctx.lineTo(mp2.x, mp2.y);
        ctx.stroke();
      }
    }

    if (showDots) {
      for (const kp of Object.values(track.keypoints)) {
        if (!kp || kp.score < 0.25) continue;

        const mapped = mapPointFromVideoToFrame(kp, frame, outputWidth, outputHeight);

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(mapped.x, mapped.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px Arial';
    ctx.fillText(`Confidence: ${(track.confidence * 100).toFixed(0)}%`, 16, canvasHeight - 18);

    ctx.restore();
  }

  return (
    <div>
      {!sessionMode && (
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Exercise</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{exerciseDefinition.label}</div>
            </div>
          </div>

          <div style={{ marginTop: 8, color: '#cbd5e1' }}>
            {externalStatusText ?? debug.statusText}
          </div>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          background: '#050816',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid #1f2942'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: 'auto',
            display: 'none'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto'
          }}
        />

        {!isRunning && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: '#94a3b8',
              background: 'rgba(2,6,23,.45)'
            }}
          >
            Camera is off
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <button onClick={startCamera} style={buttonStyle('#2563eb')}>
          Start Camera
        </button>
        <button onClick={stopCamera} style={buttonStyle('#334155')}>
          Stop Camera
        </button>
        <button onClick={() => setShowSkeleton((v) => !v)} style={buttonStyle('#0f766e')}>
          {showSkeleton ? 'Hide Skeleton' : 'Show Skeleton'}
        </button>
        <button onClick={() => setShowBox((v) => !v)} style={buttonStyle('#7c3aed')}>
          {showBox ? 'Hide Box' : 'Show Box'}
        </button>
        <button onClick={() => setShowDots((v) => !v)} style={buttonStyle('#b45309')}>
          {showDots ? 'Hide Keypoints' : 'Show Keypoints'}
        </button>
        <button
          onClick={handleToggleAutoFraming}
          style={buttonStyle(autoFramingEnabled ? '#15803d' : '#475569')}
        >
          {autoFramingEnabled ? 'Auto-Framing On' : 'Auto-Framing Off'}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            background: '#3f1119',
            color: '#fecdd3',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #7f1d1d',
            whiteSpace: 'pre-wrap'
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function buttonStyle(bg: string): CSSProperties {
  return {
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer'
  };
}

const cardStyle: CSSProperties = {
  background: '#121a31',
  border: '1px solid #1f2942',
  borderRadius: 16,
  padding: 16
};      
