import type { ActivityKind } from '../scene/activity';

export interface FramePose {
  kind: ActivityKind;
  walkPhase: number;
  timeSec: number;
}

/** Org mode freezes the simulation: it must not advance (AC-14). */
export function shouldStepSim(orgOn: boolean): boolean {
  return !orgOn;
}

/** Pose arguments for one robot this frame; org mode forces a static idle pose (AC-14). */
export function framePose(orgOn: boolean, kind: ActivityKind, walkPhase: number, clock: number, still: boolean, idLen: number): FramePose {
  if (orgOn) return { kind: 'idle', walkPhase: 0, timeSec: 0 };
  return { kind, walkPhase: still ? 0 : walkPhase, timeSec: still ? 0 : clock + idLen };
}
