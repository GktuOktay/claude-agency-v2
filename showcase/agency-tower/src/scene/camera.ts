// Camera rig, elevator ride timing and pointer classification (REQ-9, REQ-10). Pure of any renderer.
import { TOUCH, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FLOOR_COUNT, FLOOR_HEIGHT, HALF_DEPTH, HALF_WIDTH, SHAFT_X } from './model';
import { STAFF_SHAFT } from '../sim/layout';
import { CAMPUS_BOUNDS, ROOF_GARDEN_FLOOR, TERRACE, WING, WING_WEST_X } from '../sim/layout';
import { PLOT_MARGIN } from '../sim/citySim';

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
export function setFrameInsets(left: number, top: number, bottom = 0): void {
  insets = { left: Math.min(0.4, Math.max(0, left)), top: Math.min(0.4, Math.max(0, top)) };
  setSheetInset(bottom);
}

/** Largest bottom-sheet fraction a floor view leaves to the sheet (the plan keeps at least a usable band). */
export const MAX_SHEET_INSET = 0.5;
let sheetInset = 0;
/**
 * Rev 38: screen fraction covered by an open bottom sheet (the settings sheet on phones). Floor and wing views
 * fit the plan above it. 0 = none (the default, desktop).
 */
export function setSheetInset(bottom: number): void {
  sheetInset = Number.isFinite(bottom) ? Math.min(MAX_SHEET_INSET, Math.max(0, bottom)) : 0;
}
let zoomSheet = 0;
/** Rev 38: screen fraction the robot card covers on phones; the robot close-up sits in the area above it. */
export function setZoomSheetInset(bottom: number): void {
  zoomSheet = Number.isFinite(bottom) ? Math.min(0.7, Math.max(0, bottom)) : 0;
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

/**
 * Overview fill (art direction after Rev 38): the framed points fit within these fractions of the free area
 * (right of the floor panel on desktop, below the floor strip on phones). Desktop is height-bound, so the
 * campus fills about 60-70 % of the width with the city around it; phones are width-bound and keep the wing edge
 * clear of the screen edge.
 */
export const OVERVIEW_FILL = { h: 0.84, v: 0.95 } as const;
/** Headroom over the tower roof for the top floor's department label. */
const OVERVIEW_ROOF_HEADROOM = 1;

/** What the overview is for: the tower with its shafts, the wing with its terrace and roof garden, the arrival plaza. */
export function overviewFocusPoints(): Vector3[] {
  const wingTop = ROOF_GARDEN_FLOOR * FLOOR_HEIGHT + 1.5; // roof garden planting and pergola
  return [
    ...boxCorners(SHAFT_X - 0.9, STAFF_SHAFT.x + 0.9, 0, TOWER_TOP + OVERVIEW_ROOF_HEADROOM, -HALF_DEPTH, HALF_DEPTH),
    ...boxCorners(WING_WEST_X, WING.x + WING.halfW, 0, wingTop, -WING.halfD, TERRACE.z1),
    // Arrival plaza: from the tower front to the allée at the south edge of the campus block (grounds.ts SITE).
    ...boxCorners(SHAFT_X - 0.7, CAMPUS_BOUNDS.x1 + PLOT_MARGIN - 0.1, 0, 0, HALF_DEPTH, CAMPUS_BOUNDS.z1 + PLOT_MARGIN - 0.1),
  ];
}

export function overviewPose(): CamPose {
  // Campus wing (KARARLAR rev 31): frame the tower, both shafts and the wing with its terrace; art direction
  // after Rev 38: plus the arrival plaza, centred in the free area and as large as the whole campus allows.
  const c = CAMPUS_BOUNDS;
  const dir = viewDirection(35, 35);
  const pts = [
    ...boxCorners(Math.min(SHAFT_X - 0.9, c.x0), Math.max(STAFF_SHAFT.x + 0.9, c.x1), 0, TOWER_TOP, Math.min(-HALF_DEPTH, c.z0), Math.max(HALF_DEPTH, c.z1)),
    ...overviewFocusPoints(),
  ];
  const forward = dir.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tanV = Math.tan(deg(CAMERA_FOV) / 2);
  const tanH = tanV * frameAspect;
  const inset = insets ?? { left: frameAspect > 1 ? PANEL_OFFSET_NDC : 0, top: 0 };
  // Free area in NDC: x in [-1 + 2*left, 1], y in [-1, 1 - 2*top]; its centre is (left, -top).
  const halfH = OVERVIEW_FILL.h * (1 - inset.left);
  const halfV = OVERVIEW_FILL.v * (1 - inset.top);
  const target = new Vector3((c.x0 + c.x1) / 2, TOWER_TOP * 0.46, (c.z0 + c.z1) / 2);
  let d = fitDistance(pts, target, dir, CAMERA_FOV, frameAspect, halfH, halfV);
  for (let i = 0; i < 10; i++) {
    const b = projectedBounds(pts, target, dir, d, CAMERA_FOV, frameAspect);
    d *= Math.max((b.maxX - b.minX) / 2 / halfH, (b.maxY - b.minY) / 2 / halfV);
    target.addScaledVector(up, ((b.minY + b.maxY) / 2 + inset.top) * d * tanV);
    target.addScaledVector(right, ((b.minX + b.maxX) / 2 - inset.left) * d * tanH);
  }
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

/** Wing level `level` (0-2), or the wing roof garden (3), with label headroom; level 0 adds the terrace. */
export function wingPlanPoints(level: number): Vector3[] {
  const base = level * FLOOR_HEIGHT;
  const z1 = level === 0 ? TERRACE.z1 : WING.halfD;
  return boxCorners(WING.x - WING.halfW, WING.x + WING.halfW, base, base + FLOOR_LABEL_HEADROOM, -WING.halfD, z1);
}

/**
 * Points a tower floor view frames. Rev 38: on a portrait screen the campus wing would show as a thin sliver
 * at the left edge; the frame takes in its whole east facade (ground to the wing level of this floor, or its
 * roof) so the edge, the sky-bridge and the wing corner read as a whole neighbour. Wide screens: the plan only.
 */
export function floorFramePoints(floor: number): Vector3[] {
  const plan = floorPlanPoints(floor);
  if (frameAspect >= 1) return plan;
  const level = Math.min(floor, ROOF_GARDEN_FLOOR);
  const x = WING.x + WING.halfW;
  const top = level * FLOOR_HEIGHT + (level === ROOF_GARDEN_FLOOR ? 0.6 : FLOOR_LABEL_HEADROOM);
  return [...plan, ...boxCorners(x, x, level * FLOOR_HEIGHT, top, -WING.halfD, WING.halfD)];
}

export function floorPose(floor: number): CamPose {
  return framePlan(floorFramePoints(floor), new Vector3(0, cabinYFor(floor), 0));
}

/** Frames a whole campus wing level (or the roof garden) like a floor view, clear of the floor panel. */
export function wingPose(level: number): CamPose {
  const pts = wingPlanPoints(level);
  const cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
  return framePlan(pts, new Vector3(WING.x, cabinYFor(level), cz));
}

/** Plan view of `pts` (with headroom); the target keeps height `start.y` (the elevator reference). */
function framePlan(pts: readonly Vector3[], start: Vector3): CamPose {
  const y = start.y;
  const dir = viewDirection(14, 44);
  const forward = dir.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  // Slide the target horizontally (its height stays the elevator reference) until the plan, with label
  // headroom, is centred vertically and offset right of the floor panel on wide screens.
  const horiz = new Vector3(up.x, 0, up.z).normalize();
  const inset = insets ?? { left: frameAspect > 1 ? PANEL_OFFSET_NDC : 0, top: 0 };
  // Free area in NDC: x in [-1 + 2*left, 1], y in [-1, 1 - 2*top].
  const wantX = inset.left;
  const bottom = sheetInset;
  const wantY = bottom - inset.top;
  const tanV = Math.tan(deg(CAMERA_FOV) / 2);
  const tanH = tanV * frameAspect;
  const target = start.clone();
  let d = fitDistance(pts, target, dir, CAMERA_FOV, frameAspect, 0.85, 0.96);
  for (let i = 0; i < 8; i++) {
    const b = projectedBounds(pts, target, dir, d, CAMERA_FOV, frameAspect);
    const cy = (b.minY + b.maxY) / 2;
    const cx = (b.minX + b.maxX) / 2;
    // Width ~90 % (less the panel offset), height within 96 %: scale the distance toward the binding one.
    const fill = Math.max((b.maxX - b.minX) / 2 / (0.95 * (1 - inset.left)), (b.maxY - b.minY) / 2 / (0.96 * (1 - inset.top - bottom)));
    d *= fill;
    target.addScaledVector(horiz, ((cy - wantY) * d * tanV) / Math.max(0.2, horiz.dot(up)));
    target.addScaledVector(right, (cx - wantX) * d * tanH);
  }
  return { cabinY: y, pos: target.clone().add(dir.multiplyScalar(d)), target };
}

/** Frames a robot and its desk: the robot fills roughly a quarter to a third of the viewport height. */
export function robotPose(robotFeet: Vector3, cabinY?: number, scale = 1): CamPose {
  const target = robotFeet.clone().add(new Vector3(0, ZOOM_TARGET_LIFT * scale, 0));
  const dir = viewDirection(25, 40);
  const pos = target.clone().add(dir.clone().multiplyScalar(ZOOM_DISTANCE));
  if (zoomSheet > 0) {
    // Rev 38: slide the view (same distance and angle) so the robot sits mid-way between the top strip and
    // the card sheet instead of under the sheet.
    const forward = dir.clone().negate();
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const up = new Vector3().crossVectors(right, forward);
    const wantY = zoomSheet - (insets?.top ?? 0);
    const shift = up.multiplyScalar(-wantY * ZOOM_DISTANCE * Math.tan(deg(ZOOM_FOV) / 2));
    target.add(shift);
    pos.add(shift);
  }
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
  const c = CAMPUS_BOUNDS; // campus wing (KARARLAR rev 31) included
  const pts = boxCorners(Math.min(SHAFT_X - 0.9, c.x0), Math.max(STAFF_SHAFT.x + 0.9, c.x1), 0, TOWER_TOP + 2.2, Math.min(-HALF_DEPTH, c.z0), Math.max(HALF_DEPTH, c.z1));
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
  enter?: { mode: RigMode; floor: number; wing?: number | null }; // applied when the step completes
  onDone?: () => void;
}

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  mode: RigMode = 'overview';
  floor = 0;
  /** Campus wing level framed in a floor-mode view (ghosting follows `floor`), or null for the tower. */
  wing: number | null = null;
  /** prefers-reduced-motion: every move is a cut (all pending steps complete in one frame). */
  reducedMotion = false;
  private beforeOrg: { mode: RigMode; floor: number; wing: number | null; pose: CamPose } | null = null;
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
    const atTower = this.wing === null;
    if (this.mode === 'floor' && this.floor === floor && atTower && !this.busy && !after.length) return;
    const pose = floorPose(floor);
    const here = this.mode === 'floor' && this.floor === floor && atTower && !this.busy;
    const travelled = Math.abs(this.cabinY - pose.cabinY) / FLOOR_HEIGHT;
    const duration = this.mode !== 'floor' ? OVERVIEW_DURATION : rideDuration(travelled);
    const first: Step = { pose, duration, enter: { mode: 'floor', floor } };
    this.run(here ? after : [first, ...after]);
  }

  /** Fly (or ride) to a campus wing level; the view ghosts like tower floor `focusFloor`. */
  goToWing(level: number, focusFloor = level): void {
    if (this.mode === 'floor' && this.wing === level && !this.busy) return;
    const pose = wingPose(level);
    const travelled = Math.abs(this.cabinY - pose.cabinY) / FLOOR_HEIGHT;
    const duration = this.mode !== 'floor' ? OVERVIEW_DURATION : Math.max(ZOOM_DURATION, rideDuration(travelled));
    this.run([{ pose, duration, enter: { mode: 'floor', floor: focusFloor, wing: level } }]);
  }

  goOverview(): void {
    this.run([{ pose: overviewPose(), duration: OVERVIEW_DURATION, enter: { mode: 'overview', floor: 0 } }]);
  }

  /** Enter org mode (1.2 s); remembers the current pose and floor so leaving restores them exactly. */
  goOrg(): void {
    if (this.mode !== 'org') {
      const pose: CamPose = { cabinY: this.cabinY, pos: this.position.clone(), target: this.target.clone(), fov: this.fov };
      this.beforeOrg = { mode: this.mode, floor: this.floor, wing: this.wing, pose };
    }
    this.run([{ pose: orgPose(), duration: OVERVIEW_DURATION, enter: { mode: 'org', floor: 0 } }]);
  }

  /** Leave org mode back to the remembered pose and floor (1.2 s). */
  exitOrg(): void {
    const back = this.beforeOrg ?? { mode: 'overview' as const, floor: 0, wing: null, pose: overviewPose() };
    this.beforeOrg = null;
    this.run([{ pose: back.pose, duration: OVERVIEW_DURATION, enter: { mode: back.mode, floor: back.floor, wing: back.wing } }]);
  }

  zoomTo(pose: CamPose, onDone?: () => void): void {
    this.run([{ pose, duration: ZOOM_DURATION, onDone }]);
  }

  returnToFloor(): void {
    this.run([{ pose: this.wing === null ? floorPose(this.floor) : wingPose(this.wing), duration: ZOOM_DURATION }]);
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
        this.wing = step.enter.wing ?? null;
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
