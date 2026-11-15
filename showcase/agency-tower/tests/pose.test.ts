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

describe('campus break poses (KARARLAR rev 31)', () => {
  it('running swings the legs in opposition, animated by time, with a forward lean', () => {
    const p = parts();
    applyPose(p, 'run', 0, 0.1);
    expect(p.legL.rotation.x).toBeCloseTo(-p.legR.rotation.x);
    expect(Math.abs(p.legL.rotation.x)).toBeGreaterThan(0.1);
    expect(p.body.rotation.x).toBeGreaterThan(0);
    const q = parts();
    applyPose(q, 'run', 0, 0.3);
    expect(q.legL.rotation.x).not.toBeCloseTo(p.legL.rotation.x); // running in place on the belt
  });

  it('lifting raises both arms together above the shoulders at the top of a rep', () => {
    const p = parts();
    applyPose(p, 'lift', 0, Math.PI / 6); // sin(3t) = 1
    expect(p.armL.rotation.z).toBeCloseTo(-p.armR.rotation.z);
    expect(Math.abs(p.armR.rotation.z)).toBeGreaterThan(2);
    expect(p.legL.rotation.x).toBe(0);
  });

  it('the paddle swing moves the right arm across the body; the left stays low', () => {
    const a = parts();
    const b = parts();
    applyPose(a, 'paddle', 0, 0);
    applyPose(b, 'paddle', 0, Math.PI / 8);
    expect(a.armR.rotation.x).toBeLessThan(-0.5);
    expect(a.armR.rotation.y).not.toBeCloseTo(b.armR.rotation.y);
    expect(Math.abs(a.armL.rotation.x)).toBeLessThan(0.6);
  });

  it('sleeping reclines the torso, stretches the legs and drops the head; it breathes slowly', () => {
    const p = parts();
    applyPose(p, 'sleep', 0, 0);
    expect(p.body.rotation.x).toBeLessThan(-0.8);
    expect(p.legL.rotation.x).toBeLessThan(-1);
    expect(p.legR.rotation.x).toBeCloseTo(p.legL.rotation.x);
    expect(Math.abs(p.head.rotation.z)).toBeGreaterThan(0.2);
  });

  it('eating sits and brings the right hand up to the mouth', () => {
    const p = parts();
    applyPose(p, 'eat', 0, 0);
    expect(p.body.position.y).toBeCloseTo(0.07);
    expect(p.armR.rotation.x).toBeLessThan(-1.5);
  });

  it('playing and reading hold the arms forward standing; reading looks down', () => {
    const play = parts();
    applyPose(play, 'play', 0, 0.2);
    expect(play.armL.rotation.x).toBeLessThan(-0.8);
    expect(play.body.position.y).toBe(0);
    const read = parts();
    applyPose(read, 'read', 0, 0);
    expect(read.armR.rotation.x).toBeLessThan(-0.8);
    expect(read.head.rotation.x).toBeGreaterThan(0.2);
  });

  it('a break pose is fully reset by the next state', () => {
    const p = parts();
    applyPose(p, 'sleep', 0, 0);
    applyPose(p, 'idle', 0, 0);
    expect(p.body.rotation.x).toBe(0);
    expect(p.legL.rotation.x).toBe(0);
    expect(p.head.rotation.z).toBe(0);
  });
});
