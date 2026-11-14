import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { overviewPose, type CameraRig } from '../scene/camera';

/** Put the camera on the overview pose at boot, with fresh matrices, so the first frame shows the tower. */
export function applyInitialCamera(rig: CameraRig, camera: PerspectiveCamera, controls: OrbitControls): void {
  const o = overviewPose();
  rig.position.copy(o.pos);
  rig.target.copy(o.target);
  camera.position.copy(o.pos);
  controls.target.copy(o.target);
  camera.lookAt(o.target);
  controls.update();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

const tmp = new Vector3();

export function projectToScreen(
  pos: Vector3,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): { x: number; y: number; visible: boolean } {
  camera.updateMatrixWorld();
  tmp.copy(pos).project(camera);
  const x = ((tmp.x + 1) / 2) * width;
  const y = ((1 - tmp.y) / 2) * height;
  return { x, y, visible: Number.isFinite(x) && Number.isFinite(y) && tmp.z < 1 };
}
