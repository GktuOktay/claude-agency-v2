// Selection flow (REQ-12): move to the floor view, zoom to the robot, wave, open the card; closing returns.
import { Vector3 } from 'three';
import type { Unit } from '../data/types';
import type { ActivitySim } from '../scene/activity';
import { CameraRig, floorPose, robotPose, ZOOM_DURATION } from '../scene/camera';
import type { TowerModel } from '../scene/model';
import { tierStyle } from '../scene/robot';
import type { CardController } from '../ui/card';

export interface SelectionDeps {
  rig: CameraRig;
  sim: ActivitySim;
  model: TowerModel;
  getCard(): CardController;
  exitOrg?: () => void;
}

export interface SelectionFlow {
  select(unit: Unit, opener: HTMLElement | null, opts?: { fromOrg?: boolean }): void;
  onCardClosed(): void;
  selectedId(): string | null;
}

export function createSelectionFlow(deps: SelectionDeps): SelectionFlow {
  let selected: string | null = null;

  return {
    selectedId: () => selected,
    select(unit, opener, opts) {
      if (opts?.fromOrg) deps.exitOrg?.();
      if (selected && selected !== unit.id) deps.sim.release(selected);
      selected = unit.id;
      deps.sim.select(unit.id);
      deps.model.setView({ mode: 'floor', focusFloor: unit.floor });

      const a = deps.sim.get(unit.id);
      const pose = robotPose(new Vector3(a.x, a.y, a.z), floorPose(unit.floor).cabinY, tierStyle(unit.tier).scale);
      const open = (): void => deps.getCard().open(unit, opener);
      deps.rig.goToFloor(unit.floor, [{ pose, duration: ZOOM_DURATION, onDone: open }]);
    },
    onCardClosed() {
      if (selected) deps.sim.release(selected);
      selected = null;
      deps.rig.returnToFloor();
    },
  };
}
