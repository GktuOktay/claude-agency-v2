// Staff wiring (Rev 31): steps the staff NPCs on the simulation clock's global pause reasons (org, user,
// hidden) and turns their speech into bubbles that share the robot bubble cap. No WebGL; jsdom-testable.
import { MAX_BUBBLES } from '../scene/activity';
import type { StaffModel } from '../scene/staff';
import type { SimClock } from '../sim/clock';

export interface StaffBubble {
  id: number;
  staffId: string;
  floor: number;
  text: string;
  remaining: number;
}

export interface StaffRuntimeOptions {
  staff: Pick<StaffModel, 'step' | 'onSpeech'>;
  clock: Pick<SimClock, 'paused'>;
  cap?: number;
}

export interface StaffRuntime {
  /** Steps staff (not while a global pause reason applies) and ages the staff bubbles. */
  frame(dtSeconds: number): void;
  /** Staff bubbles to show; robot bubbles keep priority, the total never exceeds the cap. */
  bubbles(robotActive: number): readonly StaffBubble[];
  dispose(): void;
}

const BUBBLE_SECONDS = 4;

export function createStaffRuntime(o: StaffRuntimeOptions): StaffRuntime {
  const cap = o.cap ?? MAX_BUBBLES;
  let active: StaffBubble[] = [];
  let nextId = 1;
  let robots = 0;
  const off = o.staff.onSpeech((e) => {
    if (robots + active.length >= cap) return;
    active.push({ id: nextId++, staffId: e.staffId, floor: e.floor, text: e.text, remaining: BUBBLE_SECONDS });
  });
  return {
    frame(dt) {
      active = active.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0);
      if (!o.clock.paused) o.staff.step(dt);
    },
    bubbles(robotActive) {
      robots = robotActive;
      return active.slice(0, Math.max(0, cap - robotActive));
    },
    dispose: off,
  };
}
