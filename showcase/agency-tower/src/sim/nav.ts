// Waypoint navigation (spec 0002 REQ-13, R-2, T-5). Pure and deterministic: per-floor graphs built from
// src/sim/layout.ts, Dijkstra shortest paths, keep-right offset lanes on aisle edges, offset path length.
import { LANE_OFFSET, type FloorLayout, type SpotKind, type XZ } from './layout';

export interface NavNode extends XZ {
  readonly id: string;
  /** Set for stationary spots (spur nodes); through (aisle) nodes have none. */
  readonly spot?: SpotKind;
}

export interface NavEdge {
  readonly a: string;
  readonly b: string;
  /** Aisle (through) edge: walked on keep-right offset lanes. Spur edges are walked on their centre line. */
  readonly through: boolean;
  readonly length: number;
}

export interface FloorGraph {
  readonly floor: number;
  readonly nodes: ReadonlyMap<string, NavNode>;
  readonly edges: readonly NavEdge[];
  /** Adjacency: node id -> [neighbour id, edge index]. */
  readonly adjacency: ReadonlyMap<string, readonly (readonly [string, number])[]>;
}

const EPS = 1e-6;
const dist = (a: XZ, b: XZ): number => Math.hypot(b.x - a.x, b.z - a.z);
const key = (p: XZ): string => `t:${p.x.toFixed(3)},${p.z.toFixed(3)}`;

/** Foot of the perpendicular from p onto segment ab, clamped to the segment, and its parameter t. */
export function projectOnSegment(p: XZ, a: XZ, b: XZ): { point: XZ; t: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 < EPS ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return { point: { x: a.x + dx * t, z: a.z + dz * t }, t };
}

/** Shortest distance from p to segment ab. */
export function pointSegmentDistance(p: XZ, a: XZ, b: XZ): number {
  return dist(p, projectOnSegment(p, a, b).point);
}

/** Builds the waypoint graph of one floor: aisles split at every attach point and junction, plus spurs. */
export function buildFloorGraph(layout: FloorLayout): FloorGraph {
  const nodes = new Map<string, NavNode>();
  const edges: NavEdge[] = [];
  const addEdge = (a: string, b: string, through: boolean): void => {
    const na = nodes.get(a);
    const nb = nodes.get(b);
    if (!na || !nb || a === b) return;
    edges.push({ a, b, through, length: dist(na, nb) });
  };
  const aisleById = new Map(layout.aisles.map((s) => [s.id, s]));
  const onAisle = new Map<string, { t: number; id: string }[]>(layout.aisles.map((s) => [s.id, []]));
  const throughNode = (aisleId: string, p: XZ, t: number): string => {
    const id = key(p);
    if (!nodes.has(id)) nodes.set(id, { id, x: p.x, z: p.z });
    onAisle.get(aisleId)?.push({ t, id });
    return id;
  };

  // Aisle end points, and junctions where one aisle's end lies on another aisle.
  for (const s of layout.aisles) {
    throughNode(s.id, s.a, 0);
    throughNode(s.id, s.b, 1);
  }
  for (const s of layout.aisles) {
    for (const other of layout.aisles) {
      if (other === s) continue;
      for (const end of [other.a, other.b]) {
        const pr = projectOnSegment(end, s.a, s.b);
        if (dist(pr.point, end) < EPS) throughNode(s.id, end, pr.t);
      }
    }
  }

  // Spots: spur from the attach point on the named aisle, or from another spot.
  const spurs: [string, string][] = [];
  for (const spot of layout.spots) {
    nodes.set(spot.id, { id: spot.id, x: spot.x, z: spot.z, spot: spot.kind });
    const aisle = aisleById.get(spot.via);
    if (aisle) {
      const pr = projectOnSegment(spot, aisle.a, aisle.b);
      spurs.push([throughNode(aisle.id, pr.point, pr.t), spot.id]);
    } else {
      spurs.push([spot.via, spot.id]);
    }
  }

  // Aisle edges between consecutive points along each aisle.
  for (const [, list] of onAisle) {
    const sorted = [...new Map(list.map((e) => [e.id, e])).values()].sort((p, q) => p.t - q.t);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev && cur) addEdge(prev.id, cur.id, true);
    }
  }
  for (const [a, b] of spurs) addEdge(a, b, false);

  const adjacency = new Map<string, [string, number][]>();
  for (const id of nodes.keys()) adjacency.set(id, []);
  edges.forEach((e, i) => {
    adjacency.get(e.a)?.push([e.b, i]);
    adjacency.get(e.b)?.push([e.a, i]);
  });
  return { floor: layout.floor, nodes, edges, adjacency };
}

/** Dijkstra on centre-line lengths; ties broken by node id so the result is deterministic. */
export function shortestPath(g: FloorGraph, from: string, to: string): string[] | null {
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null;
  const best = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    let curD = Infinity;
    for (const [id, d] of best) {
      if (done.has(id)) continue;
      if (d < curD - EPS || (Math.abs(d - curD) <= EPS && cur !== null && id < cur)) {
        cur = id;
        curD = d;
      }
    }
    if (cur === null) return null;
    if (cur === to) break;
    done.add(cur);
    for (const [next, ei] of g.adjacency.get(cur) ?? []) {
      const e = g.edges[ei];
      if (!e || done.has(next)) continue;
      const nd = curD + e.length;
      const old = best.get(next);
      if (old === undefined || nd < old - EPS) {
        best.set(next, nd);
        prev.set(next, cur);
      }
    }
  }
  const path = [to];
  while (path[0] !== from) {
    const p = prev.get(path[0] ?? '');
    if (p === undefined) return null;
    path.unshift(p);
  }
  return path;
}

/** The edge joining two adjacent nodes, if any. */
export function edgeBetween(g: FloorGraph, a: string, b: string): NavEdge | null {
  for (const [n, ei] of g.adjacency.get(a) ?? []) if (n === b) return g.edges[ei] ?? null;
  return null;
}

/** Right-hand normal of a travel direction (x right, z toward the viewer, y up). */
function rightOf(d: XZ): XZ {
  return { x: -d.z, z: d.x };
}

/**
 * The walked polyline for a node path: aisle edges are offset LANE_OFFSET to the right of travel, so
 * robots meeting head-on pass 2 x LANE_OFFSET apart; spur edges stay on their centre line. Right turns
 * between aisle edges use the miter point, left and sharp turns a bevel; every point stays within
 * LANE_OFFSET of the graph.
 */
export function offsetPath(g: FloorGraph, path: readonly string[], offset = LANE_OFFSET): XZ[] {
  const pts: XZ[] = [];
  const push = (p: XZ): void => {
    const last = pts[pts.length - 1];
    if (!last || dist(last, p) > EPS) pts.push(p);
  };
  const first = g.nodes.get(path[0] ?? '');
  if (!first) return pts;
  if (path.length === 1) return [{ x: first.x, z: first.z }];
  interface Seg {
    a: XZ;
    b: XZ;
    dir: XZ;
    through: boolean;
  }
  const segs: Seg[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = g.nodes.get(path[i - 1] ?? '');
    const b = g.nodes.get(path[i] ?? '');
    const e = edgeBetween(g, path[i - 1] ?? '', path[i] ?? '');
    if (!a || !b || !e) throw new Error(`no edge ${path[i - 1]} -> ${path[i]}`);
    const len = dist(a, b);
    segs.push({ a, b, dir: { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, through: e.through });
  }
  const shifted = (s: Seg, p: XZ): XZ => {
    if (!s.through) return { x: p.x, z: p.z };
    const r = rightOf(s.dir);
    return { x: p.x + r.x * offset, z: p.z + r.z * offset };
  };
  push({ x: first.x, z: first.z });
  segs.forEach((s, i) => {
    const prev = segs[i - 1];
    if (!prev) push(shifted(s, s.a));
    else if (prev.through && s.through) {
      const cos = prev.dir.x * s.dir.x + prev.dir.z * s.dir.z;
      const turnRight = rightOf(prev.dir).x * s.dir.x + rightOf(prev.dir).z * s.dir.z > EPS;
      if (cos > 1 - EPS) push(shifted(s, s.a));
      else if (turnRight && cos > -0.5) {
        const r0 = rightOf(prev.dir);
        const r1 = rightOf(s.dir);
        const k = offset / (1 + cos);
        push({ x: s.a.x + (r0.x + r1.x) * k, z: s.a.z + (r0.z + r1.z) * k });
      } else {
        push(shifted(prev, s.a));
        push(shifted(s, s.a));
      }
    } else {
      if (prev.through) push(shifted(prev, s.a));
      push({ x: s.a.x, z: s.a.z });
      push(shifted(s, s.a));
    }
    const next = segs[i + 1];
    if (!next || !(s.through && next.through)) push(shifted(s, s.b));
  });
  const last = segs[segs.length - 1];
  if (last) push({ x: last.b.x, z: last.b.z });
  return pts;
}

/** Length of a polyline. */
export function pathLength(points: readonly XZ[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) l += dist(a, b);
  }
  return l;
}

/** Offset path and its length between two nodes (null when unreachable). */
export function route(g: FloorGraph, from: string, to: string): { nodes: string[]; points: XZ[]; length: number } | null {
  const nodes = shortestPath(g, from, to);
  if (!nodes) return null;
  const points = offsetPath(g, nodes);
  return { nodes, points, length: pathLength(points) };
}

/** Nearest node to a position (ties by id), e.g. to re-path an interrupted ambient walk. */
export function nearestNode(g: FloorGraph, p: XZ, filter: (n: NavNode) => boolean = () => true): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const n of g.nodes.values()) {
    if (!filter(n)) continue;
    const d = dist(n, p);
    if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && best !== null && n.id < best)) {
      best = n.id;
      bestD = d;
    }
  }
  return best;
}

/** Point at distance `s` along a polyline (clamped), for movement along a route. */
export function pointAlong(points: readonly XZ[], s: number): XZ {
  let left = Math.max(0, s);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const l = dist(a, b);
    if (left <= l) {
      const t = l < EPS ? 0 : left / l;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    left -= l;
  }
  const end = points[points.length - 1];
  return end ? { x: end.x, z: end.z } : { x: 0, z: 0 };
}

/** Distance from p to the nearest graph edge (centre lines). */
export function distanceToGraph(g: FloorGraph, p: XZ): number {
  let d = Infinity;
  for (const e of g.edges) {
    const a = g.nodes.get(e.a);
    const b = g.nodes.get(e.b);
    if (a && b) d = Math.min(d, pointSegmentDistance(p, a, b));
  }
  return d;
}
