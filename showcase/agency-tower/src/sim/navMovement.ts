// Real Movement for the workflow engine (spec 0002 REQ-13, REQ-14, REQ-17, REQ-19, §7.5b, §7.5c, AC-12,
// AC-13). Same floor: one walk leg on the nav.ts route + offset path at 1.2 u/s. Other floor: walk to a
// landing waiting spot, call (button gesture), call-wait, ride the east staff cabin (elevator.ts), walk
// on. Robots keep ROBOT_SEPARATION while walking unless both stand in §7.5c zones; a walker yields
// (stands) while its next step would break that, at most MAX_YIELD_S per wait. Pure and deterministic:
// it draws no random numbers; time comes only from step(dt) (the 0002 simulation clock).
import hierarchy from '../data/hierarchy.json';
import { TIERS } from '../data/types';
import { createElevator, type Elevator } from './elevator';
import { FLOOR_COUNT, ROBOT_SEPARATION, STAFF_LANDING, floorLayout, floorY, separationExempt, type FloorLayout, type XZ } from './layout';
import type { MovePhase, Movement, Target } from './movement';
import { buildFloorGraph, offsetPath, pathLength, pointAlong, projectOnSegment, shortestPath, type FloorGraph } from './nav';

export const WALK_SPEED = 1.2;
/** Call-button gesture at the waiting spot before the call registers (part of the cabin-arrival wait). */
export const CALL_GESTURE_S = 0.5;
/** Longest single yield wait (AC-12); after it the walker goes on. */
export const MAX_YIELD_S = 6;
/** A give-way ends once the priority walker is this far away (separation + one lane width). */
export const GIVE_WAY_CLEAR = 0.95;

export interface Pos3 {
  floor: number;
  x: number;
  y: number;
  z: number;
}

export interface LegRecord {
  unit: string;
  kind: 'walk' | 'ride';
  floor: number;
  start: number;
  end: number;
  /** Walk: offset path length. */
  length: number;
  /** Walk: total yield wait. */
  yields: number;
  /** Walk: longest single yield wait. */
  maxYield: number;
  /** Ride: cabin-arrival wait reported by the elevator (call to ride start). */
  waited?: number;
  /** Ride: floors travelled. */
  floors?: number;
}

export interface NavMovementOptions {
  units: ReadonlyMap<string, number>;
  /** Per-floor layouts in the scene's desk order; default from the unit map (layoutsFromUnits). */
  layouts?: readonly FloorLayout[];
  /** Keep the leg log and the elevator log (tests). */
  record?: boolean;
  /** Floor the staff cabin starts at (default 0). */
  cabinFloor?: number;
}

export interface NavMovement extends Movement {
  readonly elevator: Elevator;
  layout(floor: number): FloorLayout;
  /** World-ish position: floor-local x/z, y = floor height (walkers) or cabin y (riders). */
  position(unit: string): Pos3;
  /** Reduced motion (REQ-19): the start of the current leg until it ends; otherwise position(). */
  renderPosition(unit: string, reduced: boolean): Pos3;
  /** Counter that changes whenever a leg starts or ends (render hook for reduced motion). */
  legIndex(unit: string): number;
  /** Graph node the unit stands at (or last passed), for tests and rendering. */
  nodeOf(unit: string): string | null;
  legLog(): readonly LegRecord[];
}

const HIERARCHY_TIERS: ReadonlyMap<string, string> = new Map(hierarchy.units.map((u) => [u.id, u.tier]));

/**
 * Layouts from the unit map with the scene's desk order (ui/unitList sortUnits: tier, then id; a unit's
 * name is its id). Tiers default to the committed hierarchy; unknown units sort last.
 */
export function layoutsFromUnits(units: ReadonlyMap<string, number>, tiers: ReadonlyMap<string, string> = HIERARCHY_TIERS): FloorLayout[] {
  const rank = (id: string): number => {
    const i = (TIERS as readonly string[]).indexOf(tiers.get(id) ?? '');
    return i < 0 ? TIERS.length : i;
  };
  return Array.from({ length: FLOOR_COUNT }, (_, f) =>
    floorLayout(
      f,
      [...units]
        .filter(([, fl]) => fl === f)
        .map(([id]) => id)
        .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
        .map((id) => ({ id, ceo: tiers.get(id) === 'ceo' })),
    ),
  );
}

type Plan = { kind: 'walk'; floor: number; to: string } | { kind: 'ride'; from: number; to: number; wait: string };

interface WalkLeg {
  kind: 'walk';
  floor: number;
  to: string;
  nodes: string[];
  points: XZ[];
  /** Arc length at which each node of `nodes` is passed. */
  nodeS: number[];
  length: number;
  s: number;
  /** Furthest arc length reached (backing up re-covers ground below it). */
  sMax: number;
  /** Unit this walker is giving way to (backing up or holding), or null. */
  giveWay: string | null;
  start: number;
  yields: number;
  yieldT: number;
  maxYield: number;
  startPos: Pos3;
}

interface RideLeg {
  kind: 'call' | 'call-wait' | 'ride';
  from: number;
  to: number;
  wait: string;
  t: number;
  start: number;
  rider: number;
  startPos: Pos3;
}

interface Unit {
  id: string;
  floor: number;
  x: number;
  z: number;
  node: string | null;
  target: Target;
  /** Resolved destination node on target.floor. */
  dest: string;
  plan: Plan[];
  leg: WalkLeg | RideLeg | null;
  /** moveTo while walking: re-path from this point via the next node. */
  reroute: { x: number; z: number; via: string } | null;
  /** moveTo while riding: plan again on arrival. */
  replan: boolean;
  legNo: number;
}

const EPS = 1e-9;
const d2 = (a: XZ, b: XZ): number => Math.hypot(a.x - b.x, a.z - b.z);
const sameTarget = (a: Target, b: Target): boolean => a.floor === b.floor && a.spot === b.spot;

export function createNavMovement(opts: NavMovementOptions): NavMovement {
  const record = opts.record ?? false;
  const layouts = opts.layouts ? [...opts.layouts] : layoutsFromUnits(opts.units);
  const graphs: FloorGraph[] = layouts.map((l) => buildFloorGraph(l));
  const elevator = createElevator({ startFloor: opts.cabinFloor ?? 0, record });
  const legs: LegRecord[] = [];
  let time = 0;

  const graph = (floor: number): FloorGraph => {
    const g = graphs[floor];
    if (!g) throw new Error(`no floor ${floor}`);
    return g;
  };
  const nodeXZ = (floor: number, id: string): XZ => {
    const n = graph(floor).nodes.get(id);
    if (!n) throw new Error(`no node ${id} on floor ${floor}`);
    return n;
  };
  const deskOwner = (floor: number): string | undefined => layouts[floor]?.desks.find((d) => d.wide)?.owner;

  const units = new Map<string, Unit>();
  for (const [id, floor] of [...opts.units].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const home = `home:${id}`;
    const p = nodeXZ(floor, home);
    units.set(id, { id, floor, x: p.x, z: p.z, node: home, target: { floor, spot: home }, dest: home, plan: [], leg: null, reroute: null, replan: false, legNo: 0 });
  }
  const order = [...units.values()];
  const get = (id: string): Unit => {
    const u = units.get(id);
    if (!u) throw new Error(`unknown unit ${id}`);
    return u;
  };

  const riding = (u: Unit): boolean => u.leg !== null && u.leg.kind === 'ride';
  const position = (u: Unit): Pos3 => {
    if (u.leg && u.leg.kind === 'ride') {
      const spot = STAFF_LANDING.riderSpots[Math.max(0, u.leg.rider)] ?? STAFF_LANDING.entry;
      const y = elevator.cabinY();
      return { floor: elevator.state().floor, x: spot.x, y, z: spot.z };
    }
    return { floor: u.floor, x: u.x, y: floorY(u.floor), z: u.z };
  };

  // ------------------------------------------------------------ spot resolution
  /** Nodes claimed by other units on a floor: their destinations, waiting spots and where they stand. */
  const claimed = (floor: number, self: Unit): Set<string> => {
    const out = new Set<string>();
    for (const v of order) {
      if (v === self) continue;
      if (v.target.floor === floor) out.add(v.dest);
      for (const p of v.plan) if (p.kind === 'ride' && p.from === floor) out.add(p.wait);
      if (v.leg && v.leg.kind !== 'walk' && v.leg.from === floor && v.leg.kind !== 'ride') out.add(v.leg.wait);
      if (v.floor === floor && v.node && !v.leg && v.plan.length === 0) out.add(v.node);
    }
    return out;
  };
  const pick = (floor: number, self: Unit, options: string[]): string => {
    const g = graph(floor);
    const have = options.filter((o) => g.nodes.has(o));
    const taken = claimed(floor, self);
    return have.find((o) => !taken.has(o)) ?? have[0] ?? (() => { throw new Error(`no spot among ${options.join(',')} on floor ${floor}`); })();
  };
  const range = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  function resolve(u: Unit, t: Target): string {
    const [kind, owner] = t.spot.split(':');
    switch (kind) {
      case 'home':
        return pick(t.floor, u, [t.spot]);
      case 'desk':
        if (owner === u.id || owner === undefined) return pick(t.floor, u, [`seat:${owner ?? u.id}`]);
        return pick(t.floor, u, [`pair:${owner}`, `seat:${owner}`]);
      case 'handover':
        return owner !== undefined && owner === deskOwner(t.floor) ? pick(t.floor, u, range('signing:', 2)) : pick(t.floor, u, [`handover:${owner}:1`, `handover:${owner}:0`]);
      case 'signing-desk':
        return u.id === deskOwner(t.floor) ? pick(t.floor, u, [`seat:${u.id}`]) : pick(t.floor, u, range('signing:', 2));
      case 'meeting-room':
        return pick(t.floor, u, [...range('mseat:', 6), 'mlead', 'msign']);
      case 'landing':
        return pick(t.floor, u, range('wait:', 3));
      default:
        return pick(t.floor, u, [t.spot]);
    }
  }

  // ------------------------------------------------------------ planning
  function plan(u: Unit, t: Target): void {
    u.target = t;
    u.dest = resolve(u, t);
    u.plan = [];
    if (u.floor === t.floor) {
      if (!(u.node === u.dest && !u.reroute)) u.plan.push({ kind: 'walk', floor: t.floor, to: u.dest });
      return;
    }
    const wait = pick(u.floor, u, range('wait:', 3));
    u.plan.push({ kind: 'walk', floor: u.floor, to: wait }, { kind: 'ride', from: u.floor, to: t.floor, wait }, { kind: 'walk', floor: t.floor, to: u.dest });
  }

  function startLeg(u: Unit): void {
    const p = u.plan.shift();
    if (!p) return;
    u.legNo++;
    const startPos = position(u);
    if (p.kind === 'ride') {
      u.leg = { kind: 'call', from: p.from, to: p.to, wait: p.wait, t: 0, start: time, rider: -1, startPos };
      return;
    }
    const g = graph(p.floor);
    const fromNode = u.reroute?.via ?? u.node;
    const nodes = fromNode ? shortestPath(g, fromNode, p.to) : null;
    if (!nodes) throw new Error(`no route for ${u.id} to ${p.to}`);
    let points = offsetPath(g, nodes);
    if (u.reroute) points = [{ x: u.reroute.x, z: u.reroute.z }, ...points];
    u.reroute = null;
    const nodeS: number[] = [];
    let from = 0;
    for (const id of nodes) {
      const s = arcOf(points, nodeXZ(p.floor, id), from);
      nodeS.push(s);
      from = s;
    }
    u.leg = { kind: 'walk', floor: p.floor, to: p.to, nodes, points, nodeS, length: pathLength(points), s: 0, sMax: 0, giveWay: null, start: time, yields: 0, yieldT: 0, maxYield: 0, startPos };
  }

  function endLeg(u: Unit): void {
    const leg = u.leg;
    if (!leg) return;
    if (leg.kind === 'walk') {
      if (record) legs.push({ unit: u.id, kind: 'walk', floor: leg.floor, start: leg.start, end: time, length: leg.length, yields: leg.yields, maxYield: leg.maxYield });
      const end = nodeXZ(leg.floor, leg.to);
      u.x = end.x;
      u.z = end.z;
      u.node = leg.to;
    }
    u.leg = null;
    u.legNo++;
  }

  // ------------------------------------------------------------ separation (REQ-13, §7.5c)
  const walking = (v: Unit): boolean => v.leg !== null && v.leg.kind === 'walk';
  /** Would u at p break the separation with v? Two walkers keep it even inside zones (stricter than §7.5c). */
  function conflict(u: Unit, p: XZ, v: Unit): boolean {
    if (v === u || v.floor !== u.floor || riding(v)) return false;
    const layout = layouts[u.floor];
    if (!layout) return false;
    const q = { x: v.x, z: v.z };
    const d = d2(p, q);
    if (d >= ROBOT_SEPARATION - EPS) return false;
    if (!walking(v) && separationExempt(layout, p, q)) return false;
    // Moving away from a robot already too close is allowed (it only ever widens the gap).
    return d <= d2({ x: u.x, z: u.z }, q) + EPS;
  }
  const blocker = (u: Unit, p: XZ): Unit | null => order.find((v) => conflict(u, p, v)) ?? null;
  const nextOf = (v: Unit, dt: number): XZ | null => {
    const leg = v.leg;
    return leg && leg.kind === 'walk' ? pointAlong(leg.points, Math.min(leg.length, leg.s + WALK_SPEED * dt)) : null;
  };

  /** Arc length one step back along u's own path, if that closes on no robot; else null. */
  function backPos(u: Unit, dt: number): number | null {
    const leg = u.leg;
    if (!leg || leg.kind !== 'walk' || leg.s <= EPS) return null;
    const back = Math.max(0, leg.s - WALK_SPEED * dt);
    const bp = pointAlong(leg.points, back);
    return order.some((v) => conflict(u, bp, v)) ? null : back;
  }

  function place(u: Unit, leg: WalkLeg, s: number): void {
    const p = pointAlong(leg.points, s);
    leg.s = s;
    u.x = p.x;
    u.z = p.z;
    let k = 0;
    while (k < leg.nodeS.length && (leg.nodeS[k] ?? 0) <= s + EPS) k++;
    u.node = leg.nodes[Math.max(0, k - 1)] ?? u.node;
  }

  function walk(u: Unit, leg: WalkLeg, dt: number, frozen: (unit: string) => boolean): void {
    const s = Math.min(leg.length, leg.s + WALK_SPEED * dt);
    const p = pointAlong(leg.points, s);
    // Give-way latch: after backing up for a priority walker, hold or keep backing until it is clear.
    if (leg.giveWay !== null) {
      const g = units.get(leg.giveWay);
      if (!g || !walking(g) || g.floor !== u.floor || d2(g, u) >= GIVE_WAY_CLEAR) leg.giveWay = null;
    }
    const b = leg.giveWay !== null ? (units.get(leg.giveWay) ?? null) : blocker(u, p);
    if (b && leg.yieldT + dt <= MAX_YIELD_S + EPS) {
      // Mutual block (merge at a junction, converging riders): the lower-priority walker backs up along
      // its own path to make room; the other goes on next step. Either way the time is a yield wait.
      const bNext = !frozen(b.id) ? nextOf(b, dt) : null;
      const mutual = bNext !== null && conflict(b, bNext, u);
      // The walker that can back up without closing on anyone gives way; if both can, the higher id does.
      const uBack = backPos(u, dt);
      const bBack = mutual ? backPos(b, dt) : null;
      if (leg.giveWay !== null || (mutual && uBack !== null && (bBack === null || u.id > b.id))) {
        leg.giveWay = b.id;
        if (uBack !== null) place(u, leg, uBack);
      }
      leg.yieldT += dt;
      leg.yields += dt;
      leg.maxYield = Math.max(leg.maxYield, leg.yieldT);
      return;
    }
    // Re-covering ground lost while backing up also counts as yield time (walk time = length / 1.2 + yields).
    const gained = Math.max(0, s - leg.sMax);
    const done = s >= leg.length - EPS;
    if (!done) {
      const lost = dt - gained / WALK_SPEED;
      if (lost > EPS) leg.yields += lost;
    }
    leg.yieldT = gained > EPS ? 0 : leg.yieldT + dt;
    leg.maxYield = Math.max(leg.maxYield, leg.yieldT);
    leg.sMax = Math.max(leg.sMax, s);
    place(u, leg, s);
    if (done) endLeg(u);
  }

  function arrive(u: Unit, leg: RideLeg): void {
    const spot = `cabin:${Math.max(0, leg.rider)}`;
    const p = nodeXZ(leg.to, spot);
    if (record) legs.push({ unit: u.id, kind: 'ride', floor: leg.from, start: leg.start, end: time, length: 0, yields: 0, maxYield: 0, waited: leg.rider >= 0 ? waitedOf(u.id) : 0, floors: Math.abs(leg.to - leg.from) });
    u.floor = leg.to;
    u.x = p.x;
    u.z = p.z;
    u.node = spot;
    elevator.clear(u.id);
    endLeg(u);
    if (u.replan) {
      u.replan = false;
      plan(u, u.target);
    }
  }
  const waitedOf = (id: string): number => {
    const log = elevator.log();
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (e && e.type === 'ride-start' && e.unit === id) return e.waited ?? 0;
    }
    return 0;
  };

  const phaseOf = (u: Unit): MovePhase => {
    const leg = u.leg;
    if (leg) return leg.kind;
    const p = u.plan[0];
    if (!p) return 'still';
    return p.kind === 'walk' ? 'walk' : 'call';
  };

  const mv: NavMovement = {
    elevator,
    layout(floor) {
      const l = layouts[floor];
      if (!l) throw new Error(`no floor ${floor}`);
      return l;
    },
    moveTo(id, t) {
      const u = get(id);
      if (sameTarget(u.target, t) && (u.leg || u.plan.length || u.node === u.dest)) return;
      const leg = u.leg;
      if (leg && leg.kind === 'ride') {
        u.target = t;
        u.replan = true;
        return;
      }
      if (leg && (leg.kind === 'call' || leg.kind === 'call-wait')) {
        elevator.cancel(id);
        u.leg = null;
        u.legNo++;
      }
      if (leg && leg.kind === 'walk') {
        let k = 0;
        while (k < leg.nodeS.length && (leg.nodeS[k] ?? 0) <= leg.s + EPS) k++;
        const via = leg.nodes[Math.min(k, leg.nodes.length - 1)];
        u.leg = null;
        u.legNo++;
        if (via !== undefined && leg.s > EPS && leg.s < leg.length - EPS) u.reroute = { x: u.x, z: u.z, via };
        else if (leg.s >= leg.length - EPS) u.node = leg.to;
      }
      plan(u, t);
    },
    isAt(id, t) {
      const u = get(id);
      return !u.leg && u.plan.length === 0 && !u.replan && sameTarget(u.target, t) && u.node === u.dest && u.floor === t.floor;
    },
    phase: (id) => phaseOf(get(id)),
    floorOf(id) {
      const u = get(id);
      return u.leg && u.leg.kind === 'ride' ? u.leg.to : u.floor;
    },
    step(dt, frozen) {
      if (!(dt > 0)) return;
      time += dt;
      // Leg starts, call gestures and selection holds (before the cabin moves).
      for (const u of order) {
        const fz = frozen(u.id);
        if (!u.leg && u.plan.length && !fz) startLeg(u);
        const leg = u.leg;
        if (!leg || leg.kind === 'walk') continue;
        if (leg.kind === 'call-wait') {
          const st = elevator.status(u.id);
          if (fz && st === 'queued') elevator.hold(u.id, true);
          else if (!fz && st === 'held') elevator.hold(u.id, false);
        }
      }
      elevator.step(dt);
      // Calls register after the cabin moved, so every caller spends at least one step in call-wait.
      for (const u of order) {
        const leg = u.leg;
        if (!leg || leg.kind !== 'call' || frozen(u.id)) continue;
        leg.t += dt;
        if (leg.t + EPS >= CALL_GESTURE_S) {
          leg.kind = 'call-wait';
          leg.start = time;
          elevator.call(u.id, leg.from, leg.to);
        }
      }
      for (const u of order) {
        const leg = u.leg;
        if (!leg || leg.kind === 'walk' || leg.kind === 'call') continue;
        const st = elevator.status(u.id);
        if (leg.kind === 'call-wait' && (st === 'boarding' || st === 'riding')) {
          leg.kind = 'ride';
          leg.rider = elevator.riderIndex(u.id);
          u.legNo++;
        } else if (leg.kind === 'ride' && st === 'arrived') arrive(u, leg);
      }
      for (const u of order) {
        if (frozen(u.id)) continue;
        if (u.leg && u.leg.kind === 'walk') walk(u, u.leg, dt, frozen);
      }
    },
    position: (id) => position(get(id)),
    renderPosition(id, reduced) {
      const u = get(id);
      if (!reduced || !u.leg) return position(u);
      return { ...u.leg.startPos };
    },
    legIndex: (id) => get(id).legNo,
    nodeOf: (id) => get(id).node,
    legLog: () => legs,
    snapshot() {
      return [
        ...order.map((u) => ({
          id: u.id,
          floor: u.floor,
          x: u.x,
          z: u.z,
          node: u.node,
          target: { ...u.target },
          dest: u.dest,
          plan: u.plan.map((p) => ({ ...p })),
          leg: u.leg ? { ...u.leg, startPos: { ...u.leg.startPos } } : null,
          reroute: u.reroute ? { ...u.reroute } : null,
          replan: u.replan,
          legNo: u.legNo,
        })),
        { id: '#elevator', time, elevator: elevator.snapshot() },
      ];
    },
  };
  return mv;
}

/** Arc length of the polyline point nearest to p, searching from arc length `from` on. */
function arcOf(points: readonly XZ[], p: XZ, from: number): number {
  let acc = 0;
  let best = from;
  let bestD = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const l = d2(a, b);
    const pr = projectOnSegment(p, a, b);
    const s = acc + l * pr.t;
    const d = d2(pr.point, p);
    if (s + EPS >= from && d < bestD - EPS) {
      bestD = d;
      best = s;
    }
    acc += l;
  }
  return best;
}
