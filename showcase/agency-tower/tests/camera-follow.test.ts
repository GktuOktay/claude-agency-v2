// KARARLAR Rev 42 "Ajan gözü": the camera follows a robot from over its shoulder, smoothly, across floors.
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { FOLLOW_UP, createFollower, followPose } from '../src/scene/follow';
import { FLOOR_HEIGHT } from '../src/sim/layout';

describe('follow camera (KARARLAR Rev 42)', () => {
  it('sits behind and above the robot and looks ahead of it', () => {
    for (const facing of [0, 1, Math.PI, -2]) {
      const feet = { x: 1, y: 3, z: -2 };
      const { pos, target } = followPose(feet, facing);
      const fwd = new Vector3(Math.sin(facing), 0, Math.cos(facing));
      const back = pos.clone().sub(new Vector3(feet.x, feet.y, feet.z));
      expect(back.dot(fwd)).toBeLessThan(-1); // behind
      expect(pos.y).toBeGreaterThan(feet.y + 1); // above the head (robot ~0.97 u)
      expect(target.clone().sub(new Vector3(feet.x, feet.y, feet.z)).dot(fwd)).toBeGreaterThan(0.5); // ahead
      expect(pos.distanceTo(new Vector3(feet.x, feet.y, feet.z))).toBeLessThan(3.5);
    }
  });

  it('eases from the current camera (no jump in the first frame) and settles on the pose', () => {
    const feet = { x: 0, y: 0, z: 0 };
    const f = createFollower(new Vector3(20, 30, 20), new Vector3(0, 0, 0));
    const first = f.update(feet, 0, 1 / 60, false);
    expect(first.pos.distanceTo(new Vector3(20, 30, 20))).toBeLessThan(5);
    let last = first;
    for (let i = 0; i < 180; i++) last = f.update(feet, 0, 1 / 60, false);
    expect(last.pos.distanceTo(followPose(feet, 0).pos)).toBeLessThan(0.01);
  });

  it('reduced motion: cuts straight to the follow pose', () => {
    const feet = { x: 2, y: 0, z: 1 };
    const f = createFollower(new Vector3(20, 30, 20), new Vector3(0, 0, 0));
    const p = f.update(feet, 0.5, 1 / 60, true);
    expect(p.pos.distanceTo(followPose(feet, 0.5).pos)).toBeLessThan(1e-9);
  });

  it('keeps following when the robot rides the elevator to another floor', () => {
    const f = createFollower(new Vector3(0, FOLLOW_UP, -1.9), new Vector3(0, 0.6, 1.3));
    let feet = { x: -9.3, y: 0, z: -2.4 };
    for (let i = 0; i < 60; i++) f.update(feet, 0, 1 / 60, false);
    for (let k = 0; k <= 60; k++) {
      feet = { x: -9.3, y: (3 * FLOOR_HEIGHT * k) / 60, z: -2.4 };
      f.update(feet, 0, 1 / 60, false);
    }
    let p = f.update(feet, 0, 1 / 60, false);
    for (let i = 0; i < 120; i++) p = f.update(feet, 0, 1 / 60, false);
    expect(p.pos.y).toBeCloseTo(3 * FLOOR_HEIGHT + FOLLOW_UP, 2);
  });
});
