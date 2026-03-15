"use client";

import { useState } from "react";
import { usePosePipeline } from "../hooks/usePosePipeline";

export default function SessionRunner() {
  const pipeline = usePosePipeline();
  const [showDebug, setShowDebug] = useState(false);

  const {
    detectorReady,
    isCameraOn,
    startCamera,
    stopCamera,
    session,
    startSession,
    pauseSession,
    resumeSession,
    abortSession,
  } = pipeline;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>AI Physiotherapy Session</h1>

      <div style={styles.grid}>
        <div style={styles.cameraPanel}>
          <h2>Live Camera</h2>

          <div style={styles.statusRow}>
            <span style={styles.badge}>
              Detector: {detectorReady ? "Ready" : "Loading"}
            </span>
            <span style={styles.badge}>
              Camera: {isCameraOn ? "On" : "Off"}
            </span>
          </div>

          <div style={styles.cameraFrame}>
            {!isCameraOn && <p>Camera is off</p>}
          </div>

          <div style={styles.cameraControls}>
            <button onClick={startCamera}>Start Camera</button>
            <button onClick={stopCamera}>Stop Camera</button>
          </div>
        </div>

        <div style={styles.sessionPanel}>
          <h2>Session Guide</h2>

          <div style={styles.exerciseBox}>
            <div style={styles.label}>Current Exercise</div>
            <div style={styles.exerciseTitle}>
              {session?.currentExercise ?? "No Exercise"}
            </div>

            <div style={styles.reps}>
              Reps: {session?.reps ?? 0} / {session?.targetReps ?? "-"}
            </div>
          </div>

          <div style={styles.coachingBox}>
            {session?.coaching ?? "Press Start Session when ready"}
          </div>

          <div style={styles.sessionControls}>
            <button onClick={startSession}>Start</button>
            <button onClick={pauseSession}>Pause</button>
            <button onClick={resumeSession}>Resume</button>
            <button onClick={abortSession}>Abort</button>
          </div>

          <div style={styles.progress}>
            Exercise {session?.currentIndex ?? 0} / {session?.totalExercises ?? 0}
          </div>
        </div>
      </div>

      <div style={styles.debugToggle}>
        <button onClick={() => setShowDebug((prev) => !prev)}>
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>
      </div>

      {showDebug && (
        <pre style={styles.debug}>
          {JSON.stringify((pipeline as any).debugSnapshot ?? pipeline, null, 2)}
        </pre>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 40,
    fontFamily: "system-ui, sans-serif",
    background: "#0a0f1e",
    color: "white",
    minHeight: "100vh",
  },
  title: {
    fontSize: 32,
    marginBottom: 30,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 30,
  },
  cameraPanel: {
    background: "#111827",
    padding: 20,
    borderRadius: 12,
  },
  sessionPanel: {
    background: "#111827",
    padding: 20,
    borderRadius: 12,
  },
  statusRow: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  badge: {
    background: "#1f2937",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 14,
  },
  cameraFrame: {
    height: 320,
    background: "#000",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#cbd5e1",
  },
  cameraControls: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  exerciseBox: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    opacity: 0.75,
    marginBottom: 8,
  },
  exerciseTitle: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  reps: {
    fontSize: 20,
    marginTop: 12,
  },
  coachingBox: {
    marginTop: 20,
    padding: 16,
    background: "#1f2937",
    borderRadius: 10,
    fontSize: 18,
    lineHeight: 1.4,
  },
  sessionControls: {
    marginTop: 20,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  progress: {
    marginTop: 20,
    opacity: 0.85,
    fontSize: 16,
  },
  debugToggle: {
    marginTop: 30,
  },
  debug: {
    marginTop: 12,
    background: "#000",
    padding: 20,
    borderRadius: 10,
    fontSize: 12,
    overflowX: "auto",
  },
};
