// QA round 2 reproduction (spec 0002 AC-15, R-4): a global pause must freeze the ambient cycle and stop all draws.
// Mirrors the sceneApp wiring: `runtime.frame(ms)` calls `onAmbient(simDt)` (skipped while the clock is paused),
// which runs `if (shouldStepSim(orgOn)) sim.step(simDt * 1000)` and `bubbles.step(simDt)`; the ambient sim gets
// `paused: () => runtime.clock.paused` as in sceneApp.
// Fix round 2: the harness used to mirror the old frame-dt order (ambient and bubbles on frame dt); only the
// harness wiring changed with sceneApp, the assertions are unchanged.
import { describe, expect, it } from 'vitest';
import { shouldStepSim } from '../src/app/frameUpdate';
import { createSimRuntime } from '../src/app/simRuntime';
import { createActivitySim, createBubbleScheduler } from '../src/scene/activity';
import { createAnchors } from '../src/scene/director';
import { createRng } from '../src/scene/rng';
import { floorY } from '../src/sim/layout';
import { isNavMovement } from '../src/sim/navMovement';
import { towerLayouts } from './directorHelpers';
import { scenarioSet, unitFloors } from './workflowHelpers';

const SEED = 20261113;
const units = unitFloors();
const ids = [...units.keys()];

function app() {
  const anchors = createAnchors(towerLayouts());
  const specs = ids.map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
  let ambient: (dt: number) => void = () => undefined;
  const rt = createSimRuntime({ scenarios: scenarioSet(), units, titles: ['A', 'B', 'C', 'D', 'E'], maxJobs: 3, isNarrow: () => false, reducedMotion: () => false, rideTo: () => undefined, onAmbient: (dt) => ambient(dt) });
  const nav = rt.workflow.movement;
  if (!isNavMovement(nav)) throw new Error('nav movement expected');
  const sim = createActivitySim(specs, SEED, { campus: { movement: nav, floors: units, paused: () => rt.clock.paused, canRide: () => nav.elevator.queue().length === 0, maxAway: 0 } });
  let bubbleDraws = 0;
  const base = createRng(SEED + 1);
  const bubbles = createBubbleScheduler(ids.map((id) => ({ id, phrases: ['merhaba'] })), () => (bubbleDraws++, base()));
  ambient = (dt) => {
    if (shouldStepSim(false)) sim.step(dt * 1000);
    bubbles.step(dt);
  };
  const frame = (): void => {
    rt.frame(100);
  };
  const state = (): string => JSON.stringify({ t: sim.time, robots: ids.map((id) => sim.get(id)) });
  return { rt, sim, frame, state, bubbleDraws: () => bubbleDraws };
}

describe('QA r2: AC-15 global pause freezes the ambient cycle (app frame order)', () => {
  it('"Hareketi durdur" (user): the ambient sim time, robots and events do not change and no bubble draw happens', () => {
    const a = app();
    for (let i = 0; i < 600; i++) a.frame();
    a.sim.drainEvents();
    const before = a.state();
    const draws = a.bubbleDraws();
    a.rt.pauseButton.click();
    expect(a.rt.clock.paused).toBe(true);
    for (let i = 0; i < 300; i++) a.frame();
    expect.soft(a.sim.drainEvents().length, 'ambient events while paused').toBe(0);
    expect.soft(a.bubbleDraws(), 'bubble draws while paused').toBe(draws);
    expect.soft(a.state() === before, 'ambient state while paused').toBe(true);
  });
});
