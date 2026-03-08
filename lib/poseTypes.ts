export type SimplePoint = {
  x: number;
  y: number;
  score: number;
};

export type SmoothedPose = {
  id: number;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  keypoints: Record<string, SimplePoint>;
};

export type DebugState = {
  fps: number;
  tracking: 'idle' | 'active' | 'lost';
  personDetected: boolean;
  trackId: number | null;
  confidence: number;
  visibleKeypoints: number;
};
