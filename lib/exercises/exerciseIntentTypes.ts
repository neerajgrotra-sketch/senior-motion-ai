export type ExerciseIntentModel = {
  id: string;
  name?: string;
  version?: string;

  signals: SignalDefinition[];
  signalDefinitions?: SignalDefinition[];

  signalRefs: {
    primaryLiftSignalId: string;
    oppositeLiftSignalId?: string;
    symmetrySignalId?: string;
    postureSignalId?: string;
    confidenceSignalId?: string;
    trunkLeanSignalId?: string;
    [key: string]: string | undefined;
  };

  thresholds: LegacyExerciseThresholds;

  errors: {
    detectTrunkLean?: boolean;
    detectAsymmetry?: boolean;
    detectLowConfidence?: boolean;
    [key: string]: boolean | undefined;
  };

  transitions?: IntentTransitionRule[];
  metadata?: Record<string, unknown>;
  coaching: {
    intro?: string;
    success?: string;
    correction?: string;
    error?: string;
    [key: string]: unknown;
  };
};
