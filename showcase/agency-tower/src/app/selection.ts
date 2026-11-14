// Selection flow (REQ-12): move to the floor view, zoom to the robot, wave, open the card; closing returns.
import { Vector3 } from 'three';
import type { Unit } from '../data/types';
import type { ActivitySim } from '../scene/activity';
import { CameraRig, floorPose, robotPose, ZOOM_DURATION } from '../scene/camera';
import type { TowerModel } from '../scene/model';
import { tierStyle } from '../scene/robot';
import type { CardController } from '../ui/card';
import type { CardLines } from '../ui/nowLine';

export interface SelectionDeps {
  rig: CameraRig;
  sim: ActivitySim;
  model: TowerModel;
  getCard(): CardController;
  exitOrg?: () => void;
  /** 0002 REQ-12: card lines for the state at selection (absent: 0001 card). */
  linesFor?: (id: string) => CardLines;
  /** 0002 REQ-17: step-scoped selection pause on the simulation clock. */
  onSelect?: (id: string) => void;
  onRelease?: (id: string) => void;
  /** 0002 T-6: where the robot is drawn now (director/nav), and on which floor; null = ambient position. */
  renderPosition?: (id: string) => { x: number; y: number; z: number; floor: number } | null;
}

export interface SelectionFlow {
  select(unit: Unit, opener: HTMLElement | null, opts?: { fromOrg?: boolean }): void;
  onCardClosed(): void;
  selectedId(): string | null;
}

export function createSelectionFlow(deps: SelectionDeps): SelectionFlow {
  let selected: string | null = null;
  let lines: CardLines | undefined;

  return {
    selectedId: () => selected,
    select(unit, opener, opts) {
      if (opts?.fromOrg) deps.exitOrg?.();
      // The card shows the state before selection (§7.6): capture it before the wave starts.
      if (selected !== unit.id) lines = deps.linesFor?.(unit.id);
      if (selected && selected !== unit.id) {
        deps.sim.release(selected);
        deps.onRelease?.(selected);
      }
      selected = unit.id;
      deps.sim.select(unit.id);
      deps.onSelect?.(unit.id);
      // Zoom to the rendered robot: a directed robot may be away from its ambient spot, even on another floor.
      const rp = deps.renderPosition?.(unit.id) ?? null;
      const a = rp ?? deps.sim.get(unit.id);
      const floor = rp ? rp.floor : unit.floor;
      deps.model.setView({ mode: 'floor', focusFloor: floor });
      const pose = robotPose(new Vector3(a.x, a.y, a.z), floorPose(floor).cabinY, tierStyle(unit.tier).scale);
      const shown = lines;
      const open = (): void => deps.getCard().open(unit, opener, shown);
      deps.rig.goToFloor(floor, [{ pose, duration: ZOOM_DURATION, onDone: open }]);
    },
    onCardClosed() {
      if (selected) {
        deps.sim.release(selected);
        deps.onRelease?.(selected);
      }
      selected = null;
      lines = undefined;
      deps.rig.returnToFloor();
    },
  };
}
