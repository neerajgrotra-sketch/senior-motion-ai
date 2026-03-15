// lib/coaching/coachingTypes.ts

export type CoachingTone = "neutral" | "encouraging" | "corrective" | "celebratory";

export interface CoachingCue {
  code: string;
  message: string;
  tone: CoachingTone;
  priority: number;
  speak: boolean;
}

export interface CoachingOutput {
  primary: CoachingCue | null;
  secondary: CoachingCue[];
}
