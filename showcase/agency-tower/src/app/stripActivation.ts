// Strip-entry activation (spec 0002 REQ-11): follows the 0001 floor-panel rules. An open card closes
// first, org mode is left first (without its own camera move), then the camera rides; the camera rig
// replaces any running plan, so mid-ride the last request wins.
export interface StripActivationDeps {
  cardOpen(): boolean;
  closeCard(): void;
  orgOn(): boolean;
  leaveOrg(): void;
  goFloor(floor: number): void;
}

export function rideToFloor(deps: StripActivationDeps, floor: number): void {
  if (deps.cardOpen()) deps.closeCard();
  if (deps.orgOn()) deps.leaveOrg();
  deps.goFloor(floor);
}
