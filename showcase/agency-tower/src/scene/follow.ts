// "Ajan gözü" follow camera (KARARLAR Rev 42): over the robot's right shoulder, smoothed. Pure of any renderer.
// It reads the robot's drawn position every frame, so it keeps following through an elevator ride to another floor.
import { Vector3 } from 'three';

/** Camera offset behind, above (from the feet) and right of the robot, and the look-ahead point. */
export const FOLLOW_BACK = 1.9;
export const FOLLOW_UP = 1.45;
export const FOLLOW_SIDE = 0.35;
export const FOLLOW_AHEAD = 1.3;
export const FOLLOW_LOOK_Y = 0.6;
/** Lens of the follow view (the robot close-up lens). */
export const FOLLOW_FOV = 50;
/** Smoothing rates (1/s): heading and camera position. */
const YAW_RATE = 3.5;
const POS_RATE = 5;

export interface Feet {
  x: number;
  y: number;
  z: number;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The follow pose for a robot at `feet` facing `facing` (forward = (sin, cos)); `scale` = robot tier scale. */
export function followPose(feet: Feet, facing: number, scale = 1): { pos: Vector3; target: Vector3 } {
  const f = new Vector3(Math.sin(facing), 0, Math.cos(facing));
  const right = new Vector3(-Math.cos(facing), 0, Math.sin(facing));
  const base = new Vector3(feet.x, feet.y, feet.z);
  const pos = base
    .clone()
    .addScaledVector(f, -FOLLOW_BACK * scale)
    .addScaledVector(right, FOLLOW_SIDE * scale)
    .add(new Vector3(0, FOLLOW_UP * scale, 0));
  const target = base.clone().addScaledVector(f, FOLLOW_AHEAD * scale).add(new Vector3(0, FOLLOW_LOOK_Y * scale, 0));
  return { pos, target };
}

export interface Follower {
  /** Advance toward the robot's current follow pose; `reduced` = cut straight to it. */
  update(feet: Feet, facing: number, dt: number, reduced: boolean, scale?: number): { pos: Vector3; target: Vector3 };
}

/** Starts at the current camera (`pos`, `target`) and eases onto the follow pose. */
export function createFollower(pos: Vector3, target: Vector3): Follower {
  const p = pos.clone();
  const t = target.clone();
  let yaw: number | null = null;
  return {
    update(feet, facing, dt, reduced, scale = 1) {
      if (yaw === null || reduced) yaw = facing;
      else yaw = wrap(yaw + wrap(facing - yaw) * (1 - Math.exp(-YAW_RATE * Math.max(0, dt))));
      const want = followPose(feet, yaw, scale);
      const k = reduced ? 1 : 1 - Math.exp(-POS_RATE * Math.max(0, dt));
      p.lerp(want.pos, k);
      t.lerp(want.target, k);
      return { pos: p.clone(), target: t.clone() };
    },
  };
}
