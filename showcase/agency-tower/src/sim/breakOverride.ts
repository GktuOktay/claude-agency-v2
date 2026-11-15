// "Molaya çık" / "Molayı bitir" (KARARLAR Rev 44): a manual override of the period the robots' break logic follows.
// `break` sends everyone (robots and the CEO) to the social areas now, `work` sends everyone back to their desks now.
// The override ends at the next scheduled transition: as soon as the schedule's own period differs from the one it
// had when the button was pressed. Pure: it reads only the schedule, so a global pause (frozen clock) freezes it.
import { isBreakPeriod, type OfficePeriod } from './schedule';

export type BreakOverrideMode = 'break' | 'work';

/** Period the break logic reads during a manual break: the coffee slot's social venues (gym, games, snack, Ar-Ge). */
export const MANUAL_BREAK_PERIOD: OfficePeriod = 'coffee';

export interface BreakOverride {
  /** The period the break logic follows: the override's while it lasts, else the schedule's. */
  period(): OfficePeriod;
  /** The active override, or null (also clears an override whose scheduled period has ended). */
  mode(): BreakOverrideMode | null;
  /** Is the office on a break now (scheduled or manual)? Decides the button's label. */
  onBreak(): boolean;
  /** "Molaya çık". */
  startBreak(): void;
  /** "Molayı bitir". */
  endBreak(): void;
  /** The button: ends the break when on one, else starts one. Returns the mode it set. */
  toggle(): BreakOverrideMode;
}

export function createBreakOverride(base: () => OfficePeriod): BreakOverride {
  let mode: BreakOverrideMode | null = null;
  let from: OfficePeriod = 'work';
  const current = (): BreakOverrideMode | null => {
    if (mode !== null && base() !== from) mode = null;
    return mode;
  };
  const set = (m: BreakOverrideMode): void => {
    mode = m;
    from = base();
  };
  const o: BreakOverride = {
    period() {
      const m = current();
      return m === 'break' ? MANUAL_BREAK_PERIOD : m === 'work' ? 'work' : base();
    },
    mode: current,
    onBreak: () => isBreakPeriod(o.period()),
    startBreak: () => set('break'),
    endBreak: () => set('work'),
    toggle() {
      const m: BreakOverrideMode = o.onBreak() ? 'work' : 'break';
      set(m);
      return m;
    },
  };
  return o;
}
