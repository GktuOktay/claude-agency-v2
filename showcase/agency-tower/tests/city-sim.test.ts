// City life sim (KARARLAR rev 31): pure, seedable street plan, vehicle and pedestrian loops, traffic lights.
import { describe, it, expect } from 'vitest';
import { CAMPUS_BOUNDS } from '../src/sim/layout';
import {
  SIGNAL,
  SIGNAL_CYCLE,
  cityPlan,
  createCitySim,
  heightCap,
  inRect,
  pathPoint,
  rectDistance,
  rectsOverlap,
  signalAt,
  signalState,
  stepCitySim,
  type Axis,
  type CitySim,
} from '../src/sim/citySim';

const plan = cityPlan(CAMPUS_BOUNDS, 7);
const snapshot = (sim: CitySim): string =>
  JSON.stringify([sim.vehicles.map((v) => [v.s.toFixed(4), v.x.toFixed(3), v.z.toFixed(3)]), sim.pedestrians.map((p) => [p.s.toFixed(4), p.x.toFixed(3)])]);
const other = (a: Axis): Axis => (a === 'x' ? 'z' : 'x');

describe('city plan', () => {
  it('keeps a clear ring around the campus: no building, tree, lamp, signal or bench inside it', () => {
    const c = plan.clear;
    expect(c.x0).toBeLessThan(CAMPUS_BOUNDS.x0 - 4);
    expect(c.x1).toBeGreaterThan(CAMPUS_BOUNDS.x1 + 4);
    expect(c.z0).toBeLessThan(CAMPUS_BOUNDS.z0 - 4);
    expect(c.z1).toBeGreaterThan(CAMPUS_BOUNDS.z1 + 4);
    for (const b of plan.buildings) expect(rectsOverlap(b, c), `building ${b.x0},${b.z0}`).toBe(false);
    for (const p of [...plan.trees, ...plan.lamps, ...plan.signals, ...plan.benches]) expect(inRect(c, p), `${p.x},${p.z}`).toBe(false);
  });

  it('has neighbouring buildings, low near the campus and capped by distance; none on a road, sidewalk or the park', () => {
    expect(plan.buildings.length).toBeGreaterThanOrEqual(40);
    const mid = plan.buildings.filter((b) => b.floors >= 4);
    expect(mid.length, 'some mid-rise buildings').toBeGreaterThan(0);
    for (const b of plan.buildings) {
      expect(b.h).toBeLessThanOrEqual(heightCap(rectDistance(CAMPUS_BOUNDS, b)) + 1e-9);
      for (const r of [...plan.roads, ...plan.sidewalks, plan.park]) expect(rectsOverlap(b, r)).toBe(false);
    }
    // Camera side (south and east of the campus) stays low-rise.
    for (const b of plan.buildings.filter((q) => q.z0 > CAMPUS_BOUNDS.z1 || q.x0 > CAMPUS_BOUNDS.x1)) expect(b.floors).toBeLessThanOrEqual(3);
  });

  it('has four signalled intersections with a head per approach, crosswalks on every side, a park with benches', () => {
    expect(plan.intersections).toHaveLength(4);
    expect(plan.signals).toHaveLength(16);
    expect(plan.crosswalks).toHaveLength(16);
    expect(plan.benches.length).toBeGreaterThanOrEqual(4);
    for (const b of plan.benches) expect(inRect(plan.park, b)).toBe(true);
    expect(plan.trees.length).toBeGreaterThanOrEqual(20);
    expect(plan.lamps.length).toBeGreaterThanOrEqual(12);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(cityPlan(CAMPUS_BOUNDS, 7))).toBe(JSON.stringify(plan));
    expect(JSON.stringify(cityPlan(CAMPUS_BOUNDS, 8).buildings)).not.toBe(JSON.stringify(plan.buildings));
  });

  it('every vehicle path stops at the lights it crosses; the ring stops at all four corners', () => {
    expect(plan.vehiclePaths[0]?.closed).toBe(true);
    expect(plan.vehiclePaths[0]?.stops).toHaveLength(4);
    for (const p of plan.vehiclePaths.slice(1)) expect(p.stops).toHaveLength(2);
  });
});

describe('signals', () => {
  it('cycles green, yellow, red and never gives both axes green or yellow at once', () => {
    const seen = new Set<string>();
    for (let t = 0; t < SIGNAL_CYCLE; t += 0.1) {
      const x = signalAt(t, 'x');
      const z = signalAt(t, 'z');
      seen.add(x);
      expect(x === 'red' || z === 'red', `t=${t.toFixed(1)}`).toBe(true);
    }
    expect([...seen].sort()).toEqual(['green', 'red', 'yellow']);
    expect(signalAt(0, 'x')).toBe('green');
    expect(signalAt(SIGNAL.green + 0.1, 'x')).toBe('yellow');
  });
});

describe('city sim', () => {
  it('is deterministic for a seed and a dt sequence, and different seeds differ', () => {
    const a = createCitySim(plan, 3);
    const b = createCitySim(plan, 3);
    const c = createCitySim(plan, 4);
    for (let i = 0; i < 300; i++) {
      stepCitySim(a, 1 / 30);
      stepCitySim(b, 1 / 30);
      stepCitySim(c, 1 / 30);
    }
    expect(snapshot(a)).toBe(snapshot(b));
    expect(snapshot(a)).not.toBe(snapshot(c));
  });

  it('has cars, taxis and buses, and pedestrians', () => {
    const sim = createCitySim(plan, 7);
    const kinds = new Set(sim.vehicles.map((v) => v.kind));
    expect([...kinds].sort()).toEqual(['bus', 'car', 'taxi']);
    expect(sim.vehicles.length).toBeGreaterThanOrEqual(16);
    expect(sim.pedestrians.length).toBeGreaterThanOrEqual(20);
  });

  it('vehicles stop at red lights: they never pass a stop line while the cross traffic has green or yellow, and they do wait', () => {
    const sim = createCitySim(plan, 7);
    let violations = 0;
    let waits = 0;
    let crossings = 0;
    for (let i = 0; i < 30 * 240; i++) {
      const before = sim.vehicles.map((v) => v.s);
      stepCitySim(sim, 1 / 30);
      sim.vehicles.forEach((v, k) => {
        const path = plan.vehiclePaths[v.path];
        const s0 = before[k] ?? 0;
        if (!path || v.s < s0) return; // wrapped
        for (const st of path.stops) {
          const front0 = s0 + v.length / 2;
          const front1 = v.s + v.length / 2;
          const line = st.s;
          if (front0 < line && front1 >= line) {
            crossings++;
            if (signalState(sim, st.node, other(st.axis)) !== 'red') violations++;
          }
          if (v.speed < 0.05 && line - front1 > 0 && line - front1 < 1.5) waits++;
        }
      });
    }
    expect(crossings).toBeGreaterThan(100);
    expect(waits).toBeGreaterThan(0);
    expect(violations).toBe(0);
  });

  it('keeps flowing (no gridlock), vehicles stay on the road and never overlap in a lane', () => {
    const sim = createCitySim(plan, 7);
    const travelled = sim.vehicles.map(() => 0);
    for (let i = 0; i < 30 * 180; i++) {
      stepCitySim(sim, 1 / 30);
      sim.vehicles.forEach((v, k) => {
        travelled[k] = (travelled[k] ?? 0) + v.speed / 30;
        expect(plan.roads.some((r) => inRect(r, v, 0.05)), `${v.kind} at ${v.x.toFixed(1)},${v.z.toFixed(1)}`).toBe(true);
      });
      if (i % 15 === 0) {
        for (const a of sim.vehicles) for (const b of sim.vehicles) {
          if (a === b || Math.cos(a.yaw - b.yaw) < 0.95) continue;
          const hx = Math.cos(a.yaw);
          const hz = -Math.sin(a.yaw);
          const rx = b.x - a.x;
          const rz = b.z - a.z;
          if (Math.abs(rx * -hz + rz * hx) > 1.0) continue;
          expect(Math.abs(rx * hx + rz * hz), `${a.kind}/${b.kind}`).toBeGreaterThan((a.length + b.length) / 2);
        }
      }
    }
    for (const d of travelled) expect(d).toBeGreaterThan(150);
  });

  it('pedestrians walk on sidewalks and crosswalks, and wait at the kerb for their light', () => {
    const sim = createCitySim(plan, 7);
    const start = sim.pedestrians.map((p) => p.s);
    let waited = 0;
    for (let i = 0; i < 30 * 120; i++) {
      stepCitySim(sim, 1 / 30);
      for (const p of sim.pedestrians) {
        expect([...plan.sidewalks, ...plan.crosswalks].some((r) => inRect(r, p, 0.05)), `ped at ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true);
        if (!p.walking) waited++;
      }
    }
    expect(waited).toBeGreaterThan(0);
    sim.pedestrians.forEach((p, k) => expect(p.s).not.toBe(start[k]));
  });

  it('path points follow the path heading', () => {
    const ring = plan.vehiclePaths[0];
    if (!ring) throw new Error('ring');
    const p = pathPoint(ring, 1);
    expect(Math.hypot(p.dx, p.dz)).toBeCloseTo(1, 6);
  });
});
