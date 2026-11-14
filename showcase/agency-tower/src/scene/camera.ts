// Camera rig, elevator ride timing and pointer classification (REQ-9, REQ-10). Pure of any renderer.
import { TOUCH, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FLOOR_COUNT, FLOOR_HEIGHT, HALF_DEPTH, HALF_WIDTH, SHAFT_X } from './model';

export const OVERVIEW_DURATION = 1.2;
export const ZOOM_DURATION = 0.6;
export const CLICK_THRESHOLD_PX = 5;
export const DOORS_SECONDS = 0.4;

export function rideDuration(floorsTravelled: number): number {
  return Math.min(3.0, Math.max(0.8, 0.6 * floorsTravelled));
}

export function configureOrbit(controls: OrbitControls): void {
  controls.enablePan = false;
  // Touch: one finger orbits, two fingers zoom (pan is off, so DOLLY_PAN only dollies).
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
  controls.enableDamping = false;
  controls.minDistance = 2;
  controls.maxDistance = MAX_DISTANCE;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = 1.5; // below pi/2: the camera stays above the target plane, above ground
}

export function classifyPointer(down: { x: number; y: number }, up: { x: number; y: number }): 'click' | 'drag' {
  return Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_THRESHOLD_PX + 1e-9 ? 'click' : 'drag';
}

export interface CamPose {
  cabinY: number; // elevator reference height; equals the camera target height during floor views
  pos: Vector3;
  target: Vector3;
  fov?: number; // vertical field of view at this pose (default CAMERA_FOV)
}

/** Narrow vertical field of view: the diorama reads near-orthographic. */
export const CAMERA_FOV = 32;
export const MAX_DISTANCE = 160;
/** Camera target height above a floor's base during floor views; also the elevator reference height. */
export const FLOOR_TARGET_Y = 0.6;
/** Camera distance to the zoom target when framing a selected robot (robot + desk in view). */
export const ZOOM_DISTANCE = 3.1;
/** Wider lens for the robot close-up: the camera stays within 3.5 units yet the robot + desk fit. */
export const ZOOM_FOV = 50;
const ZOOM_TARGET_LIFT = 0.28;

let frameAspect = 16 / 9;
/** Poses fit the viewport aspect (wide desktop and narrow phone). Call on resize. */
export function setFrameAspect(aspect: number): void {
  if (Number.isFinite(aspect) && aspect > 0) frameAspect = aspect;
}
export const getFrameAspect = (): number => frameAspect;

let insets: { left: number; top: number } | null = null;
/**
 * Screen fractions covered by UI chrome (floor panel column on the left, or a strip on top on phones).
 * Floor views centre the plan in the remaining area. Without a measurement, wide screens assume a
 * left column of PANEL_OFFSET_NDC.
 */
export function clearFrameInsets(): void {
  insets = null;
}
export function setFrameInsets(left: number, top: number): void {
  insets = { left: Math.min(0.4, Math.max(0, left)), top: Math.min(0.4, Math.max(0, top)) };
}

const deg = (d: number): number => (d * Math.PI) / 180;

/** Unit vector from the target toward the camera: azimuth from +z toward +x, elevation above the horizon. */
export function viewDirection(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = deg(azimuthDeg);
  const el = deg(elevationDeg);
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/**
 * Smallest camera distance along `dir` from `target` at which every point lies inside `margin` of the
 * frustum of a perspective camera looking at `target`.
 */
export function fitDistance(points: readonly Vector3[], target: Vector3, dir: Vector3, fovDeg: number, aspect: number, margin: number, marginV = margin): number {
  const forward = dir.clone().normalize().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tanV = Math.tan(deg(fovDeg) / 2) * marginV;
  const tanH = Math.tan(deg(fovDeg) / 2) * aspect * margin;
  let d = 0;
  const rel = new Vector3();
  for (const p of points) {
    rel.copy(p).sub(target);
    const z = rel.dot(forward);
    d = Math.max(d, Math.abs(rel.dot(right)) / tanH - z, Math.abs(rel.dot(up)) / tanV - z);
  }
  return d;
}

function boxCorners(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new Vector3(x, y, z));
  return out;
}

const cabinYFor = (floor: number): number => floor * FLOOR_HEIGHT + FLOOR_TARGET_Y;
const TOWER_TOP = FLOOR_COUNT * FLOOR_HEIGHT;

export function overviewPose(): CamPose {
  const target = new Vector3(-0.6, TOWER_TOP * 0.46, 0);
  const dir = viewDirection(35, 35);
  const pts = boxCorners(SHAFT_X - 0.9, HALF_WIDTH, 0, TOWER_TOP, -HALF_DEPTH, HALF_DEPTH);
  const d = fitDistance(pts, target, dir, CAMERA_FOV, frameAspect, 0.84);
  return { cabinY: cabinYFor(0), pos: target.clone().add(dir.multiplyScalar(d)), target };
}

/** Headroom above the floor for robot heads and their name pills, included when framing a floor. */
export const FLOOR_LABEL_HEADROOM = 2.6;
/** Horizontal NDC offset of the floor plan on wide screens, leaving room for the left floor panel. */
export const PANEL_OFFSET_NDC = 0.12;

/** Bounds (in NDC) of `points` seen from `target + dir * d` looking at `target`. */
export function projectedBounds(points: readonly Vector3[], target: Vector3, dir: Vector3, d: number, fovDeg: number, aspect: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const forward = dir.clone().normalize().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tanV = Math.tan(deg(fovDeg) / 2);
  const tanH = tanV * aspect;
  const pos = target.clone().add(dir.clone().normalize().multiplyScalar(d));
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const rel = new Vector3();
  for (const p of points) {
    rel.copy(p).sub(pos);
    const depth = rel.dot(forward);
    const x = rel.dot(right) / (depth * tanH);
    const y = rel.dot(up) / (depth * tanV);
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
  }
  return b;
}

export function floorPlanPoints(floor: number): Vector3[] {
  const base = floor * FLOOR_HEIGHT;
  return boxCorners(-HALF_WIDTH, HALF_WIDTH, base, base + FLOOR_LABEL_HEADROOM, -HALF_DEPTH, HALF_DEPTH);
}

export function floorPose(floor: number): CamPose {
  const y = cabinYFor(floor);
  const dir = viewDirection(14, 44);
  const pts = floorPlanPoints(floor);
  const forward = dir.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  // Slide the target horizontally (its height stays the elevator reference) until the plan, with label
  // headroom, is centred vertically and offset right of the floor panel on wide screens.
  const horiz = new Vector3(up.x, 0, up.z).normalize();
  const inset = insets ?? { left: frameAspect > 1 ? PANEL_OFFSET_NDC : 0, top: 0 };
  // Free area in NDC: x in [-1 + 2*left, 1], y in [-1, 1 - 2*top].
  const wantX = inset.left;
  const wantY = -inset.top;
  const tanV = Math.tan(deg(CAMERA_FOV) / 2);
  const tanH = tanV * frameAspect;
  const target = new Vector3(0, y, 0);
  let d = fitDistance(pts, target, dir, CAMERA_FOV, frameAspect, 0.85, 0.96);
  for (let i = 0; i < 8; i++) {
    const b = projectedBounds(pts, target, dir, d, CAMERA_FOV, frameAspect);
    const cy = (b.minY + b.maxY) / 2;
    const cx = (b.minX + b.maxX) / 2;
    // Width ~90 % (less the panel offset), height within 96 %: scale the distance toward the binding one.
    const fill = Math.max((b.maxX - b.minX) / 2 / (0.95 * (1 - inset.left)), (b.maxY - b.minY) / 2 / (0.96 * (1 - inset.top)));
    d *= fill;
    target.addScaledVector(horiz, ((cy - wantY) * d * tanV) / Math.max(0.2, horiz.dot(up)));
    target.addScaledVector(right, (cx - wantX) * d * tanH);
  }
  return { cabinY: y, pos: target.clone().add(dir.multiplyScalar(d)), target };
}

/** Frames a robot and its desk: the robot fills roughly a quarter to a third of the viewport height. */
export function robotPose(robotFeet: Vector3, cabinY?: number, scale = 1): CamPose {
  const target = robotFeet.clone().add(new Vector3(0, ZOOM_TARGET_LIFT * scale, 0));
  const pos = target.clone().add(viewDirection(25, 40).multiplyScalar(ZOOM_DISTANCE));
  return { cabinY: cabinY ?? target.y, pos, target, fov: ZOOM_FOV };
}

export type RigMode = 'overview' | 'floor' | 'org';

let orgInsets = { top: 0.1, bottom: 0.14 };
/** Screen fractions covered by the toolbar (top) and the legend (bottom) in org mode; null resets. */
export function setOrgInsets(top: number | null, bottom = 0): void {
  orgInsets = top === null ? { top: 0.1, bottom: 0.14 } : { top: Math.min(0.35, Math.max(0, top)), bottom: Math.min(0.35, Math.max(0, bottom)) };
}

/**
 * Org mode: the whole tower in one fixed, slightly lower front 3/4 pose so reporting lines read. The fit
 * includes headroom for the name pills over the top floor and keeps clear of the toolbar and legend.
 */
export function orgPose(): CamPose {
  const dir = viewDirection(24, 22);
  const pts = boxCorners(SHAFT_X - 0.9, HALF_WIDTH, 0, TOWER_TOP + 2.2, -HALF_DEPTH, HALF_DEPTH);
  const forward = dir.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tanV = Math.tan(deg(CAMERA_FOV) / 2);
  const tanH = tanV * frameAspect;
  const { top, bottom } = orgInsets;
  const wantY = bottom - top; // centre of the free band in NDC
  const halfV = 1 - top - bottom;
  const target = new Vector3(-0.6, TOWER_TOP * 0.5, 0);
  let d = fitDistance(pts, target, dir, CAMERA_FOV, frameAspect, 0.9, 0.9 * halfV);
  for (let i = 0; i < 8; i++) {
    const b = projectedBounds(pts, target, dir, d, CAMERA_FOV, frameAspect);
    d *= Math.max((b.maxX - b.minX) / 2 / 0.9, (b.maxY - b.minY) / 2 / (0.92 * halfV));
    target.addScaledVector(up, ((b.minY + b.maxY) / 2 - wantY) * d * tanV);
    target.addScaledVector(right, ((b.minX + b.maxX) / 2) * d * tanH);
  }
  return { cabinY: cabinYFor(0), pos: target.clone().add(dir.multiplyScalar(d)), target };
}

export interface Step {
  pose: CamPose;
  duration: number;
  enter?: { mode: RigMode; floor: number }; // applied when the step completes
  onDone?: () => void;
}

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  mode: RigMode = 'overview';
  floor = 0;
  /** prefers-reduced-motion: every move is a cut (all pending steps complete in one frame). */
  reducedMotion = false;
  private beforeOrg: { mode: RigMode; floor: number; pose: CamPose } | null = null;
  doors: 'open' | 'closed' = 'open';
  doorsOpenness = 1;
  cabinY = cabinYFor(0);
  readonly position = overviewPose().pos;
  readonly target = overviewPose().target;
  fov = CAMERA_FOV;

  private steps: Step[] = [];
  private from: { cabinY: number; pos: Vector3; target: Vector3; fov: number } | null = null;
  private elapsed = 0;

  get busy(): boolean {
    return this.steps.length > 0;
  }

  /** Replace any running plan with `steps`, starting from the current state (last request wins). */
  run(steps: Step[]): void {
    this.steps = steps.slice();
    this.begin();
    if (!this.steps.length) return;
    this.doors = 'closed';
  }

  /** Ride (or fly from overview) to a floor view, then run `after` (e.g. a zoom). */
  goToFloor(floor: number, after: Step[] = []): void {
    if (this.mode === 'floor' && this.floor === floor && !this.busy && !after.length) return;
    const pose = floorPose(floor);
    const here = this.mode === 'floor' && this.floor === floor && !this.busy;
    const travelled = Math.abs(this.cabinY - pose.cabinY) / FLOOR_HEIGHT;
    const duration = this.mode !== 'floor' ? OVERVIEW_DURATION : rideDuration(travelled);
    const first: Step = { pose, duration, enter: { mode: 'floor', floor } };
    this.run(here ? after : [first, ...after]);
  }

  goOverview(): void {
    this.run([{ pose: overviewPose(), duration: OVERVIEW_DURATION, enter: { mode: 'overview', floor: 0 } }]);
  }

  /** Enter org mode (1.2 s); remembers the current pose and floor so leaving restores them exactly. */
  goOrg(): void {
    if (this.mode !== 'org') {
      const pose: CamPose = { cabinY: this.cabinY, pos: this.position.clone(), target: this.target.clone(), fov: this.fov };
      this.beforeOrg = { mode: this.mode, floor: this.floor, pose };
    }
    this.run([{ pose: orgPose(), duration: OVERVIEW_DURATION, enter: { mode: 'org', floor: 0 } }]);
  }

  /** Leave org mode back to the remembered pose and floor (1.2 s). */
  exitOrg(): void {
    const back = this.beforeOrg ?? { mode: 'overview' as const, floor: 0, pose: overviewPose() };
    this.beforeOrg = null;
    this.run([{ pose: back.pose, duration: OVERVIEW_DURATION, enter: { mode: back.mode, floor: back.floor } }]);
  }

  zoomTo(pose: CamPose, onDone?: () => void): void {
    this.run([{ pose, duration: ZOOM_DURATION, onDone }]);
  }

  returnToFloor(): void {
    this.run([{ pose: floorPose(this.floor), duration: ZOOM_DURATION }]);
  }

  update(dt: number): void {
    if (this.reducedMotion) {
      // Cuts: finish every pending step now, in order, with their callbacks.
      for (let guard = 0; guard < 16 && this.steps.length; guard++) this.advance(Number.POSITIVE_INFINITY);
      this.doorsOpenness = this.doors === 'open' ? 1 : 0;
      return;
    }
    this.advance(dt);
    this.stepDoors(dt);
  }

  private advance(dt: number): void {
    const step = this.steps[0];
    if (!step || !this.from) return;
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / step.duration);
    const s = ease(t);
    const f = this.from;
    this.cabinY = f.cabinY + (step.pose.cabinY - f.cabinY) * s;
    this.position.lerpVectors(f.pos, step.pose.pos, s);
    this.target.lerpVectors(f.target, step.pose.target, s);
    this.fov = f.fov + ((step.pose.fov ?? CAMERA_FOV) - f.fov) * s;
    if (this.floorRide) this.target.y = this.cabinY;
    if (t >= 1) {
      this.cabinY = step.pose.cabinY;
      this.position.copy(step.pose.pos);
      this.target.copy(step.pose.target);
      this.fov = step.pose.fov ?? CAMERA_FOV;
      this.steps.shift();
      if (step.enter) {
        this.mode = step.enter.mode;
        this.floor = step.enter.floor;
      }
      step.onDone?.();
      if (this.steps.length) this.begin();
      else {
        this.doors = 'open';
        this.floorRide = false;
      }
    }
  }

  private floorRide = false;

  private begin(): void {
    this.elapsed = 0;
    const step = this.steps[0];
    if (!step) {
      this.from = null;
      return;
    }
    this.from = { cabinY: this.cabinY, pos: this.position.clone(), target: this.target.clone(), fov: this.fov };
    // A floor-to-floor ride keeps cabin and camera target locked together.
    this.floorRide = this.mode === 'floor' && step.enter?.mode === 'floor';
    if (this.floorRide) this.from.target.y = this.cabinY;
  }

  private stepDoors(dt: number): void {
    const goal = this.doors === 'open' ? 1 : 0;
    const delta = dt / DOORS_SECONDS;
    this.doorsOpenness = goal > this.doorsOpenness ? Math.min(goal, this.doorsOpenness + delta) : Math.max(goal, this.doorsOpenness - delta);
  }

  /** The user orbited: keep the rig in sync when it is idle. */
  syncFromUser(pos: Vector3): void {
    if (!this.busy) this.position.copy(pos);
  }
}
