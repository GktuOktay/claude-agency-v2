// Campus amenity wing (KARARLAR rev 31): wing levels, zones, sky-bridges, ghosting, nav reach and budgets.
import { describe, it, expect, afterEach } from 'vitest';
import { Group, InstancedMesh, Mesh, PerspectiveCamera, Vector3, type Material, type Object3D } from 'three';
import { buildTower, FLOOR_COUNT, FLOOR_HEIGHT, type FloorMaterials, type TowerModel } from '../src/scene/model';
import { buildCampus } from '../src/scene/campus';
import { PROJECT_ARCHIVE } from '../src/scene/amenities';
import { Kit, mergeStatic } from '../src/scene/furniture';
import { CAMERA_FOV, orgPose, overviewPose, setFrameAspect } from '../src/scene/camera';
import {
  AMENITY_SPOTS,
  BRIDGE_DOOR,
  CAMPUS_BOUNDS,
  CAMPUS_ZONES,
  CORRIDOR_Z,
  FURNITURE_CLEARANCE,
  HALF_WIDTH,
  LANE_OFFSET,
  ROOF_GARDEN_FLOOR,
  SPOT_CLEARANCE,
  WING,
  WING_EAST_X,
  WING_LEVELS,
  WING_WEST_X,
  floorLayout,
  type FloorLayout,
  type Rect,
  type XZ,
} from '../src/sim/layout';
import { buildCampusGraph, buildFloorGraph, pointSegmentDistance, shortestPath, type CampusGraph } from '../src/sim/nav';
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
const towerLayout = (d: TowerData, f: number): FloorLayout =>
  floorLayout(
    f,
    sortUnits(d.units)
      .filter((u) => u.floor === f)
      .map((u) => ({ id: u.id, ceo: u.tier === 'ceo' })),
  );

function segRectDistance(a: XZ, b: XZ, r: Rect): number {
  const inside = (p: XZ): boolean => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
  if (inside(a) || inside(b)) return 0;
  const c: XZ[] = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ];
  const o = (u: XZ, v: XZ, w: XZ): number => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
  let d = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = c[i]!;
    const t = c[(i + 1) % 4]!;
    if (o(a, b, s) * o(a, b, t) < 0 && o(s, t, a) * o(s, t, b) < 0) return 0;
    d = Math.min(d, pointSegmentDistance(s, a, b), pointSegmentDistance(a, s, t), pointSegmentDistance(b, s, t));
  }
  return d;
}

/** Visible with all its ancestors. */
function shown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

const LABELS = ['YEMEKHANE', 'SNACK BAR', 'SPOR SALONU', 'OYUN ALANI', 'UYKU ODALARI', 'AR-GE ★', 'ARŞİV'];

describe('campus nav: bridges and amenity spots (wing levels 0-2)', () => {
  const d = data();
  const graphs = new Map<number, CampusGraph>(WING_LEVELS.map((f) => [f, buildCampusGraph(towerLayout(d, f))]));

  it('the wing has three levels matching tower floors 0-2, and break spots for every amenity kind', () => {
    expect(WING_LEVELS).toEqual([0, 1, 2]);
    const kinds = new Set(AMENITY_SPOTS.map((s) => s.kind));
    for (const k of ['serving', 'snack', 'dining', 'terrace', 'treadmill', 'weights', 'mat', 'ping-pong', 'foosball', 'arcade', 'bean-bag', 'pod', 'lab-bench', 'archive'] as const) expect(kinds.has(k), k).toBe(true);
    expect(AMENITY_SPOTS.filter((s) => s.kind === 'ping-pong')).toHaveLength(2);
    expect(new Set(AMENITY_SPOTS.map((s) => s.id)).size).toBe(AMENITY_SPOTS.length);
    for (const s of AMENITY_SPOTS) {
      expect(s.x, s.id).toBeGreaterThan(WING_WEST_X);
      expect(s.x, s.id).toBeLessThan(WING_EAST_X);
    }
  });

  it('is additive: every tower node and edge of the floor graph is kept', () => {
    for (const f of WING_LEVELS) {
      const base = buildFloorGraph(towerLayout(d, f));
      const g = graphs.get(f)!;
      for (const [id, n] of base.nodes) expect(g.nodes.get(id), `floor ${f} ${id}`).toEqual(n);
      const keyOf = (a: string, b: string): string => [a, b].sort().join('|');
      const edges = new Set(g.edges.map((e) => keyOf(e.a, e.b)));
      for (const e of base.edges) {
        // A tower aisle edge may be split by a new junction; it must then still be connected end to end.
        if (!edges.has(keyOf(e.a, e.b))) expect(shortestPath(g, e.a, e.b), `floor ${f} ${e.a}-${e.b}`).not.toBeNull();
      }
    }
  });

  it('a glass sky-bridge joins the tower corridor to the wing spine through both door gaps', () => {
    for (const f of WING_LEVELS) {
      const g = graphs.get(f)!;
      // Through-edges on the corridor line reach the door line x from both sides (lanes stay inside the gap).
      const onLine = g.edges.filter((e) => {
        const a = g.nodes.get(e.a)!;
        const b = g.nodes.get(e.b)!;
        return e.through && Math.abs(a.z - CORRIDOR_Z) < 1e-9 && Math.abs(b.z - CORRIDOR_Z) < 1e-9;
      });
      expect(CORRIDOR_Z - LANE_OFFSET).toBeGreaterThan(BRIDGE_DOOR.z0 + 0.2);
      expect(CORRIDOR_Z + LANE_OFFSET).toBeLessThan(BRIDGE_DOOR.z1 - 0.2);
      const crosses = (x: number): boolean => {
        const span = onLine.map((e) => [Math.min(g.nodes.get(e.a)!.x, g.nodes.get(e.b)!.x), Math.max(g.nodes.get(e.a)!.x, g.nodes.get(e.b)!.x)] as const);
        return span.some(([lo, hi]) => lo < x - 0.1 && hi >= x - 1e-9) && span.some(([lo, hi]) => lo <= x + 1e-9 && hi > x + 0.1);
      };
      expect(crosses(-HALF_WIDTH), `floor ${f} tower door`).toBe(true);
      expect(crosses(WING_EAST_X), `floor ${f} wing door`).toBe(true);
    }
  });

  it('every amenity spot is reachable from every tower desk seat and the staff landing of its floor', () => {
    for (const f of WING_LEVELS) {
      const g = graphs.get(f)!;
      const spots = AMENITY_SPOTS.filter((s) => s.floor === f);
      expect(spots.length).toBeGreaterThan(5);
      const starts = [...g.nodes.values()].filter((n) => n.spot === 'seat' || n.spot === 'landing-call').map((n) => n.id);
      expect(starts.length).toBeGreaterThan(1);
      for (const s of spots) {
        expect(g.amenities.get(s.id)?.kind).toBe(s.kind);
        for (const from of starts) expect(shortestPath(g, from, s.id), `floor ${f} ${from} -> ${s.id}`).not.toBeNull();
      }
    }
  });

  it('amenity spots are spur nodes, clear of every through lane by 0.45 u', () => {
    for (const f of WING_LEVELS) {
      const g = graphs.get(f)!;
      for (const e of g.edges) if (e.through) for (const id of [e.a, e.b]) expect(g.amenities.has(id), `floor ${f} ${id}`).toBe(false);
      for (const s of g.amenities.values()) {
        expect(g.stationary.has(s.id)).toBe(true);
        for (const e of g.edges) {
          if (!e.through) continue;
          const a = g.nodes.get(e.a)!;
          const b = g.nodes.get(e.b)!;
          const l = Math.hypot(b.x - a.x, b.z - a.z);
          const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
          for (const o of [0, LANE_OFFSET, -LANE_OFFSET]) {
            const dd = pointSegmentDistance(s, { x: a.x + n.x * o, z: a.z + n.z * o }, { x: b.x + n.x * o, z: b.z + n.z * o });
            expect(dd, `floor ${f} ${s.id} vs ${e.a}->${e.b}`).toBeGreaterThanOrEqual(SPOT_CLEARANCE - 1e-9);
          }
        }
      }
    }
  });

  it('every bridge and wing edge keeps 0.25 u off wing walls, bridge sides and wing furniture', () => {
    for (const f of WING_LEVELS) {
      const g = graphs.get(f)!;
      const wingRects = g.layout.footprints.filter((r) => r.x1 < -HALF_WIDTH + 0.1);
      expect(wingRects.length).toBeGreaterThan(8);
      for (const e of g.edges) {
        const a = g.nodes.get(e.a)!;
        const b = g.nodes.get(e.b)!;
        if (Math.max(a.x, b.x) > -HALF_WIDTH + 0.1 && Math.min(a.x, b.x) > -HALF_WIDTH - 0.1) continue; // tower-only edges: nav.test.ts
        for (const r of g.layout.footprints) expect(segRectDistance(a, b, r), `floor ${f} ${e.a}->${e.b} vs ${r.name}`).toBeGreaterThanOrEqual(FURNITURE_CLEARANCE - 1e-9);
      }
    }
  });

  it('floors without a wing level get no campus nodes', () => {
    for (let f = 3; f < FLOOR_COUNT; f++) expect(buildCampusGraph(towerLayout(d, f)).amenities.size).toBe(0);
  });
});

describe('campus scene: wing, zones, bridges, ghosting', () => {
  let cached: TowerModel | null = null;
  const model = (): TowerModel => (cached ??= buildTower(data()));
  const wingMeshes = (m: TowerModel, floor: number): Mesh[] => {
    const out: Mesh[] = [];
    m.root.updateMatrixWorld(true);
    m.floors[floor]!.group.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld);
      if (bb.min.x < -HALF_WIDTH - 2 && o.name !== 'skyline-building') out.push(o);
    });
    return out;
  };

  it('zones with the seven floor labels; labels are room labels on the wing level of their floor', () => {
    const zones = CAMPUS_ZONES.filter((z) => z.label !== null);
    expect(zones.map((z) => z.label).sort()).toEqual([...LABELS].sort());
    const m = model();
    for (const z of zones) {
      const r = m.rooms.find((x) => x.text === z.label);
      expect(r, String(z.label)).toBeDefined();
      expect(r!.floor).toBe(z.floor);
      expect(r!.primary).toBe(false);
      expect(r!.position.x).toBeLessThan(WING_EAST_X);
      expect(Math.floor(r!.position.y / FLOOR_HEIGHT)).toBe(z.floor);
    }
    expect(CAMPUS_ZONES.some((z) => z.id === 'roof-garden' && z.floor === ROOF_GARDEN_FLOOR)).toBe(true);
  });

  it('each wing level and the roof garden have geometry west of the tower, joined by a sky-bridge on floors 0-2', () => {
    const m = model();
    for (const f of [...WING_LEVELS, ROOF_GARDEN_FLOOR]) expect(wingMeshes(m, f).length, `floor ${f}`).toBeGreaterThan(3);
    for (const f of [4, 5]) expect(wingMeshes(m, f)).toHaveLength(0);
    for (const f of WING_LEVELS) {
      const bridge = m.floors[f]!.group.getObjectByName('sky-bridge');
      expect(bridge, `floor ${f}`).toBeDefined();
      const bb = { min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) };
      bridge!.updateMatrixWorld(true);
      bridge!.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld);
        bb.min.min(b.min);
        bb.max.max(b.max);
      });
      expect(bb.min.x).toBeLessThanOrEqual(WING_EAST_X + 0.05);
      expect(bb.max.x).toBeGreaterThanOrEqual(-HALF_WIDTH - 0.1);
      expect(bb.min.y).toBeGreaterThanOrEqual(f * FLOOR_HEIGHT - 0.1);
      expect(bb.max.y).toBeLessThan((f + 1) * FLOOR_HEIGHT);
    }
  });

  it('the tower west wall has a door gap where the bridge lands (floors 0-2 only)', () => {
    const m = model();
    const doorVerts = (f: number): number => {
      const wall = m.floors[f]!.group.getObjectByName('exterior-wall');
      if (!(wall instanceof Mesh)) throw new Error('wall');
      const p = wall.geometry.attributes.position!;
      let n = 0;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + wall.position.x;
        const y = p.getY(i);
        const z = p.getZ(i) + wall.position.z;
        if (x < -HALF_WIDTH + 0.1 && z > BRIDGE_DOOR.z0 + 0.05 && z < BRIDGE_DOOR.z1 - 0.05 && y > 0.05) n++;
      }
      return n;
    };
    for (const f of WING_LEVELS) expect(doorVerts(f), `floor ${f}`).toBe(0);
    expect(doorVerts(4)).toBeGreaterThan(0);
  });

  it('ghosting: each wing level behaves like the tower floor of the same index (REQ-8)', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 1 });
    const opacityOf = (o: Mesh): number => (o.material as Material).opacity;
    // Above the focus: only slabs stay, ghosted; below: only slabs, dimmed; focused: everything.
    for (const f of [0, 2]) {
      const visible = wingMeshes(m, f).filter(shown);
      expect(visible.length, `floor ${f}`).toBeGreaterThan(0);
      for (const o of visible) {
        expect(o.name, `floor ${f}`).toBe('floor-slab');
        expect(opacityOf(o)).toBeCloseTo(f === 2 ? 0.08 : 0.4, 5);
      }
    }
    for (const o of wingMeshes(m, 1)) expect(shown(o)).toBe(true);
    m.setView({ mode: 'overview', focusFloor: 0 });
    for (const f of WING_LEVELS) for (const o of wingMeshes(m, f)) expect(shown(o)).toBe(true);
  });

  it('the archive has labelled project boxes from a built-in list of fictional project names', () => {
    expect(PROJECT_ARCHIVE.length).toBeGreaterThanOrEqual(24);
    expect(new Set(PROJECT_ARCHIVE).size).toBe(PROJECT_ARCHIVE.length);
    const m = model();
    expect(m.floors[2]!.group.getObjectByName('archive-boxes')).toBeDefined();
    expect(m.floors[2]!.group.getObjectByName('archive-labels')).toBeDefined();
  });
});

describe('campus budgets', () => {
  it('the campus share of the real scene: <= 120k vertices and <= 60 meshes', () => {
    // Share = every vertex west of the tower wall (wing, bridges, grounds) and every mesh that lies wholly
    // there; wing parts merged into a tower floor mesh add vertices but no draw call.
    const m = buildTower(data());
    m.root.updateMatrixWorld(true);
    const v = new Vector3();
    let verts = 0;
    let meshes = 0;
    m.root.traverse((o) => {
      // The city around the campus (src/scene/city.ts) has its own share, checked in city-scene.test.ts.
      if (!(o instanceof Mesh) || o.name === 'skyline-building' || o.name === 'ground' || o.name === 'ground-shadow' || o.parent?.name === 'city') return;
      const pos = o.geometry.attributes.position;
      if (!pos) return;
      if (o instanceof InstancedMesh) {
        // Only the campus instances geometry (green walls, archive boxes, trees); counted once like build-budget.
        verts += pos.count;
        meshes++;
        return;
      }
      let west = 0;
      for (let i = 0; i < pos.count; i++) if (v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).x < -HALF_WIDTH - 0.1) west++;
      verts += west;
      if (west === pos.count || (west > 0 && o.name !== 'merged' && o.name !== '')) meshes++; // own draw call (bridge-spanning named meshes included)
    });
    console.info(`[budget] campus share vertices=${verts} meshes=${meshes}`);
    expect(verts).toBeLessThanOrEqual(120_000); // Rev 40: was 150 000
    expect(meshes).toBeLessThanOrEqual(60);
  });

  it('buildCampus works on bare floors and builds three wing levels plus the roof garden', () => {
    const floors = Array.from({ length: FLOOR_COUNT }, (_, i) => {
      const group = new Group();
      group.position.y = i * FLOOR_HEIGHT;
      const materials: FloorMaterials = { walls: [], slab: [], contents: [], robots: [], tinted: [] };
      return { id: i, group, materials };
    });
    const textures = { wood: null, hatch: null, blob: null };
    const kits = floors.map((f) => new Kit(f.materials, textures));
    const campus = buildCampus({ floors, kits, textures });
    for (const f of floors) mergeStatic(f.group);
    expect(campus.levels.map((l) => l.floor)).toEqual([0, 1, 2, ROOF_GARDEN_FLOOR]);
    expect(campus.group.name).toBe('campus');
    expect(campus.zones).toBe(CAMPUS_ZONES);
    expect(campus.spots).toBe(AMENITY_SPOTS);
    for (const f of [0, 1, 2]) expect(floors[f]!.materials.walls.length).toBeGreaterThan(0);
  });

  it('the whole scene stays under 700k vertices and 1000 meshes with the campus', () => {
    const m = buildTower(data());
    let verts = 0;
    let meshes = 0;
    m.root.traverse((o) => {
      if (o instanceof Mesh) {
        meshes++;
        verts += o.geometry.attributes.position?.count ?? 0;
      }
    });
    console.info(`[budget] total vertices=${verts} meshes=${meshes}`);
    expect(verts).toBeLessThan(700_000);
    expect(meshes).toBeLessThan(1000);
  });
});

describe('campus camera framing', () => {
  afterEach(() => setFrameAspect(16 / 9));
  const corners = (): Vector3[] => {
    const out: Vector3[] = [];
    for (const x of [CAMPUS_BOUNDS.x0, CAMPUS_BOUNDS.x1]) for (const y of [0, FLOOR_COUNT * FLOOR_HEIGHT]) for (const z of [CAMPUS_BOUNDS.z0, CAMPUS_BOUNDS.z1]) out.push(new Vector3(x, y, z));
    return out;
  };
  it('overview and org poses fit the wing and its roof garden on desktop and phone', () => {
    expect(CAMPUS_BOUNDS.x0).toBeLessThan(WING.x - WING.halfW);
    for (const aspect of [1280 / 800, 375 / 667]) {
      setFrameAspect(aspect);
      for (const pose of [overviewPose(), orgPose()]) {
        const cam = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 400);
        cam.position.copy(pose.pos);
        cam.lookAt(pose.target);
        cam.updateMatrixWorld(true);
        for (const c of corners()) {
          const p = c.clone().project(cam);
          expect(Math.abs(p.x), `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y), `aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
