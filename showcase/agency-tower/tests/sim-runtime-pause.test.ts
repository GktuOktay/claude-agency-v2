// AC-15 / R-4 through the real runtime (QA r2A gap): a global pause makes no engine draw, no engine step and no
// ambient-hook call. sim-clock.test.ts re-implements the frame in its rig, so a runtime that stepped the engine
// with dt = 0 (and an engine that drew at dt = 0) escaped it; this test drives `createSimRuntime().frame`.
import { describe, expect, it, vi } from 'vitest';
import { createSimRuntime } from '../src/app/simRuntime';
import { createRng } from '../src/scene/rng';
import { streamSeed } from '../src/sim/workflow';
import { scenarioSet, unitFloors } from './workflowHelpers';

function runtime(onAmbient?: (dt: number) => void) {
  const base = createRng(streamSeed(8, 'engine'));
  let draws = 0;
  const ambient: number[] = [];
  const rt = createSimRuntime({
    scenarios: scenarioSet(),
    units: unitFloors(),
    titles: ['A', 'B', 'C', 'D', 'E'],
    maxJobs: 3,
    seed: 8,
    isNarrow: () => false,
    reducedMotion: () => false,
    rideTo: () => undefined,
    workflow: { rng: () => (draws++, base()) },
    onAmbient: (dt) => {
      ambient.push(dt);
      onAmbient?.(dt);
    },
  });
  return { rt, ambient, draws: () => draws };
}

describe('simRuntime: a global pause stops the engine and the ambient hook (AC-15)', () => {
  for (const reason of ['org', 'user', 'hidden'] as const) {
    it(`"${reason}": frame() returns 0, the engine is not stepped, draws nothing, the ambient hook is not called`, () => {
      const r = runtime();
      for (let i = 0; i < 300; i++) r.rt.frame(100);
      expect(r.draws()).toBeGreaterThan(0);
      expect(r.ambient.length).toBe(300);
      const draws = r.draws();
      const calls = r.ambient.length;
      const t = r.rt.workflow.time;
      const step = vi.spyOn(r.rt.workflow, 'step');
      if (reason === 'org') r.rt.setOrg(true);
      else if (reason === 'hidden') r.rt.setHidden(true);
      else r.rt.pauseButton.click();
      for (let i = 0; i < 200; i++) expect(r.rt.frame(100)).toBe(0);
      expect(step).not.toHaveBeenCalled();
      expect(r.draws()).toBe(draws);
      expect(r.ambient.length).toBe(calls);
      expect(r.rt.workflow.time).toBe(t);
    });
  }

  it('running: the ambient hook and the engine both get the simulation dt (≤ 0.1 s), the hook first', () => {
    const order: string[] = [];
    const r = runtime((dt) => order.push(`ambient:${dt}`));
    const step = r.rt.workflow.step.bind(r.rt.workflow);
    vi.spyOn(r.rt.workflow, 'step').mockImplementation((dt) => {
      order.push(`engine:${dt}`);
      step(dt);
    });
    expect(r.rt.frame(250)).toBe(0.1);
    expect(order).toEqual(['ambient:0.1', 'engine:0.1']);
  });
});
