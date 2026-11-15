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
/** Exit budget per rider (CEO: "≤ ~1.5 s"). */
const EXIT_MAX_S = 1.5;
const cabinX0 = STAFF_SHAFT.x - STAFF_SHAFT.cabinHalf;
const outOfCabin = (p: { x: number }): boolean => p.x < cabinX0 - 1e-9;

interface ExitWatch {
  /** Unit -> seconds from doors fully open (the `exit` log) to out of the cabin footprint. */
  times: Map<string, number>;
  /** Units seen inside the cabin or its doorway while the cabin was moving or its doors were shut (on a landing). */
  throughDoors: Set<string>;
  /** Exits at a floor other than the rider's ride destination. */
  wrongFloor: string[];
  /** Exits (by `exit` log) never followed by leaving the cabin. */
  pending: Map<string, number>;
}

/** Watches every `exit` of the cabin log and when that rider gets out of the cabin footprint. */
function watchExits(nav: NavMovement, units: readonly string[]): { step(t: number): void; result: ExitWatch } {
  const res: ExitWatch = { times: new Map(), throughDoors: new Set(), wrongFloor: [], pending: new Map() };
  let seen = 0;
  const rideTo = new Map<string, number>();
  const all: { unit: string; s: number }[] = [];
  return {
    result: res,
    step() {
      for (const u of units) if (nav.phase(u) === 'ride') rideTo.set(u, nav.floorOf(u));
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
          all.push({ unit: u, s: nav.elevator.time - since });
          res.times.set(`${u}#${all.length}`, nav.elevator.time - since);
          if (nav.elevator.time - since > 1.5) console.log("SLOW", u, since, nav.elevator.time, nav.legLog().filter((l) => l.unit === u).slice(-3));
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
  it('six riders of one stop leave the cabin together, each within 1.5 s of the doors opening, before the doors close', () => {
    // Six units share floor 1; each waits (held) at the landing until all six are there, then the cabin takes them all.
    const ids = [...unitFloors().keys()].filter((u) => u !== 'ceo').slice(0, 6);
    const units = new Map(ids.map((u) => [u, 1]));
    const nav = createNavMovement({ units, record: true, cabinFloor: 1 });
    ids.forEach((u, i) => nav.moveTo(u, { floor: 3, spot: i === 0 ? 'meeting-room:lead' : 'meeting-room' }));
    const w = watchExits(nav, ids);
    let released = false;
    const frozen = (u: string): boolean => !released && nav.phase(u) === 'call-wait';
    for (let i = 0; i < 60 / STEP; i++) {
      if (!released && ids.every((u) => nav.phase(u) === 'call-wait')) released = true;
      nav.step(STEP, frozen);
      w.step(i * STEP);
    }
    console.log(ids.map((u) => `${u}:${nav.phase(u)}:${nav.nodeOf(u)}`).join(" "));
    expect(released).toBe(true);
    const boarded = nav.elevator.log().filter((e) => e.type === 'riders').map((e) => e.count ?? 0);
    expect(Math.max(...boarded)).toBe(6);
    const times = [...w.result.times.values()];
    expect(times).toHaveLength(6);
    expect(Math.max(...times), times.map((t) => t.toFixed(2)).join(' ')).toBeLessThanOrEqual(EXIT_MAX_S);
    // Together, not one by one: the last rider is out within 1 s of the first.
    expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(1);
    expect([...w.result.throughDoors]).toEqual([]);
    expect(w.result.wrongFloor).toEqual([]);
    expect([...w.result.pending.keys()]).toEqual([]);
    for (const u of ids) expect(nav.isAt(u, { floor: 3, spot: u === ids[0] ? 'meeting-room:lead' : 'meeting-room' }), u).toBe(true);
  });

  it('in the seeded 300 s office run every rider gets out within 1.5 s of the doors opening, never through shut doors', () => {
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
      if (t > 16.3 && t < 24) {
        const s = nav.elevator.state();
        console.log(`T ${t.toFixed(1)} ${s.mode} f${s.pos.toFixed(2)} d${s.doors.toFixed(2)} ` + [...units.keys()].filter((u) => { const p = nav.position(u); return p.x > 6.5 && p.floor === 0; }).map((u) => { const p = nav.position(u); return `${u}:${nav.phase(u)}(${p.x.toFixed(2)},${p.z.toFixed(2)})`; }).join(' '));
      }
    }
    const times = [...w.result.times.values()];
    expect(times.length).toBeGreaterThan(10);
    const worst = Math.max(...times);
    expect(worst, `exits ${times.length}, worst ${worst.toFixed(2)} s`).toBeLessThanOrEqual(EXIT_MAX_S);
    expect([...w.result.throughDoors]).toEqual([]);
    expect(w.result.wrongFloor).toEqual([]);
  });
});
