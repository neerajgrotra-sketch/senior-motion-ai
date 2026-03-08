'use client';

import { useEffect, useRef, useState } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import type { DebugState } from '@/lib/poseTypes';
import { buildPoseTrack, keypointsToMap, SKELETON_EDGES, smoothPose, visibleKeypointCount } from '@/lib/poseUtils';

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 720;
const DETECTION_INTERVAL_MS = 50;
const PERSON_ID = 1;
const LOST_AFTER_MS = 2000;

export default function PoseTrackerPage() {
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

  const [isRunning, setIsRunning] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [error, setError] = useState<string>('');
  const [debug, setDebug] = useState<DebugState>({
    fps: 0,
    tracking: 'idle',
    personDetected: false,
    trackId: null,
    confidence: 0,
    visibleKeypoints: 0
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      setError('');
      if (!detectorRef.current) {
        detectorRef.current = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
          }
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT }
        }
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setIsRunning(true);
      lastSeenRef.current = performance.now();
      animationRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      console.error(err);
      setError('Could not start the camera. Check browser permissions and confirm you are on HTTPS or localhost.');
    }
  }

  function stopCamera() {
    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    activeTrackRef.current = null;
    setIsRunning(false);
    setDebug({
      fps: 0,
      tracking: 'idle',
      personDetected: false,
      trackId: null,
      confidence: 0,
      visibleKeypoints: 0
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

    if (!video || !canvas || !detector || !isRunning) {
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

    if (ts - lastRunRef.current >= DETECTION_INTERVAL_MS) {
      lastRunRef.current = ts;
      const poses = await detector.estimatePoses(video, { flipHorizontal: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pose = poses[0];
      if (pose?.keypoints?.length) {
        const pointMap = keypointsToMap(pose.keypoints);
        const built = buildPoseTrack(PERSON_ID, pointMap);

        if (built) {
          const smoothed = smoothPose(built, activeTrackRef.current, 0.35);
          activeTrackRef.current = smoothed;
          lastSeenRef.current = ts;
          drawTrack(ctx, smoothed, canvas.width, canvas.height);
          setDebug({
            fps: debug.fps,
            tracking: 'active',
            personDetected: true,
            trackId: smoothed.id,
            confidence: smoothed.confidence,
            visibleKeypoints: visibleKeypointCount(smoothed.keypoints)
          });
        }
      } else {
        if (ts - lastSeenRef.current > LOST_AFTER_MS) {
          activeTrackRef.current = null;
          setDebug((prev) => ({
            ...prev,
            tracking: 'lost',
            personDetected: false,
            trackId: null,
            confidence: 0,
            visibleKeypoints: 0
          }));
        } else if (activeTrackRef.current) {
          drawTrack(ctx, activeTrackRef.current, canvas.width, canvas.height);
        }
      }
    } else {
      clearCanvas();
      if (activeTrackRef.current) drawTrack(ctx, activeTrackRef.current, canvas.width, canvas.height);
    }

    frameCountRef.current += 1;
    if (ts - lastFpsTickRef.current >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / (ts - lastFpsTickRef.current));
      frameCountRef.current = 0;
      lastFpsTickRef.current = ts;
      setDebug((prev) => ({ ...prev, fps }));
    }

    animationRef.current = requestAnimationFrame(renderLoop);
  }

  function drawTrack(ctx: CanvasRenderingContext2D, track: NonNullable<typeof activeTrackRef.current>, width: number, height: number) {
    ctx.save();

    if (showBox) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(track.bbox.x, track.bbox.y, track.bbox.width, track.bbox.height);

      ctx.fillStyle = '#22c55e';
      ctx.font = '18px Arial';
      ctx.fillText(`ID ${track.id}`, track.bbox.x, Math.max(20, track.bbox.y - 8));
    }

    if (showSkeleton) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      for (const [a, b] of SKELETON_EDGES) {
        const p1 = track.keypoints[a];
        const p2 = track.keypoints[b];
        if (!p1 || !p2 || p1.score < 0.25 || p2.score < 0.25) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    if (showDots) {
      for (const kp of Object.values(track.keypoints)) {
        if (kp.score < 0.25) continue;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px Arial';
    ctx.fillText(`Confidence: ${(track.confidence * 100).toFixed(0)}%`, 16, height - 18);

    ctx.restore();
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Overshoot V1: Standing Person Pose Tracker</h1>
        <p style={{ marginTop: 0, color: '#b6c2df' }}>
          Detect one standing person, assign a stable ID, and render a stick figure that follows body movement in real time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          <section>
            <div style={{ position: 'relative', background: '#050816', borderRadius: 16, overflow: 'hidden', border: '1px solid #1f2942' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: 'auto', display: 'block', transform: 'scaleX(-1)' }}
              />
              <canvas
                ref={canvasRef}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }}
              />
              {!isRunning && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#94a3b8', background: 'rgba(2,6,23,.45)' }}>
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
            </div>

            {error && (
              <div style={{ marginTop: 14, background: '#3f1119', color: '#fecdd3', padding: 12, borderRadius: 12, border: '1px solid #7f1d1d' }}>
                {error}
              </div>
            )}
          </section>

          <aside style={{ background: '#121a31', border: '1px solid #1f2942', borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Debug Panel</h2>
            <Metric label="Tracking State" value={debug.tracking} />
            <Metric label="Person Detected" value={debug.personDetected ? 'Yes' : 'No'} />
            <Metric label="Track ID" value={debug.trackId ?? '—'} />
            <Metric label="Visible Keypoints" value={debug.visibleKeypoints} />
            <Metric label="Confidence" value={`${(debug.confidence * 100).toFixed(0)}%`} />
            <Metric label="FPS" value={debug.fps} />

            <div style={{ marginTop: 18, color: '#b6c2df', fontSize: 14, lineHeight: 1.6 }}>
              Best results come from a full standing body view, front lighting, and a clear background. For this V1, keep only one person in the frame.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #1f2942' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buttonStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 700
  };
}
