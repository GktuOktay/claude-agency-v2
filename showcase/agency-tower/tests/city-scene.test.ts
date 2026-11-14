// City around the campus (KARARLAR rev 31): meshes, budgets, day/night, org dim and freeze, reduced motion,
// not pickable, never covering the tower or the wing from the camera views.
import { describe, it, expect } from 'vitest';
import { Box3, Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, SRGBColorSpace, Vector3, type Material, type Object3D } from 'three';
import { createCity, type City } from '../src/scene/city';
import { buildTower, FLOOR_COUNT, FLOOR_HEIGHT } from '../src/scene/model';
import { floorPose, orgPose, overviewPose, viewDirection } from '../src/scene/camera';
import { CAMPUS_BOUNDS, HALF_DEPTH, HALF_WIDTH, ROOF_GARDEN_FLOOR, TERRACE, WING_EAST_X, WING_WEST_X } from '../src/sim/layout';
import { cityPlan } from '../src/sim/citySim';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import type { TowerData } from '../src/data/types';

function data(): TowerData {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

function meshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

function count(root: Object3D): { meshes: number; verts: number; drawnVerts: number } {
  let verts = 0;
  let drawnVerts = 0;
  const list = meshes(root);
  for (const m of list) {
    const n = m.geometry.attributes.position?.count ?? 0;
    verts += n;
    drawnVerts += m instanceof InstancedMesh ? n * m.count : n;
  }
  return { meshes: list.length, verts, drawnVerts };
}

function matrices(city: City, name: string): number[] {
  const m = city.group.getObjectByName(name);
  if (!(m instanceof InstancedMesh)) throw new Error(name);
  return Array.from(m.instanceMatrix.array);
}

const materialsOf = (root: Object3D): Material[] => meshes(root).flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));
const std = (root: Object3D, name: string): MeshStandardMaterial => {
  const m = root.getObjectByName(name);
  if (!(m instanceof Mesh) || !(m.material instanceof MeshStandardMaterial)) throw new Error(name);
  return m.material;
};
const dim = (root: Object3D): number => {
  const u: unknown = materialsOf(root)[0]?.userData.cityHaze;
  if (!u || typeof u !== 'object' || !('uDim' in u)) throw new Error('haze uniforms');
  const v: unknown = (u as { uDim: { value: unknown } }).uDim.value;
  return typeof v === 'number' ? v : NaN;
};

describe('city meshes', () => {
  it('builds streets, buildings with windows, trees, lamps, signals, vehicles, pedestrians and a park within its share', () => {
    const city = createCity({ seed: 7 });
    expect(city.group.name).toBe('city');
    const names = meshes(city.group).map((m) => m.name);
    for (const n of ['city-ground', 'city-buildings', 'city-windows-lit', 'city-windows-dark', 'city-props', 'city-tree-crowns', 'city-lamp-heads', 'city-signal-lamps', 'city-cars', 'city-taxis', 'city-buses', 'city-pedestrians']) expect(names, n).toContain(n);
    const c = count(city.group);
    console.info(`[budget] city meshes=${c.meshes} vertices=${c.verts} drawn(instances expanded)=${c.drawnVerts}`);
    expect(c.meshes).toBeLessThanOrEqual(40);
    expect(c.verts).toBeLessThanOrEqual(80_000);
    expect(c.drawnVerts, 'even with every instance expanded').toBeLessThanOrEqual(80_000);
  });

  it('is not pickable: every mesh ignores raycasts', () => {
    const city = createCity({ seed: 7 });
    city.group.updateMatrixWorld(true);
    const plan = cityPlan(CAMPUS_BOUNDS, 7);
    const b = plan.buildings[0];
    if (!b) throw new Error('building');
    const rc = new Raycaster(new Vector3((b.x0 + b.x1) / 2, 60, (b.z0 + b.z1) / 2), new Vector3(0, -1, 0));
    expect(rc.intersectObject(city.group, true)).toHaveLength(0);
    for (const m of meshes(city.group)) expect(m.castShadow || m.receiveShadow, m.name).toBe(false);
  });

  it('moves vehicles and pedestrians on step; under reduced motion nothing moves', () => {
    const city = createCity({ seed: 7 });
    const cars0 = matrices(city, 'city-cars');
    const peds0 = matrices(city, 'city-pedestrians');
    city.setReducedMotion(true);
    for (let i = 0; i < 30; i++) city.step(1 / 30);
    expect(matrices(city, 'city-cars')).toEqual(cars0);
    expect(matrices(city, 'city-pedestrians')).toEqual(peds0);
    city.setReducedMotion(false);
    for (let i = 0; i < 30; i++) city.step(1 / 30);
    expect(matrices(city, 'city-cars')).not.toEqual(cars0);
    expect(matrices(city, 'city-pedestrians')).not.toEqual(peds0);
  });

  it('org mode dims the city further and freezes it; leaving org restores both', () => {
    const city = createCity({ seed: 7 });
    for (let i = 0; i < 10; i++) city.step(1 / 30);
    const d0 = dim(city.group);
    city.setOrg(true);
    expect(dim(city.group)).toBeGreaterThan(d0);
    const cars = matrices(city, 'city-cars');
    for (let i = 0; i < 30; i++) city.step(1 / 30);
    expect(matrices(city, 'city-cars')).toEqual(cars);
    city.setOrg(false);
    expect(dim(city.group)).toBe(d0);
    for (let i = 0; i < 30; i++) city.step(1 / 30);
    expect(matrices(city, 'city-cars')).not.toEqual(cars);
  });

  it('lights windows, street lamps and vehicle lights at night only', () => {
    const city = createCity({ seed: 7 });
    city.setNight(false);
    expect(std(city.group, 'city-windows-lit').emissiveIntensity).toBe(0);
    expect(std(city.group, 'city-lamp-heads').emissiveIntensity).toBe(0);
    expect(city.group.getObjectByName('city-vehicle-lights')?.visible).toBe(false);
    city.setNight(true);
    expect(std(city.group, 'city-windows-lit').emissiveIntensity).toBeGreaterThan(0.5);
    expect(std(city.group, 'city-windows-dark').emissiveIntensity).toBe(0);
    expect(std(city.group, 'city-lamp-heads').emissiveIntensity).toBeGreaterThan(0.5);
    expect(city.group.getObjectByName('city-vehicle-lights')?.visible).toBe(true);
    city.setNight(0.5); // the smoothed night factor the scene feeds the tower
    expect(std(city.group, 'city-windows-lit').emissiveIntensity).toBeGreaterThan(0);
  });

  it('reads warm, light and calm (rev 33): materials stay above a lightness and saturation floor; the day fade is light and warm', () => {
    // Floors in sRGB HSL: the old gray city sat at a mean saturation of about 0.1 and a road lightness of 0.56.
    const L_MEAN = 0.68;
    const S_MEAN = 0.2;
    const L_MIN = 0.55;
    const hsl = { h: 0, s: 0, l: 0 };
    const c = new Color();
    const mean = (name: string): { l: number; s: number; minL: number } => {
      const m = city.group.getObjectByName(name);
      if (!(m instanceof Mesh)) throw new Error(name);
      const colors = m.geometry.attributes.color;
      if (!colors) throw new Error(`${name} colors`);
      let l = 0;
      let s = 0;
      let minL = 1;
      for (let i = 0; i < colors.count; i++) {
        c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).getHSL(hsl, SRGBColorSpace);
        l += hsl.l;
        s += hsl.s;
        minL = Math.min(minL, hsl.l);
      }
      return { l: l / colors.count, s: s / colors.count, minL };
    };
    const city = createCity({ seed: 7 });
    for (const name of ['city-ground', 'city-buildings', 'city-props']) {
      const m = mean(name);
      console.info(`[mood] ${name} mean L=${m.l.toFixed(3)} S=${m.s.toFixed(3)} min L=${m.minL.toFixed(3)}`);
      expect(m.l, `${name} lightness`).toBeGreaterThanOrEqual(L_MEAN);
      expect(m.s, `${name} saturation`).toBeGreaterThanOrEqual(S_MEAN);
      expect(m.minL, `${name} darkest colour`).toBeGreaterThanOrEqual(L_MIN);
    }
    // Instance colours (trees, umbrellas, cars, clothes) are never dark or gray either.
    for (const name of ['city-tree-crowns', 'city-umbrellas', 'city-cars', 'city-pedestrians']) {
      const m = city.group.getObjectByName(name);
      if (!(m instanceof InstancedMesh) || !m.instanceColor) throw new Error(name);
      for (let i = 0; i < m.count; i++) {
        c.setRGB(m.instanceColor.getX(i), m.instanceColor.getY(i), m.instanceColor.getZ(i)).getHSL(hsl, SRGBColorSpace);
        expect(hsl.l, `${name} ${i}`).toBeGreaterThanOrEqual(L_MIN);
      }
    }
    expect(std(city.group, 'city-windows-lit').color.getHSL(hsl, SRGBColorSpace).s, 'sky-blue glass').toBeGreaterThanOrEqual(0.3);
    const haze = (): Vector3 => {
      const u: unknown = materialsOf(city.group)[0]?.userData.cityHaze;
      if (!u || typeof u !== 'object' || !('uHaze' in u)) throw new Error('haze');
      const v: unknown = (u as { uHaze: { value: unknown } }).uHaze.value;
      if (!(v instanceof Vector3)) throw new Error('haze value');
      return v.clone();
    };
    city.setNight(false);
    const day = haze();
    expect(new Color(day.x, day.y, day.z).getHSL(hsl, SRGBColorSpace).l, 'light day fade').toBeGreaterThanOrEqual(0.85);
    expect(day.x, 'warm day fade (red over blue)').toBeGreaterThan(day.z);
    city.setNight(true);
    expect(new Color(haze().x, haze().y, haze().z).getHSL(hsl, SRGBColorSpace).l, 'cozy night, not black').toBeGreaterThanOrEqual(0.18);
    expect(city.group.getObjectByName('city-lamp-pools')?.visible, 'warm lamp pools at night').toBe(true);
    city.setNight(false);
    expect(city.group.getObjectByName('city-lamp-pools')?.visible).toBe(false);
  });

  it('signal lamps change as the lights cycle', () => {
    const city = createCity({ seed: 7 });
    const lamps = city.group.getObjectByName('city-signal-lamps');
    if (!(lamps instanceof InstancedMesh) || !lamps.instanceColor) throw new Error('signal lamps');
    const c0 = Array.from(lamps.instanceColor.array);
    for (let i = 0; i < 30 * 12; i++) city.step(1 / 30);
    expect(Array.from(lamps.instanceColor.array)).not.toEqual(c0);
  });
});

describe('city in the tower scene', () => {
  it('adds one city group to the tower root (not to a floor) and can be turned off', () => {
    const m = buildTower(data());
    const city = m.root.getObjectByName('city');
    expect(city?.parent).toBe(m.root);
    for (const f of m.floors) expect(f.group.getObjectByName('city')).toBeUndefined();
    expect(m.city).not.toBeNull();
    const off = buildTower(data(), { city: false });
    expect(off.root.getObjectByName('city')).toBeUndefined();
    expect(off.city).toBeNull();
    const a = count(off.root);
    const b = count(m.root);
    console.info(`[budget] scene without city meshes=${a.meshes} vertices=${a.verts}; with city meshes=${b.meshes} vertices=${b.verts}`);
    expect(b.verts).toBeLessThan(700_000);
    expect(b.meshes).toBeLessThan(1000);
  });

  it('does not ghost per floor: floor views leave the city untouched; org dims it; night lights it', () => {
    const m = buildTower(data());
    const group = m.root.getObjectByName('city');
    if (!group) throw new Error('city');
    const opacity = (): number[] => materialsOf(group).map((x) => x.opacity);
    const o0 = opacity();
    const d0 = dim(group);
    m.setView({ mode: 'floor', focusFloor: 2 });
    expect(group.visible).toBe(true);
    expect(opacity()).toEqual(o0);
    expect(dim(group)).toBe(d0);
    m.setView({ mode: 'overview', focusFloor: 0 });
    m.setOrg(true);
    expect(dim(group)).toBeGreaterThan(d0);
    m.setOrg(false);
    expect(dim(group)).toBe(d0);
    m.setNight(1);
    expect(std(group, 'city-windows-lit').emissiveIntensity).toBeGreaterThan(0.5);
    m.setNight(0);
    expect(std(group, 'city-windows-lit').emissiveIntensity).toBe(0);
  });
});

describe('the city never covers the tower or the wing', () => {
  const plan = cityPlan(CAMPUS_BOUNDS, 7);
  // Obstacles: every building and tree crown (thin poles excluded, see the city.ts ruling).
  const boxes: Box3[] = [
    ...plan.buildings.map((b) => new Box3(new Vector3(b.x0, 0, b.z0), new Vector3(b.x1, b.h, b.z1))),
    ...plan.trees.map((t) => new Box3(new Vector3(t.x - t.h * 0.3, t.h * 0.38, t.z - t.h * 0.3), new Vector3(t.x + t.h * 0.3, t.h, t.z + t.h * 0.3))),
    // Rev 33 extras: café umbrellas and the park kiosk.
    ...plan.tables.map((t) => new Box3(new Vector3(t.x - 1.05, 0, t.z - 1.05), new Vector3(t.x + 1.05, 2.45, t.z + 1.05))),
    new Box3(new Vector3(plan.kiosk.x0 - 0.2, 0, plan.kiosk.z0 - 0.9), new Vector3(plan.kiosk.x1 + 0.2, 2.7, plan.kiosk.z1 + 0.2)),
    // Rev 37 extra: the plaza sculpture (the hotel and its porte-cochère are plan buildings already).
    new Box3(new Vector3(plan.sculpture.x - plan.sculpture.r, 0, plan.sculpture.z - plan.sculpture.r), new Vector3(plan.sculpture.x + plan.sculpture.r, plan.sculpture.h, plan.sculpture.z + plan.sculpture.r)),
  ];
  // Sample points on the tower and wing walls (bottom, middle, top edges) and the terrace edge.
  const targets: Vector3[] = [];
  const ring = (x0: number, x1: number, z0: number, z1: number, ys: number[]): void => {
    for (const y of ys) {
      for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 8) targets.push(new Vector3(x, y, z0), new Vector3(x, y, z1));
      for (let z = z0; z <= z1 + 1e-6; z += (z1 - z0) / 4) targets.push(new Vector3(x0, y, z), new Vector3(x1, y, z));
    }
  };
  const top = FLOOR_COUNT * FLOOR_HEIGHT;
  ring(-HALF_WIDTH, HALF_WIDTH, -HALF_DEPTH, HALF_DEPTH, [0.2, top / 2, top]);
  ring(WING_WEST_X, WING_EAST_X, -HALF_DEPTH, HALF_DEPTH, [0.2, (ROOF_GARDEN_FLOOR * FLOOR_HEIGHT) / 2, ROOF_GARDEN_FLOOR * FLOOR_HEIGHT]);
  ring(TERRACE.x0, TERRACE.x1, TERRACE.z0, TERRACE.z1, [0.2]);

  const blocked = (eye: Vector3): string | null => {
    const dir = new Vector3();
    const hit = new Vector3();
    for (const t of targets) {
      dir.subVectors(t, eye);
      const len = dir.length();
      dir.normalize();
      for (const b of boxes) {
        if (b.containsPoint(eye)) continue; // camera inside a block: not a covering view
        const r = new Raycaster(eye, dir, 0, len);
        if (r.ray.intersectBox(b, hit) && hit.distanceTo(eye) < len - 0.05) return `target ${t.toArray().map((v) => v.toFixed(1))} by box ${b.min.toArray().map((v) => v.toFixed(1))}..${b.max.toArray().map((v) => v.toFixed(1))}`;
      }
    }
    return null;
  };

  it('from the overview, org and every floor view', () => {
    for (const pose of [overviewPose(), orgPose(), ...Array.from({ length: FLOOR_COUNT }, (_, f) => floorPose(f))]) expect(blocked(pose.pos)).toBeNull();
  });

  it('from orbit views all around the campus at the preset elevations and distances', () => {
    const centre = overviewPose().target;
    const low = floorPose(0).target;
    for (const target of [centre, low]) for (const el of [22, 35, 50]) for (const d of [25, 45, 70, 100]) for (let az = 0; az < 360; az += 15) {
      const eye = target.clone().add(viewDirection(az, el).multiplyScalar(d));
      expect(blocked(eye), `az ${az} el ${el} d ${d} target y ${target.y.toFixed(1)}`).toBeNull();
    }
  });

  it('the buildings mesh is built from the checked plan (no taller geometry)', () => {
    const city = createCity({ seed: 7 });
    const m = city.group.getObjectByName('city-buildings');
    if (!(m instanceof Mesh)) throw new Error('buildings');
    const pos = m.geometry.attributes.position;
    if (!pos) throw new Error('positions');
    const p = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      expect(boxes.some((b) => b.clone().expandByScalar(0.01).containsPoint(p)), `building vertex ${p.toArray().map((v) => v.toFixed(1))}`).toBe(true);
    }
    const crowns = city.group.getObjectByName('city-tree-crowns');
    if (!(crowns instanceof InstancedMesh)) throw new Error('crowns');
    const im = new Matrix4();
    const bb = new Box3();
    crowns.geometry.computeBoundingBox();
    for (let i = 0; i < crowns.count; i++) {
      crowns.getMatrixAt(i, im);
      bb.copy(crowns.geometry.boundingBox ?? new Box3()).applyMatrix4(im);
      expect(boxes.some((b) => b.containsBox(bb.clone().expandByScalar(-0.01))), `crown ${i}`).toBe(true);
    }
  });
});
