// Phone framing (KARARLAR Rev 38 polish): tower floor views do not slice a thin sliver off the campus wing,
// and bottom sheets (the open settings sheet, the robot card) do not cover the focused content.
import { describe, it, expect, afterEach } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  CAMERA_FOV, ZOOM_FOV, clearFrameInsets, floorFramePoints, floorPlanPoints, floorPose, robotPose, setFrameAspect, setFrameInsets,
  setSheetInset, setZoomSheetInset, wingPose, wingPlanPoints,
} from '../src/scene/camera';
import { WING } from '../src/sim/layout';
import { FLOOR_COUNT } from '../src/scene/model';
import { createSettingsMenu } from '../src/ui/settingsMenu';

const project = (pose: { pos: Vector3; target: Vector3; fov?: number }, aspect: number, p: Vector3): Vector3 => {
  const cam = new PerspectiveCamera(pose.fov ?? CAMERA_FOV, aspect, 0.1, 400);
  cam.position.copy(pose.pos);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  return p.clone().project(cam);
};
const PHONE = 375 / 812;
const floors = Array.from({ length: FLOOR_COUNT }, (_, f) => f);

afterEach(() => {
  clearFrameInsets();
  setSheetInset(0);
  setZoomSheetInset(0);
  setFrameAspect(16 / 9);
});

describe('tower floor views on phones keep the wing edge whole', () => {
  it('on a phone the framing includes the wing east facade: the edge shows whole, not as a sliver', () => {
    setFrameAspect(PHONE);
    setFrameInsets(0, 0.14);
    const eastX = WING.x + WING.halfW;
    for (const f of floors) {
      const pose = floorPose(f);
      const extra = floorFramePoints(f).filter((p) => Math.abs(p.x - eastX) < 1e-6);
      expect(extra.length).toBeGreaterThan(0);
      for (const p of floorFramePoints(f)) {
        const v = project(pose, PHONE, p);
        expect(v.x).toBeGreaterThanOrEqual(-1);
        expect(v.x).toBeLessThanOrEqual(1);
        expect(v.y).toBeLessThanOrEqual(1 - 2 * 0.14 + 1e-6);
        expect(v.y).toBeGreaterThanOrEqual(-1);
      }
    }
  });

  it('desktop framing is unchanged (no wing points on wide screens)', () => {
    setFrameAspect(1280 / 800);
    for (const f of floors) expect(floorFramePoints(f)).toEqual(floorPlanPoints(f));
  });
});

describe('bottom sheet inset', () => {
  it('a zero bottom inset gives the same floor pose as before', () => {
    setFrameAspect(PHONE);
    setFrameInsets(0, 0.14);
    const a = floorPose(3);
    setFrameInsets(0, 0.14, 0);
    setSheetInset(0);
    const b = floorPose(3);
    expect(b.pos.toArray()).toEqual(a.pos.toArray());
    expect(b.target.toArray()).toEqual(a.target.toArray());
  });

  it('with the settings sheet open, floor and wing views fit above it', () => {
    setFrameAspect(PHONE);
    setFrameInsets(0, 0.14);
    setSheetInset(0.45);
    for (const f of floors) {
      const pose = floorPose(f);
      for (const p of floorFramePoints(f)) expect(project(pose, PHONE, p).y).toBeGreaterThanOrEqual(-1 + 2 * 0.45 - 1e-6);
    }
    const w = wingPose(1);
    for (const p of wingPlanPoints(1)) expect(project(w, PHONE, p).y).toBeGreaterThanOrEqual(-1 + 2 * 0.45 - 1e-6);
  });

  it('clamps the sheet inset so a floor view keeps a usable area', () => {
    setFrameAspect(PHONE);
    setSheetInset(0.9);
    const pose = floorPose(2);
    for (const p of floorFramePoints(2)) expect(project(pose, PHONE, p).y).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('the robot close-up sits in the free area above the card sheet on phones', () => {
    setFrameAspect(PHONE);
    setFrameInsets(0, 0.14);
    const feet = new Vector3(1, 6, 0.5);
    const plain = robotPose(feet);
    expect(Math.abs(project(plain, PHONE, plain.target).y)).toBeLessThan(1e-6);
    setZoomSheetInset(0.5);
    const lifted = robotPose(feet);
    expect(lifted.fov).toBe(ZOOM_FOV);
    expect(project(lifted, PHONE, feet).y).toBeGreaterThan(-1 + 2 * 0.5); // feet above the sheet top
    // same distance, only the framing slides
    expect(lifted.pos.distanceTo(lifted.target)).toBeCloseTo(plain.pos.distanceTo(plain.target), 6);
  });
});

describe('settings sheet toggle hook', () => {
  it('reports open and close so the app can reframe', () => {
    const seen: boolean[] = [];
    const m = createSettingsMenu({ sections: [], onToggle: (on) => seen.push(on) });
    document.body.replaceChildren(m.element);
    m.open();
    m.close();
    expect(seen).toEqual([true, false]);
  });
});
