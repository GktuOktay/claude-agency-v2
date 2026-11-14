// Overview framing (art direction after Rev 38): the campus fills most of the desktop width with the city
// still around it, the whole campus stays in view, and the boot camera is never pulled back by the orbit clamp.
import { afterEach, describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_FOV, CameraRig, PANEL_OFFSET_NDC, clearFrameInsets, configureOrbit, overviewFocusPoints, overviewPose, setFrameAspect, setFrameInsets } from '../src/scene/camera';
import { applyInitialCamera } from '../src/app/initialCamera';
import { CAMPUS_BOUNDS, FLOOR_COUNT, FLOOR_HEIGHT } from '../src/sim/layout';

const DESKTOPS = [1280 / 800, 1440 / 900, 1920 / 1080];
const PHONES = [375 / 667, 390 / 844];

function campusCorners(): Vector3[] {
  const c = CAMPUS_BOUNDS;
  const out: Vector3[] = [];
  for (const x of [c.x0, c.x1]) for (const y of [0, FLOOR_COUNT * FLOOR_HEIGHT]) for (const z of [c.z0, c.z1]) out.push(new Vector3(x, y, z));
  return out;
}

function camAt(pos: Vector3, target: Vector3, aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 400);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
}

function span(points: readonly Vector3[], cam: PerspectiveCamera): { minX: number; maxX: number; minY: number; maxY: number; width: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const q = p.clone().project(cam);
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  return { minX, maxX, minY, maxY, width: (maxX - minX) / 2 };
}

describe('overview framing (art direction)', () => {
  afterEach(() => {
    setFrameAspect(16 / 9);
    clearFrameInsets();
  });

  it('desktop: the campus fills about 60-70 % of the viewport width, the city stays visible around it', () => {
    for (const aspect of DESKTOPS) {
      setFrameAspect(aspect);
      const o = overviewPose();
      const s = span(campusCorners(), camAt(o.pos, o.target, aspect));
      expect(s.width, `aspect ${aspect.toFixed(2)}`).toBeGreaterThanOrEqual(0.58);
      expect(s.width, `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.72);
    }
  });

  it('phone: the campus is at least as large as before (width-bound) and never cut', () => {
    for (const aspect of PHONES) {
      setFrameAspect(aspect);
      const o = overviewPose();
      const s = span(campusCorners(), camAt(o.pos, o.target, aspect));
      expect(s.width, `aspect ${aspect.toFixed(2)}`).toBeGreaterThanOrEqual(0.8);
      expect(Math.max(-s.minX, s.maxX), `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.9);
    }
  });

  it('the whole campus and the arrival plaza stay in view, clear of the floor panel on desktop', () => {
    for (const aspect of [...DESKTOPS, ...PHONES]) {
      setFrameAspect(aspect);
      const o = overviewPose();
      const cam = camAt(o.pos, o.target, aspect);
      const s = span([...campusCorners(), ...overviewFocusPoints()], cam);
      expect(s.maxX, `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.97);
      expect(s.maxY, `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.97);
      expect(s.minY, `aspect ${aspect.toFixed(2)}`).toBeGreaterThanOrEqual(-0.97);
      const left = aspect > 1 ? -1 + 2 * PANEL_OFFSET_NDC : -0.97;
      expect(s.minX, `aspect ${aspect.toFixed(2)}`).toBeGreaterThanOrEqual(left);
    }
  });

  it('a measured floor panel column moves the campus right of it', () => {
    setFrameAspect(1280 / 800);
    setFrameInsets(0.2, 0);
    const o = overviewPose();
    const s = span([...campusCorners(), ...overviewFocusPoints()], camAt(o.pos, o.target, 1280 / 800));
    expect(s.minX).toBeGreaterThanOrEqual(-1 + 2 * 0.2);
    expect(s.maxX).toBeLessThanOrEqual(0.97);
  });

  it('boot on a tall phone: the orbit clamp does not pull the camera in past the overview fit', () => {
    for (const aspect of PHONES) {
      setFrameAspect(aspect);
      const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 400);
      const controls = new OrbitControls(camera, document.createElement('canvas'));
      configureOrbit(controls);
      applyInitialCamera(new CameraRig(), camera, controls);
      const o = overviewPose();
      expect(camera.position.distanceTo(o.pos), `aspect ${aspect.toFixed(2)}`).toBeLessThan(1e-6);
      camera.updateMatrixWorld(true);
      const s = span(campusCorners(), camera);
      expect(Math.max(-s.minX, s.maxX), `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.97);
      controls.dispose();
    }
  });
});
