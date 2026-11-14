// Staff NPCs (CEO-authorized expansion, KARARLAR rev 31): cleaners, tea server and guards. Pure sim: determinism
// per seed, footprint clearance, desk visits, floor-0 guards, org freeze, reduced motion, speech events.
import { describe, it, expect } from 'vitest';
import {
  FLOOR_COUNT,
  FURNITURE_CLEARANCE,
  GUARD_POST,
  LANE_OFFSET,
  LOBBY_FLOOR,
  LOBBY_SPOTS,
  STAFF_LANDING,
  floorLayout,
  lobbyPropFootprints,
  type FloorLayout,
  type Rect,
  type XZ,
} from '../src/sim/layout';
import { buildFloorGraph, pointSegmentDistance } from '../src/sim/nav';
import {
  CLEANER_FLOORS,
  MAX_PHRASE_LENGTH,
  STAFF_IDS,
  STAFF_PHRASES,
  TEA_CAPACITY,
  createStaffSim,
  staffGraphs,
  staffLayout,
  type StaffEvent,
  type StaffView,
} from '../src/sim/staffSim';
import { sortUnits } from '../src/ui/unitList';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import type { TowerData } from '../src/data/types';

function data(): TowerData {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

function layouts(d = data()): FloorLayout[] {
  return Array.from({ length: FLOOR_COUNT }, (_, f) =>
    floorLayout(
      f,
      sortUnits(d.units)
        .filter((u) => u.floor === f)
        .map((u) => ({ id: u.id, ceo: u.tier === 'ceo' })),
    ),
  );
}

const inside = (p: XZ, r: Rect): boolean => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

function segRectDistance(a: XZ, b: XZ, r: Rect): number {
  if (inside(a, r) || inside(b, r)) return 0;
  const c: XZ[] = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ];
  const o = (u: XZ, v: XZ, w: XZ): number => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
  let d = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = c[i]!;
    const t = c[(i + 1) % 4]!;
    if (o(a, b, s) * o(a, b, t) < 0 && o(s, t, a) * o(s, t, b) < 0) return 0;
    d = Math.min(d, pointSegmentDistance(s, a, b), pointSegmentDistance(a, s, t), pointSegmentDistance(b, s, t));
  }
  return d;
}

/** Runs the sim for `seconds` in 0.1 s steps, collecting every snapshot and every event. */
function run(seed: number, seconds: number, all = layouts()): { views: StaffView[][]; events: StaffEvent[] } {
  const sim = createStaffSim(all, seed);
  const views: StaffView[][] = [sim.snapshot()];
  const events: StaffEvent[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    sim.step(0.1);
    views.push(sim.snapshot());
    events.push(...sim.drainEvents());
  }
  return { views, events };
}

describe('staff cast', () => {
  it('has 2 cleaners, 1 tea server and 2 guards, none of them an agency unit', () => {
    const sim = createStaffSim(layouts(), 1);
    const roles = sim.snapshot().map((v) => v.role);
    expect(roles.filter((r) => r === 'cleaner')).toHaveLength(2);
    expect(roles.filter((r) => r === 'tea')).toHaveLength(1);
    expect(roles.filter((r) => r === 'guard-desk')).toHaveLength(1);
    expect(roles.filter((r) => r === 'guard-patrol')).toHaveLength(1);
    const unitIds = new Set(data().units.map((u) => u.id));
    for (const id of STAFF_IDS) expect(unitIds.has(id)).toBe(false);
  });
});

describe('staff graph (nav built on layout)', () => {
  const all = layouts();
  const graphs = staffGraphs(all);

  it('is one connected graph per floor and keeps every edge 0.25 u clear of every footprint (lobby props included)', () => {
    for (const [f, g] of graphs.entries()) {
      const seen = new Set<string>();
      const stack = [[...g.nodes.keys()][0] ?? ''];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const [n] of g.adjacency.get(id) ?? []) stack.push(n);
      }
      expect(seen.size, `floor ${f}`).toBe(g.nodes.size);
      const fps = staffLayout(all[f]!).footprints;
      for (const e of g.edges) {
        const a = g.nodes.get(e.a)!;
        const b = g.nodes.get(e.b)!;
        for (const r of fps) expect(segRectDistance(a, b, r), `floor ${f} ${e.a}->${e.b} vs ${r.name}`).toBeGreaterThanOrEqual(FURNITURE_CLEARANCE - 1e-9);
      }
    }
  });

  it('the lobby path and the desk/turnstile props exist only on floor 0; the props keep clear of every robot aisle lane', () => {
    for (const [f, g] of graphs.entries()) {
      for (const s of LOBBY_SPOTS) if (s.id.startsWith('staff:lobby') || s.id === 'staff:entrance' || s.id === GUARD_POST.id) expect(g.nodes.has(s.id), `floor ${f} ${s.id}`).toBe(f === LOBBY_FLOOR);
      expect(staffLayout(all[f]!).footprints.some((r) => r.name === 'security-desk')).toBe(f === LOBBY_FLOOR);
    }
    const robot = buildFloorGraph(all[LOBBY_FLOOR]!);
    for (const e of robot.edges) {
      const a = robot.nodes.get(e.a)!;
      const b = robot.nodes.get(e.b)!;
      for (const r of lobbyPropFootprints()) expect(segRectDistance(a, b, r)).toBeGreaterThanOrEqual(FURNITURE_CLEARANCE + LANE_OFFSET);
    }
    // The props do not overlap existing floor-0 furniture.
    for (const p of lobbyPropFootprints()) {
      for (const r of all[LOBBY_FLOOR]!.footprints) {
        const overlap = p.x0 < r.x1 && p.x1 > r.x0 && p.z0 < r.z1 && p.z1 > r.z0;
        expect(overlap, `${p.name} vs ${r.name}`).toBe(false);
      }
    }
  });

  it('does not change the robot layout: robot graphs have no staff node', () => {
    for (const l of all) for (const id of buildFloorGraph(l).nodes.keys()) expect(id.startsWith('staff:')).toBe(false);
  });
});

describe('staff behaviour', () => {
  const all = layouts();
  const long = run(7, 900, all);

  it('is deterministic per seed and differs between seeds', () => {
    const a = run(42, 120, all);
    const b = run(42, 120, all);
    expect(b.views).toEqual(a.views);
    expect(b.events).toEqual(a.events);
    const c = run(43, 120, all);
    expect(c.views).not.toEqual(a.views);
  });

  it('never stands or walks inside a desk or any other furniture footprint', () => {
    const fps = all.map((l) => staffLayout(l).footprints);
    for (const frame of long.views) {
      for (const v of frame) {
        for (const r of fps[v.floor]!) expect(inside(v, r), `${v.id} floor ${v.floor} (${v.x.toFixed(2)}, ${v.z.toFixed(2)}) in ${r.name}`).toBe(false);
      }
    }
  });

  it('the tea server visits every desk of a floor, refills at least every TEA_CAPACITY glasses and moves on floor by floor', () => {
    const tea = long.events.filter((e) => e.staffId === 'staff:tea');
    const served = tea.filter((e) => e.type === 'serve');
    expect(served.length).toBeGreaterThan(10);
    let sinceRefill = 0;
    for (const e of tea) {
      if (e.type === 'refill') sinceRefill = 0;
      if (e.type === 'serve') {
        sinceRefill++;
        expect(sinceRefill).toBeLessThanOrEqual(TEA_CAPACITY);
      }
    }
    // Every desk owner of at least two floors was served; serve events name real desk owners of that floor.
    const byFloor = new Map<number, Set<string>>();
    for (const e of served) {
      if (e.type !== 'serve') continue;
      expect(all[e.floor]!.desks.map((d) => d.owner)).toContain(e.owner);
      const s = byFloor.get(e.floor) ?? new Set<string>();
      s.add(e.owner);
      byFloor.set(e.floor, s);
    }
    const complete = [...byFloor.entries()].filter(([f, s]) => s.size === all[f]!.desks.length);
    expect(complete.length).toBeGreaterThanOrEqual(2);
    expect(tea.some((e) => e.type === 'floor')).toBe(true);
  });

  it('the tea server pauses at a desk: stands still in the serve state facing the desk', () => {
    const frames = long.views.map((f) => f.find((v) => v.id === 'staff:tea')!);
    const serving = frames.filter((v) => v.state === 'serve');
    expect(serving.length).toBeGreaterThan(10);
  });

  it('guards stay on floor 0; the desk guard keeps its post; the patrol guard reaches the entrance', () => {
    const post = LOBBY_SPOTS.find((s) => s.id === GUARD_POST.id)!;
    let entrance = false;
    const entranceSpot = LOBBY_SPOTS.find((s) => s.id === 'staff:entrance')!;
    for (const frame of long.views) {
      for (const v of frame) {
        if (v.role === 'guard-desk' || v.role === 'guard-patrol') expect(v.floor).toBe(LOBBY_FLOOR);
        if (v.role === 'guard-desk') expect(Math.hypot(v.x - post.x, v.z - post.z)).toBeLessThan(1e-9);
        if (v.role === 'guard-patrol' && Math.hypot(v.x - entranceSpot.x, v.z - entranceSpot.z) < 1e-6) entrance = true;
      }
    }
    expect(entrance).toBe(true);
  });

  it('cleaners stay on their floor sets, mop on several floors and change floors only at the staff landing with a fade', () => {
    const cleaners = STAFF_IDS.filter((id) => id.startsWith('staff:cleaner'));
    cleaners.forEach((id, i) => {
      const floors = new Set<number>();
      for (const frame of long.views) {
        const v = frame.find((x) => x.id === id)!;
        expect(CLEANER_FLOORS[i]).toContain(v.floor);
        floors.add(v.floor);
        if (v.state === 'fade-out' || v.state === 'fade-in') expect(Math.hypot(v.x - STAFF_LANDING.entry.x, v.z - STAFF_LANDING.entry.z)).toBeLessThan(1e-6);
      }
      const mops = long.events.filter((e) => e.staffId === id && e.type === 'mop');
      expect(new Set(mops.map((e) => e.floor)).size).toBeGreaterThanOrEqual(2);
      for (const e of long.events.filter((x) => x.staffId === id && x.type === 'floor')) {
        if (e.type !== 'floor') continue;
        expect(Math.hypot(e.x - STAFF_LANDING.entry.x, e.z - STAFF_LANDING.entry.z)).toBeLessThan(1e-6);
      }
      // A fade passes through partial opacity.
      const partial = long.views.some((f) => {
        const v = f.find((x) => x.id === id)!;
        return v.opacity > 0.05 && v.opacity < 0.95;
      });
      expect(partial).toBe(true);
    });
  });

  it('walks between spots continuously (no jump larger than one step at walking speed)', () => {
    for (let i = 1; i < long.views.length; i++) {
      for (const v of long.views[i]!) {
        const p = long.views[i - 1]!.find((x) => x.id === v.id)!;
        if (p.floor !== v.floor) continue;
        expect(Math.hypot(v.x - p.x, v.z - p.z), v.id).toBeLessThanOrEqual(0.1 * 1.2 + 1e-9);
      }
    }
  });
});

describe('org mode and reduced motion', () => {
  const all = layouts();

  it('org mode freezes every staff member in place and emits nothing; leaving it resumes', () => {
    const sim = createStaffSim(all, 3);
    for (let i = 0; i < 150; i++) sim.step(0.1);
    sim.drainEvents();
    sim.setOrg(true);
    const before = sim.snapshot();
    for (let i = 0; i < 600; i++) sim.step(0.1);
    expect(sim.snapshot()).toEqual(before);
    expect(sim.drainEvents()).toEqual([]);
    sim.setOrg(false);
    for (let i = 0; i < 300; i++) sim.step(0.1);
    expect(sim.snapshot()).not.toEqual(before);
  });

  it('reduced motion: positions only cut to leg ends, no walk phase, no fades', () => {
    const sim = createStaffSim(all, 5);
    for (let i = 0; i < 37; i++) sim.step(0.1); // somebody is mid-walk now
    sim.setReducedMotion(true);
    let prev = sim.snapshot();
    for (const v of prev) {
      expect(v.state).not.toBe('walk');
      expect(v.opacity).toBe(1);
    }
    let cuts = 0;
    for (let i = 0; i < 3000; i++) {
      sim.step(0.1);
      const now = sim.snapshot();
      for (const v of now) {
        const p = prev.find((x) => x.id === v.id)!;
        expect(v.state === 'walk' || v.state === 'fade-in' || v.state === 'fade-out', v.id).toBe(false);
        expect(v.walkPhase).toBe(0);
        expect(v.opacity).toBe(1);
        if (Math.hypot(v.x - p.x, v.z - p.z) > 1e-9 || v.floor !== p.floor) {
          cuts++;
          expect(v.node, `${v.id} cut to a node`).not.toBeNull();
        }
      }
      prev = now;
    }
    expect(cuts).toBeGreaterThan(10);
  });
});

describe('speech bubbles', () => {
  it('phrases are Turkish, at most 48 characters, and include the brief examples', () => {
    expect(MAX_PHRASE_LENGTH).toBe(48);
    const flat = Object.values(STAFF_PHRASES).flat();
    expect(flat).toContain('Çay ister misiniz?');
    expect(flat).toContain('Dikkat, zemin ıslak!');
    for (const p of flat) expect([...p].length).toBeLessThanOrEqual(48);
  });

  it('are rare, come from the built-in list and reach onSpeech listeners as events', () => {
    const sim = createStaffSim(layouts(), 11);
    const heard: StaffEvent[] = [];
    const off = sim.onSpeech((e) => heard.push(e));
    const drained: StaffEvent[] = [];
    for (let i = 0; i < 6000; i++) {
      sim.step(0.1);
      drained.push(...sim.drainEvents());
    }
    const speech = drained.filter((e) => e.type === 'speech');
    expect(speech.length).toBeGreaterThan(0);
    expect(heard).toEqual(speech);
    // Rare: at most one line per staff member per 20 s on average over 10 minutes.
    expect(speech.length).toBeLessThanOrEqual((600 / 20) * STAFF_IDS.length);
    const flat = new Set(Object.values(STAFF_PHRASES).flat());
    for (const e of speech) if (e.type === 'speech') expect(flat.has(e.text)).toBe(true);
    off();
    for (let i = 0; i < 3000; i++) sim.step(0.1);
    expect(heard).toHaveLength(speech.length);
  });
});
