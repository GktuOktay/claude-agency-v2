// "Tanıtım turu" (KARARLAR Rev 43 package A): a cinematic camera tour of the campus. Pure of any renderer: the
// plan is a list of segments (eased Catmull-Rom glides through a few poses, plus one segment where the app
// follows a working robot), the player advances it frame by frame. Reduced motion: held shots and cuts.
import { CatmullRomCurve3, Vector3 } from 'three';
import { CAMERA_FOV, overviewPose, viewDirection } from './camera';
import { DESK_Z, WING, WORK_CENTER_X, floorY } from '../sim/layout';
import type { CampusKey } from '../ui/campusNav';

export interface TourPose {
  pos: Vector3;
  target: Vector3;
  fov: number;
}

/** The floor view a segment shows (tower floor or campus area); null = the whole campus (overview ghosting). */
export type TourView = { floor: number } | { campus: CampusKey } | null;

export type TourSegment =
  | { kind: 'path'; name: TourPlace; duration: number; view: TourView; poses: TourPose[] }
  | { kind: 'follow'; name: TourPlace; duration: number; view: TourView };

export const TOUR_PLACES = ['overview', 'lobby', 'engineering', 'rnd', 'meeting', 'gym', 'roof', 'follow', 'finale'] as const;
export type TourPlace = (typeof TOUR_PLACES)[number];

/** Lens of the interior shots. */
const SHOT_FOV = 36;

const orbitPose = (azDeg: number, elDeg: number, scale = 1): TourPose => {
  const o = overviewPose();
  const d = o.pos.distanceTo(o.target) * scale;
  return { pos: o.target.clone().add(viewDirection(azDeg, elDeg).multiplyScalar(d)), target: o.target.clone(), fov: o.fov ?? CAMERA_FOV };
};

const shot = (target: Vector3, azDeg: number, elDeg: number, d: number): TourPose => ({
  pos: target.clone().add(viewDirection(azDeg, elDeg).multiplyScalar(d)),
  target: target.clone(),
  fov: SHOT_FOV,
});

/** Two shots on one target: an establishing view, then a slow push in with a small turn. */
const place = (target: Vector3, a: readonly [number, number, number], b: readonly [number, number, number]): TourPose[] => [shot(target, ...a), shot(target, ...b)];

/** The tour (~69 s). Built when started, so the overview framing matches the current window. */
export function tourPlan(): TourSegment[] {
  const o = overviewPose();
  const end: TourPose = { pos: o.pos.clone(), target: o.target.clone(), fov: o.fov ?? CAMERA_FOV };
  return [
    { kind: 'path', name: 'overview', duration: 12, view: null, poses: [orbitPose(35, 35), orbitPose(8, 32), orbitPose(-18, 30), orbitPose(-42, 33, 0.92)] },
    { kind: 'path', name: 'lobby', duration: 7, view: { floor: 0 }, poses: place(new Vector3(0, floorY(0) + 0.8, 0.5), [-25, 42, 22], [5, 34, 14]) },
    { kind: 'path', name: 'engineering', duration: 7, view: { floor: 1 }, poses: place(new Vector3(WORK_CENTER_X, floorY(1) + 0.6, DESK_Z + 1.4), [25, 45, 16], [-5, 38, 11]) },
    { kind: 'path', name: 'rnd', duration: 7, view: { campus: 'wing-2' }, poses: place(new Vector3(WING.x, floorY(2) + 0.6, WING.z), [-30, 45, 18], [-5, 38, 12]) },
    { kind: 'path', name: 'meeting', duration: 7, view: { floor: 3 }, poses: place(new Vector3(1.2, floorY(3) + 0.5, 2.2), [30, 48, 12], [10, 40, 8]) },
    { kind: 'path', name: 'gym', duration: 7, view: { campus: 'wing-1' }, poses: place(new Vector3(WING.x, floorY(1) + 0.6, WING.z), [-10, 42, 16], [-35, 36, 12]) },
    { kind: 'path', name: 'roof', duration: 7, view: { campus: 'roof' }, poses: place(new Vector3(WING.x, floorY(3) + 0.4, WING.z), [20, 50, 22], [-15, 40, 15]) },
    { kind: 'follow', name: 'follow', duration: 6, view: { floor: 1 } },
    { kind: 'path', name: 'finale', duration: 9, view: null, poses: [orbitPose(12, 42, 1.12), end] },
  ];
}

export const tourTotal = (plan: readonly TourSegment[]): number => plan.reduce((a, s) => a + s.duration, 0);

/** Share of the finale over which the golden light comes in. */
const GOLDEN_RAMP = 0.5;

export interface TourFrame {
  /** Camera for this frame; null in a follow segment (the app drives the camera). */
  pose: TourPose | null;
  segment: TourSegment;
  /** 0..1 through the segment. */
  local: number;
  /** The segment started this frame (the app switches the floor view). */
  entered: boolean;
  /** 0..1 golden-hour light blend (finale only). */
  golden: number;
}

export interface TourPlayer {
  readonly done: boolean;
  update(dt: number, current: TourPose): TourFrame;
  stop(): void;
}

const ease = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

interface Glide {
  pos: CatmullRomCurve3;
  target: CatmullRomCurve3;
  fovs: number[];
}

export function createTourPlayer(plan: readonly TourSegment[], reduced: boolean): TourPlayer {
  let i = 0;
  let t = 0;
  let entered = true;
  let done = plan.length === 0;
  let glide: Glide | null = null;
  const fallback = plan[plan.length - 1];

  const begin = (seg: TourSegment, from: TourPose): void => {
    glide = null;
    if (seg.kind !== 'path' || reduced) return;
    const pts = [from, ...seg.poses];
    glide = {
      pos: new CatmullRomCurve3(pts.map((p) => p.pos.clone()), false, 'centripetal'),
      target: new CatmullRomCurve3(pts.map((p) => p.target.clone()), false, 'centripetal'),
      fovs: pts.map((p) => p.fov),
    };
  };

  const poseAt = (seg: TourSegment, local: number): TourPose | null => {
    if (seg.kind !== 'path') return null;
    const last = seg.poses[seg.poses.length - 1];
    if (!last) return null;
    if (local >= 1) return { pos: last.pos.clone(), target: last.target.clone(), fov: last.fov };
    if (reduced || !glide) {
      // Held shots: one cut per pose, evenly spaced through the segment.
      const p = seg.poses[Math.min(seg.poses.length - 1, Math.floor(local * seg.poses.length))] ?? last;
      return { pos: p.pos.clone(), target: p.target.clone(), fov: p.fov };
    }
    const s = ease(local);
    const n = glide.fovs.length - 1;
    const k = Math.min(n - 1, Math.floor(s * n));
    const f = s * n - k;
    const fov = (glide.fovs[k] ?? CAMERA_FOV) + ((glide.fovs[k + 1] ?? CAMERA_FOV) - (glide.fovs[k] ?? CAMERA_FOV)) * f;
    return { pos: glide.pos.getPoint(s), target: glide.target.getPoint(s), fov };
  };

  const golden = (seg: TourSegment, local: number): number => (seg.name === 'finale' ? Math.min(1, local / GOLDEN_RAMP) : 0);

  return {
    get done() {
      return done;
    },
    update(dt, current) {
      let seg = plan[i] ?? fallback;
      if (!seg) throw new Error('empty tour');
      if (done) return { pose: poseAt(seg, 1), segment: seg, local: 1, entered: false, golden: golden(seg, 1) };
      if (entered && t === 0) begin(seg, current);
      let wasEntered = entered;
      entered = false;
      t += Math.max(0, dt);
      // Carry the overshoot into the next segment(s).
      while (t >= seg.duration && i < plan.length - 1) {
        t -= seg.duration;
        i++;
        const from = poseAt(seg, 1) ?? current;
        seg = plan[i] ?? seg;
        begin(seg, from);
        wasEntered = true;
      }
      const local = Math.min(1, t / seg.duration);
      if (i === plan.length - 1 && local >= 1) done = true;
      return { pose: poseAt(seg, local), segment: seg, local, entered: wasEntered, golden: golden(seg, local) };
    },
    stop() {
      done = true;
    },
  };
}

/** URL switches for recording (Rev 43): `?tour=1` exposes `window.__tour`; `?film=1` also hides all UI and autostarts. */
export function tourParams(search: string): { hook: boolean; film: boolean } {
  const sp = new URLSearchParams(search);
  const film = sp.get('film') === '1';
  return { hook: film || sp.get('tour') === '1', film };
}

export interface TourHookApi {
  start(): void;
  onEnd(cb: () => void): void;
}

declare global {
  interface Window {
    /** Recording hook (Rev 43), present only with `?tour=1` / `?film=1`. */
    __tour?: unknown;
  }
}

/** Sets `__tour` on `win` only when the URL asked for it. */
export function installTourHook(win: { __tour?: unknown }, api: TourHookApi, params: { hook: boolean }): void {
  if (params.hook) win.__tour = api;
}
