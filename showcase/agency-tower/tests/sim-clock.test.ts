import { describe, it, expect } from 'vitest';
import { createSimClock, MAX_SIM_STEP_S, pauseText } from '../src/sim/clock';
import { createRng } from '../src/scene/rng';
import { streamSeed, type Workflow, type WfEvent } from '../src/sim/workflow';
import { makeWorkflow, unitFloors } from './workflowHelpers';
import { createTimedMovement } from '../src/sim/movement';

describe('simulation clock (AC-15, REQ-16, §7.8)', () => {
  it('advances by frame time in steps of at most 100 ms', () => {
    const c = createSimClock();
    expect(c.tick(16)).toBeCloseTo(0.016);
    expect(c.tick(250)).toBeCloseTo(MAX_SIM_STEP_S);
    expect(c.tick(-5)).toBe(0);
    expect(c.time).toBeCloseTo(0.116);
    expect(c.wallTime).toBeCloseTo(0.266);
  });

  for (const reason of ['org', 'user', 'hidden'] as const) {
    it(`does not advance while "${reason}" applies and resumes after`, () => {
      const c = createSimClock();
      c.tick(100);
      c.setReason(reason, true);
      expect(c.paused).toBe(true);
      expect(c.tick(100)).toBe(0);
      expect(c.time).toBeCloseTo(0.1);
      c.setReason(reason, false);
      expect(c.paused).toBe(false);
      expect(c.tick(100)).toBeCloseTo(0.1);
      expect(c.time).toBeCloseTo(0.2);
    });
  }

  it('keeps pause reasons independent: org and user both on, turning one off stays paused', () => {
    const c = createSimClock();
    c.setReason('org', true);
    c.setReason('user', true);
    c.setReason('org', false);
    expect(c.paused).toBe(true);
    expect(c.reasons()).toEqual(['user']);
    expect(c.tick(100)).toBe(0);
    c.setReason('user', false);
    expect(c.reasons()).toEqual([]);
    expect(c.tick(100)).toBeCloseTo(0.1);
  });

  it('selection is step-scoped: the clock keeps running', () => {
    const c = createSimClock();
    c.select('qa-engineer');
    expect(c.isSelected('qa-engineer')).toBe(true);
    expect(c.paused).toBe(false);
    expect(c.tick(100)).toBeCloseTo(0.1);
    c.release('qa-engineer');
    expect(c.isSelected('qa-engineer')).toBe(false);
  });

  it('strip pause text: global first, then selection, else none', () => {
    const c = createSimClock();
    expect(pauseText(c, false)).toBeNull();
    expect(pauseText(c, true)).toBe('Duraklatıldı · seçili robot');
    c.setReason('hidden', true);
    expect(pauseText(c, true)).toBe('Duraklatıldı');
    expect(pauseText(c, false)).toBe('Duraklatıldı');
  });
});

// ---------------------------------------------------------------- engine on the clock (AC-15)

/** `timed`: inject the timed stand-in for tests that measure engine logic at its pace (Rev 32). */
function rig(seed = 8, timed = false) {
  const clock = createSimClock();
  const base = createRng(streamSeed(seed, 'engine'));
  let draws = 0;
  const movement = timed ? createTimedMovement(unitFloors()) : undefined;
  const wf = makeWorkflow({ isSelected: (u) => clock.isSelected(u), rng: () => (draws++, base()), ...(movement ? { movement } : {}) });
  const log: { wall: number; e: WfEvent }[] = [];
  const frame = (ms = 100): void => {
    const dt = clock.tick(ms);
    if (dt > 0) wf.step(dt);
    for (const e of wf.drainEvents()) log.push({ wall: Math.round(clock.wallTime * 1000) / 1000, e });
  };
  const frames = (s: number, each?: () => void): void => {
    for (let i = 0; i < Math.round(s * 10); i++) {
      frame();
      each?.();
    }
  };
  return { clock, wf, frame, frames, log, draws: () => draws };
}
const until = (r: ReturnType<typeof rig>, pred: () => boolean, maxS = 900): void => {
  for (let i = 0; i < maxS * 10 && !pred(); i++) r.frame();
  expect(pred()).toBe(true);
};
const runOf = (wf: Workflow, job: number, step: string) =>
  (wf.snapshot() as { runs: { job: number; step: string; elapsed: number; phase: string }[] }).runs.find((r) => r.job === job && r.step === step);

describe('global pause freezes the engine (AC-15)', () => {
  for (const reason of ['org', 'user', 'hidden'] as const) {
    it(`"${reason}": no timer advances, no draw, entries read "Duraklatıldı", snapshot equal on resume`, () => {
      const r = rig();
      r.frames(120);
      const snap = JSON.stringify(r.wf.snapshot());
      const draws = r.draws();
      const events = r.log.length;
      r.clock.setReason(reason, true);
      r.frames(60, () => {
        for (const j of r.wf.jobs()) expect(pauseText(r.clock, j.pausedBySelection)).toBe('Duraklatıldı');
      });
      expect(r.draws()).toBe(draws);
      expect(r.log.length).toBe(events);
      r.clock.setReason(reason, false);
      expect(JSON.stringify(r.wf.snapshot())).toBe(snap);
      r.frames(5);
      expect(r.wf.time).toBeGreaterThan(120);
    });
  }

  it('org and the toggle both on: turning one off keeps everything paused', () => {
    const r = rig();
    r.frames(30);
    const t = r.wf.time;
    r.clock.setReason('org', true);
    r.clock.setReason('user', true);
    r.frames(5);
    r.clock.setReason('org', false);
    r.frames(5);
    expect(r.wf.time).toBe(t);
    r.clock.setReason('user', false);
    r.frames(1);
    expect(r.wf.time).toBeGreaterThan(t);
  });

  it('a 30 s pause at 50 s equals the unpaused trace with later times shifted by 30 s', () => {
    const a = rig(13, true);
    a.frames(200);
    const b = rig(13, true);
    b.frames(50);
    b.clock.setReason('user', true);
    b.frames(30);
    b.clock.setReason('user', false);
    b.frames(150);
    expect(b.log.map((x) => x.e)).toEqual(a.log.map((x) => x.e));
    a.log.forEach((x, i) => {
      const shift = x.wall > 50 + 1e-6 ? 30 : 0;
      expect(b.log[i]!.wall).toBeCloseTo(x.wall + shift, 6);
    });
    expect(a.log.length).toBeGreaterThan(50);
  });

  it('the "Tamamlandı" entry stays 4 s of simulation time and does not age while paused', () => {
    const r = rig();
    until(r, () => r.wf.jobs().some((j) => j.done));
    const n = r.wf.jobs().find((j) => j.done)!.n;
    r.frames(2);
    r.clock.setReason('user', true);
    r.frames(30);
    expect(r.wf.jobs().some((j) => j.n === n && j.done)).toBe(true);
    r.clock.setReason('user', false);
    r.frames(1.8);
    expect(r.wf.jobs().some((j) => j.n === n && j.done)).toBe(true);
    r.frames(0.3);
    expect(r.wf.jobs().some((j) => j.n === n)).toBe(false);
  });
});

describe('selection pause is step-scoped (AC-15, REQ-17)', () => {
  it('only the selected robot\'s step stops its elapsed time; co-actors hold; another job advances', () => {
    const r = rig(8, true);
    // Job #1's meeting: BA, react-engineer, qa-engineer.
    until(r, () => runOf(r.wf, 1, 'meet')?.phase === 'active');
    r.frames(1);
    const before = runOf(r.wf, 1, 'meet')!.elapsed;
    const otherBefore = r.log.filter((x) => x.e.job !== 1).length;
    const mvBefore = JSON.stringify((r.wf.movement.snapshot() as { id: string }[]).filter((m) => ['business-analyst', 'qa-engineer'].includes(m.id)));
    r.clock.select('react-engineer');
    r.frames(10, () => {
      const j = r.wf.jobs().find((x) => x.n === 1)!;
      expect(j.pausedBySelection).toBe(true);
      expect(pauseText(r.clock, j.pausedBySelection)).toBe('Duraklatıldı · seçili robot');
      for (const o of r.wf.jobs().filter((x) => x.n !== 1)) expect(o.pausedBySelection).toBe(false);
    });
    expect(runOf(r.wf, 1, 'meet')!.elapsed).toBe(before);
    expect(JSON.stringify((r.wf.movement.snapshot() as { id: string }[]).filter((m) => ['business-analyst', 'qa-engineer'].includes(m.id)))).toBe(mvBefore);
    expect(r.log.filter((x) => x.e.job !== 1).length).toBeGreaterThan(otherBefore);
    r.clock.release('react-engineer');
    r.frames(1);
    expect(runOf(r.wf, 1, 'meet')!.elapsed).toBeGreaterThan(before);
  });

  it('a carrier waiting for the selected robot keeps its 8 s timer and drops the copy in the tray', () => {
    const r = rig();
    // Job #1 carries the envelope to the business-analyst (c-ba); select the recipient first.
    until(r, () => r.log.some((x) => x.e.type === 'step-start' && x.e.job === 1 && x.e.step === 'c-ba'));
    r.clock.select('business-analyst');
    until(r, () => r.log.some((x) => x.e.type === 'tray-drop' && x.e.job === 1));
    const wait = r.log.find((x) => x.e.type === 'wait-start' && x.e.job === 1 && x.e.step === 'c-ba')!.e.t;
    const drop = r.log.find((x) => x.e.type === 'tray-drop' && x.e.job === 1)!.e;
    expect(drop.to).toBe('business-analyst');
    expect(drop.t - wait).toBeGreaterThanOrEqual(8 - 1e-6);
    expect(drop.t - wait).toBeLessThanOrEqual(8.1 + 1e-6);
    expect(r.log.some((x) => x.e.type === 'handover' && x.e.job === 1 && x.e.step === 'c-ba')).toBe(false);
    r.clock.release('business-analyst');
    until(r, () => r.log.some((x) => x.e.type === 'tray-take' && x.e.job === 1 && x.e.to === 'business-analyst'));
  });

  it('a robot selected while riding keeps riding (the cabin runs on)', () => {
    const r = rig();
    let rider: string | undefined;
    until(r, () => {
      rider = r.wf.unitState('chief-of-staff')?.state === 'ride' ? 'chief-of-staff' : undefined;
      return rider !== undefined;
    });
    const floorBefore = r.wf.movement.floorOf(rider!);
    r.clock.select(rider!);
    r.frames(6);
    expect(r.wf.movement.phase(rider!)).not.toBe('ride');
    expect(r.wf.movement.floorOf(rider!)).toBe(floorBefore);
    r.clock.release(rider!);
  });
});

