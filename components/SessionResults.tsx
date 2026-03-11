'use client';

import type { CSSProperties } from 'react';
import type { SessionResult } from '../lib/sessionTypes';

type Props = {
  result: SessionResult;
  onBackToBuilder: () => void;
};

export default function SessionResults({ result, onBackToBuilder }: Props) {
  return (
    <main style={{ minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Session Results</h1>
        <p style={{ marginTop: 0, color: '#b6c2df' }}>{result.sessionName}</p>

        <section style={cardStyle}>
          <Metric label="Steps completed" value={result.steps.length} />
          <Metric label="Total duration" value={formatMs(result.totalDurationMs)} />
          <Metric label="Started" value={new Date(result.startedAt).toLocaleString()} />
          <Metric label="Finished" value={new Date(result.finishedAt).toLocaleString()} />
        </section>

        <section style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Step summary</h2>

          <div style={{ display: 'grid', gap: 14 }}>
            {result.steps.map((step) => (
              <div key={step.stepId} style={cardStyle}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{step.label}</div>

                <Metric label="Target reps" value={step.targetReps} />
                <Metric label="Completed reps" value={step.completedReps} />
                <Metric label="Required posture" value={step.requiredPosture} />
                <Metric label="Posture at start" value={step.postureAtStart} />
                <Metric label="Hold seconds" value={step.targetHoldSeconds} />
                <Metric label="Rest seconds" value={step.restSeconds} />
                <Metric label="Session peak lift" value={step.sessionPeakLift.toFixed(3)} />
                <Metric
                  label="Last rep peak"
                  value={step.lastRepPeakLift !== null ? step.lastRepPeakLift.toFixed(3) : '—'}
                />
                <Metric label="Success" value={step.success ? 'Yes' : 'No'} />
              </div>
            ))}
          </div>
        </section>

        <div style={{ marginTop: 22 }}>
          <button onClick={onBackToBuilder} style={buttonStyle('#2563eb')}>
            Create Another Session
          </button>
        </div>
      </div>
    </main>
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

function formatMs(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

const cardStyle: CSSProperties = {
  background: '#121a31',
  border: '1px solid #1f2942',
  borderRadius: 16,
  padding: 18
};

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
