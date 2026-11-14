import { Raycaster, type Object3D, type Ray } from 'three';
import type { RobotEntry, TowerModel } from './model';

// Picks robots only: the building shell and non-pickable (ghosted) floors are never raycast (REQ-8).
export function pickRobot(model: TowerModel, ray: Ray): RobotEntry | null {
  const pickable = model.pickableFloors();
  const targets: Object3D[] = model.robots.filter((r) => pickable.has(r.floor)).map((r) => r.group);
  if (!targets.length) return null;
  const rc = new Raycaster(ray.origin, ray.direction);
  const hit = rc.intersectObjects(targets, true)[0];
  if (!hit) return null;
  const id: unknown = hit.object.userData.unitId;
  return model.robots.find((r) => r.unit.id === id) ?? null;
}
