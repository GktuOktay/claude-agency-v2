import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { applyPose } from '../src/scene/pose';
import type { RobotParts } from '../src/scene/robot';

const parts = (): RobotParts => ({ body: new Group(), head: new Group(), armL: new Group(), armR: new Group(), legL: new Group(), legR: new Group() });

describe('robot poses', () => {
  it('walking swings the legs in opposition', () => {
    const p = parts();
    applyPose(p, 'walk', 1.2, 0);
    expect(p.legL.rotation.x).toBeCloseTo(-p.legR.rotation.x);
    expect(p.legL.rotation.x).not.toBe(0);
  });

  it('waving raises the right arm above the shoulder', () => {
    const p = parts();
    applyPose(p, 'wave', 0, 0.3);
    expect(Math.abs(p.armR.rotation.z)).toBeGreaterThan(1.5);
  });

  it('working holds the arms forward at the desk; legs still', () => {
    const p = parts();
    applyPose(p, 'work', 0, 1);
    expect(p.armL.rotation.x).toBeLessThan(-0.8);
    expect(p.legL.rotation.x).toBe(0);
  });

  it('resets the pose between states', () => {
    const p = parts();
    applyPose(p, 'wave', 0, 0.3);
    applyPose(p, 'idle', 0, 0);
    expect(Math.abs(p.armR.rotation.z)).toBeLessThan(0.2);
  });
});
