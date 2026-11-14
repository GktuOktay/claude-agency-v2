import { describe, it, expect } from 'vitest';
import { createActivitySim, createBubbleScheduler, MAX_STEP_MS, type ActivityKind, type SimEvent } from '../src/scene/activity';
import { createRng } from '../src/scene/rng';
import { buildTower } from '../src/scene/model';
import { Screen } from '../src/scene/screen';
import { CODE_LINES } from '../src/scene/codeLines';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

const SEED = 20261113;

function data() {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

function setup(seed = SEED) {
  const model = buildTower(data());
  const sim = createActivitySim(
    model.robots.map((r) => ({ id: r.unit.id, home: r.homePoint, work: r.workPoint, coffee: r.coffeePoint })),
    seed,
  );
  return { model, sim };
}

const VALID: Record<string, ActivityKind[]> = {
  idle: ['walk'],
  walk: ['work', 'coffee', 'idle'],
  work: ['walk'],
  coffee: ['walk'],
};

function run(seconds: number, seed = SEED) {
  const { model, sim } = setup(seed);
  const trace: string[] = [];
  const steps = Math.round(seconds / 0.1);
  for (let i = 0; i < steps; i++) {
    sim.step(100);
    if (i % 10 === 0) trace.push(model.robots.map((r) => `${sim.get(r.unit.id).kind}@${sim.get(r.unit.id).x.toFixed(2)}`).join('|'));
  }
  return { model, sim, trace };
}

describe('seeded rng', () => {
  it('same seed gives the same sequence, different seeds differ', () => {
    const a = createRng(1);
    const b = createRng(1);
    const c = createRng(2);
    const sa = [a(), a(), a()];
    expect(sa).toEqual([b(), b(), b()]);
    expect(sa).not.toEqual([c(), c(), c()]);
    for (const v of sa) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('activity simulation (AC-17)', () => {
  it('every robot visits at least two distinct activities in 120 s', () => {
    const { model, sim } = setup();
    const seen = new Map<string, Set<string>>(model.robots.map((r) => [r.unit.id, new Set<string>()]));
    for (let i = 0; i < 1200; i++) {
      sim.step(100);
      for (const r of model.robots) seen.get(r.unit.id)?.add(sim.get(r.unit.id).kind);
    }
    for (const [, kinds] of seen) expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it('at least 3 robots take a coffee break in 120 s', () => {
    const { sim } = setup();
    const coffee = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      sim.step(100);
      for (const e of sim.drainEvents()) if (e.to === 'coffee') coffee.add(e.id);
    }
    expect(coffee.size).toBeGreaterThanOrEqual(3);
  });

  it('every transition is in the table; periods and walks last as specified', () => {
    const { sim } = setup();
    const events: SimEvent[] = [];
    for (let i = 0; i < 1200; i++) {
      sim.step(100);
      events.push(...sim.drainEvents());
    }
    expect(events.length).toBeGreaterThan(50);
    const ranges: Record<string, [number, number]> = { idle: [3, 8], work: [10, 30], coffee: [6, 12] };
    for (const e of events) {
      expect(VALID[e.from]).toContain(e.to);
      const range = ranges[e.from];
      if (range) {
        expect(e.duration).toBeGreaterThanOrEqual(range[0]);
        expect(e.duration).toBeLessThanOrEqual(range[1]);
      } else {
        expect(e.from).toBe('walk');
        expect(Math.abs(e.duration - e.distance / 1.2)).toBeLessThanOrEqual(0.1 + 1e-6);
      }
    }
  });

  it('no robot shares a desk', () => {
    const { model } = setup();
    const keys = model.robots.map((r) => `${r.floor}:${r.workPoint.x},${r.workPoint.z}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('clamps a 500 ms step to 100 ms', () => {
    const a = setup();
    const b = setup();
    a.sim.step(500);
    b.sim.step(MAX_STEP_MS);
    expect(a.sim.get('scout')).toEqual(b.sim.get('scout'));
    expect(a.sim.time).toBeCloseTo(0.1);
  });

  it('the same seed gives an identical trace; a different seed differs', () => {
    expect(run(60).trace).toEqual(run(60).trace);
    expect(run(60, SEED + 1).trace).not.toEqual(run(60).trace);
  });

  it('working places the robot at its desk and scrolls its screen', () => {
    const { model, sim } = setup();
    const screens = new Map(model.robots.map((r) => [r.unit.id, r.screen]));
    let checked = 0;
    for (let i = 0; i < 1200 && checked < 20; i++) {
      sim.step(100);
      for (const r of model.robots) {
        const a = sim.get(r.unit.id);
        const screen = screens.get(r.unit.id) as Screen;
        screen.scrolling = a.kind === 'work';
        if (a.kind === 'work') {
          expect(a.x).toBeCloseTo(r.workPoint.x);
          expect(a.z).toBeCloseTo(r.workPoint.z);
          const before = screen.offset;
          screen.update(0.1);
          expect(screen.offset).not.toBe(before);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a screen that is not working does not scroll', () => {
    const s = new Screen();
    s.update(1);
    expect(s.offset).toBe(0);
    s.scrolling = true;
    s.update(1);
    expect(s.offset).toBeGreaterThan(0);
  });

  it('wave stops the robot and release resumes the cycle', () => {
    const { sim } = setup();
    for (let i = 0; i < 100; i++) sim.step(100);
    sim.select('scout');
    const frozen = { ...sim.get('scout') };
    expect(frozen.kind).toBe('wave');
    for (let i = 0; i < 50; i++) sim.step(100);
    const after = sim.get('scout');
    expect([after.x, after.z]).toEqual([frozen.x, frozen.z]);
    sim.faceToward('scout', 10, 10);
    expect(sim.get('scout').facing).toBeCloseTo(Math.atan2(10 - frozen.x, 10 - frozen.z));
    sim.release('scout');
    expect(sim.get('scout').kind).not.toBe('wave');
    let moved = false;
    for (let i = 0; i < 400; i++) {
      sim.step(100);
      if (sim.get('scout').x !== frozen.x || sim.get('scout').kind !== frozen.kind) moved = true;
    }
    expect(moved).toBe(true);
  });
});

describe('speech bubbles (AC-17)', () => {
  const units = () => data().units.map((u) => ({ id: u.id, phrases: u.phrasesTr }));

  it('over 300 s: at most 4 concurrent, a start in every 20 s window, 3-5 s each, phrases <= 48 chars from the overlay', () => {
    const sched = createBubbleScheduler(units(), createRng(SEED));
    const phrases = new Map(data().units.map((u) => [u.id, new Set(u.phrasesTr)]));
    const starts: number[] = [];
    const lifetimes = new Map<string, { start: number; end: number }>();
    let t = 0;
    let prevActive = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      t = (i + 1) * 0.1;
      const active = sched.step(0.1);
      expect(active.length).toBeLessThanOrEqual(4);
      const key = (b: { unitId: string; text: string }) => `${b.unitId}|${b.text}|`;
      const now = new Set<string>();
      for (const b of active) {
        expect(b.text.length).toBeLessThanOrEqual(48);
        expect(phrases.get(b.unitId)?.has(b.text)).toBe(true);
        const k = key(b) + b.id;
        now.add(k);
        if (!prevActive.has(k)) {
          starts.push(t);
          lifetimes.set(k, { start: t, end: t });
        }
        const l = lifetimes.get(k);
        if (l) l.end = t;
      }
      prevActive = now;
    }
    expect(starts[0]).toBeLessThanOrEqual(20);
    for (let i = 1; i < starts.length; i++) expect((starts[i] as number) - (starts[i - 1] as number)).toBeLessThanOrEqual(20);
    expect(300 - (starts[starts.length - 1] as number)).toBeLessThanOrEqual(20);
    for (const { start, end } of lifetimes.values()) {
      if (end < 299.8) {
        expect(end - start + 0.1).toBeGreaterThanOrEqual(3 - 1e-9);
        expect(end - start + 0.1).toBeLessThanOrEqual(5 + 1e-9);
      }
    }
  });
});

describe('screen code source (AC-17)', () => {
  it('uses the built-in list only', () => {
    expect(CODE_LINES.length).toBeGreaterThan(8);
    expect(new Screen().lines).toBe(CODE_LINES);
  });
});
