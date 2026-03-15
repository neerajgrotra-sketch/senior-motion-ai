type PointLike = {
  x: number;
  y: number;
  score?: number;
} | null;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function safeNorm(value: number, denom: number, fallback = 0) {
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-6) return fallback;
  return value / denom;
}

export function angleAtJoint(a: PointLike, joint: PointLike, c: PointLike): number | null {
  if (!a || !joint || !c) return null;

  const abx = a.x - joint.x;
  const aby = a.y - joint.y;
  const cbx = c.x - joint.x;
  const cby = c.y - joint.y;

  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);

  if (magAB < 1e-6 || magCB < 1e-6) return null;

  const cosTheta = clamp(dot / (magAB * magCB), -1, 1);
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

export function lineAngleDeg(a: PointLike, b: PointLike): number {
  if (!a || !b) return 0;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}
