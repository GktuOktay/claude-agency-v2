// Room life (KARARLAR Rev 39): the company's wider team ("ekip"), non-unit people who give every room life.
// Pure and seedable, no three.js. They are not units: never pickable, not in the unit list, cards or org lines.
// Each occupant is anchored at its own point (never an AMENITY_SPOT, >= 0.45 u from every spot, out of every
// aisle; tests/room-life-sim.test.ts) and plays a looping activity with a small local move. Presence follows
// the office schedule (src/sim/schedule.ts, read only): busier at the break slots, the cafeteria peaks at
// lunch, Ar-Ge ("the brain") is the busiest room, mostly empty after hours.
import { OFFICE_DAY, type OfficePeriod } from './schedule';
import { LOUNGE_AT, LOUNGE_COMPACT_AT, PENTHOUSE, PROP_AT, ROOF_GARDEN_FLOOR, wingX, type XZ } from './layout';

export type LifeRoom =
  | 'lobby'
  | 'yemekhane'
  | 'snack-bar'
  | 'terrace'
  | 'gym'
  | 'game-room'
  | 'rnd-lab'
  | 'sleep-pods'
  | 'archive'
  | 'lounge'
  | 'roof-garden'
  | 'roof-terrace'
  /** Film-only rooms (Rev 46, `?film=1`; src/film/staging.ts): never in LIFE_ROOMS or LIFE_ANCHORS. */
  | 'engineering'
  | 'penthouse';

export const LIFE_ROOMS: readonly LifeRoom[] = ['lobby', 'yemekhane', 'snack-bar', 'terrace', 'gym', 'game-room', 'rnd-lab', 'sleep-pods', 'archive', 'lounge', 'roof-garden', 'roof-terrace'];

export type LifeActivity =
  | 'run'
  | 'lift'
  | 'stretch'
  | 'coach'
  | 'pingpong'
  | 'foosball'
  | 'chat-low'
  | 'present'
  | 'watch'
  | 'whiteboard'
  | 'bench'
  | 'devices'
  | 'server'
  | 'discuss'
  | 'dine'
  | 'cook'
  | 'barista'
  | 'coffee'
  | 'talk'
  | 'read'
  | 'browse'
  | 'nap'
  | 'type'
  | 'visit';

/** stand: on the floor; sit: on a seat `seat` u high; low: bean bag; lie: on a recliner. */
export type LifePosture = 'stand' | 'sit' | 'low' | 'lie';
export type HeldProp = 'cup' | 'book' | 'tablet' | 'paddle' | 'dumbbell';
export type LifeOutfit = 'office' | 'gym' | 'chef' | 'smart';

/** Presence probability per office period. */
export type Profile = Readonly<Record<OfficePeriod, number>>;
export const PROFILES = {
  /** Staff on duty (cook, barista, receptionist): always in during office hours. */
  staff: { work: 1, coffee: 1, lunch: 1, tea: 1, after: 0 },
  /** Ar-Ge lead: in all day, often stays late. */
  core: { work: 1, coffee: 1, lunch: 1, tea: 1, after: 0.6 },
  lab: { work: 0.9, coffee: 0.6, lunch: 0.2, tea: 0.6, after: 0.1 },
  diner: { work: 0.1, coffee: 0.05, lunch: 1, tea: 0.05, after: 0 },
  leisure: { work: 0.3, coffee: 0.95, lunch: 0.6, tea: 0.95, after: 0.05 },
  /** One group per leisure room that is always there in office hours, so no room stands empty. */
  host: { work: 1, coffee: 1, lunch: 1, tea: 1, after: 0.05 },
  nap: { work: 0.3, coffee: 0.1, lunch: 0.5, tea: 0.1, after: 0 },
  visitor: { work: 0.8, coffee: 0.6, lunch: 0.3, tea: 0.6, after: 0 },
} as const satisfies Record<string, Profile>;
export type ProfileId = keyof typeof PROFILES;

export interface LifeAnchor extends XZ {
  readonly id: string;
  readonly room: LifeRoom;
  readonly floor: number;
  /** Yaw (yaw 0 faces +z, like the robots). */
  readonly facing: number;
  readonly activity: LifeActivity;
  readonly posture: LifePosture;
  /** Seat (or recliner) height above the floor surface. */
  readonly seat: number;
  readonly profile: ProfileId;
  /** Presence group: members of a pair arrive and leave together. */
  readonly group: string;
  /** Half amplitude of the local move along the person's left-right axis (0: in place). */
  readonly wander: number;
  readonly held: readonly HeldProp[];
  readonly outfit: LifeOutfit;
}

const S = 0;
const N = Math.PI;
const E = Math.PI / 2;
const W = -Math.PI / 2;

type Row = readonly [
  id: string,
  room: LifeRoom,
  floor: number,
  wing: boolean,
  x: number,
  z: number,
  facing: number,
  activity: LifeActivity,
  posture: LifePosture,
  seat: number,
  profile: ProfileId,
  group: string | null,
  wander: number,
  held: readonly HeldProp[],
  outfit: LifeOutfit,
];

const STOOL = 0.33;
const SOFA = 0.3;
const ROOF = ROOF_GARDEN_FLOOR;
const lounge = LOUNGE_AT;
const compact = LOUNGE_COMPACT_AT;

// Wing rows use wing-local x (layout.ts wingX); tower rows floor-local x. Placement notes per room are in
// the Rev 39 report; tests check every point against the real nav graphs.
const ROWS: readonly Row[] = [
  // ---- tower floor 0: lobby reception (receptionist and a visitor couple)
  ['receptionist', 'lobby', 0, false, PROP_AT.x, PROP_AT.z - 0.65, S, 'type', 'sit', SOFA, 'staff', null, 0, [], 'smart'],
  ['visitor-a', 'lobby', 0, false, PROP_AT.x - 0.85, PROP_AT.z + 0.55, N, 'visit', 'stand', 0, 'visitor', 'visitors', 0, [], 'smart'],
  ['visitor-b', 'lobby', 0, false, PROP_AT.x - 0.35, PROP_AT.z + 0.6, N, 'visit', 'stand', 0, 'visitor', 'visitors', 0, [], 'office'],
  // ---- wing level 0: cafeteria, snack bar, terrace
  ['cook', 'yemekhane', 0, true, -2.5, -4.2, S, 'cook', 'stand', 0, 'staff', null, 0.3, [], 'chef'],
  ['diner-1', 'yemekhane', 0, true, -3.05, -0.15, S, 'dine', 'sit', STOOL, 'diner', null, 0, [], 'office'],
  ['diner-2', 'yemekhane', 0, true, -1.55, -0.15, S, 'dine', 'sit', STOOL, 'diner', null, 0, [], 'office'],
  ['diner-3', 'yemekhane', 0, true, 3.05, -0.15, S, 'dine', 'sit', STOOL, 'diner', null, 0, [], 'smart'],
  ['diner-4', 'yemekhane', 0, true, -3.05, 2.85, S, 'dine', 'sit', STOOL, 'diner', null, 0, [], 'office'],
  ['diner-5', 'yemekhane', 0, true, 3.05, 2.85, S, 'dine', 'sit', STOOL, 'diner', null, 0, [], 'office'],
  ['diner-6', 'yemekhane', 0, true, 2.7, 4.75, N, 'dine', 'sit', STOOL, 'diner', null, 0, [], 'office'],
  ['barista', 'snack-bar', 0, true, 2.9, -3.9, S, 'barista', 'stand', 0, 'staff', null, 0.25, [], 'chef'],
  ['coffee-a', 'snack-bar', 0, true, 0.2, -2.6, E, 'coffee', 'stand', 0, 'leisure', 'coffee', 0, ['cup'], 'office'],
  ['coffee-b', 'snack-bar', 0, true, 0.75, -2.6, W, 'talk', 'stand', 0, 'leisure', 'coffee', 0, ['cup'], 'smart'],
  ['terrace-reader', 'terrace', 0, true, -2.8, 6.3, S, 'coffee', 'stand', 0, 'host', null, 0, ['cup'], 'office'],
  // ---- wing level 1: gym
  ['runner-a', 'gym', 1, true, 0.3, -4.0, N, 'run', 'stand', 0, 'leisure', null, 0, [], 'gym'],
  ['runner-b', 'gym', 1, true, 5.05, -4.0, N, 'run', 'stand', 0, 'leisure', null, 0, [], 'gym'],
  ['lifter-a', 'gym', 1, true, 1.05, -3.6, N, 'lift', 'stand', 0, 'leisure', null, 0, ['dumbbell'], 'gym'],
  ['lifter-b', 'gym', 1, true, 4.3, -3.45, N, 'lift', 'stand', 0, 'leisure', null, 0, ['dumbbell'], 'gym'],
  ['stretcher', 'gym', 1, true, -3.6, -1.8, S, 'stretch', 'stand', 0, 'leisure', null, 0, [], 'gym'],
  ['trainer', 'gym', 1, true, -2.3, -1.8, W, 'coach', 'stand', 0, 'host', null, 0.15, [], 'gym'],
  // ---- wing level 1: game room (own ping-pong table and foosball, two bean bags)
  ['pingpong-a', 'game-room', 1, true, 3.0, 0.5, S, 'pingpong', 'stand', 0, 'host', 'pingpong', 0.15, ['paddle'], 'office'],
  ['pingpong-b', 'game-room', 1, true, 3.0, 3.0, N, 'pingpong', 'stand', 0, 'host', 'pingpong', 0.15, ['paddle'], 'office'],
  ['foosball-a', 'game-room', 1, true, 4.4, 1.15, S, 'foosball', 'stand', 0, 'leisure', 'foosball', 0, [], 'office'],
  ['foosball-b', 'game-room', 1, true, 4.4, 2.45, N, 'foosball', 'stand', 0, 'leisure', 'foosball', 0, [], 'smart'],
  ['beanbag-a', 'game-room', 1, true, -4.95, 3.05, S, 'chat-low', 'low', 0.17, 'leisure', 'beanbag', 0, [], 'office'],
  ['beanbag-b', 'game-room', 1, true, -4.95, 4.25, N, 'chat-low', 'low', 0.17, 'leisure', 'beanbag', 0, [], 'office'],
  // ---- wing level 2: Ar-Ge, the brain (LED wall group, whiteboard, benches, device wall, GPU room, pods)
  ['lab-lead', 'rnd-lab', 2, true, 2.9, -4.45, S, 'present', 'stand', 0, 'core', null, 0.12, [], 'smart'],
  ['lab-watch-a', 'rnd-lab', 2, true, 1.7, -4.45, N, 'watch', 'stand', 0, 'lab', null, 0, [], 'office'],
  ['lab-watch-b', 'rnd-lab', 2, true, 4.1, -4.45, N, 'watch', 'stand', 0, 'lab', null, 0, ['tablet'], 'office'],
  ['lab-board-a', 'rnd-lab', 2, true, 0.2, -4.5, W, 'whiteboard', 'stand', 0, 'lab', 'board', 0, [], 'office'],
  ['lab-board-b', 'rnd-lab', 2, true, 0.2, -4.0, W, 'discuss', 'stand', 0, 'lab', 'board', 0, [], 'smart'],
  ['lab-bench-a', 'rnd-lab', 2, true, 5.2, -2.95, W, 'bench', 'stand', 0, 'lab', null, 0, [], 'office'],
  ['lab-bench-b', 'rnd-lab', 2, true, 0.35, -2.95, E, 'bench', 'stand', 0, 'lab', null, 0, [], 'office'],
  ['lab-devices', 'rnd-lab', 2, true, 4.65, 2.75, E, 'devices', 'stand', 0, 'lab', null, 0, ['tablet'], 'office'],
  ['lab-gpu', 'rnd-lab', 2, true, 4.6, 3.55, S, 'server', 'stand', 0, 'lab', null, 0.2, ['tablet'], 'office'],
  ['lab-pod-a', 'rnd-lab', 2, true, 1.9, 4.45, N, 'discuss', 'stand', 0, 'lab', null, 0, [], 'office'],
  ['lab-pod-b', 'rnd-lab', 2, true, 3.05, 4.45, N, 'discuss', 'stand', 0, 'lab', null, 0, [], 'smart'],
  // ---- wing level 2: nap recliner, archive
  ['napper', 'sleep-pods', 2, true, -2.95, -2.55, S, 'nap', 'lie', 0.3, 'nap', null, 0, [], 'office'],
  ['archivist', 'archive', 2, true, -2.4, 4.95, N, 'browse', 'stand', 0, 'host', null, 0.5, ['book'], 'office'],
  // ---- wing roof garden (floor-3 height) and the penthouse roof terrace
  ['roof-a', 'roof-garden', ROOF, true, -2.85, 1.2, S, 'read', 'sit', 0.29, 'host', null, 0, ['book'], 'office'],
  ['roof-b', 'roof-garden', ROOF, true, -2.15, 1.2, S, 'talk', 'sit', 0.29, 'leisure', null, 0, [], 'smart'],
  ['terrace-a', 'roof-terrace', PENTHOUSE, false, -1.0, 1.66, S, 'read', 'sit', SOFA, 'host', null, 0, ['book'], 'smart'],
  ['terrace-b', 'roof-terrace', PENTHOUSE, false, -0.3, 1.66, S, 'talk', 'sit', SOFA, 'leisure', null, 0, ['cup'], 'office'],
  // ---- tower lounges (floor 3 keeps the compact lounge)
  ['lounge-3', 'lounge', 3, false, compact.x - 0.36, compact.z - 0.49, S, 'read', 'sit', SOFA, 'leisure', null, 0, ['book'], 'office'],
  ['lounge-4a', 'lounge', 4, false, lounge.x - 0.36, lounge.z - 0.49, S, 'read', 'sit', SOFA, 'host', null, 0, ['book'], 'office'],
  ['lounge-4b', 'lounge', 4, false, lounge.x + 0.36, lounge.z - 0.49, S, 'coffee', 'sit', SOFA, 'leisure', null, 0, ['cup'], 'smart'],
];

export const LIFE_ANCHORS: readonly LifeAnchor[] = ROWS.map(([id, room, floor, wing, x, z, facing, activity, posture, seat, profile, group, wander, held, outfit]) => ({
  id: `life:${id}`,
  room,
  floor,
  x: wing ? wingX(x) : x,
  z,
  facing,
  activity,
  posture,
  seat,
  profile,
  group: group ?? id,
  wander,
  held,
  outfit,
}));

// ---------------------------------------------------------------- schedule (minutes -> period)

const hm = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Office period at `minutes` since 00:00 (the OFFICE_DAY table of schedule.ts). */
export function periodAtMinutes(minutes: number): OfficePeriod {
  const at = ((minutes % 1440) + 1440) % 1440;
  for (const d of OFFICE_DAY) {
    const span = (hm(d.to) - hm(d.from) + 1440) % 1440;
    if ((at - hm(d.from) + 1440) % 1440 < span) return d.period;
  }
  return 'after';
}

// ---------------------------------------------------------------- presence (pure)

/** Presence is re-rolled every WINDOW office minutes (and at every period change). */
export const PRESENCE_WINDOW_MIN = 20;

function hash(seed: number, text: string): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function isPresent(a: LifeAnchor, minutes: number, seed = 1): boolean {
  const period = periodAtMinutes(minutes);
  const p = PROFILES[a.profile][period];
  if (p >= 1) return true;
  if (p <= 0) return false;
  const win = Math.floor((((minutes % 1440) + 1440) % 1440) / PRESENCE_WINDOW_MIN);
  return hash(seed, `${a.group}|${period}|${win}`) < p;
}

/** People present per room at office time `minutes`. */
export function occupancyAt(minutes: number, seed = 1): Map<LifeRoom, number> {
  const out = new Map<LifeRoom, number>(LIFE_ROOMS.map((r) => [r, 0]));
  for (const a of LIFE_ANCHORS) if (isPresent(a, minutes, seed)) out.set(a.room, (out.get(a.room) ?? 0) + 1);
  return out;
}

/** Local move at phase k in [-1, 1]: along the person's left-right axis, `wander` at most. */
export function lifeOffset(a: Pick<LifeAnchor, 'facing' | 'wander'>, k: number): XZ {
  const d = a.wander * k;
  return { x: Math.cos(a.facing) * d, z: -Math.sin(a.facing) * d };
}

// ---------------------------------------------------------------- the sim

export interface LifeView {
  readonly id: string;
  readonly room: LifeRoom;
  readonly floor: number;
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  readonly activity: LifeActivity;
  readonly posture: LifePosture;
  readonly seat: number;
  /** Present now (target of the fade). */
  readonly present: boolean;
  /** 0..1 arrival fade (scale in the scene); 0 or 1 under reduced motion. */
  readonly appear: number;
  /** Animation time, seconds (0 and held under reduced motion). */
  readonly t: number;
}

export interface RoomLifeSimOptions {
  seed?: number;
  reducedMotion?: boolean;
  /** Office time at start ("HH:MM" or minutes since 00:00), default 12:00. */
  officeTime?: string | number;
  /** The occupants (default LIFE_ANCHORS; the film adds its staging crew, src/film/staging.ts). */
  anchors?: readonly LifeAnchor[];
}

export interface RoomLifeSim {
  readonly anchors: readonly LifeAnchor[];
  setOfficeTime(hhmm: string | number): void;
  /** Advances animation and fades; does nothing in org mode (frozen). */
  step(dtSeconds: number): void;
  setOrg(on: boolean): void;
  setReducedMotion(on: boolean): void;
  snapshot(): readonly LifeView[];
}

const FADE_PER_S = 2.5;

export function createRoomLifeSim(o: RoomLifeSimOptions = {}): RoomLifeSim {
  const seed = o.seed ?? 1;
  let reduced = o.reducedMotion ?? false;
  let org = false;
  const toMinutes = (v: string | number): number => (typeof v === 'number' ? v : hm(v));
  let minutes = toMinutes(o.officeTime ?? '12:00');
  const anchors = o.anchors ?? LIFE_ANCHORS;
  const state = anchors.map((a) => {
    const present = isPresent(a, minutes, seed);
    return { a, present, appear: present ? 1 : 0, t: hash(seed, `${a.id}|phase`) * 20, rate: 0.35 + hash(seed, `${a.id}|rate`) * 0.3 };
  });
  let views: LifeView[] = [];
  const build = (): void => {
    views = state.map((s) => {
      const a = s.a;
      const k = reduced ? 0 : Math.sin(s.t * s.rate * (a.activity === 'pingpong' ? 6 : 1));
      const off = lifeOffset(a, k);
      return {
        id: a.id,
        room: a.room,
        floor: a.floor,
        x: a.x + off.x,
        z: a.z + off.z,
        facing: a.facing,
        activity: a.activity,
        posture: a.posture,
        seat: a.seat,
        present: s.present,
        appear: s.appear,
        t: reduced ? 0 : s.t,
      };
    });
  };
  build();
  return {
    anchors,
    setOfficeTime(v) {
      minutes = toMinutes(v);
    },
    step(dtSeconds) {
      if (org) return;
      const dt = Math.max(0, dtSeconds);
      for (const s of state) {
        s.present = isPresent(s.a, minutes, seed);
        const target = s.present ? 1 : 0;
        if (reduced) s.appear = target;
        else s.appear = s.appear < target ? Math.min(target, s.appear + FADE_PER_S * dt) : Math.max(target, s.appear - FADE_PER_S * dt);
        if (!reduced) s.t += dt;
      }
      build();
    },
    setOrg(on) {
      org = on;
    },
    setReducedMotion(on) {
      reduced = on;
      if (on) for (const s of state) s.appear = s.present ? 1 : 0;
      build();
    },
    snapshot: () => views,
  };
}
