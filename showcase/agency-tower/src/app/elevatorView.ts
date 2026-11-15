// Staff cabin view adapter (spec 0002 REQ-14, §7.5b, AC-13). Copies the elevator simulation onto the
// east cabin meshes once per frame: cabinY → setHeight, doorOpen → setDoorsOpen, callLit → setCallLit
// for every floor. Reads only; it never steps the elevator. Type-only imports keep it free of three.js.
import type { Elevator } from '../sim/elevator';
import { FLOOR_COUNT } from '../sim/layout';
import type { Movement } from '../sim/movement';
import { isNavMovement } from '../sim/navMovement';
import type { StaffCabin } from '../scene/model';

export type CabinSource = Pick<Elevator, 'cabinY' | 'doorOpen' | 'callLit'>;
export type CabinSink = Pick<StaffCabin, 'setHeight' | 'setDoorsOpen' | 'setCallLit'>;

export function syncStaffCabin(elevator: CabinSource, cabin: CabinSink, floors: number = FLOOR_COUNT): void {
  cabin.setHeight(elevator.cabinY());
  cabin.setDoorsOpen(elevator.doorOpen());
  for (let f = 0; f < floors; f++) cabin.setCallLit(f, elevator.callLit(f));
}

/** Syncs from the workflow's movement when it is nav movement (has the elevator); false otherwise. */
export function syncStaffCabinFrom(movement: Movement, cabin: CabinSink): boolean {
  if (!isNavMovement(movement)) return false;
  syncStaffCabin(movement.elevator, cabin);
  return true;
}
