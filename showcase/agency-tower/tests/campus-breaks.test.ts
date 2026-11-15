// Campus breaks (KARARLAR rev 31): free robots sometimes take their break at a campus amenity instead of
// the floor's coffee station, walking through the real nav movement (sky-bridges, staff elevator). Off by
// default, so the 0001 cycle and its tests are unchanged; on in the app.
import { describe, it, expect } from 'vitest';
import { createActivitySim, type ActivitySim, type ActivitySpec, type BreakMovement, type CampusBreakOptions } from '../src/scene/activity';
import { ARCHIVE_UNITS, CURIOUS_UNITS } from '../src/scene/breaks';
import { createAnchors, createDirector } from '../src/scene/director';
import { AMENITY_SPOTS, HALF_WIDTH, floorY } from '../src/sim/layout';
import { createNavMovement, type NavMovement } from '../src/sim/navMovement';
import type { Target } from '../src/sim/movement';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

const SEED = 20261113;
const never = (): boolean => false;
const spotById = new Map(AMENITY_SPOTS.map((s) => [s.id, s]));

function specs(): ActivitySpec[] {
  const anchors = createAnchors(towerLayouts());
  return [...unitFloors().keys()].map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
}

interface Spy extends BreakMovement {
  calls: { unit: string; target: Target; t: number }[];
}
function spy(nav: NavMovement, clock: { t: number }, check?: (unit: string) => void): Spy {
  const calls: Spy['calls'] = [];
  return {
    calls,
    moveTo(u, t) {
      check?.(u);
      calls.push({ unit: u, target: t, t: clock.t });
      nav.moveTo(u, t);
    },
    isAt: (u, t) => nav.isAt(u, t),
    phase: (u) => nav.phase(u),
    renderPosition: (u, r) => nav.renderPosition(u, r),
  };
}

interface Rig {
  nav: NavMovement;
  sim: ActivitySim;
  mv: Spy;
  clock: { t: number };
  step(n?: number, each?: () => void): void;
}
function rig(seed = SEED, over: Partial<CampusBreakOptions> = {}): Rig {
  const nav = createNavMovement({ units: unitFloors(), record: true });
  const clock = { t: 0 };
  const mv = spy(nav, clock);
  const sim = createActivitySim(specs(), seed, { campus: { movement: mv, floors: unitFloors(), ...over } });
  return {
    nav,
    sim,
    mv,
    clock,
    step(n = 1, each) {
      for (let i = 0; i < n; i++) {
        sim.step(100);
        nav.step(0.1, never);
        clock.t += 0.1;
        each?.();
      }
    },
  };
}

const ids = [...unitFloors().keys()];

describe('campus breaks are off by default (0001 cycle unchanged)', () => {
  it('no option, or campus null, gives the same trace as before', () => {
    const trace = (sim: ActivitySim): string[] => {
      const out: string[] = [];
      for (let i = 0; i < 600; i++) {
        sim.step(100);
        if (i % 10 === 0) out.push(ids.map((id) => `${sim.get(id).kind}@${sim.get(id).x.toFixed(2)}`).join('|'));
      }
      return out;
    };
    const a = trace(createActivitySim(specs(), SEED));
    expect(trace(createActivitySim(specs(), SEED, {}))).toEqual(a);
    expect(trace(createActivitySim(specs(), SEED, { campus: null }))).toEqual(a);
    expect(createActivitySim(specs(), SEED).onBreak('scout')).toBeNull();
  });
});

describe('campus breaks (on)', () => {
  // One 900 s run shared by the rule checks below.
  const r = rig(SEED, { isLunch: () => r.clock.t % 300 < 100 });
  const visits: { unit: string; spot: string; t: number; lunch: boolean }[] = [];
  const poses = new Map<string, Set<string>>();
  let pingPongAlone = 0;
  let pingPongPairs = 0;
  let wingCrossers = 0;
  const crossed = new Set<string>();
  const prev = new Map<string, string | null>();
  const chosenAtLunch = new Map<string, boolean>(); // lunch phase when the break was chosen
  r.step(9000, () => {
    let paddles = 0;
    for (const id of ids) {
      const b = r.sim.onBreak(id);
      const v = r.sim.get(id);
      if (b && !chosenAtLunch.has(id)) chosenAtLunch.set(id, r.clock.t % 300 < 100);
      if (!b) chosenAtLunch.delete(id);
      if (b && v.kind === 'coffee' && prev.get(id) !== b.id) {
        visits.push({ unit: id, spot: b.id, t: r.clock.t, lunch: chosenAtLunch.get(id) ?? false });
        prev.set(id, b.id);
        expect(r.nav.nodeOf(id)).toBe(b.id); // standing at its amenity spot
        expect(v.x).toBeCloseTo(b.x, 6);
        expect(v.facing).toBeCloseTo(b.facing, 6);
      }
      if (!b) prev.set(id, null);
      if (b && v.kind === 'coffee' && v.pose) {
        if (!poses.has(b.kind)) poses.set(b.kind, new Set());
        poses.get(b.kind)!.add(v.pose);
      }
      if (v.pose === 'paddle') paddles++;
      if (b && v.x < -HALF_WIDTH && !crossed.has(id)) {
        crossed.add(id);
        wingCrossers++;
      }
    }
    if (paddles === 1) pingPongAlone++;
    if (paddles === 2) pingPongPairs++;
  });

  it('several robots take breaks at campus amenities, crossing into the wing', () => {
    expect(new Set(visits.map((v) => v.unit)).size).toBeGreaterThanOrEqual(6);
    expect(wingCrossers).toBeGreaterThanOrEqual(6);
    const venues = new Set(visits.map((v) => spotById.get(v.spot)!.zone));
    for (const z of ['gym', 'game-room', 'snack-bar']) expect(venues).toContain(z);
  });

  it('robots from other floors ride the staff elevator to the wing', () => {
    const away = visits.filter((v) => spotById.get(v.spot)!.floor !== unitFloors().get(v.unit));
    expect(away.length).toBeGreaterThan(0);
    const riders = new Set(r.nav.legLog().filter((l) => l.kind === 'ride').map((l) => l.unit));
    for (const v of away) expect(riders).toContain(v.unit);
  });

  it('the coffee station is still used', () => {
    // breaks sometimes go to the campus "instead": the floor coffee station keeps part of them
    const r2 = rig();
    let coffee = 0;
    r2.step(1200, () => {
      for (const e of r2.sim.drainEvents()) if (e.to === 'coffee' && !r2.sim.onBreak(e.id)) coffee++;
    });
    expect(coffee).toBeGreaterThanOrEqual(3);
  });

  it('shows the amenity pose: running, lifting, paddle swing, eating, playing, sleeping', () => {
    const expected: Record<string, string> = { treadmill: 'run', weights: 'lift', 'ping-pong': 'paddle', foosball: 'play', arcade: 'play', snack: 'eat', dining: 'eat', pod: 'sleep', 'lab-bench': 'work', archive: 'read' };
    expect(poses.size).toBeGreaterThan(3);
    for (const [kind, set] of poses) for (const p of set) expect(['idle', expected[kind]]).toContain(p); // ping-pong: idle until the partner is there
  });

  it('venue rules: lab for curious units, archive for auditors, cafeteria at lunch, never the CEO', () => {
    for (const v of visits) {
      const s = spotById.get(v.spot)!;
      if (s.zone === 'rnd-lab') expect(CURIOUS_UNITS.has(v.unit)).toBe(true);
      if (s.zone === 'archive') expect(ARCHIVE_UNITS.has(v.unit)).toBe(true);
      if (s.kind === 'dining') expect(v.lunch).toBe(true);
      expect(v.unit).not.toBe('ceo');
    }
    expect(visits.some((v) => spotById.get(v.spot)!.kind === 'dining')).toBe(true);
  });

  it('ping-pong is played in pairs only; nap pods are rare', () => {
    expect(pingPongPairs).toBeGreaterThan(0);
    expect(pingPongAlone).toBe(0);
    const pods = visits.filter((v) => spotById.get(v.spot)!.kind === 'pod').length;
    const gym = visits.filter((v) => spotById.get(v.spot)!.zone === 'gym').length;
    expect(pods).toBeLessThan(gym);
  });

  it('two robots never hold the same amenity spot', () => {
    const r3 = rig(SEED + 5);
    r3.step(3000, () => {
      const held = ids.map((id) => r3.sim.onBreak(id)?.id).filter((x): x is string => x !== undefined);
      expect(new Set(held).size).toBe(held.length);
    });
  });
});

describe('campus breaks: determinism, interrupts, pause, reduced motion', () => {
  const trace = (seed: number): string[] => {
    const r = rig(seed);
    const out: string[] = [];
    r.step(3000, () => {
      if (Math.round(r.clock.t * 10) % 10 === 0) out.push(ids.map((id) => `${r.sim.get(id).kind}:${r.sim.onBreak(id)?.id ?? '-'}@${r.sim.get(id).x.toFixed(2)}`).join('|'));
    });
    return out;
  };

  it('the same seed gives an identical trace; another seed differs', () => {
    const a = trace(SEED);
    expect(trace(SEED)).toEqual(a);
    expect(trace(SEED + 1)).not.toEqual(a);
  });

  /** Steps until some robot is at a wing amenity on a floor other than its home floor. */
  function awayOnBreak(r: Rig): string {
    for (let i = 0; i < 12000; i++) {
      r.step();
      for (const id of ids) {
        const b = r.sim.onBreak(id);
        if (b && r.sim.get(id).kind === 'coffee' && b.floor !== unitFloors().get(id)) return id;
      }
    }
    throw new Error('no away break');
  }

  it('a reservation interrupts the break; the cycle never moves the robot again until resume', () => {
    const r = rig();
    const u = awayOnBreak(r);
    const home = unitFloors().get(u)!;
    r.sim.reserve(u);
    expect(r.sim.onBreak(u)).toBeNull();
    const before = r.mv.calls.filter((c) => c.unit === u).length;
    // The engine re-paths it from the wing to its desk (the director chases this position).
    r.nav.moveTo(u, { floor: home, spot: `desk:${u}` });
    r.step(2000);
    expect(r.nav.isAt(u, { floor: home, spot: `desk:${u}` })).toBe(true);
    expect(r.mv.calls.filter((c) => c.unit === u).length).toBe(before);
    // Back home (director return), the cycle resumes: idle at home, breaks possible again.
    r.nav.moveTo(u, { floor: home, spot: `home:${u}` });
    r.step(600);
    r.sim.resume(u);
    expect(r.sim.get(u).kind).toBe('idle');
    expect(r.sim.get(u).pose).toBeUndefined();
  });

  it('a ping-pong partner whose mate is reserved walks back home', () => {
    const r = rig();
    let pair: [string, string] | null = null;
    for (let i = 0; i < 12000 && !pair; i++) {
      r.step();
      const players = ids.filter((id) => r.sim.get(id).pose === 'paddle');
      if (players.length === 2) pair = [players[0]!, players[1]!];
    }
    expect(pair).not.toBeNull();
    const [a, b] = pair!;
    r.sim.reserve(a);
    r.step(1);
    expect(r.sim.get(b).kind).toBe('walk');
    // 60 s (was 200 s): with walk-in elevator boarding b is home after ~21 s and starts its next break at ~99 s.
    r.step(600);
    expect(r.sim.onBreak(b)).toBeNull();
    expect(r.nav.isAt(b, { floor: unitFloors().get(b)!, spot: `home:${b}` })).toBe(true);
  });

  it('global pause holds break robots (no timer, no new break, no moveTo)', () => {
    let paused = false;
    const r = rig(SEED, { paused: () => paused });
    const u = awayOnBreak(r);
    const el = r.sim.get(u).elapsed;
    const calls = r.mv.calls.length;
    paused = true;
    for (let i = 0; i < 1200; i++) r.sim.step(100); // the movement is frozen too (sim clock paused)
    expect(r.sim.get(u).elapsed).toBe(el);
    expect(r.sim.onBreak(u)).not.toBeNull();
    expect(r.mv.calls.length).toBe(calls);
  });

  // Spec 0002 REQ-19 / AC-16: the trace is identical with and without reduced motion (the old clause "no new
  // break starts" contradicted it and is replaced by full equality of the movement calls and events).
  it('reduced motion: break walkers show leg cuts; breaks, calls and events are identical to the run without it; arrivals still settle', () => {
    const r = rig();
    const twin = rig();
    let u: string | null = null;
    for (let i = 0; i < 12000 && !u; i++) {
      r.step();
      twin.step();
      u = ids.find((id) => r.sim.onBreak(id) && r.sim.get(id).kind === 'walk' && r.nav.phase(id) === 'walk') ?? null;
    }
    expect(u).not.toBeNull();
    const w = u!;
    r.sim.setStatic(true);
    const events: unknown[] = [];
    const twinEvents: unknown[] = [];
    let settled = false;
    r.step(1500, () => {
      events.push(...r.sim.drainEvents());
      const v = r.sim.get(w);
      expect(v.kind).not.toBe('walk');
      if (!r.sim.onBreak(w)) return; // back home: the ambient cycle's own leg cuts apply (activity tests)
      const p = r.nav.renderPosition(w, true);
      expect(v.x).toBeCloseTo(p.x, 9);
      expect(v.z).toBeCloseTo(p.z, 9);
      expect(v.pose).not.toBe('walk');
      if (r.sim.onBreak(w) && r.sim.get(w).kind === 'coffee') settled = true;
    });
    twin.step(1500, () => twinEvents.push(...twin.sim.drainEvents()));
    expect(settled).toBe(true);
    expect(JSON.stringify(r.mv.calls)).toBe(JSON.stringify(twin.mv.calls));
    expect(JSON.stringify(events)).toBe(JSON.stringify(twinEvents));
    expect(r.sim.time).toBe(twin.sim.time);
  });
});

describe('campus breaks with the workflow engine and the director', () => {
  it('robots on a break are free; job steps run and jobs finish; the cycle never steers a reserved robot', () => {
    const layouts = towerLayouts();
    const units = unitFloors();
    const wf = makeWorkflow();
    const nav = wf.movement as NavMovement;
    const clock = { t: 0 };
    const mv = spy(nav, clock, (u) => expect(wf.unitState(u)).toBeNull());
    const ambient = createActivitySim(specs(), 7, { campus: { movement: mv, floors: units } });
    const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
    let interruptedOnBreak = 0;
    let jobsDone = 0;
    const wasOnBreak = new Set<string>();
    for (let i = 0; i < 12000; i++) {
      ambient.step(100);
      wf.step(0.1);
      clock.t += 0.1;
      for (const id of units.keys()) if (ambient.onBreak(id)) wasOnBreak.add(id);
      const ev = wf.drainEvents();
      jobsDone += ev.filter((e) => e.type === 'job-done').length;
      dir.ingest(ev);
      dir.update(0.1, wf);
      for (const id of units.keys()) {
        if (wf.unitState(id) && wasOnBreak.has(id)) {
          interruptedOnBreak++;
          wasOnBreak.delete(id);
        }
        if (wf.unitState(id)) expect(ambient.onBreak(id)).toBeNull();
      }
    }
    // Every moveTo by the cycle happened while the engine had no claim on the unit.
    for (const c of mv.calls) expect(c.target.spot.startsWith('amenity:') || c.target.spot.startsWith('home:')).toBe(true);
    expect(mv.calls.length).toBeGreaterThan(10);
    expect(interruptedOnBreak).toBeGreaterThan(0);
    expect(jobsDone).toBeGreaterThanOrEqual(3); // breaks delay steps (walk back), never block them
  }, 60000);
});
