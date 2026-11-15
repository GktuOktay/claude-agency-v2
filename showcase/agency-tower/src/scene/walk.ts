// "Gezinti" walk mode (KARARLAR Rev 42): first person at eye height inside one floor. Pure of any renderer.
// The walker stays near the floor's waypoint graph (src/sim/nav.ts) and outside every wall / furniture footprint,
// so it never passes through a wall or a desk; "click, walk there" follows the graph's shortest path.
import { Vector3 } from 'three';
import { distanceToGraph, projectOnSegment, shortestPath, type FloorGraph } from '../sim/nav';
import { floorY, type Rect, type XZ } from '../sim/layout';

/** Eye height above the floor top (robots are ~0.97 u tall; partitions 1.2 u). */
export const EYE_HEIGHT = 1.0;
/** Keyboard walking speed (u/s) and turn rate (rad/s). */
export const WALK_MODE_SPEED = 1.6;
export const TURN_SPEED = 1.8;
/** The walker keeps within this distance of a graph edge (the walkable band of the floor). */
export const WALK_RADIUS = 0.5;
/** Clearance kept from every footprint (walls, desks, shelves). Graph edges keep 0.25 u (REQ-13). */
export const BODY_RADIUS = 0.15;
/** Look sensitivity for drag (rad per CSS px) and the pitch limit (rad). */
export const LOOK_PER_PX = 0.005;
export const PITCH_LIMIT = 1.2;
/** Lens of the walk view. */
export const WALK_FOV = 62;
/** A click farther than this from the walkable band is not a destination. */
export const MAX_SNAP = 2.5;

export interface WalkInput {
  /** +1 forward, -1 back. */
  forward: number;
  /** +1 right, -1 left. */
  strafe: number;
  /** +1 turn right, -1 turn left. */
  turn: number;
}

/** Keys held now (KeyboardEvent.key, any case) to a movement input. W/S or Up/Down walk, A/D strafe, Left/Right turn. */
export function walkInputFromKeys(keys: ReadonlySet<string>): WalkInput {
  const has = (...k: string[]): boolean => k.some((x) => keys.has(x));
  const axis = (pos: boolean, neg: boolean): number => (pos ? 1 : 0) - (neg ? 1 : 0);
  return {
    forward: axis(has('w', 'W', 'ArrowUp'), has('s', 'S', 'ArrowDown')),
    strafe: axis(has('d', 'D'), has('a', 'A')),
    turn: axis(has('ArrowRight'), has('ArrowLeft')),
  };
}

/** Every key the walk mode reads (for preventDefault on arrows and key tracking). */
export const isWalkKey = (key: string): boolean => /^(?:[wasdWASD]|Arrow(?:Up|Down|Left|Right))$/.test(key);

export interface WalkerOptions {
  graph: FloorGraph;
  footprints: readonly Rect[];
  floor: number;
  /** Where the walk starts (snapped to the nearest graph point). */
  start: XZ;
  /** Heading: forward = (sin yaw, cos yaw), the robots' facing convention. */
  yaw: number;
}

export interface WalkerState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface Walker {
  readonly floor: number;
  state(): WalkerState;
  /** Drag look ("grab the view"): dragging right turns left, dragging down looks up. */
  look(dxPx: number, dyPx: number): void;
  /** Walk to the floor point `p` along the graph; `reduced` = arrive at once. False if `p` is off the floor. */
  walkTo(p: XZ, reduced: boolean): boolean;
  /** True while a click-to-walk route is being followed. */
  walking(): boolean;
  /** Keyboard movement (cancels a route) and route following. */
  update(dt: number, input: WalkInput, reduced?: boolean): void;
  /** Camera position (eye) and look-at target. */
  pose(): { pos: Vector3; target: Vector3 };
  /** Whether `p` is walkable (inside the band, outside every footprint). */
  canStand(p: XZ): boolean;
}

const inflate = (r: Rect, m: number): Rect => ({ name: r.name, x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
const inside = (r: Rect, p: XZ): boolean => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
const dist = (a: XZ, b: XZ): number => Math.hypot(b.x - a.x, b.z - a.z);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Nearest point on any graph edge to `p`, with that edge's end node ids. */
function nearestOnGraph(g: FloorGraph, p: XZ): { point: XZ; a: string; b: string; d: number } | null {
  let best: { point: XZ; a: string; b: string; d: number } | null = null;
  for (const e of g.edges) {
    const na = g.nodes.get(e.a);
    const nb = g.nodes.get(e.b);
    if (!na || !nb) continue;
    const { point } = projectOnSegment(p, na, nb);
    const d = dist(point, p);
    if (!best || d < best.d) best = { point, a: e.a, b: e.b, d };
  }
  return best;
}

function polyLength(pts: readonly XZ[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1]!, pts[i]!);
  return l;
}

/** Route from `from` to `to` along the graph: onto the nearest edge, its shortest node path, off at the goal edge. */
export function walkRoute(g: FloorGraph, from: XZ, to: XZ): XZ[] | null {
  const s = nearestOnGraph(g, from);
  const e = nearestOnGraph(g, to);
  if (!s || !e) return null;
  const sameEdge = (s.a === e.a && s.b === e.b) || (s.a === e.b && s.b === e.a);
  if (sameEdge) return [from, s.point, e.point];
  let best: XZ[] | null = null;
  let bestL = Infinity;
  for (const a of [s.a, s.b]) {
    for (const b of [e.a, e.b]) {
      const path = shortestPath(g, a, b);
      if (!path) continue;
      const pts: XZ[] = [from, s.point, ...path.map((id) => g.nodes.get(id)!), e.point];
      const l = polyLength(pts);
      if (l < bestL) {
        bestL = l;
        best = pts;
      }
    }
  }
  return best;
}

export function createWalker(o: WalkerOptions): Walker {
  const g = o.graph;
  const blocks = o.footprints.map((r) => inflate(r, BODY_RADIUS));
  const onGraph = nearestOnGraph(g, o.start);
  let x = onGraph ? onGraph.point.x : o.start.x;
  let z = onGraph ? onGraph.point.z : o.start.z;
  let yaw = o.yaw;
  let pitch = -0.08;
  let route: XZ[] | null = null;
  let leg = 1;
  const eyeY = floorY(o.floor) + EYE_HEIGHT;

  // A point on a graph edge is always walkable (edges keep 0.25 u off footprints), so the walker can never be stuck.
  const canStand = (p: XZ): boolean => {
    const d = distanceToGraph(g, p);
    if (d <= 1e-3) return true;
    if (d > WALK_RADIUS) return false;
    for (const r of blocks) if (inside(r, p)) return false;
    return true;
  };

  /** Move by (dx, dz), sliding along a blocking wall (one axis at a time when the full move is blocked). */
  const tryMove = (dx: number, dz: number): void => {
    if (canStand({ x: x + dx, z: z + dz })) {
      x += dx;
      z += dz;
    } else if (dx && canStand({ x: x + dx, z })) x += dx;
    else if (dz && canStand({ x, z: z + dz })) z += dz;
  };

  const finishRoute = (): void => {
    const end = route?.[route.length - 1];
    const prev = route?.[route.length - 2];
    if (end) {
      if (prev && dist(prev, end) > 1e-6) yaw = Math.atan2(end.x - prev.x, end.z - prev.z);
      x = end.x;
      z = end.z;
    }
    route = null;
  };

  return {
    floor: o.floor,
    canStand,
    state: () => ({ x, z, yaw, pitch }),
    walking: () => route !== null,
    look(dx, dy) {
      yaw = wrap(yaw + dx * LOOK_PER_PX);
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + dy * LOOK_PER_PX));
    },
    walkTo(p, reduced) {
      const goal = nearestOnGraph(g, p);
      if (!goal || goal.d > MAX_SNAP) return false;
      const r = walkRoute(g, { x, z }, p);
      if (!r) return false;
      route = r;
      leg = 1;
      if (reduced) finishRoute();
      return true;
    },
    update(dt, input, reduced = false) {
      if (!(dt > 0)) return;
      if (input.forward || input.strafe || input.turn) {
        route = null; // the keyboard takes over
        yaw = wrap(yaw - input.turn * TURN_SPEED * dt);
        const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const right = { x: -Math.cos(yaw), z: Math.sin(yaw) };
        const len = Math.hypot(input.forward, input.strafe) || 1;
        const step = (WALK_MODE_SPEED * dt) / len;
        const dx = (f.x * input.forward + right.x * input.strafe) * step;
        const dz = (f.z * input.forward + right.z * input.strafe) * step;
        // Sub-steps keep a fast frame from tunnelling through a thin wall.
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
        for (let i = 0; i < n; i++) tryMove(dx / n, dz / n);
        return;
      }
      if (!route) return;
      if (reduced) {
        finishRoute();
        return;
      }
      let left = WALK_MODE_SPEED * dt;
      while (route && left > 0) {
        const to = route[leg];
        if (!to) {
          finishRoute();
          break;
        }
        const d = dist({ x, z }, to);
        if (d > 1e-6) {
          const want = Math.atan2(to.x - x, to.z - z);
          yaw = wrap(yaw + wrap(want - yaw) * Math.min(1, dt * 6));
        }
        if (d <= left) {
          x = to.x;
          z = to.z;
          left -= d;
          leg++;
          if (leg >= route.length) finishRoute();
        } else {
          x += ((to.x - x) / d) * left;
          z += ((to.z - z) / d) * left;
          left = 0;
        }
      }
    },
    pose() {
      const pos = new Vector3(x, eyeY, z);
      const c = Math.cos(pitch);
      const target = pos.clone().add(new Vector3(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c));
      return { pos, target };
    },
  };
}
