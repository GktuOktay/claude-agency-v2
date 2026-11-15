// KARARLAR Rev 44 "asansörü büyütelim, çok trafik oluyor": the six-rider collective cabin against the pre-Rev 44
// cabin (3 riders, identical from -> to only) in the same seeded 600 s office run at `high` (app wiring: engine
// with nav + staff elevator, ambient with schedule breaks for everyone and the occupancy director).
import { describe, it, expect } from 'vitest';
import { maxJobsFor } from '../src/app/params';
import { appCampusOptions, createActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import type { ElevatorPolicy } from '../src/sim/elevator';
import { floorY } from '../src/sim/layout';
import { createNavMovement } from '../src/sim/navMovement';
import { breakPeriodAt } from '../src/sim/schedule';
import { MASTER_SEED } from '../src/sim/workflow';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

interface Traffic {
  rides: number;
  meanWait: number;
  maxQueue: number;
  /** Share of 0.1 s samples with more than 4 calls waiting. */
  over4: number;
  meanQueue: number;
  jobsDone: number;
}

function traffic(policy: ElevatorPolicy, seconds = 600): Traffic {
  const layouts = towerLayouts();
  const anchors = createAnchors(layouts);
  const units = unitFloors();
  const nav = createNavMovement({ units, layouts, record: true, elevatorPolicy: policy });
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
  let maxQueue = 0;
  let over4 = 0;
  let qSum = 0;
  let jobsDone = 0;
  const n = Math.round(seconds * 10);
  for (let i = 0; i < n; i++) {
    ambient.step(100);
    wf.step(0.1);
    t += 0.1;
    const ev = wf.drainEvents();
    jobsDone += ev.filter((e) => e.type === 'job-done').length;
    dir.ingest(ev);
    dir.update(0.1, wf);
    const q = nav.elevator.queue().length;
    maxQueue = Math.max(maxQueue, q);
    qSum += q;
    if (q > 4) over4++;
  }
  const waits = nav.elevator.log().filter((e) => e.type === 'ride-start').map((e) => e.waited ?? 0);
  return { rides: waits.length, meanWait: waits.reduce((s, w) => s + w, 0) / Math.max(1, waits.length), maxQueue, over4: over4 / n, meanQueue: qSum / n, jobsDone };
}

const fmt = (x: Traffic): string =>
  `rides ${x.rides}, mean wait ${x.meanWait.toFixed(1)} s, mean queue ${x.meanQueue.toFixed(2)}, max queue ${x.maxQueue}, queue > 4 ${(x.over4 * 100).toFixed(1)} %, jobs ${x.jobsDone}`;

describe('staff elevator traffic (Rev 44)', () => {
  it('seeded 600 s office run: the collective six-rider cabin cuts the mean wait substantially', () => {
    const before = traffic('legacy');
    const after = traffic('collective');
    console.info(`elevator before (legacy, 3 riders): ${fmt(before)}`);
    console.info(`elevator after (collective, 6 riders): ${fmt(after)}`);
    expect(before.rides).toBeGreaterThan(20);
    expect(after.rides).toBeGreaterThanOrEqual(before.rides);
    // "Substantially": the mean wait is at least a third shorter (measured: 4.9 s -> 3.0 s, -40 %).
    expect(after.meanWait).toBeLessThanOrEqual((2 / 3) * before.meanWait);
    expect(after.meanQueue).toBeLessThan(before.meanQueue);
    // Long queues are not regular (so no second cabin, Rev 44): more than 4 waiting under 5 % of the time (measured 2.5 %).
    expect(after.over4).toBeLessThan(0.05);
  }, 180000);
});
