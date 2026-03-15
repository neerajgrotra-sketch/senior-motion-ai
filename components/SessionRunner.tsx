"use client";

import { useState } from "react";
import { usePosePipeline } from "@/hooks/usePosePipeline";

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
        {/* CAMERA PANEL */}
        <div style={styles.cameraPanel}>
          <h2>Live Camera</h2>

          <div style={styles.cameraFrame}>
            {!isCameraOn && <p>Camera is off</p>}
          </div>

          <div style={styles.cameraControls}>
            <button onClick={startCamera}>Start Camera</button>
            <button onClick={stopCamera}>Stop Camera</button>
          </div>
        </div>

        {/* SESSION PANEL */}
        <div style={styles.sessionPanel}>
          <h2>Session Guide</h2>

          <div style={styles.exerciseBox}>
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

      {/* DEBUG TOGGLE */}
      <div style={styles.debugToggle}>
        <button onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>
      </div>

      {/* DEBUG PANEL */}
      {showDebug && (
        <pre style={styles.debug}>
          {JSON.stringify(pipeline.debugSnapshot, null, 2)}
        </pre>
      )}
    </div>
  );
}

const styles: any = {
  page: {
    padding: 40,
    fontFamily: "system-ui",
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
    borderRadius: 10,
  },

  cameraFrame: {
    height: 320,
    background: "#000",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  cameraControls: {
    marginTop: 10,
    display: "flex",
    gap: 10,
  },

  sessionPanel: {
    background: "#111827",
    padding: 20,
    borderRadius: 10,
  },

  exerciseBox: {
    marginBottom: 20,
  },

  exerciseTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },

  reps: {
    fontSize: 20,
    marginTop: 10,
  },

  coachingBox: {
    marginTop: 20,
    padding: 15,
    background: "#1f2937",
    borderRadius: 8,
  },

  sessionControls: {
    marginTop: 20,
    display: "flex",
    gap: 10,
  },

  progress: {
    marginTop: 20,
    opacity: 0.8,
  },

  debugToggle: {
    marginTop: 30,
  },

  debug: {
    marginTop: 10,
    background: "#000",
    padding: 20,
    borderRadius: 8,
    fontSize: 12,
  },
};
