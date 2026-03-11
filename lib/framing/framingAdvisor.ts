import type { PoseTrack } from '../poseTypes';

export type FramingStatus =
  | 'good'
  | 'no_person'
  | 'too_close'
  | 'too_far'
  | 'move_left'
  | 'move_right'
  | 'move_up'
  | 'move_down'
  | 'need_headroom';

export type FramingAssessment = {
  status: FramingStatus;
  message: string;
  bboxHeightRatio: number;
  headroomRatio: number;
  leftMarginRatio: number;
  rightMarginRatio: number;
  bottomMarginRatio: number;
};

type Input = {
  track: PoseTrack | null;
  frameWidth: number;
  frameHeight: number;
  overheadMode?: boolean;
};

const TOO_CLOSE_HEIGHT_RATIO = 0.82;
const TOO_FAR_HEIGHT_RATIO = 0.3;

const MIN_HEADROOM_RATIO = 0.08;
const MIN_OVERHEAD_HEADROOM_RATIO = 0.18;

const MIN_SIDE_MARGIN_RATIO = 0.06;
const MIN_BOTTOM_MARGIN_RATIO = 0.04;

export function assessFraming({
  track,
  frameWidth,
  frameHeight,
  overheadMode = false
}: Input): FramingAssessment {
  if (!track || frameWidth <= 0 || frameHeight <= 0) {
    return {
      status: 'no_person',
      message: 'Step into the frame',
      bboxHeightRatio: 0,
      headroomRatio: 0,
      leftMarginRatio: 0,
      rightMarginRatio: 0,
      bottomMarginRatio: 0
    };
  }

  const { bbox, keypoints } = track;

  const bboxHeightRatio = bbox.height / frameHeight;
  const leftMarginRatio = bbox.x / frameWidth;
  const rightMarginRatio = (frameWidth - (bbox.x + bbox.width)) / frameWidth;
  const bottomMarginRatio = (frameHeight - (bbox.y + bbox.height)) / frameHeight;

  const headY = getTopVisibleY(keypoints, bbox.y);
  const headroomRatio = headY / frameHeight;

  const requiredHeadroom = overheadMode
    ? MIN_OVERHEAD_HEADROOM_RATIO
    : MIN_HEADROOM_RATIO;

  if (bboxHeightRatio > TOO_CLOSE_HEIGHT_RATIO) {
    return makeAssessment(
      'too_close',
      overheadMode
        ? 'Move back so your hands can raise fully above your head'
        : 'Move back slightly',
      bboxHeightRatio,
      headroomRatio,
      leftMarginRatio,
      rightMarginRatio,
      bottomMarginRatio
    );
  }

  if (headroomRatio < requiredHeadroom) {
    return makeAssessment(
      'need_headroom',
      overheadMode
        ? 'Need more space above your head for overhead exercises'
        : 'Move a little lower in the frame',
      bboxHeightRatio,
      headroomRatio,
      leftMarginRatio,
      rightMarginRatio,
      bottomMarginRatio
    );
  }

  if (leftMarginRatio < MIN_SIDE_MARGIN_RATIO) {
    return makeAssessment(
      'move_right',
      'Move slightly to your right',
      bboxHeightRatio,
      headroomRatio,
      leftMarginRatio,
      rightMarginRatio,
      bottomMarginRatio
    );
  }

  if (rightMarginRatio < MIN_SIDE_MARGIN_RATIO) {
    return makeAssessment(
      'move_left',
      'Move slightly to your left',
      bboxHeightRatio,
      headroomRatio,
      leftMarginRatio,
      rightMarginRatio,
      bottomMarginRatio
    );
  }

  if (bottomMarginRatio < MIN_BOTTOM_MARGIN_RATIO) {
    return makeAssessment(
      'move_up',
      'Move slightly farther from the camera',
      bboxHeightRatio,
      headroomRatio,
      leftMarginRatio,
      rightMarginRatio,
      bottomMarginRatio
    );
  }

  if (bboxHeightRatio < TOO_FAR_HEIGHT_RATIO) {
    return makeAssessment(
      'too_far',
      'Move a little closer',
      bboxHeightRatio,
      headroomRatio,
      leftMarginRatio,
      rightMarginRatio,
      bottomMarginRatio
    );
  }

  return makeAssessment(
    'good',
    overheadMode ? 'Framing is good for overhead movement' : 'Framing is good',
    bboxHeightRatio,
    headroomRatio,
    leftMarginRatio,
    rightMarginRatio,
    bottomMarginRatio
  );
}

function makeAssessment(
  status: FramingStatus,
  message: string,
  bboxHeightRatio: number,
  headroomRatio: number,
  leftMarginRatio: number,
  rightMarginRatio: number,
  bottomMarginRatio: number
): FramingAssessment {
  return {
    status,
    message,
    bboxHeightRatio,
    headroomRatio,
    leftMarginRatio,
    rightMarginRatio,
    bottomMarginRatio
  };
}

function getTopVisibleY(
  keypoints: PoseTrack['keypoints'],
  fallbackY: number
): number {
  const candidates = [
    keypoints['nose'],
    keypoints['left_eye'],
    keypoints['right_eye'],
    keypoints['left_ear'],
    keypoints['right_ear'],
    keypoints['left_shoulder'],
    keypoints['right_shoulder']
  ].filter((p) => p && p.score >= 0.25);

  if (candidates.length === 0) return fallbackY;

  return Math.min(...candidates.map((p) => p.y));
}
