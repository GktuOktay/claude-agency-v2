// CEO film review: callers appeared inside the staff cabin the moment its doors opened (the ride leg snapped them from
// the landing waiting spot to their rider spot). Boarders now walk from the waiting spot through the open door to
// their rider spot while the cabin holds its doors open for them (bounded), then the doors close. Tracked frame by
// frame here: the rendered and simulated positions never jump further than one walking step, and every boarder
// crosses the cabin door line on its own floor while the doors stand fully open.
import { describe, it, expect } from 'vitest';
import { appCampusOptions, createActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import { maxJobsFor } from '../src/app/params';
import { FLOOR_HEIGHT, STAFF_SHAFT, floorY } from '../src/sim/layout';
import { TRAVEL_PER_FLOOR_S } from '../src/sim/elevator';
import { WALK_SPEED, createNavMovement, type NavMovement } from '../src/sim/navMovement';
import { breakPeriodAt } from '../src/sim/schedule';
import { MASTER_SEED } from '../src/sim/workflow';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

const STEP = 0.05;
/** Cabin door plane (west edge of the cabin plate): boarders cross it eastward. */
const DOOR_X = STAFF_SHAFT.x - STAFF_SHAFT.cabinHalf;
/** Fastest vertical rate: one floor per TRAVEL_PER_FLOOR_S. */
const CABIN_SPEED = FLOOR_HEIGHT / TRAVEL_PER_FLOOR_S;

interface Pos {
  floor: number;
  x: number;
  y: number;
  z: number;
}

interface BoardWatch {
  /** Largest per-frame horizontal move (sim and rendered position) and the unit/time it happened. */
  maxStep: { d: number; at: string };
  /** Largest per-frame vertical move. */
  maxRise: { d: number; at: string };
  /** Units that entered a ride and the floor they boarded at. */
  boarders: Map<string, number>;
  /** Units seen crossing the door line eastward on their boarding floor while the doors were fully open. */
  crossedOpen: Set<string>;
  /** Units that crossed the door line eastward while the doors were not fully open (or the cabin was elsewhere). */
  crossedShut: string[];
}

function watchBoarding(nav: NavMovement, units: readonly string[]): { step(t: number): void; result: BoardWatch } {
  const res: BoardWatch = { maxStep: { d: 0, at: '' }, maxRise: { d: 0, at: '' }, boarders: new Map(), crossedOpen: new Set(), crossedShut: [] };
  const last = new Map<string, { sim: Pos; ren: Pos; phase: string }>();
  return {
    result: res,
    step(t) {
      const cab = nav.elevator.state();
      for (const u of units) {
        const sim = nav.position(u);
        const ren = nav.renderPosition(u, false);
        const phase = nav.phase(u);
        const prev = last.get(u);
        if (prev) {
          for (const [a, b] of [
            [prev.sim, sim],
            [prev.ren, ren],
          ] as const) {
            const d = Math.hypot(b.x - a.x, b.z - a.z);
            if (d > res.maxStep.d) res.maxStep = { d, at: `${u} @${t.toFixed(2)} ${prev.phase}->${phase} (${a.x.toFixed(2)},${a.z.toFixed(2)})->(${b.x.toFixed(2)},${b.z.toFixed(2)})` };
            const r = Math.abs(b.y - a.y);
            if (r > res.maxRise.d) res.maxRise = { d: r, at: `${u} @${t.toFixed(2)} ${prev.phase}->${phase}` };
          }
          if (phase === 'ride' && prev.phase !== 'ride') res.boarders.set(u, prev.sim.floor);
          // Walking into the cabin (eastward over the door plane) on a landing.
          if (prev.sim.x < DOOR_X && sim.x >= DOOR_X && sim.floor === prev.sim.floor) {
            const from = sim.floor;
            if (cab.floor === from && cab.mode === 'doors' && cab.doors >= 1) res.crossedOpen.add(u);
            else res.crossedShut.push(`${u} @${t.toFixed(2)} cabin ${cab.mode} f${cab.floor} doors ${cab.doors.toFixed(2)}`);
          }
        }
        last.set(u, { sim, ren, phase });
      }
    },
  };
}

describe('staff cabin boarding (CEO film review: no teleport into the cabin)', () => {
  it('six callers walk from their waiting spots through the open doors to their rider spots; positions never jump', () => {
    // As in the exit test: three callers on floor 0 and three on floor 1, held at the landing until all six wait.
    const ids = [...unitFloors().keys()].filter((u) => u !== 'ceo').slice(0, 6);
    const units = new Map(ids.map((u, i) => [u, i < 3 ? 0 : 1]));
    const nav = createNavMovement({ units, record: true, cabinFloor: 0 });
    const target = (i: number) => ({ floor: 3, spot: i === 0 ? 'meeting-room:lead' : 'meeting-room' });
    const w = watchBoarding(nav, ids);
    let released = false;
    let releasedAt = -1;
    let step = 0;
    const frozen = (u: string): boolean => nav.phase(u) === 'call-wait' && (!released || step < releasedAt + (units.get(u) === 1 ? 1 : 0));
    for (let i = 0; i < 90 / STEP; i++) {
      const k = i / (2 / STEP);
      if (Number.isInteger(k) && k < ids.length) nav.moveTo(ids[k]!, target(k));
      step = i;
      if (!released && ids.every((u) => nav.phase(u) === 'call-wait')) {
        released = true;
        releasedAt = i;
      }
      nav.step(STEP, frozen);
      w.step(i * STEP);
    }
    expect(released).toBe(true);
    expect(Math.max(...nav.elevator.log().filter((e) => e.type === 'riders').map((e) => e.count ?? 0))).toBe(6);
    // No discontinuity: at most one walking step per frame horizontally, the cabin's rate vertically.
    expect(w.result.maxStep.d, w.result.maxStep.at).toBeLessThanOrEqual(WALK_SPEED * STEP + 1e-6);
    expect(w.result.maxRise.d, w.result.maxRise.at).toBeLessThanOrEqual(CABIN_SPEED * STEP + 1e-6);
    expect([...w.result.boarders.keys()].sort()).toEqual([...ids].sort());
    // Every boarder walked through the door while it stood fully open; nobody passed shut doors.
    expect([...w.result.crossedOpen].sort()).toEqual([...ids].sort());
    expect(w.result.crossedShut).toEqual([]);
    // Doors are fully open at every walk-in and every exit; the walk-in hold stays bounded.
    for (const e of nav.elevator.log()) if (e.type === 'board' || e.type === 'exit') expect(e.doors).toBe(1);
    // Nobody is left outside by the walk-in hold (every re-queue is a selection-hold release).
    const count = (type: string): number => nav.elevator.log().filter((e) => e.type === type).length;
    expect(count('requeue')).toBe(count('hold'));
    for (const u of ids) expect(nav.isAt(u, target(ids.indexOf(u))), u).toBe(true);
  });

  it('in the seeded 300 s office run no rider jumps into or out of the cabin; every boarder walks through open doors', () => {
    const layouts = towerLayouts();
    const anchors = createAnchors(layouts);
    const units = unitFloors();
    const nav = createNavMovement({ units, layouts, record: true });
    const wf = makeWorkflow({ maxJobs: maxJobsFor('high'), seed: MASTER_SEED, record: false, movement: nav });
    const specs = [...units.keys()].map((id) => {
      const d = anchors.deskOf(id)!;
      const y = floorY(d.floor);
      return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
    });
    let t = 0;
    const ambient = createActivitySim(specs, 20261113, {
      campus: appCampusOptions({ movement: nav, floors: units, period: () => breakPeriodAt(t), periodAhead: (s) => breakPeriodAt(t + s), queued: () => nav.elevator.queue().length }),
    });
    const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
    const ids = [...units.keys()];
    const w = watchBoarding(nav, ids);
    const rideStarts = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      ambient.step(100);
      wf.step(0.1);
      t += 0.1;
      dir.ingest(wf.drainEvents());
      dir.update(0.1, wf);
      for (const u of ids) if (nav.phase(u) === 'ride') rideStarts.add(u);
      w.step(t);
    }
    expect(rideStarts.size).toBeGreaterThan(5);
    // 0.1 s steps here: one walking step is 0.12 u.
    expect(w.result.maxStep.d, w.result.maxStep.at).toBeLessThanOrEqual(WALK_SPEED * 0.1 + 1e-6);
    expect(w.result.maxRise.d, w.result.maxRise.at).toBeLessThanOrEqual(CABIN_SPEED * 0.1 + 1e-6);
    expect(w.result.crossedShut).toEqual([]);
    for (const e of nav.elevator.log()) if (e.type === 'board' || e.type === 'exit') expect(e.doors).toBe(1);
  });
});
