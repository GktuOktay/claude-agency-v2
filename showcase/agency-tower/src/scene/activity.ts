// Activity state machine (REQ-11) and speech-bubble scheduler (REQ-21). Pure, seedable, no three.js.
import { createRng, range, type Rng } from './rng';
import { AMENITY_SPOTS, type AmenitySpot } from '../sim/layout';
import type { MovePhase, Target } from '../sim/movement';
import type { OfficePeriod } from '../sim/schedule';
import { NO_CAMPUS_BREAK, OCCUPANCY_LUNCH, OCCUPANCY_MORNING, OCCUPANCY_SLOT, OCCUPANCY_WORK, PING_PONG, PODS_TICK_CHANCE, POSE_OF, ROTATE_REST_S, ZONE_STAY_S, drawStay, inVenue, pickWeighted, slotVenueWeights, venueOfSpot, venueWeights, zoneRank, type SlotKind } from './breaks';
import type { AmenityZoneId } from '../sim/layout';

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
/**
 * Object poses (KARARLAR Rev 43 B, src/scene/actions.ts): pouring at the machine, sipping, walking with a cup,
 * a tray or a phone, a mat stretch, whiteboard writing, a chat, a desk stretch, sipping tea while typing.
 */
export type ActionPose =
  | 'pour'
  | 'sip'
  | 'cup-walk'
  | 'cup-stand'
  | 'tray-walk'
  | 'tray-stand'
  | 'phone-walk'
  | 'phone-stand'
  | 'stretch'
  | 'write'
  | 'chat'
  | 'arms-up'
  | 'work-sip';
/** Pose vocabulary: the ambient kinds, the static step gestures (hand over, stamp press, sit still), break poses. */
export type PoseKind = ActivityKind | 'reach' | 'press' | 'sit' | BreakPose | ActionPose;
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
  /** Start of the current ambient walk leg (reduced motion renders here until the leg ends, REQ-19). */
  walkFrom: Point;
  walkPhase: number;
  waving: boolean;
  /** Reserved by a workflow step (spec 0002): the cycle holds until `resume`. */
  reserved: boolean;
  /** Campus break in progress (walk there, stay, walk back), driven through the nav movement. */
  brk: Break | null;
  /** Joins the current schedule slot's break (Rev 35): drawn once at the slot start. */
  join: boolean;
  /** Simulation time the last campus break ended (Rev 39 rotation). */
  backAt: number;
  /** Occupancy director sessions taken (Rev 39 rotation: fewest first). */
  visits: number;
  /** Rev 39: the director picked this robot for a zone; it finishes its desk or coffee stay and goes. */
  summon: AmenityZoneId | null;
}

export type BreakPhase = 'go' | 'stay' | 'back';

interface Break {
  spot: AmenitySpot;
  /** Schedule slot the break was taken in (Rev 35), if any. */
  slot: SlotKind | null;
  phase: BreakPhase;
  /** Ping-pong mate (both play only while both stand at the table). */
  partner: string | null;
  /** Last rendered position, for facing and walk phase. */
  last: Point;
  /** Occupancy director session (Rev 39): its stay length, seconds. */
  stay?: number;
}

/** Movement subset a campus break walks through (the workflow's nav movement in the app). */
export interface BreakMovement {
  moveTo(unit: string, target: Target): void;
  isAt(unit: string, target: Target): boolean;
  phase(unit: string): MovePhase;
  /** Floor-local x/z, y = floor or cabin height; `reduced`: the current leg's start (leg cuts, REQ-19). */
  renderPosition(unit: string, reduced: boolean): Point;
  /** Callers on `floor` waiting for a free landing waiting spot (elevator backlog not yet in the call queue). */
  awaitingSpot?(floor: number): number;
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
  /** Chance that a coffee break goes to the campus instead (default 0.4; with `period`, outside slots OFF_SLOT_CHANCE). */
  chance?: number;
  /**
   * Office schedule period (Rev 35, src/sim/schedule.ts). When given, breaks follow it: at a coffee / tea / lunch
   * slot start each free robot joins the break with JOIN_CHANCE; outside the slots breaks stay rare; after hours
   * no campus break starts and most robots stay idle at home. Absent: the Rev 31 behaviour.
   */
  period?: () => OfficePeriod;
  /** Units that never take campus breaks (default NO_CAMPUS_BREAK, the CEO). Rev 35 app: none. */
  exclude?: ReadonlySet<string>;
  /**
   * Occupancy director (Rev 39, needs `period`): in work hours (and at lunch) every zone in OCCUPANCY_WORK
   * (OCCUPANCY_LUNCH) keeps its target of robots, rotating free ambient robots through it. Default off.
   */
  occupancy?: boolean;
  /** The `period` this many seconds later (director: the lab crew arrives before the morning starts). */
  periodAhead?: (seconds: number) => OfficePeriod;
  /**
   * Rev 44 break button (src/sim/breakOverride.ts; `period` already reads the override): `break` makes every free
   * robot join, `work` calls every robot back from its break to the desk and pauses the occupancy director.
   */
  override?: () => 'break' | 'work' | null;
}

export interface ActivityOptions {
  /** Campus breaks; off (null / absent) keeps the 0001 coffee cycle exactly. */
  campus?: CampusBreakOptions | null;
}

/** Most robots away from their home floor on a campus break at once (elevator and job latency). */
export const MAX_AWAY_BREAKS = 1;
/** Rev 35 app: social areas for everyone, many robots away at once (the elevator gate still spaces trips). */
export const SOCIAL_MAX_AWAY = 14;
/** Rev 35 app elevator gate: a new off-floor break trip starts only while fewer calls than this wait (job calls queue behind at most this many). */
export const BREAK_QUEUE_MAX = 2;
/** Chance a free robot joins a schedule slot's break, drawn once per robot at the slot start. */
export const JOIN_CHANCE: Readonly<Record<SlotKind, number>> = { coffee: 0.7, tea: 0.7, lunch: 0.85 };
/** Outside the slots (work hours) a coffee choice goes to the campus this rarely. */
export const OFF_SLOT_CHANCE = 0.05;
/** After hours an idle robot stays idle at home this often instead of walking to its desk or the coffee. */
export const AFTER_HOURS_STAY = 0.9;
/** A meal at the cafeteria or on the terrace during the lunch slot lasts longer, seconds [min, max). */
export const LUNCH_STAY_S: readonly [number, number] = [50, 75];
/** Longest wait at the ping-pong table for the mate. */
export const MATE_WAIT_S = 90;
const CAMPUS_SEED_SALT = 0x5eed;
/** Occupancy director (Rev 39) re-checks the zone targets this often, simulation seconds. */
export const DIRECTOR_TICK_S = 1;
/** A stay ending within this many seconds is relieved early (the relief's trip overlaps the stay's end). */
export const RELIEF_LEAD_S = 45;
/** Rev 44: longest overstay of a zone's last robot waiting for its relief (hand-over), seconds. */
export const RELIEF_WAIT_S = 60;
/** The lab crew leaves home this many seconds before the break logic's morning (a wing trip takes 15–90 s). */
export const MORNING_LEAD_S = 30;

export interface AppCampusInput {
  movement: BreakMovement;
  floors: ReadonlyMap<string, number>;
  period: () => OfficePeriod;
  /** `period` this many seconds later. */
  periodAhead?: (seconds: number) => OfficePeriod;
  /** Calls waiting at the staff elevator now. */
  queued: () => number;
  paused?: () => boolean;
  /** Rev 39 occupancy director (default on). */
  occupancy?: boolean;
  /** Rev 44 break button override. */
  override?: () => 'break' | 'work' | null;
}

/** The app's campus options (Rev 35/38/39), shared by the page and the liveness/occupancy tests. */
export function appCampusOptions(i: AppCampusInput): CampusBreakOptions {
  return {
    movement: i.movement,
    floors: i.floors,
    period: i.period,
    ...(i.paused ? { paused: i.paused } : {}),
    ...(i.periodAhead ? { periodAhead: i.periodAhead } : {}),
    ...(i.override ? { override: i.override } : {}),
    canRide: () => i.queued() < BREAK_QUEUE_MAX,
    exclude: new Set<string>(),
    maxAway: SOCIAL_MAX_AWAY,
    occupancy: i.occupancy ?? true,
  };
}

export interface ActivitySim {
  time: number;
  step(dtMs: number): void;
  get(id: string): ActivityView;
  drainEvents(): SimEvent[];
  select(id: string): void;
  release(id: string): void;
  faceToward(id: string, x: number, z: number): void;
  /**
   * Reduced motion (0002 REQ-19): rendering only. The simulation keeps its time, events and draws exactly as
   * without it; `get` renders every walker at its leg start until the leg ends, never in a walk or wave pose.
   */
  setStatic(on: boolean): void;
  /** §7.5 interrupt: a step reserved the robot; its cycle stops where it is (the director moves it). */
  reserve(id: string): void;
  /** §7.5 return: the robot is back at its home point; it idles there for a newly drawn idle duration. */
  resume(id: string): void;
  isReserved(id: string): boolean;
  /** The amenity spot of a robot on a campus break (walking there, staying or walking back), else null. */
  onBreak(id: string): AmenitySpot | null;
  /** Phase of a campus break (walking there, staying, walking back), else null. */
  breakPhase(id: string): BreakPhase | null;
}

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.z - a.z);

export function createActivitySim(specs: readonly ActivitySpec[], seed: number, options: ActivityOptions = {}): ActivitySim {
  const rng: Rng = createRng(seed);
  const campus = options.campus ?? null;
  // Break choices draw from their own stream, so the coffee cycle's draws are untouched by them.
  const brng: Rng = createRng((seed ^ CAMPUS_SEED_SALT) >>> 0);
  const events: SimEvent[] = [];
  const robots = new Map<string, Internal>();
  /** Reduced motion is a render flag only: `step` never reads it (trace identical, AC-16). */
  let reduced = false;
  /** Office period seen in the previous step (slot start / end detection). */
  let lastPeriod: OfficePeriod | undefined;
  /** Rev 44: the current "Molayı bitir" recall has been carried out (once, when not paused). */
  let recalled = false;

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
      walkFrom: { ...spec.home },
      walkPhase: 0,
      waving: false,
      reserved: false,
      brk: null,
      join: false,
      backAt: -Infinity,
      visits: 0,
      summon: null,
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
    r.walkFrom = { ...r.pos };
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
  const excluded = campus?.exclude ?? NO_CAMPUS_BREAK;
  const breakable = (r: Internal, mv: BreakMovement): boolean =>
    !r.reserved && !r.waving && !r.brk && r.kind === 'idle' && !excluded.has(r.spec.id) && campus?.floors.has(r.spec.id) === true && mv.isAt(r.spec.id, homeTarget(r.spec.id));
  /** A trip off the home floor needs room under MAX_AWAY_BREAKS (`extra` already planned) and the cabin. */
  const awayOk = (r: Internal, s: AmenitySpot, extra = 0): boolean => {
    const home = campus?.floors.get(r.spec.id);
    if (s.floor === home) return true;
    let away = extra;
    for (const v of robots.values()) if (awayOf(v)) away++;
    // Callers held at their desks for a free waiting spot are elevator backlog too: no new trip from that landing.
    const backlog = home !== undefined ? (campus?.movement.awaitingSpot?.(home) ?? 0) : 0;
    return away < (campus?.maxAway ?? MAX_AWAY_BREAKS) && (campus?.canRide?.() ?? true) && backlog === 0;
  };

  function beginBreak(r: Internal, s: AmenitySpot, partner: string | null, mv: BreakMovement, time: number, slot: SlotKind | null = null): void {
    const p = mv.renderPosition(r.spec.id, false);
    r.brk = { spot: s, slot, phase: 'go', partner, last: { ...p } };
    r.join = false;
    mv.moveTo(r.spec.id, spotTarget(s));
    r.target = 'home';
    r.targetPoint = r.spec.home;
    r.walkLength = 0;
    change(r, 'walk', time);
  }

  /**
   * Tries a campus break; true if one started. Without `slot`: a robot whose idle period ended with a coffee
   * choice, gated by the campus chance. With `slot` (Rev 35): a robot joining a schedule slot's break (no chance
   * gate); the `station` choice sends it to the floor coffee station instead.
   */
  function tryBreak(r: Internal, time: number, slot?: SlotKind): boolean {
    if (!campus) return false;
    const mv = campus.movement;
    if (!breakable(r, mv)) return false;
    let venue: ReturnType<typeof slotVenueWeights>[number][0] | null;
    if (slot) {
      venue = pickWeighted(brng, slotVenueWeights(r.spec.id, slot));
      if (venue === 'station') {
        r.join = false;
        startWalk(r, 'coffee', time);
        return true;
      }
    } else {
      const p = campus.period?.();
      const chance = p === undefined ? (campus.chance ?? 0.4) : p === 'after' ? 0 : (campus.chance ?? OFF_SLOT_CHANCE);
      if (!(brng() < chance)) return false;
      venue = pickWeighted(brng, venueWeights(r.spec.id, p === undefined ? (campus.isLunch?.() ?? false) : p === 'lunch'));
    }
    if (!venue) return false;
    const v = venue;
    const taken = held();
    const free = AMENITY_SPOTS.filter((s) => inVenue(s, v) && !taken.has(s.id) && awayOk(r, s));
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
      beginBreak(r, spot, mate.spec.id, mv, time, slot ?? null);
      beginBreak(mate, other, r.spec.id, mv, time, slot ?? null);
      return true;
    }
    beginBreak(r, spot, null, mv, time, slot ?? null);
    return true;
  }

  /**
   * Rev 44 hand-over: the last robot of a director session in a zone stays on (at most RELIEF_WAIT_S past its stay)
   * while its relief is on the way, so the zone does not stand empty during the relief's trip.
   */
  function awaitingRelief(r: Internal): boolean {
    const b = r.brk;
    if (!b || b.slot !== null || b.stay === undefined || b.partner !== null || r.elapsed >= r.limit + RELIEF_WAIT_S) return false;
    const zone = b.spot.zone;
    let coming = false;
    for (const o of robots.values()) {
      if (o === r) continue;
      if (o.brk && o.brk.spot.zone === zone) {
        if (o.brk.phase === 'stay') return false;
        if (o.brk.phase === 'go') coming = true;
      } else if (o.summon === zone) coming = true;
    }
    if (coming) return true;
    // No relief on the way: a zone the current period still staffs keeps its last robot (at most RELIEF_WAIT_S).
    const p = campus?.period?.();
    const want = p === 'work' ? OCCUPANCY_WORK : p === 'lunch' ? OCCUPANCY_LUNCH : p === 'coffee' || p === 'tea' ? OCCUPANCY_SLOT : null;
    return (want?.[zone] ?? 0) > 0;
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

  /** One step of a robot on a campus break (simulation state; the true nav position, never the render cut). */
  function stepBreak(r: Internal, dt: number): void {
    const b = r.brk;
    if (!b || !campus) return;
    const mv = campus.movement;
    const id = r.spec.id;
    const p = mv.renderPosition(id, false);
    const dx = p.x - b.last.x;
    const dz = p.z - b.last.z;
    if (Math.hypot(dx, dz) > 1e-5) {
      r.facing = Math.atan2(dx, dz);
      r.walkPhase += dt * 6;
    }
    b.last = { ...p };
    r.pos = { ...p };
    r.elapsed += dt;
    if (b.phase === 'go') {
      if (mv.isAt(id, spotTarget(b.spot))) {
        change(r, 'coffee', sim.time);
        const venue = venueOfSpot(b.spot) ?? 'snack';
        const mate = mateOf(r);
        // Ping-pong mates share one game length.
        const meal = b.slot === 'lunch' && (venue === 'cafeteria' || venue === 'terrace');
        r.limit = b.stay ?? (mate && mate.brk?.phase === 'stay' ? mate.limit : meal ? range(brng, LUNCH_STAY_S[0], LUNCH_STAY_S[1]) : drawStay(brng, venue));
        if (mate && mate.brk?.phase === 'go') mate.limit = r.limit;
        b.phase = 'stay';
        r.facing = b.spot.facing;
      } else if (b.partner !== null && !mateOf(r)) leaveBreak(r, mv, sim.time);
    } else if (b.phase === 'stay') {
      r.facing = b.spot.facing;
      // Ping-pong: the game clock waits for the mate (at most MATE_WAIT_S), then both share one length.
      const mate = mateOf(r);
      if (mate && mate.brk?.phase !== 'stay') {
        if (r.elapsed < MATE_WAIT_S) r.limit += dt;
        else leaveBreak(r, mv, sim.time);
        return;
      }
      if ((r.elapsed >= r.limit && !awaitingRelief(r)) || (b.partner !== null && !mateOf(r))) leaveBreak(r, mv, sim.time);
    } else if (mv.isAt(id, homeTarget(id))) {
      r.brk = null;
      r.backAt = sim.time;
      r.pos = { ...r.spec.home };
      change(r, 'idle', sim.time);
      r.limit = draw('idle');
      r.facing = 0;
    }
  }

  // ---------------------------------------------------------------- occupancy director (Rev 39)
  let tickIn = 0;
  const spotsByZone = new Map<AmenityZoneId, AmenitySpot[]>();
  // Ping-pong needs a pair (slot breaks pair robots); the director fills single spots only.
  for (const s of AMENITY_SPOTS) if (s.kind !== 'ping-pong') spotsByZone.set(s.zone, [...(spotsByZone.get(s.zone) ?? []), s]);
  const order = [...robots.values()];

  /** One director tick: top every zone up to its target with the best-ranked free robot. */
  function direct(period: OfficePeriod, time: number): void {
    if (!campus) return;
    // After hours nothing starts, except the lab crew heading in shortly before the morning (MORNING_LEAD_S).
    const morning = period === 'after' && campus.periodAhead?.(MORNING_LEAD_S) === 'work';
    const targets = period === 'work' ? OCCUPANCY_WORK : period === 'lunch' ? OCCUPANCY_LUNCH : period === 'after' ? (morning ? OCCUPANCY_MORNING : null) : OCCUPANCY_SLOT;
    if (!targets) return;
    // Rev 44: in a coffee / tea slot (and at lunch) the director may place robots that are joining the break.
    const slotTargets = period === 'coffee' || period === 'tea' || period === 'lunch';
    const mv = campus.movement;
    const committed = new Map<AmenityZoneId, number>();
    const add = (z: AmenityZoneId): void => void committed.set(z, (committed.get(z) ?? 0) + 1);
    for (const r of robots.values()) {
      // Rev 44: a robot a job took (reserved) holds no place, even with its break or summon pending.
      if (r.reserved) {
        r.summon = null;
        continue;
      }
      // A robot near the end of its stay no longer counts: its relief is summoned while it still sits there.
      if (r.brk && (r.brk.phase === 'go' || (r.brk.phase === 'stay' && r.limit - r.elapsed > RELIEF_LEAD_S))) add(r.brk.spot.zone);
      else if (r.summon) add(r.summon);
    }
    const pods = brng() < PODS_TICK_CHANCE;
    // Largest relative deficit first (ties keep the table order: the lab first).
    const zones = (Object.entries(targets) as [AmenityZoneId, number][])
      .filter(([z, want]) => (committed.get(z) ?? 0) < want && (z !== 'sleep-pods' || pods))
      .sort((a, b) => (committed.get(a[0]) ?? 0) / a[1] - (committed.get(b[0]) ?? 0) / b[1]);
    for (const [zone] of zones) {
      const first = spotsByZone.get(zone)?.[0];
      if (!first) continue;
      // Free ambient robots: idle at home, at the desk or the coffee station (never a job step, §7.5).
      const cands = order
        .filter((r) => !r.reserved && !r.waving && !r.brk && !r.summon && (!r.join || slotTargets) && r.kind !== 'walk' && !excluded.has(r.spec.id) && campus.floors.has(r.spec.id) && time - r.backAt >= ROTATE_REST_S)
        .map((r) => ({ r, rank: zoneRank(r.spec.id, zone, campus.floors.get(r.spec.id) ?? 0, first.floor) }))
        .sort((a, b) => a.rank - b.rank || Number(b.r.kind === 'idle') - Number(a.r.kind === 'idle') || a.r.visits - b.r.visits);
      const pick = cands[0];
      if (!pick) continue;
      pick.r.summon = zone;
      pick.r.join = false; // Rev 44: a slot joiner the director places takes this session as its break
      pick.r.visits++;
      if (pick.r.kind === 'idle') startSession(pick.r, time);
      else pick.r.limit = Math.min(pick.r.limit, pick.r.elapsed); // finishes the desk / coffee stay now
    }
  }

  /** Starts a summoned robot's session (idle at home); true if it left. Off-floor trips wait for the gate. */
  function startSession(r: Internal, time: number): boolean {
    const zone = r.summon;
    if (!campus || !zone) return false;
    const mv = campus.movement;
    if (!breakable(r, mv)) return false;
    const taken = held();
    const spots = (spotsByZone.get(zone) ?? []).filter((s) => !taken.has(s.id) && awayOk(r, s));
    const spot = spots[Math.floor(brng() * spots.length)];
    if (!spot) return false;
    const [lo, hi] = ZONE_STAY_S[zone];
    beginBreak(r, spot, null, mv, time, null);
    r.summon = null;
    if (r.brk) r.brk.stay = range(brng, lo, hi);
    return true;
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
      sim.time += dt;
      const period = campus?.period?.();
      const slot: SlotKind | null = period === 'coffee' || period === 'tea' || period === 'lunch' ? period : null;
      const ov = campus?.override?.() ?? null;
      if (ov !== 'work') recalled = false;
      else if (!recalled && !paused && campus) {
        // Rev 44 "Molayı bitir": everyone on a break heads back now (home, then the desk); coffee drinkers too.
        recalled = true;
        for (const r of robots.values()) {
          if (r.reserved) continue;
          r.summon = null;
          r.join = false;
          if (r.brk) {
            if (r.brk.phase !== 'back') leaveBreak(r, campus.movement, sim.time);
          } else if (r.kind === 'coffee') r.limit = Math.min(r.limit, r.elapsed);
        }
      }
      if (period !== lastPeriod) {
        // Slot start (Rev 35): one join draw per free robot, in roster order; a slot end clears the joins.
        lastPeriod = period;
        // A period change ends the director's pending picks; the director staffs the new period first
        // (Rev 39: the lab keeps its crew through a slot), then the free robots draw their slot joins.
        for (const r of robots.values()) {
          r.summon = null;
          r.join = false;
        }
        if (campus?.occupancy && period !== undefined && !paused && ov !== 'work') {
          tickIn = DIRECTOR_TICK_S;
          direct(period, sim.time);
        }
        for (const r of robots.values()) {
          r.join = slot !== null && !r.reserved && !r.brk && !r.summon && !excluded.has(r.spec.id) && campus?.floors.has(r.spec.id) === true && brng() < (ov === 'break' ? 1 : JOIN_CHANCE[slot]);
          // Mesai biter: robots at their desk or the coffee station head home (no draw).
          if (period === 'after' && !r.reserved && !r.brk && (r.kind === 'work' || r.kind === 'coffee')) r.limit = Math.min(r.limit, r.elapsed);
        }
      }
      if (campus?.occupancy && period !== undefined && !paused && ov !== 'work') {
        tickIn -= dt;
        if (tickIn <= 0) {
          tickIn += DIRECTOR_TICK_S;
          direct(period, sim.time);
        }
      }
      for (const r of robots.values()) {
        if (r.waving || r.reserved) continue;
        if (r.brk) {
          if (!paused) stepBreak(r, dt);
          continue;
        }
        if (r.summon && !paused) {
          // Summoned by the occupancy director (Rev 39): leave from home now, or wait there for the gate.
          if (r.kind === 'idle') {
            if (!startSession(r, sim.time)) r.elapsed += dt;
            continue;
          }
          if (r.kind === 'work' || r.kind === 'coffee') r.limit = Math.min(r.limit, r.elapsed);
        }
        if (r.join && slot && !paused) {
          // Joining the slot's break: from idle at home start it now; a robot at its desk or coffee leaves early.
          if (r.kind === 'idle') {
            if (tryBreak(r, sim.time, slot)) continue;
            r.elapsed += dt; // waits at home for a free spot or the elevator gate
            continue;
          }
          if (r.kind === 'work' || r.kind === 'coffee') r.limit = Math.min(r.limit, r.elapsed);
        }
        // Rev 44 "Molayı bitir": a robot idle at home goes straight to its desk.
        if (ov === 'work' && r.kind === 'idle' && !paused) r.limit = Math.min(r.limit, r.elapsed);
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
          if (r.kind === 'idle' && period === 'after' && rng() < AFTER_HOURS_STAY) {
            // After hours (Rev 35): most robots stay idle at home.
            r.elapsed = 0;
            r.limit = draw('idle');
          } else if (r.kind === 'idle') {
            const drawn: WalkTarget = rng() < 0.5 ? 'desk' : 'coffee';
            const to: WalkTarget = ov === 'work' ? 'desk' : drawn;
            if (!(to === 'coffee' && !paused && tryBreak(r, sim.time))) startWalk(r, to, sim.time);
          } else startWalk(r, 'home', sim.time);
        }
      }
    },
    get(id) {
      const r = robots.get(id);
      if (!r) throw new Error(`unknown robot ${id}`);
      // Reduced motion renders a walker standing (idle pose) and a selected robot with a raised arm.
      const kind: ActivityKind = r.waving ? (reduced ? 'raise' : 'wave') : reduced && r.kind === 'walk' ? 'idle' : r.kind;
      const walkPhase = reduced ? 0 : r.walkPhase;
      if (r.brk && campus && !r.reserved) {
        // Live from the nav movement (it steps after this sim in a frame); the selection gesture wins the pose.
        const p = campus.movement.renderPosition(id, reduced);
        const raw = r.waving ? undefined : breakPose(r);
        const pose = reduced && raw === 'walk' ? 'idle' : raw;
        return { kind, ...(pose ? { pose } : {}), x: p.x, y: p.y, z: p.z, facing: r.facing, walkPhase, elapsed: r.elapsed };
      }
      // Leg cut (REQ-19): an ambient walker is rendered at its leg start until it arrives.
      const p = reduced && r.kind === 'walk' && !r.reserved ? r.walkFrom : r.pos;
      return { kind, x: p.x, y: p.y, z: p.z, facing: r.facing, walkPhase, elapsed: r.elapsed };
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
      // Render flag only: no event, no draw, no position change (a live change mid-leg shows the leg start).
      reduced = on;
    },
    reserve(id) {
      const r = robots.get(id);
      if (!r) return;
      // §7.5 interrupt: the break ends here; the engine re-paths the robot from where it is (no moveTo here).
      r.reserved = true;
      r.brk = null;
      r.summon = null;
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
    breakPhase(id) {
      return robots.get(id)?.brk?.phase ?? null;
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
