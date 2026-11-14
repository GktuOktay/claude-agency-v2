// Simulation clock with pause reasons (spec 0002 REQ-16..18, R-4, §7.8). Pure; no timers.
// Every simulated timer (engine, movement, elevator, whiteboard, lamps, progress, strip) reads this
// clock. Global reasons stop it; `select:<id>` is step-scoped and left to the consumers.
import { tr } from '../i18n/tr';

export const MAX_SIM_STEP_S = 0.1;
export type GlobalReason = 'org' | 'user' | 'hidden';
const ORDER: readonly GlobalReason[] = ['org', 'user', 'hidden'];

export interface SimClock {
  /** Simulation seconds; frozen while a global reason applies. */
  readonly time: number;
  /** Frame seconds fed in, paused or not (for tests and diagnostics). */
  readonly wallTime: number;
  readonly paused: boolean;
  reasons(): GlobalReason[];
  setReason(reason: GlobalReason, on: boolean): void;
  select(id: string): void;
  release(id: string): void;
  isSelected(id: string): boolean;
  selected(): string[];
  /** Feeds one frame; returns the simulation step in seconds (≤ 0.1; 0 while paused). */
  tick(frameMs: number): number;
}

export function createSimClock(): SimClock {
  const active = new Set<GlobalReason>();
  const selected = new Set<string>();
  let time = 0;
  let wall = 0;
  return {
    get time() {
      return time;
    },
    get wallTime() {
      return wall;
    },
    get paused() {
      return active.size > 0;
    },
    reasons: () => ORDER.filter((r) => active.has(r)),
    setReason(reason, on) {
      if (on) active.add(reason);
      else active.delete(reason);
    },
    select: (id) => void selected.add(id),
    release: (id) => void selected.delete(id),
    isSelected: (id) => selected.has(id),
    selected: () => [...selected],
    tick(frameMs) {
      const ms = Math.max(frameMs, 0);
      wall += ms / 1000;
      if (active.size > 0) return 0;
      const dt = Math.min(ms / 1000, MAX_SIM_STEP_S);
      time += dt;
      return dt;
    },
  };
}

/** §7.8 strip text for a job entry: global pause wins; a job with a selected participant otherwise. */
export function pauseText(clock: SimClock, jobHasSelected: boolean): string | null {
  if (clock.paused) return tr.sim.paused;
  return jobHasSelected ? tr.sim.pausedSelected : null;
}
