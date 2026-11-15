// City life around the campus (KARARLAR rev 31, calm and prestige rework rev 33, luxury and realism rev 37):
// a pure, seedable street plan (tree-lined boulevards with planted medians and bike lanes, a park with a
// landscaped plaza and a pond, café terraces, a grand hotel with a porte-cochère, glass towers further back)
// plus calm premium traffic, cyclists and pedestrian loops.
//
// Ruling: one world unit is one metre (the tower floor is a 3 m diorama floor); city storeys are 3.5 m,
// lanes 3.5 m and sidewalks 4 m like a real European boulevard — if wrong, change the scale constants. No three.js and no DOM here; src/scene/city.ts turns the plan into meshes and reads the sim state.
//
// Coordinates are world x/z (the tower root sits at the origin). +x is east, +z is south (toward the
// default cameras). Traffic keeps right: the right of heading (dx, dz) is (-dz, dx).
import { createRng, range, type Rng } from '../scene/rng';

export interface CityRect {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}
export interface CityXZ {
  readonly x: number;
  readonly z: number;
}
export type Axis = 'x' | 'z';
export type Signal = 'green' | 'yellow' | 'red';
/** `bus` is the small electric shuttle (rev 33: no big buses); `taxi` is the chauffeured limousine (rev 37). */
export type VehicleKind = 'car' | 'taxi' | 'bus';
/** Body style (rev 37): cars are sedans, grand tourers, electric SUVs or convertibles. */
export type BodyStyle = 'sedan' | 'tourer' | 'suv' | 'convertible' | 'limousine' | 'shuttle';
export type BuildingStyle = 'midrise' | 'tower' | 'hotel' | 'canopy';

/** Half width of the planted median on the ring boulevards. */
export const MEDIAN_HALF = 0.8;
/** One traffic lane each way (real-world 3.5 m). */
export const LANE_WIDTH = 3.5;
/** Painted bike lane on the outer edge of the road. */
export const BIKE_WIDTH = 1.5;
export const ROAD_HALF = MEDIAN_HALF + LANE_WIDTH + BIKE_WIDTH;
/** Vehicles drive in the middle of their lane. */
export const LANE_OFFSET = MEDIAN_HALF + LANE_WIDTH / 2;
export const WALK_WIDTH = 4.0;
/** Free plot (plaza) between the campus footprint and its sidewalk. */
export const PLOT_MARGIN = 2.3;
export const CROSSWALK_WIDTH = 3.0;
/** Vehicles stop this far from the intersection centre: road half, crosswalk and a small gap. */
export const STOP_DIST = ROAD_HALF + CROSSWALK_WIDTH + 0.5;
/** Cyclists ride this far right of the road centre line, in the middle of the outer bike lane. */
export const BIKE_OFFSET = ROAD_HALF - BIKE_WIDTH / 2;
/** City reach beyond the ring roads (it fades into the haze before this). */
export const CITY_REACH = 46;
/** Building height cap: h <= HEIGHT_SLOPE * (distance to the campus footprint) - HEIGHT_DROP. */
export const HEIGHT_SLOPE = 0.38;
export const HEIGHT_DROP = 1.0;
/** Storey height of the neighbouring buildings (real-world 3.5 m). */
export const STOREY = 3.5;
/** Parapet and roof build-up above the top storey. */
export const PARAPET = 0.6;
/** Floors a building may have at most: camera side (south, east) and further back. */
const MAX_FLOORS = { cameraSide: 3, back: 8 } as const;

/** Signal cycle (s): x green, x yellow, all red, z green, z yellow, all red. */
export const SIGNAL = { green: 10, yellow: 2.5, allRed: 2.5 } as const;
export const SIGNAL_CYCLE = 2 * (SIGNAL.green + SIGNAL.yellow + SIGNAL.allRed);

export interface Building extends CityRect {
  readonly h: number;
  readonly floors: number;
  readonly tone: number; // palette index
  readonly style: BuildingStyle;
}
/** Grand hotel (rev 37): stepped stone blocks, a porte-cochère over the forecourt drop-off and a doorman. */
export interface Hotel {
  readonly blocks: readonly Building[];
  readonly canopy: Building;
  /** Paved drop-off between the front block and the sidewalk. */
  readonly forecourt: CityRect;
  readonly doorman: { readonly x: number; readonly z: number; readonly yaw: number };
}
export interface Sculpture {
  readonly x: number;
  readonly z: number;
  readonly h: number;
  /** Half extent of its footprint. */
  readonly r: number;
}
export interface Tree {
  readonly x: number;
  readonly z: number;
  readonly h: number;
}
export interface Lamp {
  readonly x: number;
  readonly z: number;
  /** Unit vector the arm points to (toward the road). */
  readonly dx: number;
  readonly dz: number;
}
export interface SignalHead {
  readonly node: number;
  readonly axis: Axis;
  readonly x: number;
  readonly z: number;
  /** Unit vector the lamps face (toward the approaching traffic). */
  readonly fx: number;
  readonly fz: number;
}
export interface Intersection {
  readonly x: number;
  readonly z: number;
  /** Phase offset (s) of the signal cycle. */
  readonly offset: number;
}
export interface Crosswalk extends CityRect {
  /** Axis the stripes run along (the walking direction). */
  readonly walk: Axis;
}
export interface Bench {
  readonly x: number;
  readonly z: number;
  /** Yaw (rad) of the seat front. */
  readonly yaw: number;
}
/** Café table (with an umbrella) on a terrace lot or at the park café. */
export interface CafeTable {
  readonly x: number;
  readonly z: number;
  readonly tone: number;
}
/** Someone sitting still on a bench or a café chair (yaw = facing). */
export interface Sitter {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly tone: number;
}
export interface Stop {
  readonly s: number;
  readonly node: number;
  readonly axis: Axis;
}
export interface CityPath {
  readonly pts: readonly CityXZ[];
  readonly closed: boolean;
  /** Cumulative length at each point. */
  readonly cum: readonly number[];
  readonly length: number;
  readonly stops: readonly Stop[];
}
export interface CityPlan {
  readonly campus: CityRect;
  /** Area kept free of anything but plaza, sidewalk and road (campus plus a clear ring). */
  readonly clear: CityRect;
  readonly extent: CityRect;
  /** Ring road centre lines. */
  readonly ring: { readonly n: number; readonly s: number; readonly w: number; readonly e: number };
  readonly roads: readonly CityRect[];
  readonly sidewalks: readonly CityRect[];
  readonly crosswalks: readonly Crosswalk[];
  readonly intersections: readonly Intersection[];
  readonly blocks: readonly CityRect[];
  readonly park: CityRect;
  /** Calm pond in the park's far half; the north-south park path crosses it on a small bridge. */
  readonly pond: CityRect;
  /** Park café kiosk footprint. */
  readonly kiosk: CityRect;
  /** Planted medians (boulevard) and painted bike lanes, cut at the intersection boxes. */
  readonly medians: readonly CityRect[];
  readonly bikeLanes: readonly CityRect[];
  /** Landscaped stone plaza in the park with a reflecting pool and a sculpture (rev 37). */
  readonly plaza: CityRect;
  readonly pool: CityRect;
  readonly sculpture: Sculpture;
  readonly hotel: Hotel;
  readonly bollards: readonly CityXZ[];
  readonly tables: readonly CafeTable[];
  readonly sitters: readonly Sitter[];
  readonly buildings: readonly Building[];
  readonly trees: readonly Tree[];
  readonly lamps: readonly Lamp[];
  readonly signals: readonly SignalHead[];
  readonly benches: readonly Bench[];
  readonly vehiclePaths: readonly CityPath[];
  readonly pedestrianPaths: readonly CityPath[];
  /** One-way bike lanes on the outer edge of each ring road (they stop at the lights). */
  readonly bikePaths: readonly CityPath[];
  /** Jogging and strolling loop inside the park. */
  readonly parkPaths: readonly CityPath[];
}

/** Horizontal distance between two rectangles (0 when they overlap). */
export function rectDistance(a: CityRect, b: CityRect): number {
  const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
  const dz = Math.max(0, b.z0 - a.z1, a.z0 - b.z1);
  return Math.hypot(dx, dz);
}
export const rectsOverlap = (a: CityRect, b: CityRect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
export const inRect = (r: CityRect, p: CityXZ, pad = 0): boolean => p.x >= r.x0 - pad && p.x <= r.x1 + pad && p.z >= r.z0 - pad && p.z <= r.z1 + pad;
const rect = (x0: number, x1: number, z0: number, z1: number): CityRect => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

/** Tallest building allowed at `d` metres from the campus footprint. */
export const heightCap = (d: number): number => HEIGHT_SLOPE * d - HEIGHT_DROP;

/** Signal for traffic travelling along `axis` at intersection phase time `t` (s). */
export function signalAt(t: number, axis: Axis): Signal {
  const half = SIGNAL.green + SIGNAL.yellow + SIGNAL.allRed;
  let p = t % SIGNAL_CYCLE;
  if (p < 0) p += SIGNAL_CYCLE;
  const local = axis === 'x' ? p : (p + half) % SIGNAL_CYCLE;
  if (local < SIGNAL.green) return 'green';
  if (local < SIGNAL.green + SIGNAL.yellow) return 'yellow';
  return 'red';
}

// ---- paths ----

function makePath(pts: readonly CityXZ[], closed: boolean): Omit<CityPath, 'stops'> {
  const cum = [0];
  const n = closed ? pts.length : pts.length - 1;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a && b) len += Math.hypot(b.x - a.x, b.z - a.z);
    cum.push(len);
  }
  return { pts, closed, cum, length: len };
}

/** Position and unit heading at arc length `s` (wrapped for closed paths, clamped for open ones). */
export function pathPoint(p: Omit<CityPath, 'stops'>, s: number): { x: number; z: number; dx: number; dz: number } {
  const L = p.length;
  let t = p.closed ? ((s % L) + L) % L : Math.min(Math.max(s, 0), L);
  const n = p.closed ? p.pts.length : p.pts.length - 1;
  // Binary search on the cumulative lengths.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((p.cum[mid] ?? 0) <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = p.pts[lo] ?? { x: 0, z: 0 };
  const b = p.pts[(lo + 1) % p.pts.length] ?? a;
  const seg = (p.cum[lo + 1] ?? 0) - (p.cum[lo] ?? 0);
  t -= p.cum[lo] ?? 0;
  const dx = seg > 0 ? (b.x - a.x) / seg : 1;
  const dz = seg > 0 ? (b.z - a.z) / seg : 0;
  return { x: a.x + dx * t, z: a.z + dz * t, dx, dz };
}

/** Arc length of the point on the path closest to `q`. */
export function projectOnPath(p: Omit<CityPath, 'stops'>, q: CityXZ): number {
  let best = Infinity;
  let bestS = 0;
  const n = p.closed ? p.pts.length : p.pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = p.pts[i];
    const b = p.pts[(i + 1) % p.pts.length];
    if (!a || !b) continue;
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const l2 = vx * vx + vz * vz;
    const u = l2 > 0 ? Math.min(1, Math.max(0, ((q.x - a.x) * vx + (q.z - a.z) * vz) / l2)) : 0;
    const d = Math.hypot(a.x + vx * u - q.x, a.z + vz * u - q.z);
    if (d < best) {
      best = d;
      bestS = (p.cum[i] ?? 0) + u * Math.sqrt(l2);
    }
  }
  return bestS;
}

/** Rounded rectangle loop (clockwise seen from above: east along z0, south along x1, ...). */
function roundedLoop(r: CityRect, radius: number): CityXZ[] {
  const out: CityXZ[] = [];
  const corners: [number, number, number][] = [
    [r.x1 - radius, r.z0 + radius, -Math.PI / 2],
    [r.x1 - radius, r.z1 - radius, 0],
    [r.x0 + radius, r.z1 - radius, Math.PI / 2],
    [r.x0 + radius, r.z0 + radius, Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k / 3) * (Math.PI / 2);
      out.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
    }
  }
  return out;
}

/** Stops on a path where it crosses an intersection's stop line (approach side only). */
function stopsFor(path: Omit<CityPath, 'stops'>, nodes: readonly Intersection[], stopDist: number, lateral: number): Stop[] {
  const out: Stop[] = [];
  nodes.forEach((node, idx) => {
    // Four approaches: travelling +x (stop line west of the node), -x, +z, -z.
    const approaches: [Axis, number, number, number, number][] = [
      ['x', 1, 0, node.x - stopDist, node.z],
      ['x', -1, 0, node.x + stopDist, node.z],
      ['z', 0, 1, node.x, node.z - stopDist],
      ['z', 0, -1, node.x, node.z + stopDist],
    ];
    for (const [axis, hx, hz, sx, sz] of approaches) {
      // The lane on the right of the heading.
      const px = sx + -hz * lateral;
      const pz = sz + hx * lateral;
      const s = projectOnPath(path, { x: px, z: pz });
      const at = pathPoint(path, s);
      if (Math.hypot(at.x - px, at.z - pz) > 0.3) continue;
      if (Math.abs(at.dx - hx) > 0.05 || Math.abs(at.dz - hz) > 0.05) continue;
      out.push({ s, node: idx, axis });
    }
  });
  return out.sort((a, b) => a.s - b.s);
}

// ---- plan ----

/** Street plan around `campus`: ring roads with four signalled corners, eight blocks, a park. */
export function cityPlan(campus: CityRect, seed = 7): CityPlan {
  const rng = createRng(seed);
  const gap = PLOT_MARGIN + WALK_WIDTH + ROAD_HALF;
  const ring = { n: campus.z0 - gap, s: campus.z1 + gap, w: campus.x0 - gap, e: campus.x1 + gap };
  const extent = rect(ring.w - CITY_REACH, ring.e + CITY_REACH, ring.n - CITY_REACH, ring.s + CITY_REACH);
  const clear = rect(ring.w + ROAD_HALF, ring.e - ROAD_HALF, ring.n + ROAD_HALF, ring.s - ROAD_HALF);
  const R = ROAD_HALF;
  const W = WALK_WIDTH;

  const roads: CityRect[] = [
    rect(extent.x0, extent.x1, ring.n - R, ring.n + R),
    rect(extent.x0, extent.x1, ring.s - R, ring.s + R),
    rect(ring.w - R, ring.w + R, extent.z0, extent.z1),
    rect(ring.e - R, ring.e + R, extent.z0, extent.z1),
  ];
  const sidewalks: CityRect[] = [];
  for (const z of [ring.n, ring.s]) {
    sidewalks.push(rect(extent.x0, extent.x1, z - R - W, z - R), rect(extent.x0, extent.x1, z + R, z + R + W));
  }
  for (const x of [ring.w, ring.e]) {
    sidewalks.push(rect(x - R - W, x - R, extent.z0, extent.z1), rect(x + R, x + R + W, extent.z0, extent.z1));
  }

  const intersections: Intersection[] = [
    { x: ring.w, z: ring.n, offset: 0 },
    { x: ring.e, z: ring.n, offset: 5 },
    { x: ring.e, z: ring.s, offset: 11 },
    { x: ring.w, z: ring.s, offset: 17 },
  ];
  const crosswalks: Crosswalk[] = [];
  for (const node of intersections) {
    // Across the x-road (people walk along z) west and east of the box; across the z-road north and south.
    for (const side of [-1, 1]) {
      crosswalks.push({ ...rect(node.x + side * R, node.x + side * (R + CROSSWALK_WIDTH), node.z - R, node.z + R), walk: 'z' });
      crosswalks.push({ ...rect(node.x - R, node.x + R, node.z + side * R, node.z + side * (R + CROSSWALK_WIDTH)), walk: 'x' });
    }
  }

  // Blocks: 3 x 3 grid around the ring, the centre one is the campus.
  const xs: [number, number][] = [
    [extent.x0, ring.w - R - W],
    [ring.w + R + W, ring.e - R - W],
    [ring.e + R + W, extent.x1],
  ];
  const zs: [number, number][] = [
    [extent.z0, ring.n - R - W],
    [ring.n + R + W, ring.s - R - W],
    [ring.s + R + W, extent.z1],
  ];
  const blocks: CityRect[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) blocks.push(rect(xs[i]![0], xs[i]![1], zs[j]![0], zs[j]![1]));

  // Park: the camera-side (south) block nearest the campus stays low and green.
  const southBlock = rect(xs[1]![0], xs[1]![1], zs[2]![0], zs[2]![1]);
  const park = rect(southBlock.x0 + 1.5, southBlock.x1 - 1.5, southBlock.z0 + 1.5, Math.min(southBlock.z1 - 9, southBlock.z0 + 26));
  const pc = { x: (park.x0 + park.x1) / 2, z: (park.z0 + park.z1) / 2 };
  const pondHalf = Math.min(10, (park.x1 - park.x0) / 2 - 5);
  const pond = rect(pc.x - pondHalf, pc.x + pondHalf, pc.z + 4, park.z1 - 3.4);
  const kiosk = rect(pc.x + 12, pc.x + 14.6, park.z0 + 2.6, park.z0 + 4.6);
  const plaza = rect(pc.x - 7.5, pc.x + 7.5, pc.z - 4.4, pc.z + 2.9);
  const pool = rect(pc.x - 4.6, pc.x + 4.6, pc.z - 1.9, pc.z + 1.9);
  const sculpture: Sculpture = { x: pc.x, z: pc.z, h: 3.6, r: 0.9 };

  const buildings: Building[] = [];
  const hotel = hotelIn(rect(xs[1]![0], xs[1]![1], zs[0]![0], zs[0]![1]), campus);
  buildings.push(...hotel.blocks, hotel.canopy);
  const hotelSite = rect(hotel.forecourt.x0, hotel.forecourt.x1, Math.min(...hotel.blocks.map((b) => b.z0)), hotel.forecourt.z1);
  const tables: CafeTable[] = [];
  const terraces = { left: 3 };
  const reserved = [rect(park.x0 - 1, park.x1 + 1, park.z0 - 1, park.z1 + 1), rect(hotelSite.x0 - 1, hotelSite.x1 + 1, hotelSite.z0 - 1, hotelSite.z1 + 1)];
  for (const b of blocks) fillBlock(b, campus, reserved, rng, buildings, tables, terraces);

  // Street trees and lamps on the outer sidewalks (the campus side keeps its clear ring).
  const trees: Tree[] = [];
  const lamps: Lamp[] = [];
  const nearNode = (x: number, z: number): boolean => intersections.some((n) => Math.abs(n.x - x) < STOP_DIST + 2 && Math.abs(n.z - z) < STOP_DIST + 2);
  const treeAt = (x: number, z: number, hMax: number): void => {
    const d = rectDistance(campus, rect(x - 1, x + 1, z - 1, z + 1));
    const h = Math.min(hMax, heightCap(d) - 0.2);
    if (h >= 2.2) trees.push({ x, z, h });
  };
  const curb = 0.6;
  const sides: [Axis, number, number][] = [
    ['x', ring.n - R - curb, -1],
    ['x', ring.s + R + curb, 1],
    ['z', ring.w - R - curb, -1],
    ['z', ring.e + R + curb, 1],
  ];
  for (const [axis, line, out] of sides) {
    const [a0, a1] = axis === 'x' ? [extent.x0, extent.x1] : [extent.z0, extent.z1];
    let k = 0;
    for (let t = a0 + 4; t < a1 - 4; t += 9, k++) {
      const [x, z] = axis === 'x' ? [t, line] : [line, t];
      if (nearNode(x, z)) continue;
      // Tree-lined: a tree in every slot on the kerb edge, a lamp between every other pair.
      const kerb = out * (0.9 - curb);
      treeAt(axis === 'x' ? x : x + kerb, axis === 'x' ? z + kerb : z, range(rng, 6.5, 8.5));
      const [lx, lz] = axis === 'x' ? [x + 4.5, z] : [x, z + 4.5];
      if (k % 2 === 1 && !nearNode(lx, lz)) lamps.push({ x: lx, z: lz, dx: axis === 'z' ? -out : 0, dz: axis === 'x' ? -out : 0 });
    }
  }

  // Boulevards: planted medians cut at the boxes, outer bike lanes, median trees where the cap allows.
  const pieces = (a0: number, a1: number, cuts: readonly number[], keep: number): [number, number][] => {
    const out: [number, number][] = [];
    let s = a0;
    for (const c of [...cuts].sort((p, q) => p - q)) {
      if (c - keep > s) out.push([s, c - keep]);
      s = Math.max(s, c + keep);
    }
    if (a1 > s) out.push([s, a1]);
    return out;
  };
  const medians: CityRect[] = [];
  const bikeLanes: CityRect[] = [];
  const M = MEDIAN_HALF;
  const B = BIKE_OFFSET;
  const keepM = STOP_DIST + 0.6;
  for (const [z, o] of [[ring.n, -1], [ring.s, 1]] as const) {
    for (const [a, b] of pieces(extent.x0, extent.x1, [ring.w, ring.e], keepM)) medians.push(rect(a, b, z - M, z + M));
    for (const [a, b] of pieces(extent.x0, extent.x1, [ring.w, ring.e], R)) bikeLanes.push(rect(a, b, z + o * (B - BIKE_WIDTH / 2), z + o * (B + BIKE_WIDTH / 2)));
  }
  for (const [x, o] of [[ring.w, -1], [ring.e, 1]] as const) {
    for (const [a, b] of pieces(extent.z0, extent.z1, [ring.n, ring.s], keepM)) medians.push(rect(x - M, x + M, a, b));
    for (const [a, b] of pieces(extent.z0, extent.z1, [ring.n, ring.s], R)) bikeLanes.push(rect(x + o * (B - BIKE_WIDTH / 2), x + o * (B + BIKE_WIDTH / 2), a, b));
  }
  for (const m of medians) {
    const alongX = m.x1 - m.x0 > m.z1 - m.z0;
    const [a0, a1] = alongX ? [m.x0, m.x1] : [m.z0, m.z1];
    for (let t = a0 + 3; t < a1 - 3; t += 9) treeAt(alongX ? t : (m.x0 + m.x1) / 2, alongX ? (m.z0 + m.z1) / 2 : t, range(rng, 5.5, 7.5));
  }

  // Park: trees on the edges, benches along the cross paths, a fountain in the middle (scene side).
  // Park café: umbrella tables in the north-east lawn next to the kiosk.
  const cafe = rect(pc.x + 3.5, pc.x + 15, park.z0 + 2, pc.z - 2.4);
  for (const dz of [3.4, 6.2]) for (const dx of [4.6, 7.2, 9.8]) if (park.z0 + dz < cafe.z1 - 0.8) tables.push({ x: pc.x + dx, z: park.z0 + dz, tone: tables.length });
  const benches: Bench[] = [];
  for (let t = park.x0 + 3; t <= park.x1 - 3; t += 6) {
    treeAt(t, park.z1 - 2.6, range(rng, 7, 9.5));
    if (Math.abs(t - pc.x) > 8.5 && !inRect(cafe, { x: t + 1.5, z: park.z0 + 2.2 }, 1.5)) treeAt(t + 1.5, park.z0 + 2.2, range(rng, 5, 7));
  }
  // Clipped plane trees at the plaza's four corners.
  for (const [x, z] of [[plaza.x0 + 0.9, plaza.z0 + 0.9], [plaza.x1 - 0.9, plaza.z0 + 0.9], [plaza.x0 + 0.9, plaza.z1 - 0.9], [plaza.x1 - 0.9, plaza.z1 - 0.9]] as const) treeAt(x, z, range(rng, 5, 6.5));
  for (const dx of [-14, -8, 8, 14]) {
    benches.push({ x: pc.x + dx, z: pc.z - 1.6, yaw: 0 }, { x: pc.x + dx, z: pc.z + 1.6, yaw: Math.PI });
  }
  // Promenade benches along the pond, facing the water.
  for (const dx of [-10.5, -4, 4, 10.5]) if (Math.abs(dx) < pondHalf + 1) benches.push({ x: pc.x + dx, z: pond.z0 - 1, yaw: 0 });
  // People sitting: on every other bench and at most café tables.
  const sitters: Sitter[] = [];
  benches.forEach((b, i) => {
    if (i % 2 === 0) sitters.push({ x: b.x - 0.4, z: b.z, yaw: b.yaw, tone: i });
    if (i % 4 === 0) sitters.push({ x: b.x + 0.35, z: b.z, yaw: b.yaw, tone: i + 3 });
  });
  tables.forEach((t, i) => {
    if (i % 3 !== 2) sitters.push({ x: t.x - 0.62, z: t.z, yaw: -Math.PI / 2, tone: i });
    if (i % 2 === 0) sitters.push({ x: t.x + 0.62, z: t.z, yaw: Math.PI / 2, tone: i + 2 });
  });

  // Bollards: across the park entrance, along the plaza's street edge and both sides of the hotel forecourt.
  const bollards: CityXZ[] = [];
  for (const dx of [-1.5, -0.5, 0.5, 1.5]) bollards.push({ x: pc.x + dx, z: park.z0 + 0.3 });
  for (let k = 0; k <= 6; k++) {
    const x = plaza.x0 + 0.4 + ((plaza.x1 - plaza.x0 - 0.8) * k) / 6;
    if (Math.abs(x - pc.x) > 1.5) bollards.push({ x, z: plaza.z0 - 0.3 });
  }
  const fc = hotel.forecourt;
  for (let z = fc.z0 + 1; z <= fc.z1 - 0.6; z += 2) bollards.push({ x: fc.x0 + 0.4, z }, { x: fc.x1 - 0.4, z });

  const signals: SignalHead[] = [];
  const pole = R + 0.4;
  // A head per approach on the near-right corner; the corner on the campus side stays clear, so that
  // approach gets a far-side head on the diagonally opposite corner instead.
  intersections.forEach((n, idx) => {
    const heads: [Axis, number, number, number, number][] = [
      ['x', -1, 1, -1, 0], // eastbound
      ['x', 1, -1, 1, 0], // westbound
      ['z', -1, -1, 0, -1], // southbound
      ['z', 1, 1, 0, 1], // northbound
    ];
    for (const [axis, sx, sz, fx, fz] of heads) {
      let x = n.x + sx * pole;
      let z = n.z + sz * pole;
      if (inRect(clear, { x, z })) {
        x = n.x - sx * pole;
        z = n.z - sz * pole;
      }
      signals.push({ node: idx, axis, x, z, fx, fz });
    }
  });

  // Vehicle paths: the inner lanes form a clockwise ring (right turns only, nothing crosses), and every
  // ring road carries straight through traffic both ways (wrapping out of sight in the haze).
  const L = LANE_OFFSET;
  const raw: { pts: CityXZ[]; closed: boolean }[] = [{ pts: roundedLoop(rect(ring.w + L, ring.e - L, ring.n + L, ring.s - L), 2.6), closed: true }];
  for (const z of [ring.n, ring.s]) {
    raw.push({ pts: [{ x: extent.x0, z: z + L }, { x: extent.x1, z: z + L }], closed: false });
    raw.push({ pts: [{ x: extent.x1, z: z - L }, { x: extent.x0, z: z - L }], closed: false });
  }
  for (const x of [ring.w, ring.e]) {
    raw.push({ pts: [{ x: x - L, z: extent.z0 }, { x: x - L, z: extent.z1 }], closed: false });
    raw.push({ pts: [{ x: x + L, z: extent.z1 }, { x: x + L, z: extent.z0 }], closed: false });
  }
  const vehiclePaths: CityPath[] = raw.map((r) => {
    const p = makePath(r.pts, r.closed);
    return { ...p, stops: stopsFor(p, intersections, STOP_DIST, L) };
  });

  // Pedestrian paths: the campus sidewalk loop, and both outer sidewalks of every ring road (two walking
  // lines each). Outer lines cross the side roads on the crosswalks.
  const sw = R + W / 2;
  const ped: { pts: CityXZ[]; closed: boolean }[] = [{ pts: roundedLoop(rect(ring.w + sw, ring.e - sw, ring.n + sw, ring.s - sw), 1.2), closed: true }];
  for (const z of [ring.n - sw, ring.s + sw]) {
    ped.push({ pts: [{ x: extent.x0, z: z - 0.6 }, { x: extent.x1, z: z - 0.6 }], closed: false });
    ped.push({ pts: [{ x: extent.x1, z: z + 0.6 }, { x: extent.x0, z: z + 0.6 }], closed: false });
  }
  for (const x of [ring.w - sw, ring.e + sw]) {
    ped.push({ pts: [{ x: x + 0.6, z: extent.z0 }, { x: x + 0.6, z: extent.z1 }], closed: false });
    ped.push({ pts: [{ x: x - 0.6, z: extent.z1 }, { x: x - 0.6, z: extent.z0 }], closed: false });
  }
  const pedestrianPaths: CityPath[] = ped.map((r) => {
    const p = makePath(r.pts, r.closed);
    return { ...p, stops: pedestrianStops(p, intersections) };
  });

  // Bike lanes: one-way on the outer edge of each ring road (keep right), straight through the boxes.
  const bikeRaw: CityXZ[][] = [
    [{ x: extent.x1, z: ring.n - B }, { x: extent.x0, z: ring.n - B }],
    [{ x: extent.x0, z: ring.s + B }, { x: extent.x1, z: ring.s + B }],
    [{ x: ring.e + B, z: extent.z1 }, { x: ring.e + B, z: extent.z0 }],
    [{ x: ring.w - B, z: extent.z0 }, { x: ring.w - B, z: extent.z1 }],
  ];
  const bikePaths: CityPath[] = bikeRaw.map((pts) => {
    const p = makePath(pts, false);
    return { ...p, stops: stopsFor(p, intersections, STOP_DIST, B) };
  });
  const loop = makePath(roundedLoop(rect(park.x0 + 1.2, park.x1 - 1.2, park.z0 + 1.2, park.z1 - 1.2), 2.5), true);
  const parkPaths: CityPath[] = [{ ...loop, stops: [] }];

  return { campus, clear, extent, ring, roads, sidewalks, crosswalks, intersections, blocks, park, pond, kiosk, plaza, pool, sculpture, hotel, bollards, medians, bikeLanes, tables, sitters, buildings, trees, lamps, signals, benches, vehiclePaths, pedestrianPaths, bikePaths, parkPaths };
}

/** Floors that fit under the height cap at `d` metres from the campus. */
const floorsAt = (d: number, max: number): number => Math.min(max, Math.floor((heightCap(d) - PARAPET) / STOREY));

/**
 * Grand hotel in the block behind the campus, facing the street toward the campus: a front block behind a
 * forecourt with a porte-cochère, a taller rear block stepping up as the cap allows.
 */
function hotelIn(block: CityRect, campus: CityRect): Hotel {
  const front = block.z1; // street side (toward the campus)
  const dOf = (z: number): number => rectDistance(campus, rect(block.x0, block.x1, z - 1, z));
  const hw = Math.min(11, (block.x1 - block.x0) / 2 - 1.2);
  const cx = block.x1 - 0.8 - hw;
  const fz = front - 10.4;
  const mk = (x0: number, x1: number, z0: number, z1: number, floors: number, style: BuildingStyle, h = floors * STOREY + PARAPET): Building => ({ ...rect(x0, x1, z0, z1), h, floors, tone: 2, style });
  const a = mk(cx - hw, cx + hw, fz - 12, fz, floorsAt(dOf(fz), 5), 'hotel');
  const b = mk(cx - hw + 2, cx + hw - 2, Math.max(block.z0 + 1, fz - 23), fz - 12, floorsAt(dOf(fz - 12), 6), 'hotel');
  const canopy = mk(cx - 5, cx + 5, fz, fz + 6.4, 1, 'canopy', 4.6);
  return { blocks: [a, b], canopy, forecourt: rect(cx - hw, cx + hw, fz, front), doorman: { x: cx + 1.8, z: fz + 1.0, yaw: -Math.PI / 2 } };
}

/** Pedestrian stops: at the kerb before each crosswalk the walking line crosses. */
function pedestrianStops(p: Omit<CityPath, 'stops'>, nodes: readonly Intersection[]): Stop[] {
  if (p.closed) return [];
  const out: Stop[] = [];
  const a = p.pts[0];
  const b = p.pts[1];
  if (!a || !b) return out;
  const axis: Axis = Math.abs(b.x - a.x) > Math.abs(b.z - a.z) ? 'x' : 'z';
  const dir = axis === 'x' ? Math.sign(b.x - a.x) : Math.sign(b.z - a.z);
  nodes.forEach((n, idx) => {
    const c = axis === 'x' ? n.x : n.z;
    const kerb = c - dir * (ROAD_HALF + 0.3);
    const s = axis === 'x' ? (kerb - a.x) * dir : (kerb - a.z) * dir;
    // Only nodes whose side road this walking line actually crosses.
    const lateral = axis === 'x' ? Math.abs(a.z - n.z) : Math.abs(a.x - n.x);
    if (lateral < ROAD_HALF + WALK_WIDTH + 0.1 && s > 0 && s < p.length) out.push({ s, node: idx, axis });
  });
  return out.sort((u, v) => u.s - v.s);
}

const TONES = 6;

/** Fills a block with low/mid-rise lots; heights follow the distance cap (never taller near the campus). */
function fillBlock(b: CityRect, campus: CityRect, reserved: readonly CityRect[], rng: Rng, out: Building[], tables: CafeTable[], terraces: { left: number }): void {
  const setback = 0.8;
  const alley = 1.6;
  const cameraSide = b.z0 > campus.z1 || b.x0 > campus.x1;
  const maxFloors = cameraSide ? MAX_FLOORS.cameraSide : MAX_FLOORS.back;
  let z = b.z0 + setback;
  while (z < b.z1 - setback - 6) {
    const depth = Math.min(range(rng, 8, 13), b.z1 - setback - z);
    let x = b.x0 + setback;
    while (x < b.x1 - setback - 5) {
      const width = Math.min(range(rng, 7, 13), b.x1 - setback - x);
      const lot = rect(x, x + width, z, z + depth);
      x += width + alley;
      if (width < 5 || depth < 6) continue;
      if (reserved.some((r) => rectsOverlap(lot, r))) continue;
      const top = floorsAt(rectDistance(campus, lot), maxFloors);
      if (top < 1) continue;
      if (rng() < 0.12) {
        // A few open lots: the first ones become café terraces with umbrella tables, the rest stay lawn.
        if (terraces.left > 0) {
          terraces.left--;
          for (let tz = lot.z0 + 1.6; tz < Math.min(lot.z1 - 1.4, lot.z0 + 7); tz += 2.8) for (let tx = lot.x0 + 1.6; tx < lot.x1 - 1.4; tx += 2.8) tables.push({ x: tx, z: tz, tone: tables.length });
        }
        continue;
      }
      // Glass towers only where the cap allows six floors or more, and then at full height.
      const floors = top >= 6 ? top : Math.max(1, Math.round(range(rng, Math.max(1, top * 0.5), top)));
      out.push({ ...lot, h: floors * STOREY + PARAPET, floors, tone: Math.floor(rng() * TONES), style: floors >= 6 ? 'tower' : 'midrise' });
    }
    z += depth + alley;
  }
}

// ---- simulation ----

export interface VehicleSpec {
  readonly kind: VehicleKind;
  readonly length: number;
  readonly width: number;
  readonly vmax: number;
}
export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  car: { kind: 'car', length: 4.9, width: 1.92, vmax: 4.8 },
  taxi: { kind: 'taxi', length: 5.25, width: 1.95, vmax: 4.6 },
  bus: { kind: 'bus', length: 6.0, width: 2.05, vmax: 3.6 },
};
/** Real-world body sizes (m) and wheel layout per style (rev 37; no copy of any real model). */
export interface BodySpec {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly wheelbase: number;
  readonly wheelR: number;
}
export const BODY_SPECS: Record<BodyStyle, BodySpec> = {
  sedan: { length: 5.05, width: 1.9, height: 1.47, wheelbase: 3.05, wheelR: 0.36 },
  tourer: { length: 4.75, width: 1.96, height: 1.3, wheelbase: 2.85, wheelR: 0.37 },
  suv: { length: 4.95, width: 2.0, height: 1.68, wheelbase: 3.0, wheelR: 0.4 },
  convertible: { length: 4.6, width: 1.9, height: 1.28, wheelbase: 2.75, wheelR: 0.35 },
  limousine: { length: 5.3, width: 1.95, height: 1.5, wheelbase: 3.25, wheelR: 0.37 },
  shuttle: { length: 6.0, width: 2.05, height: 2.5, wheelbase: 3.9, wheelR: 0.4 },
};
/** Car body styles in order of appearance: mostly sedans and SUVs, a few grand tourers and convertibles. */
const CAR_BODIES: readonly BodyStyle[] = ['sedan', 'suv', 'tourer', 'sedan', 'convertible', 'suv', 'sedan', 'tourer', 'suv', 'convertible'];
/** Bicycle length (m) and cruising speed range (m/s). */
export const BIKE_LENGTH = 1.8;
const BIKE_SPEED = [3.0, 3.8] as const;

export interface Vehicle {
  readonly kind: VehicleKind;
  readonly body: BodyStyle;
  readonly path: number;
  readonly length: number;
  readonly vmax: number;
  s: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  /** Paint palette index (scene side). */
  readonly tone: number;
}
export interface Pedestrian {
  readonly path: number;
  readonly speed: number;
  s: number;
  x: number;
  z: number;
  yaw: number;
  /** Walking cycle phase (rad) for the step bob. */
  phase: number;
  walking: boolean;
  readonly tone: number;
  /** Lateral offset (m, right of the heading) from the walking line: couples walk side by side. */
  readonly side: number;
  /** Walks a dog (scene side draws it just ahead). */
  readonly dog: boolean;
  /** Jogging (park loop only). */
  readonly jog: boolean;
}
export interface Cyclist {
  readonly path: number;
  readonly vmax: number;
  s: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  readonly tone: number;
}
export interface CitySim {
  readonly plan: CityPlan;
  t: number;
  readonly vehicles: Vehicle[];
  /** Sidewalk pedestrians (they wait at the crosswalk lights). */
  readonly pedestrians: Pedestrian[];
  /** Strollers, a couple with a dog and joggers on the park loop. */
  readonly parkGoers: Pedestrian[];
  readonly cyclists: Cyclist[];
}

const ACCEL = 1.4;
const DECEL = 3.2;
const MAX_DECEL = 9;
const MIN_GAP = 1.6;
const LOOKAHEAD = 40;

/** Calm mix per path: the ring carries the shuttle, a taxi and a car; through lanes one or two cars or taxis, one shuttle. */
function vehicleMix(pathIdx: number, rng: Rng): VehicleKind[] {
  if (pathIdx === 0) return ['bus', 'taxi', 'car'];
  const mix: VehicleKind[] = [pathIdx % 3 === 0 ? 'taxi' : 'car'];
  if (pathIdx % 2 === 0) mix.push(rng() < 0.5 ? 'taxi' : 'car');
  if (pathIdx === 5) mix.push('bus');
  return mix;
}

export function createCitySim(plan: CityPlan, seed = 7): CitySim {
  const rng = createRng(seed ^ 0x5eed);
  const vehicles: Vehicle[] = [];
  let carCount = 0;
  plan.vehiclePaths.forEach((path, i) => {
    const kinds = vehicleMix(i, rng);
    const slot = path.length / kinds.length;
    kinds.forEach((kind, k) => {
      const body: BodyStyle = kind === 'taxi' ? 'limousine' : kind === 'bus' ? 'shuttle' : (CAR_BODIES[carCount++ % CAR_BODIES.length] ?? 'sedan');
      const spec = BODY_SPECS[body];
      // Spawn outside the intersection approaches and clear of vehicles already placed (any path).
      let s = slot * k;
      for (let attempt = 0; attempt < 80; attempt++) {
        s = attempt < 40 ? slot * k + range(rng, 0, slot * 0.6) : range(rng, 0, path.length);
        const q = pathPoint(path, s);
        const inBox = plan.intersections.some((n) => Math.abs(n.x - q.x) < STOP_DIST + spec.length && Math.abs(n.z - q.z) < STOP_DIST + spec.length);
        const crowded = vehicles.some((u) => Math.hypot(u.x - q.x, u.z - q.z) < 14 && Math.cos(u.yaw) * q.dx - Math.sin(u.yaw) * q.dz > -0.5);
        if (!inBox && !crowded) break;
      }
      const v: Vehicle = { kind, body, path: i, length: spec.length, vmax: VEHICLE_SPECS[kind].vmax * range(rng, 0.9, 1.05), s, speed: 0, x: 0, z: 0, yaw: 0, tone: Math.floor(rng() * 6) };
      vehicles.push(v);
      placeOn(path, v);
    });
  });
  // Relaxed strollers; on every outer sidewalk line the first walker is a couple, two of them with a dog.
  const walker = (path: number, s: number, speed: number, side = 0, dog = false, jog = false): Pedestrian => ({ path, speed, s, x: 0, z: 0, yaw: 0, phase: range(rng, 0, Math.PI * 2), walking: true, tone: Math.floor(rng() * 7), side, dog, jog });
  const pedestrians: Pedestrian[] = [];
  plan.pedestrianPaths.forEach((path, i) => {
    const count = i === 0 ? 6 : 3;
    for (let k = 0; k < count; k++) {
      const s = (path.length / count) * (k + range(rng, 0, 0.6));
      const speed = range(rng, 0.75, 1.05);
      if (i > 0 && k === 0) pedestrians.push(walker(i, s, speed, -0.28), walker(i, s, speed, 0.28, i % 4 === 1));
      else pedestrians.push(walker(i, s, speed));
    }
  });
  const parkGoers: Pedestrian[] = [];
  plan.parkPaths.forEach((path, i) => {
    const L = path.length;
    const sp = range(rng, 0.7, 0.85);
    parkGoers.push(walker(i, L * 0.1, sp, 0.25), walker(i, L * 0.1, sp, 0.7, true));
    parkGoers.push(walker(i, L * 0.55, range(rng, 0.7, 0.9), 0.45));
    for (const f of [0.3, 0.7, 0.9]) parkGoers.push(walker(i, L * f, range(rng, 2.2, 2.6), -0.45, false, true));
  });
  const cyclists: Cyclist[] = [];
  plan.bikePaths.forEach((path, i) => {
    for (const f of [0.15, 0.6]) {
      const c: Cyclist = { path: i, vmax: range(rng, BIKE_SPEED[0], BIKE_SPEED[1]), s: path.length * (f + range(rng, 0, 0.1)), speed: 0, x: 0, z: 0, yaw: 0, tone: Math.floor(rng() * 7) };
      placeCyclist(path, c);
      cyclists.push(c);
    }
  });
  const sim: CitySim = { plan, t: 0, vehicles, pedestrians, parkGoers, cyclists };
  for (const v of vehicles) place(sim, v);
  for (const p of pedestrians) placePed(plan.pedestrianPaths, p);
  for (const p of parkGoers) placePed(plan.parkPaths, p);
  return sim;
}

function placeCyclist(path: CityPath, c: Cyclist): void {
  const p = pathPoint(path, c.s);
  c.x = p.x;
  c.z = p.z;
  c.yaw = Math.atan2(-p.dz, p.dx);
}

/** Signal state at intersection `node` for traffic along `axis`. */
export function signalState(sim: CitySim, node: number, axis: Axis): Signal {
  const n = sim.plan.intersections[node];
  return signalAt(sim.t + (n?.offset ?? 0), axis);
}

function place(sim: CitySim, v: Vehicle): void {
  const path = sim.plan.vehiclePaths[v.path];
  if (path) placeOn(path, v);
}
function placeOn(path: CityPath, v: Vehicle): void {
  const p = pathPoint(path, v.s);
  v.x = p.x;
  v.z = p.z;
  v.yaw = Math.atan2(-p.dz, p.dx);
}
function placePed(paths: readonly CityPath[], p: Pedestrian): void {
  const path = paths[p.path];
  if (!path) return;
  const q = pathPoint(path, p.s);
  p.x = q.x - q.dz * p.side;
  p.z = q.z + q.dx * p.side;
  p.yaw = Math.atan2(-q.dz, q.dx);
}

/** Distance along the path from `s` to the next red/yellow stop line the vehicle must respect. */
function stopAhead(sim: CitySim, path: CityPath, s: number, speed: number, front: number): number {
  let best = Infinity;
  for (const st of path.stops) {
    let d = st.s - s;
    if (path.closed && d < -front) d += path.length;
    d -= front; // distance from the front bumper
    if (d < -0.05 || d > LOOKAHEAD) continue;
    const sig = signalState(sim, st.node, st.axis);
    if (sig === 'green') continue;
    // Too close to stop comfortably (or even hard, once red): it is already committed and goes through.
    const need = (speed * speed) / (2 * (sig === 'yellow' ? DECEL : MAX_DECEL));
    if (d < need - 0.3) continue;
    best = Math.min(best, Math.max(0, d));
  }
  return best;
}

const SAMPLE_STEP = 1.5;
const SAMPLES = Math.ceil(LOOKAHEAD / SAMPLE_STEP);

/**
 * Gap to the nearest vehicle ahead along the vehicle's own future path (any path: same lane, merges and
 * curves alike). Another vehicle blocks when it sits on a sample of the path ahead and heads the same way.
 */
function leaderAhead(sim: CitySim, v: Vehicle, path: CityPath): { gap: number; speed: number } {
  let gap = Infinity;
  let speed = 0;
  // Only vehicles within reach can be on the path ahead.
  const near = sim.vehicles.filter((u) => u !== v && Math.abs(u.x - v.x) < LOOKAHEAD + 2 && Math.abs(u.z - v.z) < LOOKAHEAD + 2);
  if (!near.length) return { gap, speed };
  for (let k = 1; k <= SAMPLES; k++) {
    const ds = k * SAMPLE_STEP;
    if (!path.closed && v.s + ds > path.length) break;
    const q = pathPoint(path, v.s + ds);
    for (const u of near) {
      if (Math.abs(u.x - q.x) > 1.3 || Math.abs(u.z - q.z) > 1.3) continue;
      if (Math.cos(u.yaw) * q.dx - Math.sin(u.yaw) * q.dz < 0.6) continue;
      const g = ds - (u.length + v.length) / 2;
      if (g < gap) {
        gap = g;
        speed = u.speed;
      }
    }
    if (gap < Infinity) break; // nearer samples come first
  }
  return { gap, speed };
}

/** Space a vehicle needs past a stop line to clear the intersection box. */
const BOX_CLEAR = STOP_DIST + ROAD_HALF + 1;

function stepVehicles(sim: CitySim, dt: number): void {
  // Decide every target speed from the same snapshot, then move.
  const targets = sim.vehicles.map((v) => {
    const path = sim.plan.vehiclePaths[v.path];
    if (!path) return 0;
    const front = v.length / 2;
    const lead = leaderAhead(sim, v, path);
    let gap = lead.gap - MIN_GAP;
    const stop = stopAhead(sim, path, v.s, v.speed, front);
    if (stop < Infinity) gap = Math.min(gap, stop - 0.4);
    // Keep the box clear: do not enter it when a stopped queue leaves no room behind the far side.
    const line = nextLine(path, v.s, front);
    if (line >= 0.3 && line < LOOKAHEAD && lead.speed < 2 && lead.gap - line < BOX_CLEAR) gap = Math.min(gap, line - 0.4);
    return Math.min(v.vmax, Math.sqrt(2 * DECEL * Math.max(0, gap)));
  });
  sim.vehicles.forEach((v, i) => {
    const target = targets[i] ?? 0;
    v.speed = target > v.speed ? Math.min(target, v.speed + ACCEL * dt) : target;
    const path = sim.plan.vehiclePaths[v.path];
    if (!path) return;
    v.s += v.speed * dt;
    if (v.s >= path.length) {
      // Closed paths loop. Open paths wrap out of sight at the city edge, but only onto a free start.
      const s = v.s - path.length;
      const busy = !path.closed && sim.vehicles.some((u) => u !== v && u.path === v.path && u.s < path.length / 2 && u.s - u.length / 2 < s + v.length / 2 + MIN_GAP + 1);
      if (busy) {
        v.s = path.length;
        v.speed = 0;
      } else v.s = s;
    }
    placeOn(path, v);
  });
}

/** Distance from the front bumper to the next stop line ahead (any signal), or Infinity. */
function nextLine(path: CityPath, s: number, front: number): number {
  let best = Infinity;
  for (const st of path.stops) {
    let d = st.s - s;
    if (path.closed && d < -front) d += path.length;
    d -= front;
    if (d >= 0 && d < best) best = d;
  }
  return best;
}

function stepPedestrians(sim: CitySim, dt: number): void {
  for (const p of sim.pedestrians) {
    const path = sim.plan.pedestrianPaths[p.path];
    if (!path) continue;
    let wait = false;
    for (const st of path.stops) {
      const d = st.s - p.s;
      if (d < 0 || d > 0.6) continue;
      if (signalState(sim, st.node, st.axis) !== 'green') wait = true;
    }
    p.walking = !wait;
    if (wait) continue;
    p.s += p.speed * dt;
    if (p.s >= path.length) p.s -= path.length;
    p.phase = (p.phase + p.speed * dt * 5.5) % (Math.PI * 2);
    placePed(sim.plan.pedestrianPaths, p);
  }
  for (const p of sim.parkGoers) {
    const path = sim.plan.parkPaths[p.path];
    if (!path) continue;
    p.s = (p.s + p.speed * dt) % path.length;
    p.phase = (p.phase + p.speed * dt * (p.jog ? 3.2 : 5.5)) % (Math.PI * 2);
    placePed(sim.plan.parkPaths, p);
  }
}

/** Cyclists: cruise, keep a gap to the rider ahead, stop at red and yellow like the cars. */
function stepCyclists(sim: CitySim, dt: number): void {
  for (const c of sim.cyclists) {
    const path = sim.plan.bikePaths[c.path];
    if (!path) continue;
    let gap = Infinity;
    for (const u of sim.cyclists) if (u !== c && u.path === c.path && u.s > c.s) gap = Math.min(gap, u.s - c.s - BIKE_LENGTH - MIN_GAP);
    const stop = stopAhead(sim, path, c.s, c.speed, BIKE_LENGTH / 2);
    if (stop < Infinity) gap = Math.min(gap, stop - 0.4);
    const target = Math.min(c.vmax, Math.sqrt(2 * DECEL * Math.max(0, gap)));
    c.speed = target > c.speed ? Math.min(target, c.speed + ACCEL * dt) : target;
    c.s += c.speed * dt;
    if (c.s >= path.length) {
      const s = c.s - path.length;
      const busy = sim.cyclists.some((u) => u !== c && u.path === c.path && u.s < s + BIKE_LENGTH + MIN_GAP);
      if (busy) {
        c.s = path.length;
        c.speed = 0;
      } else c.s = s;
    }
    placeCyclist(path, c);
  }
}

/** Advances the city by `dt` seconds (sub-stepped; deterministic for a given seed and dt sequence). */
export function stepCitySim(sim: CitySim, dt: number): void {
  if (!(dt > 0)) return;
  let left = Math.min(dt, 1);
  while (left > 1e-9) {
    const h = Math.min(left, 0.05);
    sim.t += h;
    stepVehicles(sim, h);
    stepPedestrians(sim, h);
    stepCyclists(sim, h);
    left -= h;
  }
}
