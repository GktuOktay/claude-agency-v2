// KARARLAR Rev 43 C3: "Gün hızı" 1× / 2× / 4× multiplies the simulation dt only (pause semantics unchanged) and
// "Öğle arasına atla" moves the office schedule clock to 12:30 without touching the engine.
import { describe, expect, it, vi } from 'vitest';
import { createSimRuntime } from '../src/app/simRuntime';
import { MAX_SIM_STEP_S, createSimClock } from '../src/sim/clock';
import { DAY_SPEEDS, createOfficeTime, secondsUntilOffice } from '../src/sim/dayControl';
import { createOfficeSchedule, officeMinutesAt, periodAt } from '../src/sim/schedule';
import { createDaySpeedControl, createLunchButton } from '../src/ui/settings/daySpeed';
import { scenarioSet, unitFloors } from './workflowHelpers';

const runtime = () =>
  createSimRuntime({
    scenarios: scenarioSet(),
    units: unitFloors(),
    titles: ['A', 'B', 'C', 'D', 'E'],
    maxJobs: 3,
    seed: 8,
    isNarrow: () => false,
    reducedMotion: () => false,
    rideTo: () => undefined,
  });

describe('Gün hızı: the runtime multiplies the simulation dt', () => {
  it('offers 1×, 2× and 4×, default 1×', () => {
    expect(DAY_SPEEDS).toEqual([1, 2, 4]);
    expect(runtime().speed()).toBe(1);
  });

  it('at 2× and 4× the clock advances 2 and 4 times the frame, the engine in steps of at most 0.1 s', () => {
    for (const s of [2, 4] as const) {
      const rt = runtime();
      rt.setSpeed(s);
      const steps: number[] = [];
      const step = rt.workflow.step.bind(rt.workflow);
      vi.spyOn(rt.workflow, 'step').mockImplementation((dt) => {
        steps.push(dt);
        step(dt);
      });
      const dt = rt.frame(100);
      expect(dt).toBeCloseTo(0.1 * s, 9);
      expect(rt.clock.time).toBeCloseTo(0.1 * s, 9);
      expect(steps).toHaveLength(s);
      for (const d of steps) expect(d).toBeLessThanOrEqual(MAX_SIM_STEP_S);
    }
  });

  it('is deterministic: N frames at 2× equal 2N frames at 1× (same engine snapshot)', () => {
    const a = runtime();
    const b = runtime();
    a.setSpeed(2);
    for (let i = 0; i < 600; i++) a.frame(100);
    for (let i = 0; i < 1200; i++) b.frame(100);
    expect(a.clock.time).toBeCloseTo(b.clock.time, 6);
    expect(JSON.stringify(a.workflow.snapshot())).toBe(JSON.stringify(b.workflow.snapshot()));
  });

  it('paused stays paused at 4×: frame returns 0, the clock and the engine do not move', () => {
    const rt = runtime();
    rt.setSpeed(4);
    for (let i = 0; i < 20; i++) rt.frame(100);
    rt.pauseButton.click();
    const t = rt.clock.time;
    const w = rt.workflow.time;
    for (let i = 0; i < 50; i++) expect(rt.frame(100)).toBe(0);
    expect(rt.clock.time).toBe(t);
    expect(rt.workflow.time).toBe(w);
    rt.pauseButton.click();
    expect(rt.frame(100)).toBeCloseTo(0.4, 9);
  });

  it('the clock advance is refused while paused', () => {
    const c = createSimClock();
    c.setReason('user', true);
    expect(c.advance(0.1)).toBe(0);
    expect(c.time).toBe(0);
    c.setReason('user', false);
    expect(c.advance(0.5)).toBe(MAX_SIM_STEP_S);
  });
});

describe('Öğle arasına atla: the office clock jumps to 12:30', () => {
  it('from the 12:00 start the office clock reads 12:30 and the period is lunch after the jump', () => {
    const clock = { time: 0 };
    const ot = createOfficeTime(clock);
    const office = createOfficeSchedule(ot);
    expect(office.now()).toMatchObject({ hh: 12, mm: 0 });
    expect(ot.jumpTo('12:30')).toBeGreaterThan(0);
    expect(office.now()).toMatchObject({ hh: 12, mm: 30, label: 'Öğle yemeği' });
    expect(office.period()).toBe('lunch');
    clock.time = 10; // the simulation goes on from there
    expect(office.period()).toBe('lunch');
  });

  it('later in the day it goes to the next 12:30; during lunch it does nothing', () => {
    const t = 200; // afternoon
    const d = secondsUntilOffice(t, '12:30');
    expect(Math.round(officeMinutesAt(t + d))).toBe(750);
    expect(periodAt(t + d)).toBe('lunch');
    const clock = { time: 0 };
    const ot = createOfficeTime(clock);
    ot.jumpTo('12:30');
    const off = ot.offset();
    expect(ot.jumpTo('12:30', { skipIf: 'lunch' })).toBe(0);
    expect(ot.offset()).toBe(off);
  });

  it('does not touch the engine: workflow time and snapshot stay identical to a run without the jump', () => {
    const a = runtime();
    const b = runtime();
    const ot = createOfficeTime(a.clock);
    for (let i = 0; i < 300; i++) {
      if (i === 100) ot.jumpTo('12:30');
      a.frame(100);
      b.frame(100);
    }
    expect(JSON.stringify(a.workflow.snapshot())).toBe(JSON.stringify(b.workflow.snapshot()));
    expect(a.clock.time).toBe(b.clock.time);
  });
});

describe('Ofis tab controls: Gün hızı and Öğle arasına atla (Turkish, 44 px)', () => {
  it('Gün hızı is a labelled group of three toggle buttons; a click reports the speed and marks it', () => {
    const onSpeed = vi.fn();
    const c = createDaySpeedControl({ current: 1, onSpeed });
    document.body.append(c.element);
    expect(c.element.querySelector('legend')?.textContent).toBe('Gün hızı');
    const bs = [...c.element.querySelectorAll('button')];
    expect(bs.map((b) => b.textContent)).toEqual(['1×', '2×', '4×']);
    expect(bs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    bs[2]!.click();
    expect(onSpeed).toHaveBeenCalledWith(4);
    expect(bs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(bs.every((b) => b.getAttribute('aria-label')?.startsWith('Gün hızı'))).toBe(true);
    c.element.remove();
  });

  it('Öğle arasına atla calls the jump and says what happened', () => {
    let jumped = 0;
    const l = createLunchButton({ onJump: () => (++jumped === 1 ? 'jumped' : 'already') });
    const b = l.element.querySelector('button')!;
    expect(b.textContent).toBe('Öğle arasına atla');
    b.click();
    expect(l.element.querySelector('[role="status"]')?.textContent).toBe('Ofis saati 12:30 · öğle arası');
    b.click();
    expect(l.element.querySelector('[role="status"]')?.textContent).toBe('Zaten öğle arası');
  });
});
