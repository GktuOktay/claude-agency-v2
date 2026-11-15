// KARARLAR rev 35: the R&D lab ("AR-GE ★") as the campus showpiece, and the campus car park.
import { describe, it, expect } from 'vitest';
import { InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { buildTower, type TowerModel } from '../src/scene/model';
import { LAB_WALL_HZ, createLabWallTicker, labWallCode, trainingLoss } from '../src/scene/amenities';
import { CODE_LINES } from '../src/scene/codeLines';
import { overviewPose } from '../src/scene/camera';
import {
  AMENITY_SPOTS,
  BIKE_RACKS,
  CAMPUS_BOUNDS,
  CAMPUS_ZONES,
  HALF_DEPTH,
  HALF_WIDTH,
  LAB_STATIONS,
  PARKING_BAY,
  PARKING_BAYS,
  PARKING_CAR_TONES,
  PARKING_GATE,
  PARKING_LAMPS,
  PARKING_LOT,
  PARKING_TREES,
  RND_LAB_FEATURES,
  TERRACE,
  WING,
  floorLayout,
  floorY,
  type LabStation,
  type Rect,
} from '../src/sim/layout';
import { buildCampusGraph, shortestPath } from '../src/sim/nav';
import { cityPlan, rectsOverlap } from '../src/sim/citySim';
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
let cached: TowerModel | null = null;
const model = (): TowerModel => (cached ??= buildTower(data()));

const LAB_FLOOR = 2;
const labSpots = AMENITY_SPOTS.filter((s) => s.zone === 'rnd-lab');
const inRect = (r: Box, x: number, z: number, pad = 0): boolean => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
type Box = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
const within = (inner: Box, outer: Box): boolean => inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.z0 >= outer.z0 && inner.z1 <= outer.z1;
const box = (name: string, x0: number, x1: number, z0: number, z1: number): Rect => ({ name, x0, x1, z0, z1 });

/** World-space vertices of every (instanced) mesh under `root` that pass `keep`. */
function countVerts(root: Object3D, keep: (p: Vector3, o: Mesh) => boolean): number {
  root.updateMatrixWorld(true);
  const v = new Vector3();
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    const inst = o instanceof InstancedMesh ? o : null;
    const m = new Mesh().matrixWorld;
    for (let k = 0; k < (inst ? inst.count : 1); k++) {
      if (inst) inst.getMatrixAt(k, m);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (inst) v.applyMatrix4(m);
        v.applyMatrix4(o.matrixWorld);
        if (keep(v, o)) n++;
      }
    }
  });
  return n;
}

describe('R&D lab: the campus showpiece (rev 35)', () => {
  it('is labelled "AR-GE ★" and lists every hero element', () => {
    const lab = CAMPUS_ZONES.find((z) => z.id === 'rnd-lab');
    expect(lab?.label).toBe('AR-GE ★');
    expect(model().rooms.some((r) => r.text === 'AR-GE ★' && r.floor === LAB_FLOOR)).toBe(true);
    const names = new Set(RND_LAB_FEATURES.map((f) => f.name));
    for (const n of ['video-wall', 'workstations', 'prototype-bench', 'whiteboard-wall', 'device-wall', 'gpu-cluster', 'collab-pod']) expect(names.has(n as never), n).toBe(true);
    expect(RND_LAB_FEATURES.filter((f) => f.name === 'collab-pod').length).toBeGreaterThanOrEqual(2);
    for (const f of RND_LAB_FEATURES) expect(within(f, lab!.bounds), f.name).toBe(true);
  });

  it('has visitor spots at workstations, the prototype bench, the video wall, the device lab and the pods', () => {
    const roles = new Map<LabStation, number>();
    for (const s of labSpots) {
      const role = LAB_STATIONS.get(s.id);
      expect(role, s.id).toBeDefined();
      roles.set(role!, (roles.get(role!) ?? 0) + 1);
      expect(s.kind).toBe('lab-bench');
      expect(s.floor).toBe(LAB_FLOOR);
    }
    expect(roles.get('workstation')).toBeGreaterThanOrEqual(2);
    expect(roles.get('bench')).toBeGreaterThanOrEqual(2);
    expect(roles.get('wall')).toBeGreaterThanOrEqual(4);
    expect(roles.get('devices')).toBeGreaterThanOrEqual(2);
    expect(roles.get('pod')).toBeGreaterThanOrEqual(2);
    expect(labSpots.length).toBeGreaterThanOrEqual(12);
  });

  it('nav reaches every new lab spot from every desk seat and the staff landing of floor 2', () => {
    const d = data();
    const tower = floorLayout(LAB_FLOOR, sortUnits(d.units).filter((u) => u.floor === LAB_FLOOR).map((u) => ({ id: u.id, ceo: u.tier === 'ceo' })));
    const g = buildCampusGraph(tower);
    const starts = [...g.nodes.values()].filter((n) => n.spot === 'seat' || n.spot === 'landing-call').map((n) => n.id);
    expect(starts.length).toBeGreaterThan(1);
    for (const s of labSpots) {
      expect(g.amenities.has(s.id), s.id).toBe(true);
      for (const from of starts) expect(shortestPath(g, from, s.id), `${from} -> ${s.id}`).not.toBeNull();
    }
    for (const id of ['lab-north', 'lab-wall', 'lab-arm']) expect(g.layout.aisles.some((a) => a.id === id), id).toBe(true);
  });

  it('builds geometry at every hero footprint, a robot arm on the bench and status LEDs in the GPU cluster', () => {
    const g = model().floors[LAB_FLOOR]!.group;
    const y0 = floorY(LAB_FLOOR);
    for (const f of RND_LAB_FEATURES) {
      const n = countVerts(g, (p) => inRect(f, p.x, p.z) && p.y > y0 + 0.3 && p.y < y0 + 1.6);
      expect(n, f.name).toBeGreaterThan(40);
    }
    const bench = RND_LAB_FEATURES.find((f) => f.name === 'prototype-bench')!;
    expect(countVerts(g, (p) => inRect(bench, p.x, p.z) && p.y > y0 + 0.75), 'robot arm above the bench top').toBeGreaterThan(60);
    const gpu = RND_LAB_FEATURES.find((f) => f.name === 'gpu-cluster')!;
    expect(countVerts(g, (p, o) => o.name === 'rnd-displays' && inRect(gpu, p.x, p.z)), 'GPU status LEDs').toBeGreaterThan(8);
    const devices = RND_LAB_FEATURES.find((f) => f.name === 'device-wall')!;
    expect(countVerts(g, (p, o) => o.name === 'rnd-displays' && inRect(devices, p.x, p.z)), 'phone and tablet screens').toBeGreaterThan(40);
  });

  it('the video wall is a curved display mesh and the lab floor is the most polished wing floor', () => {
    const g = model().floors[LAB_FLOOR]!.group;
    const displays = g.getObjectByName('rnd-displays');
    expect(displays).toBeInstanceOf(Mesh);
    const mat = (displays as Mesh).material;
    expect(mat).toBeInstanceOf(MeshBasicMaterial);
    const wall = RND_LAB_FEATURES.find((f) => f.name === 'video-wall')!;
    const zs: number[] = [];
    countVerts(g, (p, o) => {
      if (o.name === 'rnd-displays' && inRect(wall, p.x, p.z)) zs.push(p.z);
      return false;
    });
    expect(zs.length).toBeGreaterThan(40);
    expect(Math.max(...zs) - Math.min(...zs), 'curved, not flat').toBeGreaterThan(0.2);
    const floor = g.getObjectByName('rnd-polished');
    expect(floor).toBeInstanceOf(Mesh);
    const fm = (floor as Mesh).material;
    expect(fm).toBeInstanceOf(MeshStandardMaterial);
    const pm = fm as MeshStandardMaterial;
    expect(pm.roughness).toBeLessThanOrEqual(0.25);
    expect(pm.userData.glow?.night ?? 0, 'warm light at night').toBeGreaterThan(0);
  });

  it('wall content is built in and updates at a low rate', () => {
    expect(LAB_WALL_HZ).toBeGreaterThan(0);
    expect(LAB_WALL_HZ).toBeLessThanOrEqual(4);
    const tick = createLabWallTicker(LAB_WALL_HZ);
    let redraws = 0;
    for (let i = 0; i <= 120; i++) if (tick(i / 60)) redraws++;
    expect(redraws).toBeLessThanOrEqual(LAB_WALL_HZ * 2 + 1);
    expect(redraws).toBeGreaterThanOrEqual(2);
    for (let t = 0; t < 40; t += 3.7) for (const line of labWallCode(t, 10)) expect(CODE_LINES).toContain(line);
    let prev = Infinity;
    for (let s = 0; s <= 200; s += 10) {
      const l = trainingLoss(s);
      expect(l).toBeGreaterThan(0);
      expect(l).toBeLessThanOrEqual(prev);
      prev = l;
    }
  });
});

describe('campus car park (rev 35)', () => {
  const plan = cityPlan(CAMPUS_BOUNDS, 7);
  const tower = box('tower', -HALF_WIDTH - 1.5, HALF_WIDTH + 2.2, -HALF_DEPTH - 0.6, HALF_DEPTH + 0.6);
  const wing = box('wing', WING.x - WING.halfW - 0.4, WING.x + WING.halfW + 0.4, -WING.halfD - 0.4, WING.halfD + 0.4);
  const terrace = box('terrace', TERRACE.x0, TERRACE.x1, TERRACE.z0, TERRACE.z1);

  it('lies inside the campus bounds, clear of the tower, the wing, the terrace and every city road and sidewalk', () => {
    expect(within(PARKING_LOT, CAMPUS_BOUNDS)).toBe(true);
    for (const r of [tower, wing, terrace]) expect(rectsOverlap(PARKING_LOT, r), r.name).toBe(false);
    for (const r of [...plan.roads, ...plan.sidewalks, ...plan.crosswalks]) expect(rectsOverlap(PARKING_LOT, r)).toBe(false);
    expect(within(PARKING_LOT, plan.clear)).toBe(true);
    for (const [x, z] of [...BIKE_RACKS, ...PARKING_LAMPS, ...PARKING_TREES.map(([x, z]) => [x, z] as const)]) {
      expect(inRect(CAMPUS_BOUNDS, x, z)).toBe(true);
      expect(inRect(tower, x, z) || inRect(wing, x, z)).toBe(false);
    }
    expect(within(PARKING_GATE.booth, PARKING_LOT)).toBe(true);
  });

  it('is on the far side from the overview camera, so it never blocks the view of the tower', () => {
    const cam = overviewPose().pos;
    const centre = new Vector3((PARKING_LOT.x0 + PARKING_LOT.x1) / 2, 0, (PARKING_LOT.z0 + PARKING_LOT.z1) / 2);
    expect(cam.z).toBeGreaterThan(0);
    expect(PARKING_LOT.z1).toBeLessThan(-HALF_DEPTH);
    expect(cam.distanceTo(centre)).toBeGreaterThan(cam.distanceTo(new Vector3(0, 0, 0)));
  });

  it('has marked bays with premium cars, an EV charging canopy, a valet stand, EV chargers, bicycle racks, trees, lamps and a gate', () => {
    expect(PARKING_BAYS.length).toBeGreaterThanOrEqual(8);
    expect(PARKING_BAYS.filter((b) => b.car !== null).length).toBeGreaterThanOrEqual(6);
    expect(PARKING_BAYS.filter((b) => b.ev).length).toBeGreaterThanOrEqual(2);
    for (const b of PARKING_BAYS) {
      const r = box(b.id, b.x - PARKING_BAY.w / 2, b.x + PARKING_BAY.w / 2, b.z - PARKING_BAY.d / 2, b.z + PARKING_BAY.d / 2);
      expect(within(r, PARKING_LOT), b.id).toBe(true);
      expect(rectsOverlap(r, PARKING_GATE.booth)).toBe(false);
    }
    // Rev 37: refined paints (pearl white, graphite, deep navy, champagne), premium body styles.
    for (const name of ['pearl', 'graphite', 'navy', 'champagne'] as const) expect(PARKING_CAR_TONES.some((t) => t.name === name), name).toBe(true);
    const styles = new Set(PARKING_BAYS.flatMap((b) => (b.car === null ? [] : [b.style])));
    for (const st of ['sedan', 'gt', 'suv'] as const) expect(styles.has(st), st).toBe(true);
    expect(PARKING_GATE.valet).toBeDefined();
    expect(within(PARKING_GATE.canopy, PARKING_LOT)).toBe(true);
    expect(BIKE_RACKS.length).toBeGreaterThanOrEqual(3);
    expect(PARKING_LAMPS.length).toBeGreaterThanOrEqual(3);
    expect(PARKING_TREES.length).toBeGreaterThanOrEqual(3);
    const b = PARKING_GATE.barrier;
    expect(b.x).toBeGreaterThan(PARKING_LOT.x0);
    expect(b.x).toBeLessThan(PARKING_BAY.x0);
  });

  it('is built on the campus grounds: one static mesh and one night-light mesh, trees in the campus tree instances', () => {
    const m = model();
    const campus = m.root.getObjectByName('campus');
    expect(campus).toBeDefined();
    const lot = campus!.getObjectByName('parking');
    expect(lot).toBeInstanceOf(Mesh);
    expect(countVerts(lot!, (p) => inRect(PARKING_LOT, p.x, p.z))).toBeGreaterThan(500);
    expect(countVerts(lot!, (p) => p.y > 0.9 && inRect(PARKING_LOT, p.x, p.z)), 'cars, chargers, booth, lamps stand up').toBeGreaterThan(100);
    const lights = campus!.getObjectByName('parking-lights');
    expect(lights).toBeInstanceOf(Mesh);
    const lm = (lights as Mesh).material as MeshStandardMaterial;
    expect(lm.userData.glow?.night ?? 0).toBeGreaterThan(0);
    const trees = campus!.getObjectByName('campus-tree-trunks');
    expect(trees).toBeInstanceOf(InstancedMesh);
    expect(countVerts(trees!, (p) => inRect(PARKING_LOT, p.x, p.z, 0.5)), 'parking trees').toBeGreaterThan(0);
  });
});

