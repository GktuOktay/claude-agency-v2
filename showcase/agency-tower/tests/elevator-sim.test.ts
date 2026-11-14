// Spec 0002 AC-13 (REQ-14, §7.5b, §7.8): the east staff-only cabin. Request order, capacity, the
// ride-leg formula, doors open at every boarding and exit, rider y = cabin y, hold/re-queue on
// selection, pause (no dt, no change), deterministic.
import { describe, it, expect } from 'vitest';
import { CABIN_CAPACITY, DOOR_S, createElevator, rideLegS, travelS, type Elevator } from '../src/sim/elevator';
import { floorY } from '../src/sim/layout';

const STEP = 0.1;
const tick = (e: Elevator, s: number): void => {
  for (let i = 0; i < Math.round(s / STEP); i++) e.step(STEP);
};
const until = (e: Elevator, ok: () => boolean, maxS = 120): number => {
  for (let i = 0; i < maxS / STEP; i++) {
    if (ok()) return e.time;
    e.step(STEP);
  }
  throw new Error('timeout');
};

describe('elevator timing (§7.5b)', () => {
  it('travel time is clamp(0.6 s x floors, 0.8 s, 3.0 s); the ride leg adds 0.6 s doors at each end', () => {
    expect(travelS(1)).toBeCloseTo(0.8);
    expect(travelS(2)).toBeCloseTo(1.2);
    expect(travelS(5)).toBeCloseTo(3.0);
    expect(travelS(0)).toBe(0);
    expect(DOOR_S).toBeCloseTo(0.6);
    expect(rideLegS(3)).toBeCloseTo(0.6 + 1.8 + 0.6);
    expect(CABIN_CAPACITY).toBe(3);
  });

  it('a rider at the cabin floor boards at once; boarding to exit equals the formula (± one step)', () => {
    const e = createElevator({ startFloor: 0, record: true });
    e.call('a', 0, 3);
    until(e, () => e.status('a') === 'arrived');
    const [board] = e.log().filter((x) => x.type === 'board');
    const [exit] = e.log().filter((x) => x.type === 'exit');
    const end = e.log().find((x) => x.type === 'ride-end' && x.unit === 'a')!;
    const start = e.log().find((x) => x.type === 'ride-start' && x.unit === 'a')!;
    expect(start.t).toBeCloseTo(0, 5);
    expect(Math.abs(end.t - start.t - rideLegS(3))).toBeLessThanOrEqual(STEP + 1e-6);
    expect(board!.doors).toBe(1);
    expect(exit!.doors).toBe(1);
    expect(exit!.floor).toBe(3);
  });

  it('an empty cabin travels to the call floor at the same rate (cabin-arrival wait)', () => {
    const e = createElevator({ startFloor: 5, record: true });
    e.call('a', 1, 2);
    until(e, () => e.status('a') === 'riding' || e.status('a') === 'boarding');
    expect(Math.abs(e.time - travelS(4))).toBeLessThanOrEqual(STEP + 1e-6);
  });
});

describe('request order, capacity and doors (AC-13)', () => {
  it('serves calls in request order; same floor and destination ride together, at most 3', () => {
    const e = createElevator({ startFloor: 0, record: true });
    e.call('a', 2, 4);
    e.call('b', 1, 0);
    for (const u of ['c', 'd', 'e']) e.call(u, 2, 4);
    until(e, () => ['a', 'b', 'c', 'd', 'e'].every((u) => e.status(u) === 'arrived'), 200);
    const boards = e.log().filter((x) => x.type === 'board');
    // First trip: a, c, d (cap 3); e waits for b's earlier call to be served first.
    expect(boards.slice(0, 3).map((b) => b.unit)).toEqual(['a', 'c', 'd']);
    expect(boards[3]!.unit).toBe('b');
    expect(boards[4]!.unit).toBe('e');
    for (const x of e.log()) if (x.type === 'riders') expect(x.count).toBeLessThanOrEqual(CABIN_CAPACITY);
    for (const x of e.log()) if (x.type === 'board' || x.type === 'exit') expect(x.doors).toBe(1);
  });

  it('every rider y equals the cabin y; doors are closed while travelling', () => {
    const e = createElevator({ startFloor: 0 });
    e.call('a', 0, 5);
    let travelled = false;
    for (let i = 0; i < 100; i++) {
      e.step(STEP);
      if (e.status('a') === 'riding') expect(Math.abs(e.riderY('a')! - e.cabinY())).toBeLessThanOrEqual(0.05);
      if (e.state().mode === 'travel') {
        travelled = true;
        expect(e.doorOpen()).toBe(0);
      }
    }
    expect(travelled).toBe(true);
    expect(e.cabinY()).toBeCloseTo(floorY(5));
    expect(e.state().floor).toBe(5);
  });

  it('call lamps are lit from call to boarding', () => {
    const e = createElevator({ startFloor: 5 });
    e.call('a', 1, 2);
    expect(e.callLit(1)).toBe(true);
    expect(e.callLit(2)).toBe(false);
    until(e, () => e.status('a') === 'riding');
    expect(e.callLit(1)).toBe(false);
  });
});

describe('selection and pause (REQ-17, §7.8)', () => {
  it('a held caller does not board; release re-queues its call at the end', () => {
    const e = createElevator({ startFloor: 4, record: true });
    e.call('a', 0, 2);
    e.hold('a', true);
    e.call('b', 0, 3);
    tick(e, 0.1);
    e.hold('a', false);
    expect(e.queue().map((c) => c.unit)).toEqual(['b', 'a']);
    until(e, () => e.status('a') === 'arrived', 60);
    expect(e.log().filter((x) => x.type === 'board').map((x) => x.unit)).toEqual(['b', 'a']);
  });

  it('dt 0 changes nothing (global pause); the same calls give the same snapshot (deterministic)', () => {
    const make = () => {
      const e = createElevator({ startFloor: 2 });
      e.call('a', 4, 0);
      e.call('b', 1, 5);
      tick(e, 3.3);
      return e;
    };
    const a = make();
    const before = JSON.stringify(a.snapshot());
    for (let i = 0; i < 50; i++) a.step(0);
    expect(JSON.stringify(a.snapshot())).toBe(before);
    expect(JSON.stringify(make().snapshot())).toBe(before);
  });

  it('cancel removes a queued call', () => {
    const e = createElevator({ startFloor: 0 });
    e.call('a', 3, 1);
    e.cancel('a');
    expect(e.queue()).toEqual([]);
    expect(e.status('a')).toBe('none');
  });
});
