// "Ajan gözü" follow camera (KARARLAR Rev 42, Rev 43): behind and above the robot's right shoulder, smoothed, far
// enough back that the robot and its surroundings are in view. Pure of any renderer.
// It reads the robot's drawn position every frame, so it keeps following through an elevator ride to another floor.
import { Vector3 } from 'three';
import { HALF_DEPTH, HALF_WIDTH, WING } from '../sim/layout';

/** Camera offset behind, above (from the feet) and right of the robot, and the look-ahead point (Rev 43: ~3x further). */
export const FOLLOW_BACK = 5.2;
export const FOLLOW_UP = 2.45;
export const FOLLOW_SIDE = 0.55;
export const FOLLOW_AHEAD = 0.8;
export const FOLLOW_LOOK_Y = 0.55;
/** Highest camera point above the feet: under the slab of the floor above (floor height 3). */
export const FOLLOW_MAX_UP = 2.6;
/** A wall behind: the offset swings sideways until this share of it fits inside, else the best swing is pulled in. */
export const FOLLOW_ROOM = 0.9;
const SWING = [0, 0.5, -0.5, 1, -1, Math.PI / 2, -Math.PI / 2];
/** Lens of the follow view. */
export const FOLLOW_FOV = 50;
/** Smoothing rates (1/s): heading and camera position. */
const YAW_RATE = 3.5;
const POS_RATE = 5;
/** Kept clear of the outer walls (u). */
const WALL_MARGIN = 0.3;

export interface Feet {
  x: number;
  y: number;
  z: number;
}

/** Horizontal area the camera stays inside (the building the robot is in). */
export interface FollowBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The tower floor, the campus wing, or (on the bridge / at the elevator) the span of both. */
export function followBounds(feet: Feet): FollowBounds {
  const m = WALL_MARGIN;
  const z0 = -HALF_DEPTH + m;
  const z1 = HALF_DEPTH - m;
  const wx0 = WING.x - WING.halfW + m;
  const wx1 = WING.x + WING.halfW - m;
  if (feet.x >= -HALF_WIDTH && feet.x <= HALF_WIDTH) return { x0: -HALF_WIDTH + m, x1: HALF_WIDTH - m, z0, z1 };
  if (feet.x >= wx0 - m && feet.x <= wx1 + m) return { x0: wx0, x1: wx1, z0: WING.z - WING.halfD + m, z1: WING.z + WING.halfD - m };
  return { x0: wx0, x1: HALF_WIDTH - m, z0, z1 };
}

/** Largest share t in [0, 1] of the offset (dx, dz) from (x, z) that stays inside `b`. */
function fitShare(x: number, z: number, dx: number, dz: number, b: FollowBounds): number {
  let t = 1;
  if (dx > 1e-9) t = Math.min(t, (b.x1 - x) / dx);
  else if (dx < -1e-9) t = Math.min(t, (b.x0 - x) / dx);
  if (dz > 1e-9) t = Math.min(t, (b.z1 - z) / dz);
  else if (dz < -1e-9) t = Math.min(t, (b.z0 - z) / dz);
  return Math.max(0, t);
}

/** The follow pose for a robot at `feet` facing `facing` (forward = (sin, cos)); `scale` = robot tier scale. */
export function followPose(feet: Feet, facing: number, scale = 1, bounds?: FollowBounds): { pos: Vector3; target: Vector3 } {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  // back along -forward, side along right = (-cos, sin)
  let dx = -fx * FOLLOW_BACK * scale - fz * FOLLOW_SIDE * scale;
  let dz = -fz * FOLLOW_BACK * scale + fx * FOLLOW_SIDE * scale;
  if (bounds) {
    // A wall behind: swing the offset (up to 90° either side) toward the most room, then pull in to stay inside.
    let best = { t: -1, dx, dz };
    for (const a of SWING) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rx = dx * c - dz * s;
      const rz = dx * s + dz * c;
      const t = fitShare(feet.x, feet.z, rx, rz, bounds);
      if (t > best.t + 1e-6) best = { t, dx: rx, dz: rz };
      if (t >= FOLLOW_ROOM) break; // enough room: keep the straightest swing
    }
    dx = best.dx * best.t;
    dz = best.dz * best.t;
  }
  const pos = new Vector3(feet.x + dx, feet.y + Math.min(FOLLOW_MAX_UP, FOLLOW_UP * scale), feet.z + dz);
  const target = new Vector3(feet.x + fx * FOLLOW_AHEAD * scale, feet.y + FOLLOW_LOOK_Y * scale, feet.z + fz * FOLLOW_AHEAD * scale);
  return { pos, target };
}

export interface Follower {
  /** Advance toward the robot's current follow pose; `reduced` = cut straight to it. */
  update(feet: Feet, facing: number, dt: number, reduced: boolean, scale?: number, bounds?: FollowBounds): { pos: Vector3; target: Vector3 };
}

/** Starts at the current camera (`pos`, `target`) and eases onto the follow pose (also after a switch to another robot). */
export function createFollower(pos: Vector3, target: Vector3): Follower {
  const p = pos.clone();
  const t = target.clone();
  let yaw: number | null = null;
  return {
    update(feet, facing, dt, reduced, scale = 1, bounds) {
      if (yaw === null || reduced) yaw = facing;
      else yaw = wrap(yaw + wrap(facing - yaw) * (1 - Math.exp(-YAW_RATE * Math.max(0, dt))));
      const want = followPose(feet, yaw, scale, bounds);
      const k = reduced ? 1 : 1 - Math.exp(-POS_RATE * Math.max(0, dt));
      p.lerp(want.pos, k);
      t.lerp(want.target, k);
      return { pos: p.clone(), target: t.clone() };
    },
  };
}

/** "Ajan gözü" switching order (Rev 43): by floor, then id; stable whatever the input order. */
export function followOrder(robots: readonly { id: string; floor: number }[]): string[] {
  return [...robots].sort((a, b) => a.floor - b.floor || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((r) => r.id);
}

/** The robot `dir` steps to from `current` in `order`, wrapping; an unknown current starts at the first. */
export function cycleFollow(order: readonly string[], current: string, dir: 1 | -1): string | null {
  if (!order.length) return null;
  const i = order.indexOf(current);
  if (i < 0) return order[0] ?? null;
  return order[(i + dir + order.length) % order.length] ?? null;
}
