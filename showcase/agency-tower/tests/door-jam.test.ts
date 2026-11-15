// CEO film review: robots leaving the work room at the same moment jammed (the elevator-exit test staggered its six
// walkers 2 s apart to dodge it). Reproduced with simultaneous departures: walkers turning into a landing waiting spot
// stepped across to the corridor centre and back (a U-turn right in front of the walker behind), the two then gave
// way to each other at once and backed off together for seconds. Measured here: every walker passes the work-room
// door, nobody yields for long, nobody overlaps or jumps, and everyone gets where they were going.
import { describe, it, expect } from 'vitest';
import { LANDING_SEPARATION, PARTITIONS, ROBOT_SEPARATION, STAFF_SHAFT, LANDING_APRON, separationExempt } from '../src/sim/layout';
import { WALK_SPEED, createNavMovement, type NavMovement } from '../src/sim/navMovement';
import type { Target } from '../src/sim/movement';
import { unitFloors } from './workflowHelpers';

const STEP = 0.05;
/** The work-room partition line (the door is the gap in it). */
const DOOR_Z = PARTITIONS[1]![1];
/** Longest single yield wait we accept in a six-robot departure (the jam held walkers for MAX_YIELD_S = 6 s). */
const MAX_WAIT_S = 2;
/**
 * The staff landing (cabin plate and apron, where robots walk as a group LANDING_SEPARATION apart) plus one separation
 * distance around it, where a group that just stepped off spreads out again.
 */
const nearLanding = (p: { x: number; z: number }): boolean => {
  const m = ROBOT_SEPARATION;
  return (
    (Math.abs(p.x - STAFF_SHAFT.x) <= STAFF_SHAFT.cabinHalf + m && Math.abs(p.z - STAFF_SHAFT.z) <= STAFF_SHAFT.cabinHalf + m) ||
    (Math.abs(p.x - LANDING_APRON.x) <= LANDING_APRON.r + m && Math.abs(p.z - LANDING_APRON.z) <= LANDING_APRON.r + m)
  );
};

interface Run {
  /** Unit -> time it crossed the work-room door line (leaving the work room). */
  door: Map<string, number>;
  /** Unit -> time it reached its target. */
  done: Map<string, number>;
  closest: { d: number; at: string };
  maxStep: { d: number; at: string };
  maxYield: { s: number; unit: string };
}

function run(nav: NavMovement, ids: readonly string[], target: (i: number) => Target, seconds: number): Run {
  const r: Run = { door: new Map(), done: new Map(), closest: { d: Infinity, at: '' }, maxStep: { d: 0, at: '' }, maxYield: { s: 0, unit: '' } };
  ids.forEach((u, i) => nav.moveTo(u, target(i)));
  const last = new Map(ids.map((u) => [u, nav.position(u)]));
  for (let i = 0; i < seconds / STEP; i++) {
    nav.step(STEP, () => false);
    const t = (i + 1) * STEP;
    for (const [k, u] of ids.entries()) {
      const p = nav.position(u);
      const q = last.get(u)!;
      if (!r.door.has(u) && p.floor === q.floor && q.z < DOOR_Z && p.z >= DOOR_Z) r.door.set(u, t);
      if (!r.done.has(u) && nav.isAt(u, target(k))) r.done.set(u, t);
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (p.floor === q.floor && d > r.maxStep.d) r.maxStep = { d, at: `${u} @${t.toFixed(2)}` };
      last.set(u, p);
    }
    for (const a of ids)
      for (const b of ids) {
        if (a >= b) continue;
        const pa = nav.position(a);
        const pb = nav.position(b);
        if (pa.floor !== pb.floor) continue;
        const ra = nav.phase(a);
        const rb = nav.phase(b);
        if (ra !== 'walk' && rb !== 'walk' && !(ra === 'ride' && rb === 'ride')) continue;
        const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
        // Riders stand closer inside the cabin; on the landing (and walking in together) robots keep LANDING_SEPARATION.
        const landing = nearLanding(pa) || nearLanding(pb) || ra === 'ride' || rb === 'ride';
        if (landing) {
          if (ra === 'ride' && rb === 'ride' && Math.abs(pa.y - pb.y) < 1e-9 && nav.elevator.state().riders.includes(a) && nav.elevator.state().riders.includes(b)) continue;
          if (d < LANDING_SEPARATION - 1e-6 && d < r.closest.d) r.closest = { d, at: `${a}/${b} landing @${t.toFixed(2)}` };
          continue;
        }
        if (separationExempt(nav.layout(pa.floor), pa, pb)) continue;
        if (d < r.closest.d) r.closest = { d, at: `${a}/${b} @${t.toFixed(2)} (${pa.x.toFixed(2)},${pa.z.toFixed(2)}) (${pb.x.toFixed(2)},${pb.z.toFixed(2)})` };
      }
  }
  for (const l of nav.legLog()) if (l.kind === 'walk' && l.maxYield > r.maxYield.s) r.maxYield = { s: l.maxYield, unit: `${l.unit} f${l.floor} @${l.start.toFixed(1)}` };
  return r;
}

const six = (): string[] => [...unitFloors().keys()].filter((u) => u !== 'ceo').slice(0, 6);
const meeting = (i: number): Target => ({ floor: 3, spot: i === 0 ? 'meeting-room:lead' : 'meeting-room' });

describe('work-room door with six robots leaving at once (CEO film review)', () => {
  it('three per floor on two floors, all at once, to the floor-3 meeting room: no jam on the way to the landing', () => {
    const ids = six();
    const units = new Map(ids.map((u, i) => [u, i < 3 ? 0 : 1]));
    const nav = createNavMovement({ units, record: true, cabinFloor: 0 });
    const r = run(nav, ids, meeting, 60);
    const doors = [...r.door.values()];
    expect(doors).toHaveLength(6);
    expect(Math.max(...doors) - Math.min(...doors)).toBeLessThanOrEqual(4);
    expect(r.maxYield.s, r.maxYield.unit).toBeLessThanOrEqual(MAX_WAIT_S);
    expect(r.closest.d, r.closest.at).toBeGreaterThanOrEqual(ROBOT_SEPARATION - 1e-6);
    expect(r.maxStep.d, r.maxStep.at).toBeLessThanOrEqual(WALK_SPEED * STEP + 1e-6);
    expect([...r.done.keys()].sort()).toEqual([...ids].sort());
    // Through the door and to the landing as fast as walking allows: every caller waits at its spot within 15 s.
    const calls = nav.legLog().filter((l) => l.kind === 'walk' && l.start <= STEP + 1e-9);
    expect(calls).toHaveLength(6);
    for (const l of calls) expect(l.end, l.unit).toBeLessThanOrEqual(15);
  });

  it('six from one work room, all at once, to the six coffee spots: all through the door within 4 s of the first', () => {
    const ids = six();
    const nav = createNavMovement({ units: new Map(ids.map((u) => [u, 1])), record: true });
    const r = run(nav, ids, (i) => ({ floor: 1, spot: `coffee:${i}` }), 40);
    const doors = [...r.door.values()];
    expect(doors).toHaveLength(6);
    expect(Math.max(...doors) - Math.min(...doors)).toBeLessThanOrEqual(4.5);
    expect(r.maxYield.s, r.maxYield.unit).toBeLessThanOrEqual(MAX_WAIT_S);
    expect(r.closest.d, r.closest.at).toBeGreaterThanOrEqual(ROBOT_SEPARATION - 1e-6);
    expect(r.maxStep.d, r.maxStep.at).toBeLessThanOrEqual(WALK_SPEED * STEP + 1e-6);
    expect([...r.done.keys()].sort()).toEqual([...ids].sort());
  });

  it('six from one work room, all at once, to another floor: no jam, no overlap, no jump; all arrive', () => {
    const ids = six();
    const nav = createNavMovement({ units: new Map(ids.map((u) => [u, 1])), record: true, cabinFloor: 0 });
    const r = run(nav, ids, meeting, 90);
    expect([...r.door.values()]).toHaveLength(6);
    expect(r.maxYield.s, r.maxYield.unit).toBeLessThanOrEqual(MAX_WAIT_S);
    expect(r.closest.d, r.closest.at).toBeGreaterThanOrEqual(ROBOT_SEPARATION - 1e-6);
    expect(r.maxStep.d, r.maxStep.at).toBeLessThanOrEqual(WALK_SPEED * STEP + 1e-6);
    expect([...r.done.keys()].sort()).toEqual([...ids].sort());
  });
});
