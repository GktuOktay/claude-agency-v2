// Luxury exterior (KARARLAR rev 37): curtain-wall facade on the tower and landscaped campus grounds.
// The facade ghosts exactly like the walls it dresses (0001 REQ-8, org <= 12 %) and is never pickable;
// the grounds stay inside the campus block, clear of roads, sidewalks, the wing and the terrace, and
// never cover the tower or the wing from the preset camera views.
import { describe, it, expect } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, Ray, Raycaster, Vector3, type Material, type Object3D } from 'three';
import { buildTower, FLOOR_COUNT, FLOOR_HEIGHT, HALF_DEPTH, HALF_WIDTH, type TowerModel } from '../src/scene/model';
import { buildFacade, ENTRANCE, FACADE_WEST_LIMIT } from '../src/scene/facade';
import { createGrounds, groundsPlan, METRE, type GroundsPlan } from '../src/scene/grounds';
import { floorPose, orgPose, overviewPose } from '../src/scene/camera';
import { pickRobot } from '../src/scene/picking';
import { CAMPUS_BOUNDS, ROOF_GARDEN_FLOOR, TERRACE, WING, WING_EAST_X, WING_WEST_X, type Rect } from '../src/sim/layout';
import { cityPlan, rectsOverlap } from '../src/sim/citySim';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import type { FloorMaterials } from '../src/scene/model';

function model(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

function meshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

function facadeOf(m: TowerModel, floor: number): Group {
  const g = m.floors[floor]?.group.getObjectByName('facade');
  if (!(g instanceof Group)) throw new Error(`facade ${floor}`);
  return g;
}

const matsOf = (o: Object3D): Material[] => [...new Set(meshesOf(o).flatMap((x) => (Array.isArray(x.material) ? x.material : [x.material])))];

/** Drawn when the mesh, all its ancestors and its material are visible. */
function shown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return o instanceof Mesh && (o.material as Material).visible;
}

describe('facade: curtain wall, crown, entrance (rev 37)', () => {
  it('every floor has slim fins and spandrel bands; the top floor a crown; floor 0 the entrance, canopy and plinth', () => {
    const m = model();
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const g = facadeOf(m, f);
      expect(g.getObjectByName('facade-fins'), `floor ${f}`).toBeInstanceOf(Mesh);
      expect(g.getObjectByName('facade-spandrel'), `floor ${f}`).toBeInstanceOf(Mesh);
      expect(g.userData.fins, `floor ${f}`).toBeGreaterThanOrEqual(30);
    }
    const top = facadeOf(m, FLOOR_COUNT - 1);
    expect(top.getObjectByName('facade-crown-reveal')).toBeInstanceOf(Mesh);
    const ground = facadeOf(m, 0);
    for (const n of ['facade-plinth', 'facade-entrance-glass', 'facade-canopy', 'facade-canopy-lights']) expect(ground.getObjectByName(n), n).toBeInstanceOf(Mesh);
    for (let f = 1; f < FLOOR_COUNT; f++) expect(facadeOf(m, f).getObjectByName('facade-canopy'), `floor ${f}`).toBeUndefined();
  });

  it('real-world scale: 3.5 m floor to floor; the entrance is double height with a cantilevered canopy', () => {
    expect(FLOOR_HEIGHT / METRE).toBeCloseTo(3.5, 5);
    expect(ENTRANCE.top).toBeGreaterThan(FLOOR_HEIGHT * 1.6);
    expect(ENTRANCE.top).toBeLessThan(FLOOR_HEIGHT * 2);
    expect(ENTRANCE.canopy.depth / METRE).toBeGreaterThanOrEqual(2.5);
    const m = model();
    m.root.updateMatrixWorld(true);
    const glass = new Box3().setFromObject(facadeOf(m, 0).getObjectByName('facade-entrance-glass')!);
    expect(glass.max.y).toBeGreaterThan(FLOOR_HEIGHT * 1.6);
    const canopy = new Box3().setFromObject(facadeOf(m, 0).getObjectByName('facade-canopy')!);
    expect(canopy.min.z).toBeGreaterThan(HALF_DEPTH);
    expect(canopy.max.z - canopy.min.z).toBeCloseTo(ENTRANCE.canopy.depth, 1);
  });

  it('stays on the building: within 0.6 u of the shell, the crown low enough for the framing, the west face flush', () => {
    const m = model();
    m.root.updateMatrixWorld(true);
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const b = new Box3().setFromObject(facadeOf(m, f));
      expect(b.min.x, `floor ${f}`).toBeGreaterThanOrEqual(FACADE_WEST_LIMIT - 1e-6);
      expect(FACADE_WEST_LIMIT).toBeGreaterThanOrEqual(-HALF_WIDTH - 0.1);
      expect(b.max.x).toBeLessThanOrEqual(HALF_WIDTH + 0.6);
      expect(b.min.z).toBeGreaterThanOrEqual(-HALF_DEPTH - 0.6);
      if (f > 0) expect(b.max.z).toBeLessThanOrEqual(HALF_DEPTH + 0.6);
      expect(b.max.y).toBeLessThanOrEqual(FLOOR_COUNT * FLOOR_HEIGHT + 0.5);
    }
  });

  it('every facade material is a wall material of its floor (ghosting follows the walls)', () => {
    const m = model();
    for (const f of m.floors) {
      const mats = matsOf(facadeOf(m, f.id));
      expect(mats.length).toBeGreaterThanOrEqual(2);
      for (const mat of mats) expect(f.materials.walls, `floor ${f.id} ${mat.name}`).toContain(mat);
    }
  });

  it('overview 0.25 like the walls; floor view: focused floor see-through, other floors hidden like their walls', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    for (const f of m.floors) {
      for (const mat of matsOf(facadeOf(m, f.id))) expect(mat.opacity).toBeCloseTo(0.25, 5);
      for (const o of meshesOf(facadeOf(m, f.id))) expect(shown(o)).toBe(true);
    }
    m.setView({ mode: 'floor', focusFloor: 2 });
    for (const f of m.floors) {
      const g = facadeOf(m, f.id);
      const wall = f.group.getObjectByName('exterior-wall') ?? f.group.getObjectByName('glass-wall');
      if (!wall) throw new Error('wall');
      expect(g.visible, `floor ${f.id}`).toBe(wall.visible);
      if (f.id === 2) for (const o of meshesOf(g)) expect(shown(o), o.name).toBe(false);
      if (f.id > 2) for (const mat of matsOf(g)) expect(mat.opacity).toBeLessThanOrEqual(0.1);
      for (const o of meshesOf(g)) expect(shown(o), `floor ${f.id} ${o.name}`).toBe(false);
    }
  });

  it('org mode: the facade fades with the shell to at most 12 %; leaving org restores the view', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 1 });
    m.setOrg(true);
    for (const f of m.floors) {
      for (const mat of matsOf(facadeOf(m, f.id))) {
        expect(mat.opacity).toBeLessThanOrEqual(0.12);
        expect(mat.opacity).toBeGreaterThan(0);
      }
    }
    m.setOrg(false);
    expect(m.view.mode).toBe('floor');
    for (const o of meshesOf(facadeOf(m, 1))) expect(shown(o)).toBe(false);
  });

  it('casts and receives no shadows in any view', () => {
    const m = model();
    for (const v of [{ mode: 'overview' as const, focusFloor: 0 }, { mode: 'floor' as const, focusFloor: 0 }, { mode: 'floor' as const, focusFloor: 5 }]) {
      m.setView(v);
      for (const f of m.floors) for (const o of meshesOf(facadeOf(m, f.id))) expect(o.castShadow || o.receiveShadow, o.name).toBe(false);
    }
  });

  it('is never pickable: facade meshes ignore raycasts and robots are found through the fins', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    m.root.updateMatrixWorld(true);
    for (const f of m.floors) {
      const g = facadeOf(m, f.id);
      for (const o of meshesOf(g)) {
        const b = new Box3().setFromObject(o);
        const c = b.getCenter(new Vector3());
        const rc = new Raycaster(new Vector3(c.x, c.y + 50, c.z), new Vector3(0, -1, 0));
        expect(rc.intersectObject(o, false), o.name).toHaveLength(0);
        expect(o.userData.unitId).toBeUndefined();
      }
    }
    // Through the fins from the south and the east, every pick matches the same scene without a facade.
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const bare = buildTower(r.data, { facade: false });
    bare.setView({ mode: 'overview', focusFloor: 0 });
    bare.root.updateMatrixWorld(true);
    let found = 0;
    for (const robot of m.robots) {
      const target = robot.group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.8, 0));
      for (const from of [new Vector3(0, 0, 40), new Vector3(40, 0, 0)]) {
        const origin = target.clone().add(from);
        const ray = new Ray(origin, target.clone().sub(origin).normalize());
        const hit = pickRobot(m, ray)?.unit.id;
        expect(hit, robot.unit.id).toBe(pickRobot(bare, ray)?.unit.id);
        if (hit) found++;
      }
    }
    expect(found).toBeGreaterThan(m.robots.length);
  });

  it('buildFacade works on bare floors and lights the crown and canopy at night', () => {
    const floors = Array.from({ length: FLOOR_COUNT }, (_, i) => {
      const group = new Group();
      group.position.y = i * FLOOR_HEIGHT;
      const materials: FloorMaterials = { walls: [], slab: [], contents: [], robots: [], tinted: [] };
      return { id: i, group, materials };
    });
    const facade = buildFacade(floors);
    expect(facade.groups).toHaveLength(FLOOR_COUNT);
    expect(facade.glows.length).toBeGreaterThanOrEqual(2);
    for (const g of facade.glows) {
      expect(g.emissiveIntensity).toBe(0);
      expect(g.userData.glow).toMatchObject({ day: 0 });
    }
    const m = model();
    const lights = m.nightMaterials();
    for (const g of m.facade.glows) expect(lights).toContain(g);
    m.setNight(1);
    for (const g of m.facade.glows) expect(g.emissiveIntensity).toBeGreaterThan(0.3);
    m.setNight(0);
    for (const g of m.facade.glows) expect(g.emissiveIntensity).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------- grounds

const plan = cityPlan(CAMPUS_BOUNDS, 7);
const block = { x0: plan.ring.w + 3.2 + 2.4, x1: plan.ring.e - 3.2 - 2.4, z0: plan.ring.n + 3.2 + 2.4, z1: plan.ring.s - 3.2 - 2.4 };

function footprintRects(p: GroundsPlan): readonly Rect[] {
  return p.footprints;
}

describe('grounds: arrival plaza, reflecting pool, trees, lawns, sculpture, benches (rev 37)', () => {
  it('has a stone plaza, a long reflecting pool, at least four mature trees in planters, lawns, a sculpture and benches', () => {
    const p = groundsPlan();
    expect(p.pool.x1 - p.pool.x0).toBeGreaterThanOrEqual(6 * (p.pool.z1 - p.pool.z0));
    expect((p.pool.x1 - p.pool.x0) / METRE).toBeGreaterThanOrEqual(10);
    expect(p.trees.length).toBeGreaterThanOrEqual(4);
    for (const t of p.trees) {
      expect(t.crownY1 / METRE, 'mature: at least 4.5 m tall').toBeGreaterThanOrEqual(4.5);
      expect(p.planters.some((r) => t.x > r.x0 && t.x < r.x1 && t.z > r.z0 && t.z < r.z1), 'tree in a planter').toBe(true);
    }
    expect(p.lawns.length).toBeGreaterThanOrEqual(2);
    expect(p.benches.length).toBeGreaterThanOrEqual(3);
    expect(p.uplights.length).toBeGreaterThanOrEqual(p.trees.length * 2);
    const g = createGrounds();
    for (const n of ['grounds-surface', 'grounds-pool-water', 'grounds-stone', 'grounds-tree-trunks', 'grounds-tree-crowns', 'grounds-bench-wood', 'grounds-sculpture', 'grounds-uplights']) {
      expect(g.group.getObjectByName(n), n).toBeInstanceOf(Mesh);
    }
  });

  it('stays inside the campus block, clear of roads and sidewalks', () => {
    const g = createGrounds();
    g.group.updateMatrixWorld(true);
    const v = new Vector3();
    for (const o of meshesOf(g.group)) {
      const pos = o.geometry.attributes.position;
      if (!pos) continue;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        expect(v.x >= block.x0 && v.x <= block.x1 && v.z >= block.z0 && v.z <= block.z1, `${o.name} vertex ${v.x.toFixed(2)},${v.z.toFixed(2)}`).toBe(true);
      }
    }
    for (const r of footprintRects(groundsPlan())) {
      for (const road of plan.roads) expect(rectsOverlap(r, road), r.name).toBe(false);
      for (const walk of plan.sidewalks) expect(rectsOverlap(r, walk), r.name).toBe(false);
    }
  });

  it('leaves the wing, its terrace and the tower footprint alone', () => {
    const wing: Rect = { name: 'wing', x0: WING_WEST_X, x1: WING_EAST_X, z0: -WING.halfD, z1: WING.halfD };
    const terrace: Rect = { name: 'terrace', ...TERRACE };
    const tower: Rect = { name: 'tower', x0: -HALF_WIDTH - 0.15, x1: HALF_WIDTH + 0.15, z0: -HALF_DEPTH - 0.15, z1: HALF_DEPTH + 0.15 };
    for (const r of groundsPlan().footprints) for (const keep of [wing, terrace, tower]) expect(rectsOverlap(r, keep), `${r.name} / ${keep.name}`).toBe(false);
  });

  it('is never pickable and never ghosts per floor: floor views leave the grounds as they are', () => {
    const m = model();
    if (!m.grounds) throw new Error('grounds');
    expect(m.grounds.group.parent).toBe(m.root);
    m.root.updateMatrixWorld(true);
    const p = groundsPlan();
    for (const t of p.trees) {
      const rc = new Raycaster(new Vector3(t.x, 40, t.z), new Vector3(0, -1, 0));
      expect(rc.intersectObject(m.grounds.group, true)).toHaveLength(0);
    }
    const state = (): string => meshesOf(m.grounds!.group).map((o) => `${o.name}:${shown(o)}:${(o.material as Material).opacity}`).join('|');
    const before = state();
    for (let f = 0; f < FLOOR_COUNT; f++) {
      m.setView({ mode: 'floor', focusFloor: f });
      expect(state()).toBe(before);
    }
    m.setOrg(true);
    m.setOrg(false);
    expect(state()).toBe(before);
  });

  it('subtle uplights: dark by day, lit at night', () => {
    const m = model();
    if (!m.grounds) throw new Error('grounds');
    const up = m.grounds.group.getObjectByName('grounds-uplights');
    if (!(up instanceof Mesh) || !(up.material instanceof MeshStandardMaterial)) throw new Error('uplights');
    m.setNight(0);
    expect(up.material.emissiveIntensity).toBe(0);
    m.setNight(1);
    expect(up.material.emissiveIntensity).toBeGreaterThan(0.5);
    for (const g of m.grounds.glows) expect(m.nightMaterials()).toContain(g);
  });

  it('the built trees and the sculpture stay inside their plan boxes (the occlusion check covers them)', () => {
    const g = createGrounds();
    g.group.updateMatrixWorld(true);
    const boxes = obstacleBoxes(groundsPlan()).map((b) => b.clone().expandByScalar(0.01));
    const v = new Vector3();
    for (const n of ['grounds-tree-crowns', 'grounds-sculpture']) {
      const o = g.group.getObjectByName(n);
      if (!(o instanceof Mesh)) throw new Error(n);
      const pos = o.geometry.attributes.position;
      if (!pos) throw new Error('positions');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        expect(boxes.some((b) => b.containsPoint(v)), `${n} vertex ${v.toArray().map((x) => x.toFixed(2))}`).toBe(true);
      }
    }
  });
});

function obstacleBoxes(p: GroundsPlan): Box3[] {
  return [
    ...p.trees.map((t) => new Box3(new Vector3(t.x - t.crownR, t.crownY0, t.z - t.crownR), new Vector3(t.x + t.crownR, t.crownY1, t.z + t.crownR))),
    new Box3(new Vector3(p.sculpture.x - p.sculpture.halfW, 0, p.sculpture.z - p.sculpture.halfD), new Vector3(p.sculpture.x + p.sculpture.halfW, p.sculpture.h, p.sculpture.z + p.sculpture.halfD)),
  ];
}

describe('the grounds never cover what the views are for', () => {
  // Targets: every floor plan at robot-head height (the content of each view), the wing levels, the
  // terrace and the roof garden, plus the tower and wing walls at mid and top height. The plinth line at
  // the foot of the facade may sit behind a tree from the overview, as it would in a real street.
  const boxes = obstacleBoxes(groundsPlan());
  const grid = (x0: number, x1: number, z0: number, z1: number, y: number, out: Vector3[]): Vector3[] => {
    for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 10) for (let z = z0; z <= z1 + 1e-6; z += (z1 - z0) / 4) out.push(new Vector3(x, y, z));
    return out;
  };
  const head = (f: number): number => f * FLOOR_HEIGHT + 0.74;
  const floorTargets = (f: number): Vector3[] => grid(-HALF_WIDTH + 0.3, HALF_WIDTH - 0.3, -HALF_DEPTH + 0.3, HALF_DEPTH - 0.3, head(f), []);
  const campusTargets: Vector3[] = [];
  for (let f = 0; f < ROOF_GARDEN_FLOOR; f++) grid(WING_WEST_X + 0.3, WING_EAST_X - 0.3, -WING.halfD + 0.3, WING.halfD - 0.3, head(f), campusTargets);
  grid(WING_WEST_X + 0.3, WING_EAST_X - 0.3, -WING.halfD + 0.3, WING.halfD - 0.3, head(ROOF_GARDEN_FLOOR), campusTargets);
  grid(TERRACE.x0, TERRACE.x1, TERRACE.z0, TERRACE.z1, head(0), campusTargets);
  const top = FLOOR_COUNT * FLOOR_HEIGHT;
  for (const y of [top / 2, top]) {
    for (let x = -HALF_WIDTH; x <= HALF_WIDTH + 1e-6; x += 2) campusTargets.push(new Vector3(x, y, HALF_DEPTH), new Vector3(x, y, -HALF_DEPTH));
    for (let z = -HALF_DEPTH; z <= HALF_DEPTH + 1e-6; z += 2.75) campusTargets.push(new Vector3(HALF_WIDTH, y, z), new Vector3(-HALF_WIDTH, y, z));
  }

  const blocked = (eye: Vector3, targets: readonly Vector3[]): string | null => {
    const dir = new Vector3();
    const hit = new Vector3();
    for (const t of targets) {
      dir.subVectors(t, eye);
      const len = dir.length();
      dir.normalize();
      for (const b of boxes) {
        const r = new Raycaster(eye, dir, 0, len);
        if (r.ray.intersectBox(b, hit) && hit.distanceTo(eye) < len - 0.05) return `target ${t.toArray().map((v) => v.toFixed(1))} by box ${b.min.toArray().map((v) => v.toFixed(1))}..${b.max.toArray().map((v) => v.toFixed(1))}`;
      }
    }
    return null;
  };
  const all = (): Vector3[] => [...Array.from({ length: FLOOR_COUNT }, (_, f) => floorTargets(f)).flat(), ...campusTargets];

  it('the overview sees every floor, the wing, the terrace and the roof garden', () => {
    expect(blocked(overviewPose().pos, all())).toBeNull();
  });

  it('each floor view sees its whole floor plan', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) expect(blocked(floorPose(f).pos, floorTargets(f)), `floor ${f}`).toBeNull();
  });

  it('org mode fades every tall piece (trees, sculpture) to at most 15 % so nothing covers the org chart', () => {
    const m = model();
    if (!m.grounds) throw new Error('grounds');
    m.setOrg(true);
    for (const n of ['grounds-tree-crowns', 'grounds-tree-trunks', 'grounds-sculpture']) {
      const o = m.grounds.group.getObjectByName(n);
      if (!(o instanceof Mesh)) throw new Error(n);
      expect((o.material as Material).opacity, n).toBeLessThanOrEqual(0.15);
      expect((o.material as Material).depthWrite, n).toBe(false);
    }
    m.setOrg(false);
    for (const n of ['grounds-tree-crowns', 'grounds-tree-trunks', 'grounds-sculpture']) {
      const o = m.grounds.group.getObjectByName(n);
      if (!(o instanceof Mesh)) throw new Error(n);
      expect((o.material as Material).opacity, n).toBe(1);
      expect((o.material as Material).transparent, n).toBe(false);
    }
  });
});

describe('exterior budget', () => {
  it('facade + grounds: <= 20k vertices and <= 30 meshes; the scene stays under 700k and 1000', () => {
    const m = model();
    let verts = 0;
    let meshes = 0;
    const own = [...m.floors.map((f) => f.group.getObjectByName('facade')), m.grounds?.group];
    for (const g of own) {
      if (!g) throw new Error('missing');
      for (const o of meshesOf(g)) {
        meshes++;
        verts += o.geometry.attributes.position?.count ?? 0;
      }
    }
    let total = 0;
    let totalMeshes = 0;
    for (const o of meshesOf(m.root)) {
      totalMeshes++;
      total += o.geometry.attributes.position?.count ?? 0;
    }
    console.info(`[budget] exterior vertices=${verts} meshes=${meshes}; scene vertices=${total} meshes=${totalMeshes}`);
    expect(verts).toBeLessThanOrEqual(20_000); // Rev 40: was 40 000
    expect(meshes).toBeLessThanOrEqual(30);
    expect(total).toBeLessThan(700_000);
    expect(totalMeshes).toBeLessThan(1000);
  });

  it('can be turned off for A/B budget checks', () => {
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const m = buildTower(r.data, { grounds: false, facade: false });
    expect(m.grounds).toBeNull();
    expect(m.floors[0]!.group.getObjectByName('facade')).toBeUndefined();
  });
});
