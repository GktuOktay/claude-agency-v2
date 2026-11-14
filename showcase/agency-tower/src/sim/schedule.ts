// Office schedule (KARARLAR Rev 35 P3): the office day on the 0002 simulation clock. Pure and
// deterministic: every reading is a function of the clock time, so a global pause freezes it.
//
// Mapping (Ruling, see the P3 report): one office day lasts OFFICE_DAY_S = 420 simulation seconds and the
// office clock runs piecewise-linearly through the segment table below, so a 15-minute coffee break gets
// 40 s and lunch 90 s (a trip from floor 5 to the wing takes 40–90 s through the staff elevator) while the 15 hours after work pass in 70 s.
// The day starts at 12:00 (noon, phase 0.25 of the 0001 day/night formula). In Otomatik the scene lights
// follow `lightPhaseAt` (hour → 0001 phase: 06:00 = 0, 12:00 = 0.25, 18:00 = 0.5), so the office is dark
// after hours.
import type { OfficeNow, OfficeSchedule, ScheduleSlot } from '../ui/settings/office';

export type OfficePeriod = 'work' | 'coffee' | 'lunch' | 'tea' | 'after';

export interface DaySegment {
  /** "HH:MM"; the segment covers [from, to), wrapping midnight when to < from. */
  readonly from: string;
  readonly to: string;
  /** Simulation seconds the segment lasts. */
  readonly seconds: number;
  readonly period: OfficePeriod;
}

/** One office day, in order from 09:00. */
export const OFFICE_DAY: readonly DaySegment[] = [
  { from: '09:00', to: '10:30', seconds: 45, period: 'work' },
  { from: '10:30', to: '10:45', seconds: 40, period: 'coffee' },
  { from: '10:45', to: '12:30', seconds: 45, period: 'work' },
  { from: '12:30', to: '13:30', seconds: 90, period: 'lunch' },
  { from: '13:30', to: '15:30', seconds: 45, period: 'work' },
  { from: '15:30', to: '15:45', seconds: 40, period: 'tea' },
  { from: '15:45', to: '18:00', seconds: 45, period: 'work' },
  { from: '18:00', to: '09:00', seconds: 70, period: 'after' },
];

export const OFFICE_DAY_S = OFFICE_DAY.reduce((s, d) => s + d.seconds, 0);

/** The CEO's slots (Rev 35), as the settings "Mola saatleri" list shows them. */
export const OFFICE_SLOTS: readonly ScheduleSlot[] = [
  { start: '09:00', end: '09:15', labelTr: 'Mesai başlar', kind: 'start' },
  { start: '10:30', end: '10:45', labelTr: 'Kahve molası', kind: 'coffee' },
  { start: '12:30', end: '13:30', labelTr: 'Öğle yemeği', kind: 'lunch' },
  { start: '15:30', end: '15:45', labelTr: 'Çay molası', kind: 'tea' },
  { start: '18:00', end: '18:15', labelTr: 'Mesai biter', kind: 'end' },
];

const WORK_LABEL = 'Mesai';
const OFF_LABEL = 'Mesai dışı';
export const DEFAULT_START = '12:00';

const hm = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const span = (d: DaySegment): number => (hm(d.to) - hm(d.from) + 1440) % 1440;

/** Seconds into the office day (from 09:00) at which the clock reads `hhmm`. */
function dayOffsetOf(hhmm: string): number {
  const at = hm(hhmm);
  let s = 0;
  for (const d of OFFICE_DAY) {
    const into = (at - hm(d.from) + 1440) % 1440;
    if (into < span(d)) return s + (into / span(d)) * d.seconds;
    s += d.seconds;
  }
  return 0;
}

const mod = (x: number, n: number): number => ((x % n) + n) % n;

/** Segment and fraction at a simulation time. */
function locate(simTime: number, startAt: string): { seg: DaySegment; f: number } {
  let t = mod(dayOffsetOf(startAt) + Math.max(0, simTime), OFFICE_DAY_S);
  for (const seg of OFFICE_DAY) {
    if (t < seg.seconds) return { seg, f: t / seg.seconds };
    t -= seg.seconds;
  }
  const last = OFFICE_DAY[OFFICE_DAY.length - 1]!;
  return { seg: last, f: 1 };
}

/** Office minutes since 00:00 (0 ≤ m < 1440, fractional) at a simulation time. */
export function officeMinutesAt(simTime: number, startAt = DEFAULT_START): number {
  const { seg, f } = locate(simTime, startAt);
  return mod(hm(seg.from) + f * span(seg), 1440);
}

export function periodAt(simTime: number, startAt = DEFAULT_START): OfficePeriod {
  return locate(simTime, startAt).seg.period;
}

/**
 * Robots leave for a break this many simulation seconds before its slot starts (and head home this early
 * before 18:00): a trip to the wing through the staff elevator takes 15–90 s, so they arrive around the slot start.
 */
export const BREAK_LEAD_S = 30;

/** The period the break logic follows: the office period BREAK_LEAD_S ahead. */
export function breakPeriodAt(simTime: number, startAt = DEFAULT_START): OfficePeriod {
  return periodAt(simTime + BREAK_LEAD_S, startAt);
}

/** 0001 day/night phase for the office hour: 06:00 → 0, 12:00 → 0.25 (noon), 18:00 → 0.5, 24:00 → 0.75. */
export function lightPhaseAt(simTime: number, startAt = DEFAULT_START): number {
  return mod(officeMinutesAt(simTime, startAt) / 1440 - 0.25, 1);
}

export const isBreakPeriod = (p: OfficePeriod): p is 'coffee' | 'lunch' | 'tea' => p === 'coffee' || p === 'lunch' || p === 'tea';

export interface OfficeClock extends OfficeSchedule {
  /** Office minutes since 00:00 now. */
  minutes(): number;
  period(): OfficePeriod;
  /** The period the robots' break logic follows (BREAK_LEAD_S ahead of `period`). */
  breakPeriod(): OfficePeriod;
  isBreak(): boolean;
  /** 0001 day/night phase that matches the office hour (lights in Otomatik). */
  lightPhase(): number;
}

export interface OfficeScheduleOptions {
  /** Office time at simulation time 0 ("HH:MM", default 12:00). */
  startAt?: string;
}

export function createOfficeSchedule(clock: { readonly time: number }, o: OfficeScheduleOptions = {}): OfficeClock {
  const startAt = o.startAt ?? DEFAULT_START;
  const minutes = (): number => officeMinutesAt(clock.time, startAt);
  return {
    slots: OFFICE_SLOTS,
    minutes,
    period: () => periodAt(clock.time, startAt),
    breakPeriod: () => breakPeriodAt(clock.time, startAt),
    isBreak: () => isBreakPeriod(periodAt(clock.time, startAt)),
    lightPhase: () => lightPhaseAt(clock.time, startAt),
    now(): OfficeNow {
      const at = Math.floor(minutes() + 1e-9) % 1440;
      const slot = OFFICE_SLOTS.find((s) => hm(s.start) <= at && at < hm(s.end));
      const label = slot?.labelTr ?? (at >= hm('09:00') && at < hm('18:00') ? WORK_LABEL : OFF_LABEL);
      return { hh: Math.floor(at / 60), mm: at % 60, label };
    },
  };
}
