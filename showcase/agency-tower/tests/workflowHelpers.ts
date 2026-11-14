// Shared test helpers for the 0002 data and workflow tests.
import hierarchy from '../src/data/hierarchy.json';

/** Unit id → floor from the committed hierarchy. */
export function unitFloors(): Map<string, number> {
  return new Map(hierarchy.units.map((u) => [u.id, u.floor]));
}

import scenariosRaw from '../src/data/scenarios.json';
import { loadScenarios, type ScenarioSet } from '../src/data/scenarios';
import { createWorkflow, type Workflow, type WorkflowOptions } from '../src/sim/workflow';

/** The committed, validated scenario set. */
export function scenarioSet(): ScenarioSet {
  const r = loadScenarios(scenariosRaw, unitFloors());
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export function makeWorkflow(over: Partial<WorkflowOptions> = {}): Workflow {
  return createWorkflow({ scenarios: scenarioSet(), units: unitFloors(), record: true, ...over });
}

/** Steps the engine in 0.1 s steps; `each` runs after every step. */
export function run(wf: Workflow, seconds: number, each?: (wf: Workflow) => void): void {
  const n = Math.round(seconds / 0.1);
  for (let i = 0; i < n; i++) {
    wf.step(0.1);
    each?.(wf);
  }
}

/** Steps until job `n` is done (or `maxS` elapses); returns the time it finished, or NaN. */
export function runUntilDone(wf: Workflow, n: number, maxS = 1500, each?: (wf: Workflow) => void): number {
  for (let i = 0; i < maxS * 10; i++) {
    wf.step(0.1);
    each?.(wf);
    const done = wf.trace().find((e) => e.type === 'job-done' && e.job === n);
    if (done) return done.t;
  }
  return Number.NaN;
}
