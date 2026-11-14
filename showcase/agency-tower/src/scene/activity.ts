// Activity state machine (REQ-11) and speech-bubble scheduler (REQ-21). Pure, seedable, no three.js.
import { createRng, range, type Rng } from './rng';
import { AMENITY_SPOTS, type AmenitySpot } from '../sim/layout';
import type { MovePhase, Target } from '../sim/movement';
import { NO_CAMPUS_BREAK, PING_PONG, POSE_OF, VENUE_KINDS, drawStay, pickWeighted, venueOf, venueWeights } from './breaks';

export const MAX_STEP_MS = 100;
export const WALK_SPEED = 1.2; // units per second
const MAX_STEP_S = MAX_STEP_MS / 1000;

export type ActivityKind = 'idle' | 'walk' | 'work' | 'coffee' | 'wave' | 'raise'; // raise: static wave (reduced motion)

// ---- Directed states (spec 0002 §7.5): a robot reserved by a workflow step leaves the cycle above.
export const DIRECTED_STATES = [
  'step-walk', 'carry-walk', 'handover', 'wait', 'escort-wait', 'call-hold', 'room-wait', 'call', 'call-wait', 'ride',
  'seat-wait', 'seated', 'present', 'pair', 'build', 'review', 'test', 'stamp-raise', 'stamp-press', 'step-work', 'called',
] as const;
export type DirectedKind = (typeof DIRECTED_STATES)[number];
/** §7.5: the hourglass waiting marker is shown exactly in these states. */
export const WAITING_STATES: ReadonlySet<DirectedKind> = new Set<DirectedKind>(['wait', 'escort-wait', 'call-hold', 'room-wait', 'call-wait', 'seat-wait']);
export const isWaiting = (s: string): boolean => (WAITING_STATES as ReadonlySet<string>).has(s);
/** Campus break poses (KARARLAR rev 31): treadmill, weights, ping-pong, nap pod, meal, games, lab/archive. */
export type BreakPose = 'run' | 'lift' | 'paddle' | 'sleep' | 'eat' | 'play' | 'read';
/** Pose vocabulary: the ambient kinds, the static step gestures (hand over, stamp press, sit still), break poses. */
export type PoseKind = ActivityKind | 'reach' | 'press' | 'sit' | BreakPose;
type Stay = 'idle' | 'work' | 'coffee';
type WalkTarget = 'desk' | 'coffee' | 'home';

const DURATIONS: Record<Stay, [number, number]> = {
  idle: [3, 8],
  work: [10, 30],
  coffee: [6, 12],
};

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface ActivitySpec {
  id: string;
  home: Point;
  work: Point;
  coffee: Point;
}

export interface ActivityView {
  kind: ActivityKind; // 'wave' while selected, otherwise the cycle state (a campus break reports walk / coffee)
  /** Set only on a campus break (KARARLAR rev 31): the pose to render instead of `kind`. */
  pose?: PoseKind;
  x: number;
  y: number;
  z: number;
  facing: number; // yaw: robot front is +z
  walkPhase: number; // grows while walking, drives limb swing
  elapsed: number;
}

export interface SimEvent {
  id: string;
  from: Exclude<ActivityKind, 'wave' | 'raise'>;
  to: Exclude<ActivityKind, 'wave' | 'raise'>;
  time: number;
  duration: number; // time spent in `from`
  distance: number; // for walk: path length
}

interface Internal {
  spec: ActivitySpec;
  kind: Exclude<ActivityKind, 'wave' | 'raise'>;
  pos: Point;
  facing: number;
  elapsed: number;
  limit: number; // seconds for idle/work/coffee
  target: WalkTarget;
  targetPoint: Point;
  walkLength: number;
  walkPhase: number;
  waving: boolean;
  /** Reserved by a workflow step (spec 0002): the cycle holds until `resume`. */
  reserved: boolean;
  /** Campus break in progress (walk there, stay, walk back), driven through the nav movement. */
  brk: Break | null;
}

interface Break {
  spot: AmenitySpot;
  phase: 'go' | 'stay' | 'back';
  /** Ping-pong mate (both play only while both stand at the table). */
  partner: string | null;
  /** Last rendered position, for facing and walk phase. */
  last: Point;
}

/** Movement subset a campus break walks through (the workflow's nav movement in the app). */
export interface BreakMovement {
  moveTo(unit: string, target: Target): void;
  isAt(unit: string, target: Target): boolean;
  phase(unit: string): MovePhase;
  /** Floor-local x/z, y = floor or cabin height; `reduced`: the current leg's start (leg cuts, REQ-19). */
  renderPosition(unit: string, reduced: boolean): Point;
}

export interface CampusBreakOptions {
  movement: BreakMovement;
  /** Home floor per robot (home target `home:<id>`). */
  floors: ReadonlyMap<string, number>;
  /** Lunch phase of the day: the cafeteria is open. Default never. */
  isLunch?: () => boolean;
  /** Global pause (0002 §7.8 clock reasons): break robots hold, no break starts. Default never. */
  paused?: () => boolean;
  /** May a new break trip use the staff elevator now (e.g. its queue is empty)? Default yes. */
  canRide?: () => boolean;
  /** Most robots away from their home floor on a break at once (default MAX_AWAY_BREAKS). */
  maxAway?: number;
  /** Chance that a coffee break goes to the campus instead (default 0.4). */
  chance?: number;
}

export interface ActivityOptions {
  /** Campus breaks; off (null / absent) keeps the 0001 coffee cycle exactly. */
  campus?: CampusBreakOptions | null;
}

/** Most robots away from their home floor on a campus break at once (elevator and job latency). */
export const MAX_AWAY_BREAKS = 1;
/** Longest wait at the ping-pong table for the mate. */
export const MATE_WAIT_S = 90;
const CAMPUS_SEED_SALT = 0x5eed;

export interface ActivitySim {
  time: number;
  step(dtMs: number): void;
  get(id: string): ActivityView;
  drainEvents(): SimEvent[];
  select(id: string): void;
  release(id: string): void;
  faceToward(id: string, x: number, z: number): void;
  /** Reduced motion: walkers settle at their target, nothing moves, selection raises an arm (no wave). */
  setStatic(on: boolean): void;
  /** §7.5 interrupt: a step reserved the robot; its cycle stops where it is (the director moves it). */
  reserve(id: string): void;
  /** §7.5 return: the robot is back at its home point; it idles there for a newly drawn idle duration. */
  resume(id: string): void;
  isReserved(id: string): boolean;
  /** The amenity spot of a robot on a campus break (walking there, staying or walking back), else null. */
  onBreak(id: string): AmenitySpot | null;
}

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.z - a.z);

export function createActivitySim(specs: readonly ActivitySpec[], seed: number, options: ActivityOptions = {}): ActivitySim {
  const rng: Rng = createRng(seed);
  const campus = options.campus ?? null;
  // Break choices draw from their own stream, so the coffee cycle's draws are untouched by them.
  const brng: Rng = createRng((seed ^ CAMPUS_SEED_SALT) >>> 0);
  const events: SimEvent[] = [];
  const robots = new Map<string, Internal>();
  let frozen = false;

  // Upper bound is reduced by one maximal step so an elapsed period never exceeds its range.
  const draw = (kind: Stay): number => range(rng, DURATIONS[kind][0], DURATIONS[kind][1] - MAX_STEP_S);

  for (const spec of specs) {
    robots.set(spec.id, {
      spec,
      kind: 'idle',
      pos: { ...spec.home },
      facing: 0,
      elapsed: 0,
      limit: draw('idle'),
      target: 'home',
      targetPoint: spec.home,
      walkLength: 0,
      walkPhase: 0,
      waving: false,
      reserved: false,
      brk: null,
    });
  }

  const pointFor = (r: Internal, t: WalkTarget): Point => (t === 'desk' ? r.spec.work : t === 'coffee' ? r.spec.coffee : r.spec.home);

  const change = (r: Internal, to: Internal['kind'], time: number): void => {
    events.push({ id: r.spec.id, from: r.kind, to, time, duration: r.elapsed, distance: r.walkLength });
    r.kind = to;
    r.elapsed = 0;
  };

  const startWalk = (r: Internal, t: WalkTarget, time: number): void => {
    r.target = t;
    r.targetPoint = pointFor(r, t);
    r.walkLength = dist(r.pos, r.targetPoint);
    change(r, 'walk', time);
  };

  // ---------------------------------------------------------------- campus breaks (KARARLAR rev 31)
  const homeTarget = (id: string): Target => ({ floor: campus?.floors.get(id) ?? 0, spot: `home:${id}` });
  const spotTarget = (s: AmenitySpot): Target => ({ floor: s.floor, spot: s.id });
  const awayOf = (r: Internal): boolean => r.brk !== null && r.brk.spot.floor !== campus?.floors.get(r.spec.id);
  const held = (): Set<string> => {
    const out = new Set<string>();
    for (const r of robots.values()) if (r.brk) out.add(r.brk.spot.id);
    return out;
  };
  /** Free, at home and idle: can start a campus break now. */
  const breakable = (r: Internal, mv: BreakMovement): boolean =>
    !r.reserved && !r.waving && !r.brk && r.kind === 'idle' && !NO_CAMPUS_BREAK.has(r.spec.id) && campus?.floors.has(r.spec.id) === true && mv.isAt(r.spec.id, homeTarget(r.spec.id));
  /** A trip off the home floor needs room under MAX_AWAY_BREAKS (`extra` already planned) and the cabin. */
  const awayOk = (r: Internal, s: AmenitySpot, extra = 0): boolean => {
    if (s.floor === campus?.floors.get(r.spec.id)) return true;
    let away = extra;
    for (const v of robots.values()) if (awayOf(v)) away++;
    return away < (campus?.maxAway ?? MAX_AWAY_BREAKS) && (campus?.canRide?.() ?? true);
  };

  function beginBreak(r: Internal, s: AmenitySpot, partner: string | null, mv: BreakMovement, time: number): void {
    const p = mv.renderPosition(r.spec.id, frozen);
    r.brk = { spot: s, phase: 'go', partner, last: { ...p } };
    mv.moveTo(r.spec.id, spotTarget(s));
    r.target = 'home';
    r.targetPoint = r.spec.home;
    r.walkLength = 0;
    change(r, 'walk', time);
  }

  /** Tries a campus break for a robot whose idle period ended with a coffee choice; true if one started. */
  function tryBreak(r: Internal, time: number): boolean {
    if (!campus) return false;
    const mv = campus.movement;
    if (!breakable(r, mv)) return false;
    if (!(brng() < (campus.chance ?? 0.4))) return false;
    const venue = pickWeighted(brng, venueWeights(r.spec.id, campus.isLunch?.() ?? false));
    if (!venue) return false;
    const taken = held();
    const free = AMENITY_SPOTS.filter((s) => VENUE_KINDS[venue].includes(s.kind) && !taken.has(s.id) && awayOk(r, s));
    // Ping-pong needs a second free robot and both table ends.
    const pp = PING_PONG.filter((s) => !taken.has(s.id));
    const mates = [...robots.values()].filter((v) => v !== r && breakable(v, mv));
    const usable = free.filter((s) => s.kind !== 'ping-pong' || (pp.length === 2 && mates.length > 0));
    const spot = usable[Math.floor(brng() * usable.length)];
    if (!spot) return false;
    if (spot.kind === 'ping-pong') {
      const other = PING_PONG.find((s) => s.id !== spot.id);
      const planned = spot.floor !== campus.floors.get(r.spec.id) ? 1 : 0;
      const okAll = other ? mates.filter((m) => awayOk(m, other, planned)) : [];
      const near = okAll.filter((m) => campus.floors.get(m.spec.id) === spot.floor);
      const okMates = near.length ? near : okAll;
      const mate = okMates[Math.floor(brng() * okMates.length)];
      if (!other || !mate) return false;
      beginBreak(r, spot, mate.spec.id, mv, time);
      beginBreak(mate, other, r.spec.id, mv, time);
      return true;
    }
    beginBreak(r, spot, null, mv, time);
    return true;
  }

  const mateOf = (r: Internal): Internal | null => {
    const id = r.brk?.partner;
    const m = id ? robots.get(id) : undefined;
    return m && m.brk && m.brk.partner === r.spec.id ? m : null;
  };

  function leaveBreak(r: Internal, mv: BreakMovement, time: number): void {
    if (!r.brk) return;
    r.brk.phase = 'back';
    r.brk.partner = null;
    mv.moveTo(r.spec.id, homeTarget(r.spec.id));
    change(r, 'walk', time);
  }

  /** One step of a robot on a campus break; `timers` false under reduced motion (arrivals only). */
  function stepBreak(r: Internal, dt: number, timers: boolean): void {
    const b = r.brk;
    if (!b || !campus) return;
    const mv = campus.movement;
    const id = r.spec.id;
    const p = mv.renderPosition(id, frozen);
    const dx = p.x - b.last.x;
    const dz = p.z - b.last.z;
    if (Math.hypot(dx, dz) > 1e-5) {
      r.facing = Math.atan2(dx, dz);
      r.walkPhase += dt * 6;
    }
    b.last = { ...p };
    r.pos = { ...p };
    if (timers) r.elapsed += dt;
    if (b.phase === 'go') {
      if (mv.isAt(id, spotTarget(b.spot))) {
        change(r, 'coffee', sim.time);
        const venue = venueOf(b.spot.kind) ?? 'snack';
        const mate = mateOf(r);
        // Ping-pong mates share one game length.
        r.limit = mate && mate.brk?.phase === 'stay' ? mate.limit : drawStay(brng, venue);
        if (mate && mate.brk?.phase === 'go') mate.limit = r.limit;
        b.phase = 'stay';
        r.facing = b.spot.facing;
      } else if (b.partner !== null && !mateOf(r) && timers) leaveBreak(r, mv, sim.time);
    } else if (b.phase === 'stay') {
      r.facing = b.spot.facing;
      if (!timers) return;
      // Ping-pong: the game clock waits for the mate (at most MATE_WAIT_S), then both share one length.
      const mate = mateOf(r);
      if (mate && mate.brk?.phase !== 'stay') {
        if (r.elapsed < MATE_WAIT_S) r.limit += dt;
        else leaveBreak(r, mv, sim.time);
        return;
      }
      if (r.elapsed >= r.limit || (b.partner !== null && !mateOf(r))) leaveBreak(r, mv, sim.time);
    } else if (mv.isAt(id, homeTarget(id))) {
      r.brk = null;
      r.pos = { ...r.spec.home };
      change(r, 'idle', sim.time);
      r.limit = draw('idle');
      r.facing = 0;
    }
  }

  function breakPose(r: Internal): PoseKind | undefined {
    const b = r.brk;
    if (!b || !campus) return undefined;
    if (b.phase === 'stay') {
      if (b.spot.kind === 'ping-pong') return mateOf(r)?.brk?.phase === 'stay' ? 'paddle' : 'idle';
      return POSE_OF[b.spot.kind];
    }
    const ph = campus.movement.phase(r.spec.id);
    if (ph === 'walk') return 'walk';
    if (ph === 'call') return 'press';
    return 'idle';
  }

  const sim: ActivitySim = {
    time: 0,
    step(dtMs) {
      const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS) / 1000;
      const paused = campus?.paused?.() ?? false;
      if (frozen) {
        // Reduced motion: the cycle stands still; break walkers finish their nav legs (shown as leg cuts).
        if (campus && !paused) for (const r of robots.values()) if (r.brk && !r.reserved && !r.waving) stepBreak(r, dt, false);
        return;
      }
      sim.time += dt;
      for (const r of robots.values()) {
        if (r.waving || r.reserved) continue;
        if (r.brk) {
          if (!paused) stepBreak(r, dt, true);
          continue;
        }
        r.elapsed += dt;
        if (r.kind === 'walk') {
          const remaining = dist(r.pos, r.targetPoint);
          const move = WALK_SPEED * dt;
          r.walkPhase += dt * 6;
          if (remaining > 0.0001) r.facing = Math.atan2(r.targetPoint.x - r.pos.x, r.targetPoint.z - r.pos.z);
          if (move >= remaining) {
            r.pos = { ...r.targetPoint };
            const arrived = r.target;
            // Walk ends on the first step that reaches the target.
            if (arrived === 'desk') {
              change(r, 'work', sim.time);
              r.limit = draw('work');
              r.facing = Math.PI;
            } else if (arrived === 'coffee') {
              change(r, 'coffee', sim.time);
              r.limit = draw('coffee');
              r.facing = Math.PI;
            } else {
              change(r, 'idle', sim.time);
              r.limit = draw('idle');
              r.facing = 0;
            }
          } else {
            r.pos = { x: r.pos.x + ((r.targetPoint.x - r.pos.x) / remaining) * move, y: r.pos.y, z: r.pos.z + ((r.targetPoint.z - r.pos.z) / remaining) * move };
          }
        } else if (r.elapsed >= r.limit) {
          if (r.kind === 'idle') {
            const to: WalkTarget = rng() < 0.5 ? 'desk' : 'coffee';
            if (!(to === 'coffee' && !paused && tryBreak(r, sim.time))) startWalk(r, to, sim.time);
          } else startWalk(r, 'home', sim.time);
        }
      }
    },
    get(id) {
      const r = robots.get(id);
      if (!r) throw new Error(`unknown robot ${id}`);
      const kind: ActivityKind = r.waving ? (frozen ? 'raise' : 'wave') : r.kind;
      if (r.brk && campus && !r.reserved) {
        // Live from the nav movement (it steps after this sim in a frame); the selection gesture wins the pose.
        const p = campus.movement.renderPosition(id, frozen);
        const pose = r.waving ? undefined : breakPose(r);
        return { kind, ...(pose ? { pose } : {}), x: p.x, y: p.y, z: p.z, facing: r.facing, walkPhase: r.walkPhase, elapsed: r.elapsed };
      }
      return { kind, x: r.pos.x, y: r.pos.y, z: r.pos.z, facing: r.facing, walkPhase: r.walkPhase, elapsed: r.elapsed };
    },
    drainEvents() {
      return events.splice(0, events.length);
    },
    select(id) {
      const r = robots.get(id);
      if (r) r.waving = true;
    },
    release(id) {
      const r = robots.get(id);
      if (r) r.waving = false;
    },
    setStatic(on) {
      frozen = on;
      if (!on) return;
      for (const r of robots.values()) {
        if (r.kind !== 'walk' || r.reserved || r.brk) continue; // break walkers follow the nav movement
        r.pos = { ...r.targetPoint };
        const to = r.target === 'desk' ? 'work' : r.target === 'coffee' ? 'coffee' : 'idle';
        change(r, to, sim.time);
        r.limit = draw(to);
        r.facing = to === 'idle' ? 0 : Math.PI;
      }
    },
    reserve(id) {
      const r = robots.get(id);
      if (!r) return;
      // §7.5 interrupt: the break ends here; the engine re-paths the robot from where it is (no moveTo here).
      r.reserved = true;
      r.brk = null;
    },
    resume(id) {
      const r = robots.get(id);
      if (!r || !r.reserved) return;
      r.reserved = false;
      r.brk = null;
      r.pos = { ...r.spec.home };
      r.kind = 'idle';
      r.elapsed = 0;
      r.limit = draw('idle');
      r.target = 'home';
      r.targetPoint = r.spec.home;
      r.walkLength = 0;
      r.facing = 0;
    },
    isReserved(id) {
      return robots.get(id)?.reserved ?? false;
    },
    onBreak(id) {
      return robots.get(id)?.brk?.spot ?? null;
    },
    faceToward(id, x, z) {
      const r = robots.get(id);
      if (r) r.facing = Math.atan2(x - r.pos.x, z - r.pos.z);
    },
  };
  return sim;
}

// ---- Speech bubbles ----

export interface BubbleSource {
  id: string;
  phrases: readonly string[];
}

export interface Bubble {
  id: number;
  unitId: string;
  text: string;
  remaining: number;
}

export const MAX_BUBBLES = 4;

export interface BubbleScheduler {
  step(dtSeconds: number): readonly Bubble[];
}

export function createBubbleScheduler(sources: readonly BubbleSource[], rng: Rng): BubbleScheduler {
  let active: Bubble[] = [];
  let nextId = 1;
  let timer = range(rng, 0.5, 2);

  return {
    step(dt) {
      active = active.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0);
      timer -= dt;
      if (timer <= 0) {
        if (active.length < MAX_BUBBLES && sources.length) {
          const free = sources.filter((s) => !active.some((b) => b.unitId === s.id) && s.phrases.length > 0);
          const pool = free.length ? free : sources;
          const src = pool[Math.floor(rng() * pool.length)];
          const text = src?.phrases[Math.floor(rng() * src.phrases.length)];
          if (src && text !== undefined) {
            active.push({ id: nextId++, unitId: src.id, text, remaining: range(rng, 3, 4.9) });
          }
          timer = range(rng, 1, 5);
        } else {
          timer = 0.5;
        }
      }
      return active;
    },
  };
}
