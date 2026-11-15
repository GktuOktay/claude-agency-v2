// Spec 0002 AC-12 (navigation parts), T-5: layout constants, waypoint graphs, spur nodes, exception
// zones, keep-right offset lanes, shortest path and offset path length. Pure: no three.js except the
// scene model (see layout-scene.test.ts).
import { describe, it, expect } from 'vitest';
import { CABIN_CAPACITY } from '../src/sim/elevator';
import {
  FLOOR_COUNT,
  FURNITURE_CLEARANCE,
  HALF_WIDTH,
  LANE_OFFSET,
  MEETING_ROOM,
  MEETING_SEAT_RADIUS,
  SPOT_CLEARANCE,
  STAFF_LANDING,
  STAFF_SHAFT,
  floorLayout,
  separationExempt,
  zoneAt,
  type FloorLayout,
  type Rect,
  type SpotKind,
  type XZ,
} from '../src/sim/layout';
import {
  buildFloorGraph,
  distanceToGraph,
  nearestNode,
  offsetPath,
  pathLength,
  pointAlong,
  pointSegmentDistance,
  route,
  shortestPath,
  type FloorGraph,
} from '../src/sim/nav';
import { sortUnits } from '../src/ui/unitList';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import type { TowerData } from '../src/data/types';

function data(): TowerData {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

function layouts(d = data()): FloorLayout[] {
  return Array.from({ length: FLOOR_COUNT }, (_, f) =>
    floorLayout(
      f,
      sortUnits(d.units)
        .filter((u) => u.floor === f)
        .map((u) => ({ id: u.id, ceo: u.tier === 'ceo' })),
    ),
  );
}

/** Stationary spots of REQ-13 (plus home, call, lead and sign spots, which are stationary too). */
const STATIONARY: readonly SpotKind[] = ['seat', 'home', 'handover', 'coffee', 'landing-wait', 'landing-call', 'signing', 'meeting-seat', 'meeting-lead', 'meeting-sign', 'cabin'];

function segRectDistance(a: XZ, b: XZ, r: Rect): number {
  const inside = (p: XZ): boolean => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
  if (inside(a) || inside(b)) return 0;
  const corners: XZ[] = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ];
  // Segment crossing a rect side -> 0.
  const cross = (p: XZ, q: XZ, s: XZ, t: XZ): boolean => {
    const o = (u: XZ, v: XZ, w: XZ): number => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
    return o(p, q, s) * o(p, q, t) < 0 && o(s, t, p) * o(s, t, q) < 0;
  };
  let d = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = corners[i]!;
    const t = corners[(i + 1) % 4]!;
    if (cross(a, b, s, t)) return 0;
    d = Math.min(d, pointSegmentDistance(s, a, b), pointSegmentDistance(a, s, t), pointSegmentDistance(b, s, t));
  }
  return d;
}

function laneSegments(g: FloorGraph): [XZ, XZ][] {
  const out: [XZ, XZ][] = [];
  for (const e of g.edges) {
    if (!e.through) continue;
    const a = g.nodes.get(e.a)!;
    const b = g.nodes.get(e.b)!;
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
    for (const s of [0, LANE_OFFSET, -LANE_OFFSET]) out.push([{ x: a.x + n.x * s, z: a.z + n.z * s }, { x: b.x + n.x * s, z: b.z + n.z * s }]);
  }
  return out;
}

describe('waypoint graphs per floor (AC-12)', () => {
  const all = layouts();
  const graphs = all.map(buildFloorGraph);

  it('builds one connected graph per floor', () => {
    expect(graphs).toHaveLength(FLOOR_COUNT);
    for (const g of graphs) {
      const seen = new Set<string>();
      const first = [...g.nodes.keys()][0] ?? '';
      const stack = [first];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const [n] of g.adjacency.get(id) ?? []) stack.push(n);
      }
      expect(seen.size, `floor ${g.floor}`).toBe(g.nodes.size);
    }
  });

  it('every stationary spot is a spur node: never an end of a through-edge', () => {
    for (const g of graphs) {
      const spotIds = [...g.nodes.values()].filter((n) => n.spot !== undefined).map((n) => n.id);
      expect(spotIds.length).toBeGreaterThan(10);
      for (const e of g.edges) if (e.through) for (const id of [e.a, e.b]) expect(spotIds, `floor ${g.floor} ${id}`).not.toContain(id);
    }
  });

  it('no through-edge, offset lanes included, passes within 0.45 u of a stationary spot', () => {
    for (const g of graphs) {
      const lanes = laneSegments(g);
      for (const n of g.nodes.values()) {
        if (!n.spot || !STATIONARY.includes(n.spot)) continue;
        for (const [a, b] of lanes) expect(pointSegmentDistance(n, a, b), `floor ${g.floor} ${n.id}`).toBeGreaterThanOrEqual(SPOT_CLEARANCE - 1e-9);
      }
    }
  });

  it('every edge segment stays outside every furniture footprint inflated by 0.25 u', () => {
    for (const [f, g] of graphs.entries()) {
      for (const e of g.edges) {
        const a = g.nodes.get(e.a)!;
        const b = g.nodes.get(e.b)!;
        for (const r of all[f]!.footprints) expect(segRectDistance(a, b, r), `floor ${f} ${e.a}->${e.b} vs ${r.name}`).toBeGreaterThanOrEqual(FURNITURE_CLEARANCE - 1e-9);
      }
    }
  });

  it('desk seats, homes, hand-over spots, coffee spots and the landing exist on every floor', () => {
    const d = data();
    for (const g of graphs) {
      for (const u of d.units.filter((x) => x.floor === g.floor)) {
        expect(g.nodes.get(`seat:${u.id}`)?.spot).toBe('seat');
        expect(g.nodes.get(`home:${u.id}`)?.spot).toBe('home');
      }
      for (let i = 0; i < 6; i++) expect(g.nodes.get(`coffee:${i}`)?.spot).toBe('coffee');
      expect([0, 1, 2].map((i) => g.nodes.get(`wait:${i}`)?.spot)).toEqual(['landing-wait', 'landing-wait', 'landing-wait']);
      expect(g.nodes.has(`wait:3`)).toBe(false);
      expect(g.nodes.get('call')?.spot).toBe('landing-call');
      expect([0, 1, 2].map((i) => g.nodes.get(`cabin:${i}`)?.spot)).toEqual(['cabin', 'cabin', 'cabin']);
    }
    expect(graphs[5]!.nodes.get('signing:0')?.spot).toBe('signing');
    expect(graphs[5]!.nodes.get('signing:1')?.spot).toBe('signing');
    for (const g of graphs.slice(0, 5)) {
      for (const u of d.units.filter((x) => x.floor === g.floor)) {
        expect(g.nodes.get(`handover:${u.id}:0`)?.spot).toBe('handover');
        expect(g.nodes.get(`handover:${u.id}:1`)?.spot).toBe('handover');
      }
    }
  });

  it('only floor 3 has the meeting room: 6 seats, a lead spot and a sign spot', () => {
    for (const g of graphs) {
      const seats = [...g.nodes.values()].filter((n) => n.spot === 'meeting-seat');
      expect(seats).toHaveLength(g.floor === 3 ? 6 : 0);
      expect(g.nodes.has('mlead')).toBe(g.floor === 3);
      expect(g.nodes.has('msign')).toBe(g.floor === 3);
    }
  });

  it('every walk from a desk seat to every other stationary spot of its floor exists', () => {
    for (const g of graphs) {
      const spots = [...g.nodes.values()].filter((n) => n.spot !== undefined);
      const seats = spots.filter((n) => n.spot === 'seat');
      for (const s of seats) for (const t of spots) expect(route(g, s.id, t.id), `${s.id} -> ${t.id}`).not.toBeNull();
    }
  });
});

describe('shortest path and offset path (R-2)', () => {
  // Hand-made fixture: an L of aisles with a spur at each end and a shortcut that is longer.
  const fixture: FloorLayout = {
    floor: 0,
    desks: [],
    spareDesks: [],
    footprints: [],
    seatZones: [],
    zones: [],
    aisles: [
      { id: 'h', a: { x: 0, z: 0 }, b: { x: 4, z: 0 } },
      { id: 'v', a: { x: 4, z: 0 }, b: { x: 4, z: 3 } },
    ],
    spots: [
      { id: 'A', kind: 'home', via: 'h', x: 0, z: -1 },
      { id: 'B', kind: 'seat', via: 'v', x: 5, z: 3 },
      { id: 'C', kind: 'coffee', via: 'h', x: 2, z: 1 },
    ],
  };
  const g = buildFloorGraph(fixture);

  it('splits aisles at attach points and joins them at junctions', () => {
    const through = g.edges.filter((e) => e.through);
    expect(through.map((e) => e.length).reduce((s, l) => s + l, 0)).toBeCloseTo(7);
    expect(g.edges.filter((e) => !e.through)).toHaveLength(3);
  });

  it('finds the shortest node path (Dijkstra, centre lines)', () => {
    const p = shortestPath(g, 'A', 'B');
    expect(p?.[0]).toBe('A');
    expect(p?.[p.length - 1]).toBe('B');
    expect(shortestPath(g, 'A', 'nowhere')).toBeNull();
    expect(shortestPath(g, 'A', 'A')).toEqual(['A']);
  });

  it('keeps right on aisle edges: opposite directions run 2 x 0.25 u apart', () => {
    const there = offsetPath(g, shortestPath(g, 'A', 'C')!);
    const back = offsetPath(g, shortestPath(g, 'C', 'A')!);
    // Travelling +x the right-hand side is +z; travelling -x it is -z.
    const midThere = pointAlong(there, pathLength(there) / 2);
    const midBack = pointAlong(back, pathLength(back) / 2);
    expect(midThere.z).toBeCloseTo(LANE_OFFSET);
    expect(midBack.z).toBeCloseTo(-LANE_OFFSET);
    expect(Math.abs(midThere.z - midBack.z)).toBeCloseTo(2 * LANE_OFFSET);
  });

  it('measures the length on the offset path, not the centre line', () => {
    const r = route(g, 'A', 'B')!;
    // A(0,-1) -> spur 1 -> lane start (0, +0.25) -> +x to the right-turn miter (3.75, 0.25)
    // -> +z to (3.75, 3) -> back to the node (4, 3) -> spur 1 to B.
    const expected = 1 + 0.25 + 3.75 + 2.75 + 0.25 + 1;
    expect(r.length).toBeCloseTo(expected, 6);
    expect(r.points[0]).toEqual({ x: 0, z: -1 });
    expect(r.points[r.points.length - 1]).toEqual({ x: 5, z: 3 });
  });

  it('every point of an offset path stays within 0.30 u of a graph edge', () => {
    for (const [from, to] of [['A', 'B'], ['B', 'A'], ['C', 'B'], ['B', 'C']] as const) {
      const pts = route(g, from, to)!.points;
      const len = pathLength(pts);
      for (let s = 0; s <= len; s += 0.05) expect(distanceToGraph(g, pointAlong(pts, s))).toBeLessThanOrEqual(0.3);
    }
  });

  it('on the real floors, offset paths between all spots stay within 0.30 u of the graph', () => {
    for (const lay of layouts()) {
      const fg = buildFloorGraph(lay);
      const spots = [...fg.nodes.values()].filter((n) => n.spot !== undefined).map((n) => n.id);
      for (let i = 0; i < spots.length; i += 3) {
        for (let j = spots.length - 1; j > i; j -= 4) {
          const r = route(fg, spots[i]!, spots[j]!)!;
          for (let s = 0; s <= r.length; s += 0.1) expect(distanceToGraph(fg, pointAlong(r.points, s))).toBeLessThanOrEqual(0.3 + 1e-9);
          expect(r.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('nearestNode is deterministic and respects a filter', () => {
    expect(nearestNode(g, { x: 0.1, z: -0.9 })).toBe('A');
    expect(nearestNode(g, { x: 0.1, z: -0.9 }, (n) => n.spot === 'seat')).toBe('B');
  });
});

describe('exception zones (§7.5c)', () => {
  const all = layouts();

  it('meeting seats have radius 0.35; each landing has exactly 3 waiting spots; the cabin is a zone', () => {
    const f3 = all[3]!;
    const seatZones = f3.zones.filter((z) => z.id.startsWith('mseat:'));
    expect(seatZones).toHaveLength(6);
    for (const z of seatZones) expect(z.r).toBe(MEETING_SEAT_RADIUS);
    for (const l of all) {
      expect(l.zones.filter((z) => z.id.startsWith('wait:'))).toHaveLength(3);
      expect(zoneAt(l, { x: STAFF_SHAFT.x, z: STAFF_SHAFT.z })?.id).toBe('cabin');
    }
  });

  it('two robots on spots are exempt; a walker in the corridor is not', () => {
    const f2 = all[2]!;
    const d = f2.desks[0]!;
    expect(separationExempt(f2, d.seat, d.pair)).toBe(true);
    expect(separationExempt(f2, d.handover[0], d.seat)).toBe(true);
    expect(separationExempt(f2, { x: 0, z: -0.9 }, { x: 0.2, z: -0.9 })).toBe(false);
    expect(separationExempt(f2, STAFF_LANDING.waitingSpots[0]!, { x: 6.9, z: -0.9 })).toBe(false);
  });

  it('spots that may hold two robots side by side are at least 0.45 u apart unless both are zones', () => {
    for (const l of all) {
      const spots = l.spots;
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const a = spots[i]!;
          const b = spots[j]!;
          if (Math.hypot(a.x - b.x, a.z - b.z) < 0.45) expect(separationExempt(l, a, b), `floor ${l.floor} ${a.id} ~ ${b.id}`).toBe(true);
        }
      }
    }
  });
});

describe('meeting-room and staff-landing constants (T-5, used by T-8)', () => {
  const m = MEETING_ROOM;
  const inRect = (p: XZ, r: Rect): boolean => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

  it('table, 6 seats, whiteboard, lead and sign spots lie inside the room bounds', () => {
    expect(m.floor).toBe(3);
    expect(m.seats).toHaveLength(6);
    for (const s of [...m.seats, m.leadSpot, m.signSpot, { x: m.table.x, z: m.table.z }, { x: m.whiteboard.x, z: m.whiteboard.z }]) expect(inRect(s, m.bounds)).toBe(true);
  });

  it('seats sit beside the table, face it, and keep 0.25 u off the table top', () => {
    const t = m.table;
    for (const s of m.seats) {
      const dx = Math.max(Math.abs(s.x - t.x) - t.w / 2, 0);
      expect(dx).toBeGreaterThanOrEqual(0.25);
      // facing: robot front is +z at yaw 0 -> forward = (sin yaw, cos yaw)
      const fwd = { x: Math.sin(s.facing), z: Math.cos(s.facing) };
      expect(fwd.x * (t.x - s.x) + fwd.z * (t.z - s.z)).toBeGreaterThan(0);
    }
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(Math.hypot(m.seats[i]!.x - m.seats[j]!.x, m.seats[i]!.z - m.seats[j]!.z)).toBeGreaterThanOrEqual(2 * 0.3);
  });

  it('the staff shaft is east of the building, its landing entry is at the cabin door', () => {
    expect(STAFF_SHAFT.x - STAFF_SHAFT.cabinHalf).toBeGreaterThan(HALF_WIDTH);
    expect(STAFF_LANDING.entry.x).toBeCloseTo(STAFF_SHAFT.x - STAFF_SHAFT.cabinHalf, 1);
    for (const r of STAFF_LANDING.riderSpots) {
      expect(Math.abs(r.x - STAFF_SHAFT.x)).toBeLessThan(STAFF_SHAFT.cabinHalf - 0.2);
      expect(Math.abs(r.z - STAFF_SHAFT.z)).toBeLessThan(STAFF_SHAFT.cabinHalf - 0.2);
    }
    // Rev 44: one rider spot per cabin place (3 -> 6).
    expect(STAFF_LANDING.riderSpots).toHaveLength(CABIN_CAPACITY);
    expect(CABIN_CAPACITY).toBe(6);
  });
});
