export type FrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AutoFrameInput = {
  videoWidth: number;
  videoHeight: number;
  bbox: FrameRect;
};

const TARGET_PERSON_HEIGHT_RATIO = 0.72;
const MIN_CROP_SCALE = 1.0;
const MAX_CROP_SCALE = 2.2;
const SAFE_MARGIN_RATIO = 0.12;
const SMOOTHING_ALPHA = 0.18;

export function createDefaultFrame(videoWidth: number, videoHeight: number): FrameRect {
  return {
    x: 0,
    y: 0,
    width: videoWidth,
    height: videoHeight
  };
}

export function computeTargetFrame(input: AutoFrameInput): FrameRect {
  const { videoWidth, videoHeight, bbox } = input;

  const personHeightRatio = bbox.height / Math.max(1, videoHeight);
  const desiredScaleRaw = TARGET_PERSON_HEIGHT_RATIO / Math.max(0.001, personHeightRatio);
  const desiredScale = clamp(desiredScaleRaw, MIN_CROP_SCALE, MAX_CROP_SCALE);

  let cropWidth = videoWidth / desiredScale;
  let cropHeight = videoHeight / desiredScale;

  const minWidth = videoWidth * 0.45;
  const minHeight = videoHeight * 0.45;

  cropWidth = Math.max(minWidth, cropWidth);
  cropHeight = Math.max(minHeight, cropHeight);

  const personCenterX = bbox.x + bbox.width / 2;
  const personCenterY = bbox.y + bbox.height / 2;

  const safeMarginX = cropWidth * SAFE_MARGIN_RATIO;
  const safeMarginY = cropHeight * SAFE_MARGIN_RATIO;

  // Bias upward a bit for standing full-body framing so feet remain visible
  const centerYBiased = personCenterY + bbox.height * 0.05;

  let x = personCenterX - cropWidth / 2;
  let y = centerYBiased - cropHeight / 2;

  // Ensure the full bbox stays within crop as much as possible
  x = Math.min(x, bbox.x - safeMarginX);
  x = Math.max(x, bbox.x + bbox.width + safeMarginX - cropWidth);

  y = Math.min(y, bbox.y - safeMarginY);
  y = Math.max(y, bbox.y + bbox.height + safeMarginY - cropHeight);

  x = clamp(x, 0, videoWidth - cropWidth);
  y = clamp(y, 0, videoHeight - cropHeight);

  return {
    x,
    y,
    width: cropWidth,
    height: cropHeight
  };
}

export function smoothFrame(
  current: FrameRect,
  previous: FrameRect | null,
  alpha = SMOOTHING_ALPHA
): FrameRect {
  if (!previous) return current;

  return {
    x: lerp(previous.x, current.x, alpha),
    y: lerp(previous.y, current.y, alpha),
    width: lerp(previous.width, current.width, alpha),
    height: lerp(previous.height, current.height, alpha)
  };
}

export function mapPointFromVideoToFrame(
  point: { x: number; y: number },
  frame: FrameRect,
  outputWidth: number,
  outputHeight: number
) {
  return {
    x: ((point.x - frame.x) / frame.width) * outputWidth,
    y: ((point.y - frame.y) / frame.height) * outputHeight
  };
}

export function mapRectFromVideoToFrame(
  rect: FrameRect,
  frame: FrameRect,
  outputWidth: number,
  outputHeight: number
): FrameRect {
  const topLeft = mapPointFromVideoToFrame(
    { x: rect.x, y: rect.y },
    frame,
    outputWidth,
    outputHeight
  );

  const bottomRight = mapPointFromVideoToFrame(
    { x: rect.x + rect.width, y: rect.y + rect.height },
    frame,
    outputWidth,
    outputHeight
  );

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + alpha * (b - a);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
