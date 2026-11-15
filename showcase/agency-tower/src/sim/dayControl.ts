// Day controls (KARARLAR Rev 43 C3). "Gün hızı" runs 1, 2 or 4 simulation sub-steps per frame (simRuntime.ts).
// "Öğle arasına atla" shifts only the office schedule clock: the office reads simulation time + an offset, so the
// workflow engine, its random draws and the determinism tests are untouched; the robots walk to lunch on their own.
// Pure; no timers.
import { DEFAULT_START, OFFICE_DAY_S, dayOffsetOf, periodAt, type OfficePeriod } from './schedule';

export const DAY_SPEEDS = [1, 2, 4] as const;
export type DaySpeed = (typeof DAY_SPEEDS)[number];
export const LUNCH_AT = '12:30';

const mod = (x: number, n: number): number => ((x % n) + n) % n;

/** Simulation seconds from `simTime` until the office clock next reads `hhmm` (0 when it reads it now). */
export function secondsUntilOffice(simTime: number, hhmm: string, startAt = DEFAULT_START): number {
  const now = mod(dayOffsetOf(startAt) + Math.max(0, simTime), OFFICE_DAY_S);
  const d = mod(dayOffsetOf(hhmm) - now, OFFICE_DAY_S);
  return d < 1e-9 || OFFICE_DAY_S - d < 1e-9 ? 0 : d;
}

export interface OfficeTime {
  /** Simulation time plus the jump offset: what the office schedule reads. */
  readonly time: number;
  offset(): number;
  /**
   * Moves the office clock forward to `hhmm`; returns the seconds jumped (0 when skipped). `skipIf`: do nothing
   * while the office is already in that period (pressing "Öğle arasına atla" during lunch).
   */
  jumpTo(hhmm: string, o?: { skipIf?: OfficePeriod }): number;
}

export function createOfficeTime(clock: { readonly time: number }, startAt = DEFAULT_START): OfficeTime {
  let offset = 0;
  const time = (): number => clock.time + offset;
  return {
    get time() {
      return time();
    },
    offset: () => offset,
    jumpTo(hhmm, o = {}) {
      if (o.skipIf && periodAt(time(), startAt) === o.skipIf) return 0;
      const d = secondsUntilOffice(time(), hhmm, startAt);
      offset = mod(offset + d, OFFICE_DAY_S);
      return d;
    },
  };
}
