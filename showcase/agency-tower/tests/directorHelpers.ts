// Shared harness for the T-6 director tests: engine (timed or real movement, via the port), the 0001
// ambient cycle and the director, stepped together in 0.1 s steps like the live page.
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { loadData } from '../src/data/loader';
import { createActivitySim, type ActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector, type Director } from '../src/scene/director';
import { floorLayout, floorY, FLOOR_COUNT, type FloorLayout } from '../src/sim/layout';
import type { WfEvent, Workflow, WorkflowOptions } from '../src/sim/workflow';
import { sortUnits } from '../src/ui/unitList';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

export function towerLayouts(): FloorLayout[] {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  const units = r.data.units;
  return Array.from({ length: FLOOR_COUNT }, (_, f) =>
    floorLayout(
      f,
      sortUnits(units)
        .filter((u) => u.floor === f)
        .map((u) => ({ id: u.id, ceo: u.tier === 'ceo' })),
    ),
  );
}

export interface Harness {
  wf: Workflow;
  ambient: ActivitySim;
  dir: Director;
  layouts: FloorLayout[];
  /** Every event drained so far, in order. */
  events: WfEvent[];
  /** Events drained in the last step. */
  last: WfEvent[];
  step(): void;
  run(seconds: number, each?: (h: Harness) => void): void;
}

export function harness(over: Partial<WorkflowOptions> = {}, ambientSeed = 7): Harness {
  const layouts = towerLayouts();
  const anchors = createAnchors(layouts);
  const units = unitFloors();
  const specs = [...units.keys()].map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
  const ambient = createActivitySim(specs, ambientSeed);
  const wf = makeWorkflow(over);
  const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient });
  const h: Harness = {
    wf,
    ambient,
    dir,
    layouts,
    events: [],
    last: [],
    step() {
      wf.step(0.1);
      ambient.step(100);
      h.last = wf.drainEvents();
      h.events.push(...h.last);
      dir.ingest(h.last);
      dir.update(0.1, wf);
    },
    run(seconds, each) {
      const n = Math.round(seconds / 0.1);
      for (let i = 0; i < n; i++) {
        h.step();
        each?.(h);
      }
    },
  };
  return h;
}

export const roundT = (t: number): number => Math.round(t * 1000) / 1000;
