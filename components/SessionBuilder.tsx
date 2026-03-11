'use client';

import type { CSSProperties } from 'react';
import { EXERCISE_OPTIONS } from '../lib/exercises/exerciseRegistry';
import type {
SessionDefinition,
SessionStep
} from '../lib/sessionTypes';

type Props = {
value: SessionDefinition;
onChange: (next: SessionDefinition) => void;
onStart: () => void;
};

const SECONDS_PER_REP_ESTIMATE = 3;

function createStep(exerciseId: string): SessionStep {
return {
id: crypto.randomUUID(),
exerciseId,
targetReps: 3,
targetHoldSeconds: 1,
restSeconds: 5,
requiredPosture: 'either',
startMode: 'auto'
};
}

function estimateStepSeconds(step: SessionStep): number {
return step.targetReps * (SECONDS_PER_REP_ESTIMATE + step.targetHoldSeconds) + step.restSeconds;
}

function formatDuration(totalSeconds: number) {
const minutes = Math.floor(totalSeconds / 60);
const seconds = totalSeconds % 60;
return `${minutes}m ${seconds}s`;
}

export default function SessionBuilder({ value, onChange, onStart }: Props) {
const totalEstimatedSeconds = value.steps.reduce(
(sum, step) => sum + estimateStepSeconds(step),
0
);

function updateSessionName(name: string) {
onChange({ ...value, steps: value.steps, name });
}

function addExercise(exerciseId: string) {
onChange({
...value,
steps: [...value.steps, createStep(exerciseId)]
});
}

function updateStep(stepId: string, patch: Partial<SessionStep>) {
onChange({
...value,
steps: value.steps.map((step) =>
step.id === stepId ? { ...step, ...patch } : step
)
});
}

function removeStep(stepId: string) {
onChange({
...value,
steps: value.steps.filter((step) => step.id !== stepId)
});
}

return (
<main style={{ minHeight: '100vh', padding: 24 }}>
<div style={{ maxWidth: 1100, margin: '0 auto' }}>
<h1 style={{ marginTop: 0, marginBottom: 8 }}>Physiotherapy Session Builder</h1>
<p style={{ marginTop: 0, color: '#b6c2df' }}>
Create a session by selecting exercises, setting reps, hold times, rest, and posture.
</p>

<section style={cardStyle}>
<label style={labelStyle}>Session name</label>
<input
value={value.name}
onChange={(e) => updateSessionName(e.target.value)}
style={inputStyle}
placeholder="Morning Mobility Session"
/>

<div style={{ marginTop: 18 }}>
<div style={labelStyle}>Estimated total session time</div>
<div style={{ fontSize: 28, fontWeight: 800 }}>
{formatDuration(totalEstimatedSeconds)}
</div>
</div>

<div style={{ marginTop: 18 }}>
<div style={labelStyle}>Add exercise</div>
<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
{EXERCISE_OPTIONS.map((exercise) => (
<button
key={exercise.id}
onClick={() => addExercise(exercise.id)}
style={buttonStyle('#2563eb')}
>
Add {exercise.label}
</button>
))}
</div>
</div>
</section>

<section style={{ marginTop: 20 }}>
<h2 style={{ marginBottom: 12 }}>Session steps</h2>

{value.steps.length === 0 ? (
<div style={cardStyle}>No exercises added yet.</div>
) : (
<div style={{ display: 'grid', gap: 14 }}>
{value.steps.map((step, index) => {
const exerciseMeta = EXERCISE_OPTIONS.find((e) => e.id === step.exerciseId);
const estimatedStepSeconds = estimateStepSeconds(step);

return (
<div key={step.id} style={cardStyle}>
<div
style={{
display: 'flex',
justifyContent: 'space-between',
gap: 16,
alignItems: 'center',
marginBottom: 14
}}
>
<div>
<div style={{ color: '#94a3b8', fontSize: 13 }}>Step {index + 1}</div>
<div style={{ fontSize: 22, fontWeight: 800 }}>
{exerciseMeta?.label ?? step.exerciseId}
</div>
<div style={{ color: '#cbd5e1', marginTop: 6 }}>
Estimated step time: {formatDuration(estimatedStepSeconds)}
</div>
</div>

<button
onClick={() => removeStep(step.id)}
style={buttonStyle('#7f1d1d')}
>
Remove
</button>
</div>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))',
gap: 14
}}
>
<NumberField
label="Reps"
value={step.targetReps}
min={1}
onChange={(v) => updateStep(step.id, { targetReps: v })}
/>
<NumberField
label="Hold (sec)"
value={step.targetHoldSeconds}
min={0}
onChange={(v) => updateStep(step.id, { targetHoldSeconds: v })}
/>
<NumberField
label="Rest (sec)"
value={step.restSeconds}
min={0}
onChange={(v) => updateStep(step.id, { restSeconds: v })}
/>
<SelectField
label="Required posture"
value={step.requiredPosture}
options={[
{ value: 'either', label: 'Either' },
{ value: 'standing', label: 'Standing' },
{ value: 'sitting', label: 'Sitting' }
]}
onChange={(v) => updateStep(step.id, { requiredPosture: v as SessionStep['requiredPosture'] })}
/>
</div>
</div>
);
})}
</div>
)}
</section>

<div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
<button
onClick={onStart}
disabled={value.steps.length === 0}
style={{
...buttonStyle(value.steps.length > 0 ? '#16a34a' : '#475569'),
opacity: value.steps.length > 0 ? 1 : 0.6,
cursor: value.steps.length > 0 ? 'pointer' : 'not-allowed'
}}
>
Start Session
</button>
</div>
</div>
</main>
);
}

function NumberField({
label,
value,
min,
onChange
}: {
label: string;
value: number;
min: number;
onChange: (value: number) => void;
}) {
return (
<div>
<label style={labelStyle}>{label}</label>
<input
type="number"
min={min}
value={value}
onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
style={inputStyle}
/>
</div>
);
}

function SelectField({
label,
value,
options,
onChange
}: {
label: string;
value: string;
options: { value: string; label: string }[];
onChange: (value: string) => void;
}) {
return (
<div>
<label style={labelStyle}>{label}</label>
<select
value={value}
onChange={(e) => onChange(e.target.value)}
style={inputStyle}
>
{options.map((option) => (
<option key={option.value} value={option.value}>
{option.label}
</option>
))}
</select>
</div>
);
}

const cardStyle: CSSProperties = {
background: '#121a31',
border: '1px solid #1f2942',
borderRadius: 16,
padding: 18
};

const labelStyle: CSSProperties = {
display: 'block',
fontSize: 13,
color: '#94a3b8',
marginBottom: 6
};

const inputStyle: CSSProperties = {
width: '100%',
background: '#0f172a',
color: 'white',
border: '1px solid #334155',
borderRadius: 10,
padding: '10px 12px',
fontWeight: 600
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
