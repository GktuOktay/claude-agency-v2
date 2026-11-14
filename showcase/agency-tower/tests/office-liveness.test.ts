// Workflow liveness with schedule breaks (Rev 35 P3): breaks never starve jobs. App wiring at `high`:
// engine (nav + staff elevator), ambient with schedule breaks for everyone, director; 1200 s, 0.1 s steps.
import { describe, it, expect } from 'vitest';
import { maxJobsFor } from '../src/app/params';
import { BREAK_QUEUE_MAX, createActivitySim, SOCIAL_MAX_AWAY } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import { floorY } from '../src/sim/layout';
import type { NavMovement } from '../src/sim/navMovement';
import { breakPeriodAt } from '../src/sim/schedule';
import { MASTER_SEED } from '../src/sim/workflow';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

/** Jobs finished in 1200 s with schedule breaks on (with breaks off for comparison). */
function finished(breaks: boolean): { done: number; onBreak: number } {
  const layouts = towerLayouts();
  const anchors = createAnchors(layouts);
  const units = unitFloors();
  const wf = makeWorkflow({ maxJobs: maxJobsFor('high'), seed: MASTER_SEED, record: false });
  const nav = wf.movement as NavMovement;
  const specs = [...units.keys()].map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
  let t = 0;
  const ambient = createActivitySim(specs, 20261113, {
    campus: breaks
      ? { movement: nav, floors: units, period: () => breakPeriodAt(t), canRide: () => nav.elevator.queue().length < BREAK_QUEUE_MAX, exclude: new Set<string>(), maxAway: SOCIAL_MAX_AWAY }
      : null,
  });
  const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
  let done = 0;
  let onBreak = 0;
  for (let i = 0; i < 12000; i++) {
    ambient.step(100);
    wf.step(0.1);
    t += 0.1;
    const ev = wf.drainEvents();
    done += ev.filter((e) => e.type === 'job-done').length;
    dir.ingest(ev);
    dir.update(0.1, wf);
    for (const id of units.keys()) if (ambient.onBreak(id)) onBreak++;
  }
  return { done, onBreak };
}

describe('liveness: schedule breaks do not starve jobs', () => {
  it('1200 s at high: jobs keep finishing with breaks on', () => {
    const on = finished(true);
    const off = finished(false);
    console.info(`jobs finished in 1200 s at high: breaks on ${on.done}, breaks off ${off.done}`);
    expect(on.onBreak).toBeGreaterThan(0);
    expect(on.done).toBeGreaterThanOrEqual(3);
    expect(on.done).toBeGreaterThanOrEqual(off.done - 2);
  }, 120000);
});

describe('floor latch: wing break robots keep their current floor in the director view', () => {
  it('off-floor break robots report the wing floor; on interrupt the view floor and position never jump', () => {
    const layouts = towerLayouts();
    const anchors = createAnchors(layouts);
    const units = unitFloors();
    const wf = makeWorkflow({ maxJobs: maxJobsFor('high'), seed: MASTER_SEED, record: false });
    const nav = wf.movement as NavMovement;
    const specs = [...units.keys()].map((id) => {
      const d = anchors.deskOf(id)!;
      const y = floorY(d.floor);
      return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
    });
    let t = 0;
    const ambient = createActivitySim(specs, 20261113, {
      campus: { movement: nav, floors: units, period: () => breakPeriodAt(t), canRide: () => nav.elevator.queue().length < BREAK_QUEUE_MAX, exclude: new Set<string>(), maxAway: SOCIAL_MAX_AWAY },
    });
    const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
    let wingViews = 0;
    let interrupts = 0;
    const prev = new Map<string, { x: number; z: number; floor: number; amb: boolean }>();
    for (let i = 0; i < 9000; i++) {
      ambient.step(100);
      wf.step(0.1);
      t += 0.1;
      dir.ingest(wf.drainEvents());
      dir.update(0.1, wf);
      for (const id of units.keys()) {
        const v = dir.view(id);
        const b = ambient.onBreak(id);
        if (b && ambient.get(id).kind === 'coffee' && b.floor !== units.get(id)) {
          wingViews++;
          expect(v.floor).toBe(b.floor); // visible and pickable on the wing level's floor index
        }
        const p = prev.get(id);
        if (p && p.amb && v.directed && p.floor !== units.get(id)) {
          interrupts++;
          expect(v.floor).toBe(p.floor); // latched: still on the wing floor
          expect(Math.hypot(v.x - p.x, v.z - p.z)).toBeLessThan(1); // no jump into the cabin
        }
        prev.set(id, { x: v.x, z: v.z, floor: v.floor, amb: !v.directed && b !== null });
      }
    }
    expect(wingViews).toBeGreaterThan(0);
    console.info(`floor latch: off-floor interrupts observed ${interrupts}`);
  }, 120000);
});
