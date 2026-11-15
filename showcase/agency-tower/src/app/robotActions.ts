// Frame wiring of the Rev 43 B object activities: the action layer (src/scene/actions.ts) fed from the ambient
// sim each frame, and the hand props (src/scene/handProps.ts). Keeps the sceneApp frame loop edit to a few lines.
// Read-only toward every simulation: it never steps, reserves or moves a robot in any sim.
import type { Group, Object3D } from 'three';
import type { ActivitySim } from '../scene/activity';
import { createActionLayer, type ActionInput, type RobotAction } from '../scene/actions';
import { createHandProps } from '../scene/handProps';
import { sipAmount } from '../scene/pose';
import type { RobotParts } from '../scene/robot';

export interface ActionRobotEntry {
  unit: { id: string };
  group: Object3D;
  parts: RobotParts;
  homePoint: { x: number; y: number; z: number };
  coffeePoint: { x: number; y: number; z: number };
}

/** Staff event subset: the tea server's `serve` at a desk (src/sim/staffSim.ts). */
export interface ServeLike {
  type: string;
  owner?: string;
}

export interface RobotActions {
  group: Group;
  /** Once per frame before the robot loop. Org mode: no actions, no props (the org view is static). */
  begin(sim: Pick<ActivitySim, 'time' | 'get' | 'isReserved' | 'onBreak' | 'breakPhase'>, reduced: boolean, orgOn: boolean, staffEvents: readonly ServeLike[]): void;
  /** The robot's action this frame, or null (render as before). */
  get(id: string): RobotAction | null;
  /** After the robot's pose is applied: its props at its hands. */
  attach(r: ActionRobotEntry, a: RobotAction | null): void;
  end(): void;
}

export function createRobotActions(robots: readonly ActionRobotEntry[]): RobotActions {
  const layer = createActionLayer(robots.map((r) => ({ id: r.unit.id, home: r.homePoint, coffee: r.coffeePoint })));
  const props = createHandProps(robots.length);
  const inputs: ActionInput[] = [];
  let off = false;
  return {
    group: props.group,
    begin(sim, reduced, orgOn, staffEvents) {
      off = orgOn;
      props.begin();
      if (orgOn) return;
      inputs.length = 0;
      for (const r of robots) {
        const id = r.unit.id;
        const view = sim.get(id);
        const busy = sim.isReserved(id) || view.kind === 'wave' || view.kind === 'raise';
        inputs.push({ id, busy, view, spot: busy ? null : sim.onBreak(id), phase: busy ? null : sim.breakPhase(id) });
      }
      layer.update(sim.time, inputs, reduced);
      for (const e of staffEvents) if (e.type === 'serve' && e.owner) layer.serve(e.owner);
    },
    get: (id) => (off ? null : layer.get(id)),
    attach(r, a) {
      if (!a || off || a.props.length === 0) return;
      props.attach(r.group, r.parts, a.props, sipAmount(a.timeSec));
    },
    end: () => props.end(),
  };
}
