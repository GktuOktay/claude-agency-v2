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
      deps.model.setView({ mode: 'floor', focusFloor: unit.floor });

      const a = deps.sim.get(unit.id);
      const pose = robotPose(new Vector3(a.x, a.y, a.z), floorPose(unit.floor).cabinY, tierStyle(unit.tier).scale);
      const shown = lines;
      const open = (): void => deps.getCard().open(unit, opener, shown);
      deps.rig.goToFloor(unit.floor, [{ pose, duration: ZOOM_DURATION, onDone: open }]);
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
