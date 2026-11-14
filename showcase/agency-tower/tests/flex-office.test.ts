// Interior upgrade (KARARLAR Revizyon 31, item 3): green, flexible floor dressing. The dressing never moves a
// desk, seat, spot, aisle or exception zone; its footprints stay clear of every waypoint edge (lanes included)
// and every stationary spot, for any desk count; it stays inside its storey and within its render budget.
import { describe, it, expect } from 'vitest';
import { InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from 'three';
import {
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  FLOOR_TOP,
  FURNITURE_CLEARANCE,
  HALF_DEPTH,
  HALF_WIDTH,
  LANE_OFFSET,
  PENTHOUSE,
  SPOT_CLEARANCE,
  floorLayout,
  type DeskOwner,
  type Rect,
  type XZ,
} from '../src/sim/layout';
import { buildFloorGraph, pointSegmentDistance } from '../src/sim/nav';
import { buildTower, type TowerModel } from '../src/scene/model';
import { DRESSING_PREFIX, buildFloorDressing, dressingFootprints } from '../src/scene/flexOffice';
import { Kit } from '../src/scene/furniture';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import type { TowerData } from '../src/data/types';

function data(): TowerData {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

function owners(floor: number, n: number): DeskOwner[] {
  return Array.from({ length: n }, (_, i) => ({ id: `u${i}`, ceo: floor === PENTHOUSE && i === 0 }));
}

function segRectDistance(a: XZ, b: XZ, r: Rect): number {
  const inside = (p: XZ): boolean => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
  if (inside(a) || inside(b)) return 0;
  const corners: XZ[] = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ];
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

const pointRectDistance = (p: XZ, r: Rect): number => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.z0 - p.z, 0, p.z - r.z1));
const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const contains = (a: Rect, b: Rect): boolean => a.x0 <= b.x0 && a.x1 >= b.x1 && a.z0 <= b.z0 && a.z1 >= b.z1;

/** Rendered vertices: an instanced mesh draws its geometry once per instance. */
function renderedVertices(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) n += (o.geometry.attributes.position?.count ?? 0) * (o instanceof InstancedMesh ? o.count : 1);
  });
  return n;
}
function meshCount(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) n++;
  });
  return n;
}

/** Calls `fn` with every world-space vertex of `o` (instance matrices applied). */
function eachVertex(o: Mesh, fn: (v: Vector3) => void): void {
  const pos = o.geometry.attributes.position;
  if (!pos) return;
  const v = new Vector3();
  const mats: Matrix4[] = [];
  if (o instanceof InstancedMesh) {
    for (let i = 0; i < o.count; i++) {
      const m = new Matrix4();
      o.getMatrixAt(i, m);
      mats.push(m.premultiply(o.matrixWorld));
    }
  } else mats.push(o.matrixWorld);
  for (const m of mats) for (let i = 0; i < pos.count; i++) fn(v.fromBufferAttribute(pos, i).applyMatrix4(m));
}

describe('flexible green floor dressing: navigation clearance', () => {
  const counts = [1, 2, 3, 4, 5, 6, 7, 8];

  it('every dressing footprint keeps 0.25 u from every waypoint edge (0.5 u from aisle centre lines, so the keep-right lanes clear it too), for 1-8 desks per floor', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const rects = dressingFootprints(f);
      expect(rects.length, `floor ${f}`).toBeGreaterThan(8);
      for (const n of counts) {
        const g = buildFloorGraph(floorLayout(f, owners(f, n)));
        for (const e of g.edges) {
          const a = g.nodes.get(e.a)!;
          const b = g.nodes.get(e.b)!;
          const need = FURNITURE_CLEARANCE + (e.through ? LANE_OFFSET : 0);
          for (const r of rects) expect(segRectDistance(a, b, r), `floor ${f} n=${n} ${e.a}->${e.b} vs ${r.name}`).toBeGreaterThanOrEqual(need - 1e-9);
        }
      }
    }
  });

  it('no dressing footprint comes within 0.45 u of a spot or overlaps a layout footprint or chair zone, for 1-8 desks per floor', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const rects = dressingFootprints(f);
      for (const n of counts) {
        const lay = floorLayout(f, owners(f, n));
        for (const r of rects) {
          for (const s of lay.spots) expect(pointRectDistance(s, r), `floor ${f} n=${n} ${s.id} vs ${r.name}`).toBeGreaterThanOrEqual(SPOT_CLEARANCE);
          for (const z of lay.zones) expect(pointRectDistance(z, r), `floor ${f} n=${n} zone ${z.id} vs ${r.name}`).toBeGreaterThan(z.r);
          for (const o of [...lay.footprints, ...lay.seatZones]) expect(overlaps(r, o), `floor ${f} n=${n} ${r.name} overlaps ${o.name}`).toBe(false);
        }
      }
    }
  });

  it('dressing footprints lie inside the building and do not overlap each other (a piece may sit wholly inside another, e.g. seating under the pergola)', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const rects = dressingFootprints(f);
      for (const r of rects) {
        expect(r.x0 >= -HALF_WIDTH && r.x1 <= HALF_WIDTH && r.z0 >= -HALF_DEPTH && r.z1 <= HALF_DEPTH, `floor ${f} ${r.name}`).toBe(true);
      }
      rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlaps(a, b) && !contains(a, b) && !contains(b, a), `floor ${f} ${a.name} / ${b.name}`).toBe(false)));
    }
  });
});

describe('flexible green floor dressing: scene', () => {
  const d = data();
  const model: TowerModel = buildTower(d);
  model.root.updateMatrixWorld(true);
  const names = (f: number): string[] => {
    const out: string[] = [];
    model.floors[f]!.group.traverse((o) => {
      if (o.name.startsWith(DRESSING_PREFIX)) out.push(o.name.slice(DRESSING_PREFIX.length));
    });
    return out;
  };

  it('every floor gets greenery (moss wall, tall, hanging and divider plants) and flexible seating (sit-stand desks, focus pods, high table, lounge chairs) and a tea corner', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const n = names(f);
      for (const k of ['moss-wall', 'tea-corner', 'high-table', 'planter-divider']) expect(n, `floor ${f} ${k}`).toContain(k);
      expect(n.filter((x) => x === 'tall-plant').length, `floor ${f} tall plants`).toBeGreaterThanOrEqual(2);
      expect(n.filter((x) => x === 'hanging-plant').length, `floor ${f} hanging plants`).toBeGreaterThanOrEqual(3);
      expect(n.filter((x) => x === 'sit-stand-desk').length, `floor ${f} sit-stand desks`).toBe(2);
      expect(n.filter((x) => x === 'focus-pod').length, `floor ${f} focus pods`).toBe(2);
      expect(n.filter((x) => x === 'lounge-chair').length, `floor ${f} lounge chairs`).toBeGreaterThanOrEqual(2);
    }
  });

  it('glass meeting nooks on floors 0, 1, 2 and 4 (floor 3 keeps its meeting room); the penthouse has a roof terrace garden and a skyline lounge', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) expect(names(f).includes('meeting-nook'), `floor ${f}`).toBe([0, 1, 2, 4].includes(f));
    const p = names(PENTHOUSE);
    for (const k of ['roof-terrace', 'pergola', 'terrace-planter', 'terrace-seating', 'skyline-lounge']) expect(p, k).toContain(k);
    for (let f = 0; f < PENTHOUSE; f++) expect(names(f)).not.toContain('roof-terrace');
  });

  it('every footprint name has a matching dressing group on its floor, and every dressing group a footprint', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      // Containers: the dressing root, the instanced foliage, the baked static meshes and the flat terrace deck.
      const groups = names(f).filter((n) => n !== 'foliage' && n !== 'dressing' && n !== 'roof-terrace' && !n.startsWith('static-'));
      const rects = dressingFootprints(f).map((r) => r.name);
      expect([...new Set(groups)].sort(), `floor ${f}`).toEqual([...new Set(rects)].sort());
    }
  });

  it('plants are instanced: one foliage InstancedMesh per floor with per-instance colours, registered for floor opacity', () => {
    for (const f of model.floors) {
      const fol: InstancedMesh[] = [];
      f.group.traverse((o) => {
        if (o instanceof InstancedMesh && o.name === `${DRESSING_PREFIX}foliage`) fol.push(o);
      });
      expect(fol, `floor ${f.id}`).toHaveLength(1);
      const m = fol[0]!;
      expect(m.count).toBeGreaterThanOrEqual(50);
      expect(m.instanceColor).not.toBeNull();
      const mat: unknown = m.material;
      expect(f.materials.contents.some((x) => x === mat)).toBe(true);
    }
  });

  it('dressing stays inside its own storey: above the floor, below the next slab, inside the shell', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const k = new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });
      const g = buildFloorDressing(k, f, 0x88aacc);
      g.updateMatrixWorld(true);
      let bad = 0;
      let seen = 0;
      g.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        eachVertex(o, (v) => {
          seen++;
          const h = v.y; // the dressing root sits at the floor surface; world y here is height above the root's parent
          if (h - FLOOR_TOP < -0.01 || h - FLOOR_TOP > FLOOR_HEIGHT - FLOOR_TOP - 0.005 || Math.abs(v.x) > HALF_WIDTH || Math.abs(v.z) > HALF_DEPTH) bad++;
        });
      });
      expect(seen, `floor ${f}`).toBeGreaterThan(1000);
      expect(bad, `floor ${f}`).toBe(0);
    }
  });

  it('render budget: the dressing adds at most 60 000 rendered vertices and 30 meshes to the tower', () => {
    const bare = buildTower(d, { dressing: false });
    const dv = renderedVertices(model.root) - renderedVertices(bare.root);
    const dm = meshCount(model.root) - meshCount(bare.root);
    console.info(`[budget] dressing: +${dv} rendered vertices, +${dm} meshes`);
    expect(dv).toBeGreaterThan(10_000);
    expect(dv).toBeLessThanOrEqual(60_000);
    expect(dm).toBeGreaterThan(0);
    expect(dm).toBeLessThanOrEqual(30);
  });

  it('the dressing leaves robots, layouts and the floor-specific props where they were', () => {
    const bare = buildTower(d, { dressing: false });
    expect(model.layouts).toEqual(bare.layouts);
    expect(model.robots.map((r) => [r.homePoint.toArray(), r.workPoint.toArray(), r.coffeePoint.toArray()])).toEqual(bare.robots.map((r) => [r.homePoint.toArray(), r.workPoint.toArray(), r.coffeePoint.toArray()]));
    for (const f of model.floors) {
      const prop = f.group.children.find((c) => c.name.startsWith('floor-prop:'));
      const bareProp = bare.floors[f.id]!.group.children.find((c) => c.name.startsWith('floor-prop:'));
      expect(prop?.name).toBe(bareProp?.name);
      expect(prop?.position.toArray()).toEqual(bareProp?.position.toArray());
    }
  });
});

