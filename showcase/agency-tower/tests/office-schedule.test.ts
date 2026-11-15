// Office schedule (KARARLAR Rev 35 P3): office day on the 0002 simulation clock, slots, live clock and label.
import { describe, it, expect } from 'vitest';
import { createSimClock } from '../src/sim/clock';
import {
  OFFICE_DAY,
  OFFICE_DAY_S,
  OFFICE_SLOTS,
  createOfficeSchedule,
  lightPhaseAt,
  officeMinutesAt,
  periodAt,
} from '../src/sim/schedule';
import { skyBrightness, isNightPhase } from '../src/scene/daynight';
import { createScheduleView } from '../src/ui/settings/office';

const hm = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** Simulation second at which the office clock first reads `hhmm` (scan, 0.05 s resolution). */
const firstAt = (hhmm: string, from = 0): number => {
  for (let t = from; t < from + OFFICE_DAY_S + 1; t += 0.05) if (Math.floor(officeMinutesAt(t)) % 1440 === hm(hhmm)) return t;
  return Number.NaN;
};

describe('office day mapping', () => {
  it('the explicit segment table covers 24 h in OFFICE_DAY_S seconds, in order', () => {
    const total = OFFICE_DAY.reduce((s, d) => s + d.seconds, 0);
    expect(total).toBe(OFFICE_DAY_S);
    let minutes = 0;
    for (const d of OFFICE_DAY) minutes += (hm(d.to) - hm(d.from) + 1440) % 1440;
    expect(minutes).toBe(1440);
    for (let i = 1; i < OFFICE_DAY.length; i++) expect(OFFICE_DAY[i]!.from).toBe(OFFICE_DAY[i - 1]!.to);
  });

  it('starts at noon (phase 0.25, like the 0001 day cycle) and repeats every OFFICE_DAY_S seconds', () => {
    expect(officeMinutesAt(0)).toBeCloseTo(hm('12:00'), 6);
    expect(lightPhaseAt(0)).toBeCloseTo(0.25, 6);
    for (const t of [3, 47.5, 123, 300]) expect(officeMinutesAt(t + OFFICE_DAY_S)).toBeCloseTo(officeMinutesAt(t), 6);
  });

  it('the clock only moves forward within a day and never jumps more than one segment rate', () => {
    let prev = officeMinutesAt(0);
    for (let t = 0.1; t < OFFICE_DAY_S; t += 0.1) {
      const m = officeMinutesAt(t);
      const d = (m - prev + 1440) % 1440;
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(15); // the fastest segment (after hours) runs < 15 office minutes per 0.1 s
      prev = m;
    }
  });

  it('break slots last long enough for a trip to the wing (coffee and tea ≥ 25 s, lunch ≥ 45 s)', () => {
    const len = (p: string): number => OFFICE_DAY.filter((d) => d.period === p).reduce((s, d) => s + d.seconds, 0);
    expect(len('coffee')).toBeGreaterThanOrEqual(25);
    expect(len('tea')).toBeGreaterThanOrEqual(25);
    expect(len('lunch')).toBeGreaterThanOrEqual(45);
  });

  it('periods follow the CEO slots: 10:30–10:45 coffee, 12:30–13:30 lunch, 15:30–15:45 tea, after 18:00 off', () => {
    const at = (hhmm: string): string => periodAt(firstAt(hhmm) + 0.01);
    expect(at('09:10')).toBe('work');
    expect(at('10:31')).toBe('coffee');
    expect(at('10:46')).toBe('work');
    expect(at('12:31')).toBe('lunch');
    expect(at('13:31')).toBe('work');
    expect(at('15:31')).toBe('tea');
    expect(at('15:46')).toBe('work');
    expect(at('18:01')).toBe('after');
    expect(at('03:00')).toBe('after');
    // Rev 45: the workday starts at 08:00.
    expect(at('07:59')).toBe('after');
    expect(at('08:01')).toBe('work');
    expect(at('08:59')).toBe('work');
  });

  it('lights: the light phase follows the office hour; dark after hours, bright in office hours', () => {
    for (let t = 0; t < OFFICE_DAY_S; t += 0.5) {
      const m = Math.floor(officeMinutesAt(t)) % 1440;
      const p = lightPhaseAt(t);
      const night = isNightPhase(p);
      expect(night).toBe(m >= hm('18:00') || m < hm('06:00'));
      if (m >= hm('09:00') && m < hm('18:00')) expect(skyBrightness(p)).toBeGreaterThan(0.45);
    }
  });
});

describe('OfficeSchedule on the simulation clock', () => {
  it('lists the five CEO slots in order with Turkish labels', () => {
    expect(OFFICE_SLOTS.map((s) => [s.start, s.labelTr, s.kind])).toEqual([
      ['08:00', 'Mesai başlar', 'start'],
      ['10:30', 'Kahve molası', 'coffee'],
      ['12:30', 'Öğle yemeği', 'lunch'],
      ['15:30', 'Çay molası', 'tea'],
      ['18:00', 'Mesai biter', 'end'],
    ]);
    expect(OFFICE_SLOTS.find((s) => s.kind === 'coffee')?.end).toBe('10:45');
    expect(OFFICE_SLOTS.find((s) => s.kind === 'lunch')?.end).toBe('13:30');
    expect(OFFICE_SLOTS.find((s) => s.kind === 'tea')?.end).toBe('15:45');
  });

  it('now() reads the simulation clock: noon at start, lunch label at 12:30, "Mesai dışı" at night', () => {
    const clock = createSimClock();
    const s = createOfficeSchedule(clock);
    expect(s.now()).toEqual({ hh: 12, mm: 0, label: 'Mesai' });
    const lunch = firstAt('12:31');
    while (clock.time < lunch) clock.tick(100);
    expect(s.now().label).toBe('Öğle yemeği');
    expect(s.period()).toBe('lunch');
    expect(s.isBreak()).toBe(true);
    const night = firstAt('22:00');
    while (clock.time < night) clock.tick(100);
    expect(s.now().hh).toBe(22);
    expect(s.now().label).toBe('Mesai dışı');
    expect(s.period()).toBe('after');
    expect(s.isBreak()).toBe(false);
  });

  it('is pause-safe: a global pause freezes the office clock', () => {
    const clock = createSimClock();
    const s = createOfficeSchedule(clock);
    for (let i = 0; i < 50; i++) clock.tick(100);
    const before = s.now();
    clock.setReason('user', true);
    for (let i = 0; i < 500; i++) clock.tick(100);
    expect(s.now()).toEqual(before);
    clock.setReason('user', false);
    for (let i = 0; i < 50; i++) clock.tick(100);
    expect(s.now()).not.toEqual(before);
  });

  it('is deterministic: the same clock time always gives the same reading; start time is configurable', () => {
    const a = createOfficeSchedule({ time: 77.7 });
    const b = createOfficeSchedule({ time: 77.7 });
    expect(a.now()).toEqual(b.now());
    const c = createOfficeSchedule({ time: 0 }, { startAt: '08:00' });
    expect(c.now()).toEqual({ hh: 8, mm: 0, label: 'Mesai başlar' });
    expect(createOfficeSchedule({ time: 0 }, { startAt: '09:00' }).now()).toEqual({ hh: 9, mm: 0, label: 'Mesai' });
  });

  it('the settings schedule view shows the live clock and marks the current slot', () => {
    const clock = { time: firstAt('10:35') };
    const view = createScheduleView(createOfficeSchedule(clock));
    expect(view.element.querySelector('.schedule-now')?.textContent).toBe('Şu an: 10:35 · Kahve molası');
    const cur = view.element.querySelector('[aria-current="true"]');
    expect(cur?.textContent).toContain('Kahve molası');
    expect(view.element.textContent).not.toContain('örnek program'); // live schedule, not the placeholder note
    clock.time = firstAt('12:40');
    view.refresh();
    expect(view.element.querySelector('[aria-current="true"]')?.textContent).toContain('Öğle yemeği');
  });
});
