'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@mediapipe/pose';

import type {
  DebugState,
  ExerciseFrameFeatures,
  ExerciseMachine
} from '../lib/poseTypes';

import {
  buildPoseTrack,
  keypointsToMap,
  SKELETON_EDGES,
  smoothPose,
  visibleKeypointCount
} from '../lib/poseUtils';

import { extractFeatures } from '../lib/features/extractFeatures';
import { stabilizeFeatures } from '../lib/features/stabilizeFeatures';
import { EXERCISE_OPTIONS, EXERCISE_REGISTRY } from '../lib/exercises/exerciseRegistry';
import {
  computeTargetFrame,
  createDefaultFrame,
  mapPointFromVideoToFrame,
  mapRectFromVideoToFrame,
  smoothFrame,
  type FrameRect
} from '../lib/framing/autoFramer';

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 720;
const DETECTION_INTERVAL_MS = 50;
const PERSON_ID = 1;
const LOST_AFTER_MS = 2000;

const DEFAULT_EXERCISE_ID = 'raise_right_hand';

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
};

export default function PoseTrackerPage({
  selectedExerciseId: selectedExerciseIdProp,
  sessionMode = false,
  targetReps,
  targetHoldSeconds,
  onExerciseComplete
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
  const stableFeaturesRef = useRef<ExerciseFrameFeatures | null>(null);
  const autoFrameRef = useRef<FrameRect | null>(null);
  const completedCalledRef = useRef(false);

  const [localExerciseId, setLocalExerciseId] = useState(DEFAULT_EXERCISE_ID);

  const selectedExerciseId = sessionMode
    ? selectedExerciseIdProp ?? DEFAULT_EXERCISE_ID
    : localExerciseId;

  const selectedExercise = useMemo(() => {
    return EXERCISE_REGISTRY[selectedExerciseId] ?? EXERCISE_REGISTRY[DEFAULT_EXERCISE_ID];
  }, [selectedExerciseId]);

  const machineRef = useRef<ExerciseMachine>(selectedExercise.createMachine());

  const [isRunning, setIsRunning] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [autoFramingEnabled, setAutoFramingEnabled] = useState(true);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState<DebugState>({
    fps: 0,
    tracking: 'idle',
    personDetected: false,
    trackId: null,
    confidence: 0,
    visibleKeypoints: 0,
    posture: 'unknown',
    avgKneeAngle: 0,
    exerciseId: DEFAULT_EXERCISE_ID,
    exercisePhase: 'idle',
    repCount: 0,
    holdMs: 0,
    statusText: 'Get ready',
    currentLiftNorm: 0,
    currentRepPeakLift: 0,
    lastRepPeakLift: null,
    sessionPeakLift: 0
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    machineRef.current = selectedExercise.createMachine();
    stableFeaturesRef.current = null;
    completedCalledRef.current = false;

    setDebug((prev) => ({
      ...prev,
      exerciseId: selectedExercise.id,
      posture: 'unknown',
      avgKneeAngle: 0,
      exercisePhase: 'idle',
      repCount: 0,
      holdMs: 0,
      statusText: 'Get ready',
      currentLiftNorm: 0,
      currentRepPeakLift: 0,
      lastRepPeakLift: null,
      sessionPeakLift: 0
    }));
  }, [selectedExercise]);

  useEffect(() => {
    if (!sessionMode || !onExerciseComplete || completedCalledRef.current) return;
    if (!targetReps) return;

    if (debug.repCount >= targetReps) {
      completedCalledRef.current = true;
      onExerciseComplete({
        completedReps: debug.repCount,
        sessionPeakLift: debug.sessionPeakLift,
        lastRepPeakLift: debug.lastRepPeakLift
      });
    }
  }, [
    debug.repCount,
    debug.sessionPeakLift,
    debug.lastRepPeakLift,
    targetReps,
    sessionMode,
    onExerciseComplete
  ]);

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

  async function startCamera() {
    try {
      setError('');

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not available.');
      }

      const stream = await getCameraStream();
      streamRef.current = stream;

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      await ensureDetector();

      machineRef.current = selectedExercise.createMachine();
      stableFeaturesRef.current = null;
      autoFrameRef.current = null;
      completedCalledRef.current = false;

      setDebug({
        fps: 0,
        tracking: 'idle',
        personDetected: false,
        trackId: null,
        confidence: 0,
        visibleKeypoints: 0,
        posture: 'unknown',
        avgKneeAngle: 0,
        exerciseId: selectedExercise.id,
        exercisePhase: 'idle',
        repCount: 0,
        holdMs: 0,
        statusText: 'Get ready',
        currentLiftNorm: 0,
        currentRepPeakLift: 0,
        lastRepPeakLift: null,
        sessionPeakLift: 0
      });

      setIsRunning(true);
      lastSeenRef.current = performance.now();
      lastRunRef.current = 0;
      frameCountRef.current = 0;
      lastFpsTickRef.current = performance.now();

      if (animationRef.current != null) {
        cancelAnimationFrame(animationRef.current);
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      console.error('Camera/model start failed:', err);

      let message = 'Unknown error';
      if (err instanceof Error) {
        message = `${err.name}: ${err.message}`;
      } else if (typeof err === 'string') {
        message = err;
      }

      setError(message);
    }
  }

  function stopCamera() {
    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    activeTrackRef.current = null;
    stableFeaturesRef.current = null;
    autoFrameRef.current = null;
    machineRef.current = selectedExercise.createMachine();
    completedCalledRef.current = false;

    setIsRunning(false);
    setDebug({
      fps: 0,
      tracking: 'idle',
      personDetected: false,
      trackId: null,
      confidence: 0,
      visibleKeypoints: 0,
      posture: 'unknown',
      avgKneeAngle: 0,
      exerciseId: selectedExercise.id,
      exercisePhase: 'idle',
      repCount: 0,
      holdMs: 0,
      statusText: 'Get ready',
      currentLiftNorm: 0,
      currentRepPeakLift: 0,
      lastRepPeakLift: null,
      sessionPeakLift: 0
    });

    clearCanvas();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

          const rawFeatures = extractFeatures(smoothedPose, ts);
          const stableFeatures = stabilizeFeatures(rawFeatures, stableFeaturesRef.current);
          stableFeaturesRef.current = stableFeatures;

          machineRef.current = selectedExercise.advance(machineRef.current, stableFeatures);

          setDebug((prev) => ({
            ...prev,
            tracking: 'active',
            personDetected: true,
            trackId: smoothedPose.id,
            confidence: smoothedPose.confidence,
            visibleKeypoints: visibleKeypointCount(smoothedPose.keypoints),
            posture: stableFeatures.posture,
            avgKneeAngle: stableFeatures.avgKneeAngle,
            exerciseId: selectedExercise.id,
            exercisePhase: machineRef.current.phase,
            repCount: machineRef.current.repCount,
            holdMs: machineRef.current.holdMs,
            statusText:
              targetHoldSeconds && targetHoldSeconds > 0
                ? `${machineRef.current.statusText} (target hold ${targetHoldSeconds}s)`
                : machineRef.current.statusText,
            currentLiftNorm: selectedExercise.getCurrentLift(stableFeatures),
            currentRepPeakLift: machineRef.current.currentRepPeakLift,
            lastRepPeakLift: machineRef.current.lastRepPeakLift,
            sessionPeakLift: machineRef.current.sessionPeakLift
          }));
        }
      } else {
        if (ts - lastSeenRef.current > LOST_AFTER_MS) {
          activeTrackRef.current = null;
          stableFeaturesRef.current = null;
          autoFrameRef.current = null;
          machineRef.current = selectedExercise.createMachine();
          trackForDraw = null;

          setDebug((prev) => ({
            ...prev,
            tracking: 'lost',
            personDetected: false,
            trackId: null,
            confidence: 0,
            visibleKeypoints: 0,
            posture: 'unknown',
            avgKneeAngle: 0,
            exerciseId: selectedExercise.id,
            exercisePhase: 'lost',
            holdMs: 0,
            statusText: 'Person lost - step back into frame',
            currentLiftNorm: 0,
            currentRepPeakLift: 0
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
      autoFrameRef.current = fallbackFrame;
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
        if (kp.score < 0.25) continue;

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
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        {!sessionMode && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Exercise</div>
              <select
                value={selectedExerciseId}
                onChange={(e) => setLocalExerciseId(e.target.value)}
                style={selectStyle}
              >
                {EXERCISE_OPTIONS.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Prompt</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{machineRef.current.prompt}</div>
            </div>
          </div>
        )}

        {sessionMode && (
          <div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Current Exercise</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{machineRef.current.prompt}</div>
            {targetReps ? (
              <div style={{ marginTop: 8, color: '#cbd5e1' }}>
                Target reps: {targetReps} | Completed reps: {debug.repCount}
              </div>
            ) : null}
          </div>
        )}

        <div style={{ marginTop: 8, color: '#cbd5e1' }}>{debug.statusText}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
          alignItems: 'start'
        }}
      >
        <section>
          <div
            style={{
              position: 'relative',
              background: '#050816',
              borderRadius: 16,
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

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
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
              onClick={() => setAutoFramingEnabled((v) => !v)}
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
        </section>

        <aside style={{ ...cardStyle, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Debug Panel</h2>
          <Metric label="Tracking State" value={debug.tracking} />
          <Metric label="Person Detected" value={debug.personDetected ? 'Yes' : 'No'} />
          <Metric label="Track ID" value={debug.trackId ?? '—'} />
          <Metric label="Visible Keypoints" value={debug.visibleKeypoints} />
          <Metric label="Confidence" value={`${(debug.confidence * 100).toFixed(0)}%`} />
          <Metric label="FPS" value={debug.fps} />
          <Metric label="Posture" value={debug.posture} />
          <Metric label="Avg Knee Angle" value={Math.round(debug.avgKneeAngle)} />
          <Metric label="Exercise" value={selectedExercise.label} />
          <Metric label="Exercise Phase" value={debug.exercisePhase} />
          <Metric label="Rep Count" value={debug.repCount} />
          <Metric label="Hold (ms)" value={Math.round(debug.holdMs)} />
          <Metric label="Current Lift" value={debug.currentLiftNorm.toFixed(3)} />
          <Metric label="Rep Peak Lift" value={debug.currentRepPeakLift.toFixed(3)} />
          <Metric
            label="Last Rep Peak"
            value={debug.lastRepPeakLift !== null ? debug.lastRepPeakLift.toFixed(3) : '—'}
          />
          <Metric label="Session Best Lift" value={debug.sessionPeakLift.toFixed(3)} />
          <Metric label="Auto-Framing" value={autoFramingEnabled ? 'On' : 'Off'} />

          <div style={{ marginTop: 18, color: '#b6c2df', fontSize: 14, lineHeight: 1.6 }}>
            {sessionMode
              ? 'Session mode is active. Complete the target reps to advance.'
              : 'Standalone exercise mode. Auto-framing keeps the whole person centered in view.'}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid #1f2942'
      }}
    >
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <strong>{value}</strong>
    </div>
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

const cardStyle: CSSProperties = {
  background: '#121a31',
  border: '1px solid #1f2942',
  borderRadius: 16,
  padding: 16
};

const selectStyle: CSSProperties = {
  background: '#0f172a',
  color: 'white',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '10px 12px',
  fontWeight: 600
};
