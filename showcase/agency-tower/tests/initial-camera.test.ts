import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraRig, configureOrbit, overviewPose } from '../src/scene/camera';
import { applyInitialCamera, projectToScreen } from '../src/app/initialCamera';

describe('initial camera (boot)', () => {
  it('applies the overview pose to camera, controls target and matrices, looking at the tower', () => {
    const camera = new PerspectiveCamera(45, 1.5, 0.1, 400); // default position (0,0,0)
    const controls = new OrbitControls(camera, document.createElement('canvas'));
    configureOrbit(controls);
    const rig = new CameraRig();
    applyInitialCamera(rig, camera, controls);
    const o = overviewPose();
    expect(camera.position.distanceTo(o.pos)).toBeLessThan(1e-6);
    expect(controls.target.distanceTo(o.target)).toBeLessThan(1e-6);
    const fwd = new Vector3();
    camera.getWorldDirection(fwd);
    expect(fwd.dot(o.target.clone().sub(o.pos).normalize())).toBeGreaterThan(0.999);
    // the tower centre projects inside the viewport
    const p = projectToScreen(new Vector3(0, 12, 0), camera, 1000, 600);
    expect(p.visible).toBe(true);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(1000);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(600);
  });

  it('projectToScreen is not visible for non-finite results', () => {
    const camera = new PerspectiveCamera(45, Number.NaN, 0.1, 400);
    camera.updateProjectionMatrix();
    expect(projectToScreen(new Vector3(0, 1, 0), camera, 100, 100).visible).toBe(false);
  });
});
