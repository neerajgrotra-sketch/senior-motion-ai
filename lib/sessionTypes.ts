export type RequiredPosture = 'standing' | 'sitting' | 'either';
export type StartMode = 'gesture' | 'auto';

export type SessionStep = {
id: string;
exerciseId: string;
targetReps: number;
targetHoldSeconds: number;
restSeconds: number;
requiredPosture: RequiredPosture;
startMode: StartMode;
};

export type SessionDefinition = {
name: string;
steps: SessionStep[];
};

export type RunnerPhase =
| 'session_intro'
| 'precheck'
| 'countdown'
| 'active'
| 'exercise_complete'
| 'rest'
| 'session_complete';

export type SessionStepResult = {
stepId: string;
exerciseId: string;
label: string;
targetReps: number;
completedReps: number;
targetHoldSeconds: number;
restSeconds: number;
requiredPosture: RequiredPosture;
postureAtStart: 'standing' | 'sitting' | 'unknown';
sessionPeakLift: number;
lastRepPeakLift: number | null;
success: boolean;
};

export type SessionResult = {
sessionName: string;
startedAt: number;
finishedAt: number;
totalDurationMs: number;
steps: SessionStepResult[];
};

export type SessionControlSignal = {
detected: boolean;
holdMs: number;
};

export type AppMode = 'builder' | 'runner' | 'results';
