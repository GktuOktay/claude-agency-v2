// KARARLAR Rev 40: Otomatik keeps the 420 s office day, but night (light phase 0.5–1, 18:00–06:00) lasts about
// a quarter of the cycle; the work and break slots keep their CEO times; a global pause freezes the light.
import { describe, it, expect } from 'vitest';
import { isNightPhase } from '../src/scene/daynight';
import { createSimClock } from '../src/sim/clock';
import { createOfficeSchedule, lightPhaseAt, OFFICE_DAY, OFFICE_DAY_S, periodAt } from '../src/sim/schedule';

describe('Otomatik night share (Rev 40)', () => {
  it('the office day still lasts 420 s', () => {
    expect(OFFICE_DAY_S).toBe(420);
  });

  it('night is 0.25 ± 0.02 of the Otomatik cycle', () => {
    let night = 0;
    const n = 42000;
    for (let i = 0; i < n; i++) if (isNightPhase(lightPhaseAt((i + 0.5) * (OFFICE_DAY_S / n)))) night++;
    expect(Math.abs(night / n - 0.25)).toBeLessThanOrEqual(0.02);
  });

  it('work and break slots keep usable lengths (coffee and tea ≥ 40 s, lunch ≥ 75 s, every work block ≥ 30 s)', () => {
    const len = (p: string): number => OFFICE_DAY.filter((d) => d.period === p).reduce((s, d) => s + d.seconds, 0);
    expect(len('coffee')).toBeGreaterThanOrEqual(40);
    expect(len('tea')).toBeGreaterThanOrEqual(40);
    expect(len('lunch')).toBeGreaterThanOrEqual(75);
    for (const d of OFFICE_DAY) if (d.period === 'work') expect(d.seconds).toBeGreaterThanOrEqual(30);
  });

  it('a global pause freezes the light phase and the office period', () => {
    const clock = createSimClock();
    const office = createOfficeSchedule(clock);
    for (let i = 0; i < 1234; i++) clock.tick(100);
    clock.setReason('user', true);
    const phase = office.lightPhase();
    const minutes = office.minutes();
    const period = office.period();
    for (let i = 0; i < 3000; i++) clock.tick(100);
    expect(office.lightPhase()).toBe(phase);
    expect(office.minutes()).toBe(minutes);
    expect(office.period()).toBe(period);
    expect(periodAt(clock.time)).toBe(period);
    clock.setReason('user', false);
    clock.tick(100);
    expect(office.lightPhase()).not.toBe(phase);
  });
});
