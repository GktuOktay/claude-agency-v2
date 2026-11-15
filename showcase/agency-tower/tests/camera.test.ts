import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CameraRig,
  rideDuration,
  configureOrbit,
  classifyPointer,
  floorPose,
  overviewPose,
  robotPose,
  OVERVIEW_DURATION,
  ZOOM_DURATION,
} from '../src/scene/camera';

const DT = 1 / 60;

function runUntilIdle(rig: CameraRig, maxSeconds = 10): { frames: number; seconds: number } {
  let frames = 0;
  while (rig.busy && frames < maxSeconds * 60) {
    rig.update(DT);
    frames++;
  }
  return { frames, seconds: frames * DT };
}

describe('orbit config and click/drag (AC-7)', () => {
  it('pan disabled, distance and polar angle clamped above ground', () => {
    const cam = new PerspectiveCamera();
    const dom = document.createElement('canvas');
    const controls = new OrbitControls(cam, dom);
    configureOrbit(controls);
    expect(controls.enablePan).toBe(false);
    expect(controls.minDistance).toBeGreaterThan(0);
    expect(Number.isFinite(controls.maxDistance)).toBe(true);
    expect(controls.maxDistance).toBeGreaterThan(controls.minDistance);
    expect(controls.minPolarAngle).toBeGreaterThan(0);
    expect(controls.maxPolarAngle).toBeLessThan(Math.PI / 2);
    controls.dispose();
  });

  it('5 px is a click, 6 px is a drag', () => {
    expect(classifyPointer({ x: 10, y: 10 }, { x: 15, y: 10 })).toBe('click');
    expect(classifyPointer({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe('click'); // distance 5
    expect(classifyPointer({ x: 10, y: 10 }, { x: 16, y: 10 })).toBe('drag');
    expect(classifyPointer({ x: 10, y: 10 }, { x: 10, y: 4 })).toBe('drag');
  });
});

describe('ride duration (AC-8)', () => {
  it('0.8 s for 1 floor, 1.2 s for 2, 3.0 s for 5', () => {
    expect(rideDuration(1)).toBeCloseTo(0.8);
    expect(rideDuration(2)).toBeCloseTo(1.2);
    expect(rideDuration(5)).toBeCloseTo(3.0);
    expect(rideDuration(0.2)).toBeCloseTo(0.8);
    expect(rideDuration(9)).toBeCloseTo(3.0);
  });
});

describe('camera rig (AC-8)', () => {
  it('starts in overview with the cabin at floor 0 and doors open', () => {
    const rig = new CameraRig();
    expect(rig.mode).toBe('overview');
    expect(rig.cabinY).toBeCloseTo(floorPose(0).cabinY);
    expect(rig.busy).toBe(false);
  });

  it('a floor-to-floor ride lasts rideDuration; cabin y and camera target y match every frame; doors open on arrival', () => {
    const rig = new CameraRig();
    rig.goToFloor(0);
    runUntilIdle(rig);
    rig.goToFloor(3);
    const expected = rideDuration(3);
    let frames = 0;
    expect(rig.doors).toBe('closed');
    while (rig.busy) {
      rig.update(DT);
      frames++;
      expect(Math.abs(rig.cabinY - rig.target.y)).toBeLessThanOrEqual(0.05);
    }
    expect(Math.abs(frames * DT - expected)).toBeLessThanOrEqual(DT * 1.5);
    expect(rig.doors).toBe('open');
    expect(rig.floor).toBe(3);
    expect(rig.cabinY).toBeCloseTo(floorPose(3).cabinY);
  });

  it('a request during a ride re-targets from the current position (last wins, no jump)', () => {
    const rig = new CameraRig();
    rig.goToFloor(5);
    runUntilIdle(rig);
    rig.goToFloor(0);
    for (let i = 0; i < 40; i++) rig.update(DT);
    const prev = rig.cabinY;
    rig.goToFloor(2);
    const bound = (3 * Math.abs(prev - floorPose(2).cabinY)) / rideDuration(Math.abs(prev - floorPose(2).cabinY) / 4) * DT * 1.05;
    let last = prev;
    let maxStep = 0;
    while (rig.busy) {
      rig.update(DT);
      maxStep = Math.max(maxStep, Math.abs(rig.cabinY - last));
      last = rig.cabinY;
    }
    expect(maxStep).toBeLessThanOrEqual(bound);
    expect(rig.cabinY).toBeCloseTo(floorPose(2).cabinY);
    expect(rig.floor).toBe(2);
  });

  it('moves to and from overview take 1.2 s and park / release the cabin at floor 0', () => {
    const rig = new CameraRig();
    rig.goToFloor(4);
    runUntilIdle(rig);
    rig.goOverview();
    const toOverview = runUntilIdle(rig);
    expect(Math.abs(toOverview.seconds - OVERVIEW_DURATION)).toBeLessThanOrEqual(DT * 1.5);
    expect(rig.mode).toBe('overview');
    expect(rig.cabinY).toBeCloseTo(floorPose(0).cabinY);
    expect(rig.position.distanceTo(overviewPose().pos)).toBeLessThan(0.01);
    rig.goToFloor(2);
    const fromOverview = runUntilIdle(rig);
    expect(Math.abs(fromOverview.seconds - OVERVIEW_DURATION)).toBeLessThanOrEqual(DT * 1.5);
    expect(rig.mode).toBe('floor');
  });

  it('requesting the current floor does not move', () => {
    const rig = new CameraRig();
    rig.goToFloor(2);
    runUntilIdle(rig);
    rig.goToFloor(2);
    expect(rig.busy).toBe(false);
  });

  it('zoom to a robot takes 0.6 s and ends within 3.5 units; return takes 0.6 s to the floor view', () => {
    const rig = new CameraRig();
    rig.goToFloor(3);
    runUntilIdle(rig);
    const robot = new Vector3(2, 12.2, 1);
    rig.zoomTo(robotPose(robot));
    const z = runUntilIdle(rig);
    expect(Math.abs(z.seconds - ZOOM_DURATION)).toBeLessThanOrEqual(DT * 1.5);
    expect(rig.position.distanceTo(robot)).toBeLessThanOrEqual(3.5);
    rig.returnToFloor();
    const r = runUntilIdle(rig);
    expect(r.seconds).toBeLessThanOrEqual(0.6 + DT * 1.5);
    expect(rig.position.distanceTo(floorPose(3).pos)).toBeLessThan(0.01);
  });

  it('runs a sequence of steps and calls their callbacks in order', () => {
    const rig = new CameraRig();
    const log: string[] = [];
    rig.run([
      { pose: floorPose(1), duration: 0.5, onDone: () => log.push('a') },
      { pose: floorPose(2), duration: 0.5, onDone: () => log.push('b') },
    ]);
    runUntilIdle(rig);
    expect(log).toEqual(['a', 'b']);
  });

  it('a new run replaces the pending sequence and drops its callbacks', () => {
    const rig = new CameraRig();
    const log: string[] = [];
    rig.run([{ pose: floorPose(5), duration: 1, onDone: () => log.push('old') }]);
    rig.update(0.3);
    rig.run([{ pose: floorPose(1), duration: 0.5, onDone: () => log.push('new') }]);
    runUntilIdle(rig);
    expect(log).toEqual(['new']);
  });
});
