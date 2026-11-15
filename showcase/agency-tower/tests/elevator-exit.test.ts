// CEO film review "asansörden inme ile ilgili sorun var": riders leaving the six-rider staff cabin (KARARLAR Rev 44).
// Before the fix the exiting riders only started to walk once the doors had closed (the cabin could already leave
// with them inside), and the riders of one stop all headed for the single corridor end point, so they blocked each
// other in the cabin for seconds (yield waits up to MAX_YIELD_S). Measured here per rider: door fully open at their
// floor -> out of the cabin footprint, walking on the floor graph.
import { describe, it, expect } from 'vitest';
import { appCampusOptions, createActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import { maxJobsFor } from '../src/app/params';
import { STAFF_LANDING, STAFF_SHAFT, floorY } from '../src/sim/layout';
import { createNavMovement, type NavMovement } from '../src/sim/navMovement';
import { breakPeriodAt } from '../src/sim/schedule';
import { MASTER_SEED } from '../src/sim/workflow';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

const STEP = 0.05;
/** Exit budget (CEO: "≤ ~1.5 s"): the mean rider and every rider of the front row (spots 0-2, by the door). */
const EXIT_MAX_S = 1.5;
/** Back-row riders (spots 3-5) stand up to 1.5 m from the cabin edge (1.25 s of walking alone): 2.0 s at most. */
const EXIT_BACK_MAX_S = 2.0;
const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const cabinX0 = STAFF_SHAFT.x - STAFF_SHAFT.cabinHalf;
const outOfCabin = (p: { x: number }): boolean => p.x < cabinX0 - 1e-9;

interface ExitWatch {
  /** Unit -> seconds from doors fully open (the `exit` log) to out of the cabin footprint. */
  times: { unit: string; s: number; slot: number }[];
  /** Units seen inside the cabin or its doorway while the cabin was moving or its doors were shut (on a landing). */
  throughDoors: Set<string>;
  /** Exits at a floor other than the rider's ride destination. */
  wrongFloor: string[];
  /** Exits (by `exit` log) never followed by leaving the cabin. */
  pending: Map<string, number>;
}

/** Watches every `exit` of the cabin log and when that rider gets out of the cabin footprint. */
function watchExits(nav: NavMovement, units: readonly string[]): { step(t: number): void; result: ExitWatch } {
  const res: ExitWatch = { times: [], throughDoors: new Set(), wrongFloor: [], pending: new Map() };
  let seen = 0;
  const rideTo = new Map<string, number>();
  const slot = new Map<string, number>();
  return {
    result: res,
    step() {
      for (const u of units) {
        if (nav.phase(u) !== 'ride') continue;
        rideTo.set(u, nav.floorOf(u));
        slot.set(u, nav.elevator.riderIndex(u));
      }
      const log = nav.elevator.log();
      for (; seen < log.length; seen++) {
        const e = log[seen]!;
        if (e.type !== 'exit' || !e.unit) continue;
        res.pending.set(e.unit, e.t);
        if (rideTo.has(e.unit) && rideTo.get(e.unit) !== e.floor) res.wrongFloor.push(`${e.unit} @${e.floor}`);
      }
      const cab = nav.elevator.state();
      for (const u of units) {
        const p = nav.position(u);
        const since = res.pending.get(u);
        if (since !== undefined && nav.phase(u) !== 'ride' && outOfCabin(p)) {
          res.times.push({ unit: u, s: nav.elevator.time - since, slot: slot.get(u) ?? -1 });
          res.pending.delete(u);
        }
        // A walker in the cabin or its doorway on the cabin's own floor needs the cabin there with open doors.
        if (nav.phase(u) === 'walk' && p.x > STAFF_LANDING.doorClearX && p.floor === cab.floor) {
          if (cab.mode !== 'doors' || cab.doors <= 0) res.throughDoors.add(u);
        }
      }
    },
  };
}

describe('staff cabin exit (CEO film review)', () => {
  it('six riders of one stop leave the cabin together within 1.5 s of the doors opening (back row 2 s), before the doors close', () => {
    // Three units on floor 0 and three on floor 1 (three waiting spots per landing); each caller is held at the
    // landing until all six wait, then the cabin collects floor 0 and floor 1 on its way up to floor 3.
    const ids = [...unitFloors().keys()].filter((u) => u !== 'ceo').slice(0, 6);
    const units = new Map(ids.map((u, i) => [u, i < 3 ? 0 : 1]));
    const nav = createNavMovement({ units, record: true, cabinFloor: 0 });
    // Walkers leave their desks 2 s apart (all at once they jam at the work-room door, a separate matter).
    const target = (i: number) => ({ floor: 3, spot: i === 0 ? 'meeting-room:lead' : 'meeting-room' });
    const w = watchExits(nav, ids);
    let released = false;
    let releasedAt = -1;
    let step = 0;
    // The floor-0 callers re-queue first (the oldest call), the floor-1 callers one step later, on the cabin's way up.
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
    expect(released, ids.map((u) => `${u}:${nav.phase(u)}:${nav.nodeOf(u)}`).join(" ")).toBe(true);
    const boarded = nav.elevator.log().filter((e) => e.type === 'riders').map((e) => e.count ?? 0);
    expect(Math.max(...boarded)).toBe(6);
    const times = w.result.times.map((x) => x.s);
    const msg = w.result.times.map((x) => `${x.slot}:${x.s.toFixed(2)}`).join(' ');
    expect(times).toHaveLength(6);
    expect(mean(times), msg).toBeLessThanOrEqual(EXIT_MAX_S);
    for (const x of w.result.times) expect(x.s, msg).toBeLessThanOrEqual(x.slot < 3 ? EXIT_MAX_S : EXIT_BACK_MAX_S);
    // Together, not one by one (0.375 s apart in single file): the last rider is out within 1.2 s of the first.
    expect(Math.max(...times) - Math.min(...times), msg).toBeLessThanOrEqual(1.2);
    expect([...w.result.throughDoors]).toEqual([]);
    expect(w.result.wrongFloor).toEqual([]);
    expect([...w.result.pending.keys()]).toEqual([]);
    for (const u of ids) expect(nav.isAt(u, { floor: 3, spot: u === ids[0] ? 'meeting-room:lead' : 'meeting-room' }), u).toBe(true);
  });

  it('in the seeded 300 s office run riders get out within 1.5 s of the doors opening (back row 2 s), never through shut doors', () => {
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
    const w = watchExits(nav, [...units.keys()]);
    for (let i = 0; i < 3000; i++) {
      ambient.step(100);
      wf.step(0.1);
      t += 0.1;
      dir.ingest(wf.drainEvents());
      dir.update(0.1, wf);
      w.step(t);
    }
    const times = w.result.times.map((x) => x.s);
    expect(times.length).toBeGreaterThan(10);
    const msg = `exits ${times.length}, mean ${mean(times).toFixed(2)} s, worst ${Math.max(...times).toFixed(2)} s`;
    expect(mean(times), msg).toBeLessThanOrEqual(EXIT_MAX_S);
    for (const x of w.result.times) expect(x.s, `${msg}; ${x.unit} spot ${x.slot}`).toBeLessThanOrEqual(x.slot < 3 ? EXIT_MAX_S : EXIT_BACK_MAX_S);
    expect([...w.result.throughDoors]).toEqual([]);
    expect(w.result.wrongFloor).toEqual([]);
  });
});
