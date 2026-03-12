'use client';

import type { CSSProperties } from 'react';
import { EXERCISE_OPTIONS } from '../lib/exercises/exerciseRegistry';
import type {
  RequiredPosture,
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

function getExerciseDescription(exerciseId: string) {
  switch (exerciseId) {
    case 'raise_right_hand':
      return 'Gentle upper-body movement focused on the right side.';
    case 'raise_left_hand':
      return 'Gentle upper-body movement focused on the left side.';
    case 'both_hands_up':
      return 'A simple bilateral movement to encourage full arm lift.';
    default:
      return 'A guided mobility exercise.';
  }
}

function getPostureCopy(posture: RequiredPosture) {
  switch (posture) {
    case 'standing':
      return 'Standing only';
    case 'sitting':
      return 'Sitting only';
    default:
      return 'Sitting or standing';
  }
}

export default function SessionBuilder({ value, onChange, onStart }: Props) {
  const totalEstimatedSeconds = value.steps.reduce(
    (sum, step) => sum + estimateStepSeconds(step),
    0
  );

  const totalExercises = value.steps.length;
  const postureSummary = summarizePostures(value.steps);

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
    <main style={pageStyle}>
      <div style={backgroundGlowA} />
      <div style={backgroundGlowB} />

      <div style={shellStyle}>
        <section style={heroStyle}>
          <div style={eyebrowStyle}>AI Guided Physiotherapy</div>
          <h1 style={heroTitleStyle}>Create Exercise Session</h1>
          <p style={heroSubtitleStyle}>
            Build a simple guided routine for mobility and movement practice.
          </p>

          <div style={heroChipRowStyle}>
            <div style={heroChipStyle}>{totalExercises} exercise{totalExercises === 1 ? '' : 's'}</div>
            <div style={heroChipStyle}>Approx. {formatDuration(totalEstimatedSeconds)}</div>
            <div style={heroChipStyle}>Senior-friendly flow</div>
          </div>
        </section>

        <div style={contentGridStyle}>
          <div style={leftColumnStyle}>
            <section style={heroCardStyle}>
              <div style={sectionHeaderRowStyle}>
                <div>
                  <div style={sectionEyebrowStyle}>Session setup</div>
                  <h2 style={sectionTitleStyle}>Session details</h2>
                </div>
              </div>

              <div style={fieldBlockStyle}>
                <label style={labelStyle}>Session name</label>
                <input
                  value={value.name}
                  onChange={(e) => updateSessionName(e.target.value)}
                  style={inputStyle}
                  placeholder="Morning Mobility Session"
                />
              </div>

              <div style={statsRowStyle}>
                <StatCard
                  label="Exercises"
                  value={String(totalExercises)}
                  hint="Added to session"
                />
                <StatCard
                  label="Estimated time"
                  value={formatDuration(totalEstimatedSeconds)}
                  hint="Based on reps, hold, and rest"
                />
                <StatCard
                  label="Posture mix"
                  value={postureSummary.title}
                  hint={postureSummary.hint}
                />
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderRowStyle}>
                <div>
                  <div style={sectionEyebrowStyle}>Exercise library</div>
                  <h2 style={sectionTitleStyle}>Add exercises</h2>
                </div>
              </div>

              <div style={exercisePickerGridStyle}>
                {EXERCISE_OPTIONS.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => addExercise(exercise.id)}
                    style={exerciseTileStyle}
                  >
                    <div style={exerciseTileTopStyle}>
                      <div style={exerciseBadgeStyle}>Add</div>
                    </div>
                    <div style={exerciseTileTitleStyle}>{exercise.label}</div>
                    <div style={exerciseTileDescriptionStyle}>
                      {getExerciseDescription(exercise.id)}
                    </div>
                    <div style={exerciseTileFooterStyle}>Tap to add to session</div>
                  </button>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderRowStyle}>
                <div>
                  <div style={sectionEyebrowStyle}>Session structure</div>
                  <h2 style={sectionTitleStyle}>Exercise steps</h2>
                </div>
                <div style={subtleMetaStyle}>
                  {totalExercises === 0
                    ? 'No exercises added yet'
                    : `${totalExercises} step${totalExercises === 1 ? '' : 's'}`}
                </div>
              </div>

              {value.steps.length === 0 ? (
                <div style={emptyStateStyle}>
                  <div style={emptyStateIconStyle}>＋</div>
                  <div style={emptyStateTitleStyle}>No exercises added yet</div>
                  <div style={emptyStateTextStyle}>
                    Choose an exercise above to begin building this session.
                  </div>
                </div>
              ) : (
                <div style={stepsListStyle}>
                  {value.steps.map((step, index) => {
                    const exerciseMeta = EXERCISE_OPTIONS.find((e) => e.id === step.exerciseId);
                    const estimatedStepSeconds = estimateStepSeconds(step);

                    return (
                      <article key={step.id} style={stepCardStyle}>
                        <div style={stepCardHeaderStyle}>
                          <div style={stepHeaderLeftStyle}>
                            <div style={stepIndexPillStyle}>Exercise {index + 1}</div>
                            <div style={stepTitleStyle}>
                              {exerciseMeta?.label ?? step.exerciseId}
                            </div>
                            <div style={stepSubtitleStyle}>
                              {getExerciseDescription(step.exerciseId)}
                            </div>
                          </div>

                          <div style={stepHeaderRightStyle}>
                            <div style={stepTimeLabelStyle}>Estimated step time</div>
                            <div style={stepTimeValueStyle}>
                              {formatDuration(estimatedStepSeconds)}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeStep(step.id)}
                              style={removeButtonStyle}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div style={pillRowStyle}>
                          <InfoPill label={`${step.targetReps} reps`} />
                          <InfoPill label={`${step.targetHoldSeconds}s hold`} />
                          <InfoPill label={`${step.restSeconds}s rest`} />
                          <InfoPill label={getPostureCopy(step.requiredPosture)} />
                        </div>

                        <div style={controlsGridStyle}>
                          <NumberField
                            label="Repetitions"
                            value={step.targetReps}
                            min={1}
                            onChange={(v) => updateStep(step.id, { targetReps: v })}
                          />
                          <NumberField
                            label="Hold time"
                            value={step.targetHoldSeconds}
                            min={0}
                            suffix="sec"
                            onChange={(v) => updateStep(step.id, { targetHoldSeconds: v })}
                          />
                          <NumberField
                            label="Rest time"
                            value={step.restSeconds}
                            min={0}
                            suffix="sec"
                            onChange={(v) => updateStep(step.id, { restSeconds: v })}
                          />
                          <SelectField
                            label="Starting posture"
                            value={step.requiredPosture}
                            options={[
                              { value: 'either', label: 'Sitting or standing' },
                              { value: 'standing', label: 'Standing' },
                              { value: 'sitting', label: 'Sitting' }
                            ]}
                            onChange={(v) =>
                              updateStep(step.id, {
                                requiredPosture: v as SessionStep['requiredPosture']
                              })
                            }
                          />
                        </div>

                        <div style={stepFooterNoteStyle}>
                          This step can be performed{' '}
                          <span style={stepFooterEmphasisStyle}>
                            {getPostureCopy(step.requiredPosture).toLowerCase()}
                          </span>
                          .
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside style={rightColumnStyle}>
            <div style={stickyColumnStyle}>
              <section style={summaryCardStyle}>
                <div style={summaryEyebrowStyle}>Session summary</div>
                <h2 style={summaryTitleStyle}>{value.name || 'Untitled session'}</h2>
                <p style={summaryTextStyle}>
                  A guided routine designed for clear, simple movement practice.
                </p>

                <div style={summaryMetricsStyle}>
                  <SummaryMetric
                    label="Exercises"
                    value={String(totalExercises)}
                  />
                  <SummaryMetric
                    label="Estimated duration"
                    value={formatDuration(totalEstimatedSeconds)}
                  />
                  <SummaryMetric
                    label="Posture focus"
                    value={postureSummary.title}
                  />
                </div>

                <div style={dividerStyle} />

                <div style={readinessCardStyle}>
                  <div style={readinessLabelStyle}>Session readiness</div>
                  <div style={readinessValueStyle}>
                    {value.steps.length > 0 ? 'Ready to start' : 'Add at least one exercise'}
                  </div>
                  <div style={readinessHintStyle}>
                    {value.steps.length > 0
                      ? 'Your routine is configured and ready for the guided runner.'
                      : 'Select an exercise from the library to begin.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onStart}
                  disabled={value.steps.length === 0}
                  style={{
                    ...startButtonStyle,
                    opacity: value.steps.length > 0 ? 1 : 0.55,
                    cursor: value.steps.length > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Start Session
                </button>

                <div style={summaryFootnoteStyle}>
                  This launches the guided session runner using the current configuration.
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
  suffix
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div style={controlFieldStyle}>
      <label style={labelStyle}>{label}</label>
      <div style={inputWrapStyle}>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          style={inputStyle}
        />
        {suffix ? <span style={inputSuffixStyle}>{suffix}</span> : null}
      </div>
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
    <div style={controlFieldStyle}>
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

function InfoPill({ label }: { label: string }) {
  return <div style={infoPillStyle}>{label}</div>;
}

function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div style={miniStatCardStyle}>
      <div style={miniStatLabelStyle}>{label}</div>
      <div style={miniStatValueStyle}>{value}</div>
      <div style={miniStatHintStyle}>{hint}</div>
    </div>
  );
}

function SummaryMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={summaryMetricRowStyle}>
      <span style={summaryMetricLabelStyle}>{label}</span>
      <span style={summaryMetricValueStyle}>{value}</span>
    </div>
  );
}

function summarizePostures(steps: SessionStep[]) {
  if (steps.length === 0) {
    return {
      title: 'Not set',
      hint: 'No posture requirements yet'
    };
  }

  const allStanding = steps.every((step) => step.requiredPosture === 'standing');
  const allSitting = steps.every((step) => step.requiredPosture === 'sitting');
  const allEither = steps.every((step) => step.requiredPosture === 'either');

  if (allStanding) {
    return {
      title: 'Standing',
      hint: 'All steps require standing'
    };
  }

  if (allSitting) {
    return {
      title: 'Sitting',
      hint: 'All steps require sitting'
    };
  }

  if (allEither) {
    return {
      title: 'Flexible',
      hint: 'All steps allow sitting or standing'
    };
  }

  return {
    title: 'Mixed',
    hint: 'Different posture requirements across steps'
  };
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '40px 24px 48px',
  background:
    'radial-gradient(circle at top left, rgba(37,99,235,0.18), transparent 28%), radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 22%), linear-gradient(180deg, #07111f 0%, #0b1526 45%, #0a1322 100%)',
  color: '#f8fafc',
  position: 'relative',
  overflow: 'hidden'
};

const backgroundGlowA: CSSProperties = {
  position: 'absolute',
  inset: 'auto auto -120px -100px',
  width: 320,
  height: 320,
  borderRadius: '50%',
  background: 'rgba(59, 130, 246, 0.12)',
  filter: 'blur(60px)',
  pointerEvents: 'none'
};

const backgroundGlowB: CSSProperties = {
  position: 'absolute',
  inset: '40px -80px auto auto',
  width: 280,
  height: 280,
  borderRadius: '50%',
  background: 'rgba(20, 184, 166, 0.08)',
  filter: 'blur(60px)',
  pointerEvents: 'none'
};

const shellStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: 1380,
  margin: '0 auto'
};

const heroStyle: CSSProperties = {
  marginBottom: 28
};

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid rgba(148,163,184,0.24)',
  background: 'rgba(15, 23, 42, 0.45)',
  borderRadius: 999,
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#93c5fd'
};

const heroTitleStyle: CSSProperties = {
  margin: '14px 0 10px',
  fontSize: 'clamp(2.2rem, 4vw, 3.5rem)',
  lineHeight: 1.02,
  fontWeight: 900,
  letterSpacing: '-0.04em'
};

const heroSubtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 18,
  lineHeight: 1.6,
  color: '#cbd5e1'
};

const heroChipRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 20
};

const heroChipStyle: CSSProperties = {
  borderRadius: 999,
  padding: '10px 14px',
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 14
};

const contentGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 0.9fr)',
  gap: 24,
  alignItems: 'start'
};

const leftColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 24
};

const rightColumnStyle: CSSProperties = {
  minWidth: 0
};

const stickyColumnStyle: CSSProperties = {
  position: 'sticky',
  top: 24
};

const basePanelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 28,
  boxShadow: '0 24px 80px rgba(2, 8, 23, 0.28)',
  backdropFilter: 'blur(10px)'
};

const heroCardStyle: CSSProperties = {
  ...basePanelStyle,
  padding: 28
};

const panelStyle: CSSProperties = {
  ...basePanelStyle,
  padding: 24
};

const summaryCardStyle: CSSProperties = {
  ...basePanelStyle,
  padding: 24
};

const sectionHeaderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 20
};

const sectionEyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#60a5fa',
  marginBottom: 6
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 850,
  letterSpacing: '-0.02em'
};

const subtleMetaStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
  fontWeight: 700
};

const fieldBlockStyle: CSSProperties = {
  marginBottom: 22
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#94a3b8',
  marginBottom: 8,
  fontWeight: 700,
  letterSpacing: '0.01em'
};

const inputWrapStyle: CSSProperties = {
  position: 'relative'
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(2, 6, 23, 0.72)',
  color: '#f8fafc',
  border: '1px solid rgba(71,85,105,0.9)',
  borderRadius: 16,
  padding: '14px 16px',
  fontWeight: 700,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box'
};

const inputSuffixStyle: CSSProperties = {
  position: 'absolute',
  right: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#94a3b8',
  fontSize: 13,
  fontWeight: 700,
  pointerEvents: 'none'
};

const statsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 14
};

const miniStatCardStyle: CSSProperties = {
  background: 'rgba(7, 16, 31, 0.72)',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: 20,
  padding: 18
};

const miniStatLabelStyle: CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 10
};

const miniStatValueStyle: CSSProperties = {
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
  marginBottom: 6
};

const miniStatHintStyle: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  lineHeight: 1.5
};

const exercisePickerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16
};

const exerciseTileStyle: CSSProperties = {
  textAlign: 'left',
  background: 'linear-gradient(180deg, rgba(15,23,42,0.84) 0%, rgba(10,15,27,0.84) 100%)',
  border: '1px solid rgba(96,165,250,0.16)',
  borderRadius: 22,
  padding: 18,
  color: '#f8fafc',
  cursor: 'pointer',
  minHeight: 170,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 14px 34px rgba(2, 8, 23, 0.18)'
};

const exerciseTileTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14
};

const exerciseBadgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: '7px 11px',
  background: 'rgba(37,99,235,0.16)',
  border: '1px solid rgba(96,165,250,0.24)',
  color: '#bfdbfe',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.05em',
  textTransform: 'uppercase'
};

const exerciseTileTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 850,
  lineHeight: 1.15,
  marginBottom: 8
};

const exerciseTileDescriptionStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: '#cbd5e1',
  flexGrow: 1
};

const exerciseTileFooterStyle: CSSProperties = {
  marginTop: 16,
  color: '#60a5fa',
  fontWeight: 800,
  fontSize: 14
};

const emptyStateStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px dashed rgba(148,163,184,0.24)',
  background: 'rgba(8, 15, 28, 0.55)',
  padding: '48px 24px',
  textAlign: 'center'
};

const emptyStateIconStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(37,99,235,0.14)',
  color: '#93c5fd',
  fontSize: 30,
  fontWeight: 700,
  marginBottom: 16
};

const emptyStateTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 850,
  marginBottom: 8
};

const emptyStateTextStyle: CSSProperties = {
  color: '#cbd5e1',
  maxWidth: 420,
  margin: '0 auto',
  lineHeight: 1.6
};

const stepsListStyle: CSSProperties = {
  display: 'grid',
  gap: 18
};

const stepCardStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(148,163,184,0.14)',
  background: 'linear-gradient(180deg, rgba(9,16,29,0.82) 0%, rgba(13,21,37,0.82) 100%)',
  padding: 22,
  boxShadow: '0 18px 48px rgba(2, 8, 23, 0.18)'
};

const stepCardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
  marginBottom: 18,
  flexWrap: 'wrap'
};

const stepHeaderLeftStyle: CSSProperties = {
  flex: '1 1 420px',
  minWidth: 0
};

const stepIndexPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '7px 11px',
  background: 'rgba(148,163,184,0.12)',
  border: '1px solid rgba(148,163,184,0.16)',
  color: '#cbd5e1',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 12
};

const stepTitleStyle: CSSProperties = {
  fontSize: 30,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.03em',
  marginBottom: 8
};

const stepSubtitleStyle: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 15,
  lineHeight: 1.6
};

const stepHeaderRightStyle: CSSProperties = {
  minWidth: 160,
  display: 'grid',
  justifyItems: 'end',
  gap: 8
};

const stepTimeLabelStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.07em'
};

const stepTimeValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 850
};

const removeButtonStyle: CSSProperties = {
  marginTop: 4,
  background: 'rgba(127, 29, 29, 0.18)',
  color: '#fecaca',
  border: '1px solid rgba(248, 113, 113, 0.25)',
  borderRadius: 14,
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer'
};

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 18
};

const infoPillStyle: CSSProperties = {
  borderRadius: 999,
  padding: '9px 12px',
  background: 'rgba(15,23,42,0.78)',
  border: '1px solid rgba(148,163,184,0.14)',
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 13
};

const controlsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 16
};

const controlFieldStyle: CSSProperties = {
  minWidth: 0
};

const stepFooterNoteStyle: CSSProperties = {
  marginTop: 18,
  paddingTop: 16,
  borderTop: '1px solid rgba(148,163,184,0.12)',
  color: '#94a3b8',
  fontSize: 14,
  lineHeight: 1.6
};

const stepFooterEmphasisStyle: CSSProperties = {
  color: '#e2e8f0',
  fontWeight: 800
};

const summaryEyebrowStyle: CSSProperties = {
  color: '#60a5fa',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10
};

const summaryTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em'
};

const summaryTextStyle: CSSProperties = {
  color: '#cbd5e1',
  lineHeight: 1.65,
  marginTop: 12,
  marginBottom: 20
};

const summaryMetricsStyle: CSSProperties = {
  display: 'grid',
  gap: 12
};

const summaryMetricRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(7, 16, 31, 0.6)',
  border: '1px solid rgba(148,163,184,0.12)'
};

const summaryMetricLabelStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
  fontWeight: 700
};

const summaryMetricValueStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: 15,
  fontWeight: 850
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'rgba(148,163,184,0.14)',
  margin: '20px 0'
};

const readinessCardStyle: CSSProperties = {
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(8,15,28,0.9) 0%, rgba(10,18,33,0.9) 100%)',
  border: '1px solid rgba(148,163,184,0.14)',
  padding: 18,
  marginBottom: 18
};

const readinessLabelStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8
};

const readinessValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
  marginBottom: 8
};

const readinessHintStyle: CSSProperties = {
  color: '#cbd5e1',
  lineHeight: 1.6,
  fontSize: 14
};

const startButtonStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: 18,
  padding: '16px 18px',
  background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
  color: '#f8fafc',
  fontWeight: 900,
  fontSize: 17,
  boxShadow: '0 18px 40px rgba(34,197,94,0.22)'
};

const summaryFootnoteStyle: CSSProperties = {
  marginTop: 14,
  color: '#94a3b8',
  fontSize: 13,
  lineHeight: 1.6
};
