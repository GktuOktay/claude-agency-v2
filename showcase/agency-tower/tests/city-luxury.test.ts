// City luxury and realism pass (KARARLAR rev 37): real-world scale, premium vehicles, a grand hotel with a
// porte-cochère, a landscaped plaza with a sculpture and a water feature, glass towers further back,
// boutique fronts and warm night lighting. The rev 31/33 behaviour checks stay in city-sim / city-scene tests.
import { describe, it, expect } from 'vitest';
import { Box3, Color, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, Vector3, type Object3D } from 'three';
import { CAMPUS_BOUNDS, FLOOR_HEIGHT } from '../src/sim/layout';
import {
  BIKE_WIDTH,
  BODY_SPECS,
  LANE_OFFSET,
  LANE_WIDTH,
  MEDIAN_HALF,
  PARAPET,
  ROAD_HALF,
  STOREY,
  WALK_WIDTH,
  cityPlan,
  createCitySim,
  heightCap,
  inRect,
  rectDistance,
  rectsOverlap,
  type BodyStyle,
} from '../src/sim/citySim';
import { CAR_PAINTS, createCity } from '../src/scene/city';

const plan = cityPlan(CAMPUS_BOUNDS, 7);
const CAR_STYLES: readonly BodyStyle[] = ['sedan', 'tourer', 'suv', 'convertible'];

describe('real-world scale (rev 37)', () => {
  it('storeys are about 3.5 m, a touch taller than the tower floors; lanes about 3.5 m; sidewalks 3 to 5 m', () => {
    expect(STOREY).toBeGreaterThanOrEqual(3.3);
    expect(STOREY).toBeLessThanOrEqual(3.7);
    expect(STOREY / FLOOR_HEIGHT).toBeGreaterThanOrEqual(1.05);
    expect(STOREY / FLOOR_HEIGHT).toBeLessThanOrEqual(1.3);
    expect(Math.abs(LANE_WIDTH - 3.5)).toBeLessThanOrEqual(0.25);
    expect(ROAD_HALF).toBeCloseTo(MEDIAN_HALF + LANE_WIDTH + BIKE_WIDTH, 9);
    expect(LANE_OFFSET, 'cars drive in the middle of their lane').toBeCloseTo(MEDIAN_HALF + LANE_WIDTH / 2, 9);
    expect(WALK_WIDTH).toBeGreaterThanOrEqual(3);
    expect(WALK_WIDTH).toBeLessThanOrEqual(5);
    for (const s of plan.sidewalks) {
      const w = Math.min(s.x1 - s.x0, s.z1 - s.z0);
      expect(w).toBeGreaterThanOrEqual(3);
      expect(w).toBeLessThanOrEqual(5);
    }
    for (const b of plan.buildings.filter((q) => q.style !== 'canopy')) expect(b.h, b.style).toBeCloseTo(b.floors * STOREY + PARAPET, 9);
  });

  it('vehicles have real proportions and fit their lane', () => {
    for (const s of CAR_STYLES) {
      const b = BODY_SPECS[s];
      expect(b.length, s).toBeGreaterThanOrEqual(4.4);
      expect(b.length, s).toBeLessThanOrEqual(5.4);
      expect(b.width, s).toBeGreaterThanOrEqual(1.82);
      expect(b.width, s).toBeLessThanOrEqual(2.05);
      expect(b.height, s).toBeGreaterThanOrEqual(1.2);
      expect(b.height, s).toBeLessThanOrEqual(1.75);
    }
    const B = BODY_SPECS;
    expect(B.suv.height).toBeGreaterThan(B.sedan.height);
    expect(B.sedan.height).toBeGreaterThan(B.tourer.height);
    expect(B.limousine.length).toBeGreaterThanOrEqual(B.sedan.length);
    expect(B.shuttle.length).toBeLessThanOrEqual(7);
    for (const b of Object.values(B)) expect(b.width, 'room in the lane').toBeLessThanOrEqual(LANE_WIDTH - 1.2);
  });
});

describe('premium traffic (rev 37)', () => {
  it('cars are executive sedans, grand tourers, electric SUVs and a few convertibles; taxis are limousines, buses shuttles', () => {
    const sim = createCitySim(plan, 7);
    const cars = sim.vehicles.filter((v) => v.kind === 'car');
    expect(new Set(cars.map((v) => v.body))).toEqual(new Set(CAR_STYLES));
    const conv = cars.filter((v) => v.body === 'convertible').length;
    expect(conv, 'a few convertibles').toBeLessThanOrEqual(3);
    for (const v of sim.vehicles) {
      if (v.kind === 'taxi') expect(v.body).toBe('limousine');
      if (v.kind === 'bus') expect(v.body).toBe('shuttle');
      expect(v.length).toBe(BODY_SPECS[v.body].length);
    }
  });
});

describe('hotel, plaza and towers (rev 37)', () => {
  it('a grand hotel faces the street behind a porte-cochère with a doorman at the door', () => {
    const h = plan.hotel;
    expect(h.blocks.length).toBeGreaterThanOrEqual(1);
    for (const b of h.blocks) {
      expect(b.style).toBe('hotel');
      expect(plan.buildings).toContain(b);
    }
    expect(Math.max(...h.blocks.map((b) => b.floors))).toBeGreaterThanOrEqual(3);
    const c = h.canopy;
    expect(c.style).toBe('canopy');
    expect(plan.buildings).toContain(c);
    expect(c.h).toBeGreaterThanOrEqual(4);
    expect(c.h).toBeLessThanOrEqual(heightCap(rectDistance(CAMPUS_BOUNDS, c)));
    // The canopy reaches out from the front block over the forecourt, short of the sidewalk.
    expect(h.blocks.some((b) => Math.abs(b.z1 - c.z0) < 0.05 && c.x0 > b.x0 && c.x1 < b.x1)).toBe(true);
    expect(inRect(h.forecourt, { x: (c.x0 + c.x1) / 2, z: c.z1 })).toBe(true);
    for (const r of [...plan.sidewalks, ...plan.roads]) expect(rectsOverlap(h.forecourt, r)).toBe(false);
    expect(plan.sidewalks.some((s) => Math.abs(s.z0 - h.forecourt.z1) < 0.05), 'the forecourt opens onto the sidewalk').toBe(true);
    expect(inRect(c, h.doorman)).toBe(true);
    for (const b of plan.buildings) if (!h.blocks.includes(b) && b !== c) expect(rectsOverlap(b, h.forecourt), 'no other building in the forecourt').toBe(false);
  });

  it('a landscaped plaza in the park carries a reflecting pool with a sculpture, lined with bollards', () => {
    expect(inRect(plan.park, { x: plan.plaza.x0, z: plan.plaza.z0 }) && inRect(plan.park, { x: plan.plaza.x1, z: plan.plaza.z1 })).toBe(true);
    expect(inRect(plan.plaza, { x: plan.pool.x0, z: plan.pool.z0 }) && inRect(plan.plaza, { x: plan.pool.x1, z: plan.pool.z1 })).toBe(true);
    const s = plan.sculpture;
    expect(inRect(plan.pool, s)).toBe(true);
    expect(s.h).toBeGreaterThanOrEqual(2.5);
    expect(s.h).toBeLessThanOrEqual(heightCap(rectDistance(CAMPUS_BOUNDS, { x0: s.x - s.r, x1: s.x + s.r, z0: s.z - s.r, z1: s.z + s.r })));
    expect(rectsOverlap(plan.pond, plan.plaza)).toBe(false);
    expect(plan.bollards.length).toBeGreaterThanOrEqual(8);
    for (const b of plan.bollards) {
      expect(inRect(plan.clear, b)).toBe(false);
      for (const r of plan.roads) expect(inRect(r, b), `${b.x},${b.z}`).toBe(false);
    }
  });

  it('a few elegant glass towers rise further back, away from the camera side and under the height cap', () => {
    const towers = plan.buildings.filter((b) => b.style === 'tower');
    expect(towers.length).toBeGreaterThanOrEqual(2);
    for (const t of towers) {
      expect(t.floors).toBeGreaterThanOrEqual(6);
      expect(rectDistance(CAMPUS_BOUNDS, t)).toBeGreaterThanOrEqual(40);
      expect(t.z0 > CAMPUS_BOUNDS.z1 || t.x0 > CAMPUS_BOUNDS.x1).toBe(false);
    }
  });

  it('mature street trees: the tallest reach 7 m or more where the cap allows', () => {
    expect(Math.max(...plan.trees.map((t) => t.h))).toBeGreaterThanOrEqual(7);
  });
});

// ---- scene ----

function meshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}
const VEHICLE_MESHES: Record<BodyStyle, string> = {
  sedan: 'city-cars',
  tourer: 'city-tourers',
  suv: 'city-suvs',
  convertible: 'city-convertibles',
  limousine: 'city-taxis',
  shuttle: 'city-buses',
};

describe('city scene luxury (rev 37)', () => {
  const city = createCity({ seed: 7 });
  const sim = createCitySim(plan, 7);
  const get = (name: string): Mesh => {
    const m = city.group.getObjectByName(name);
    if (!(m instanceof Mesh)) throw new Error(name);
    return m;
  };

  it('every body style has its own paint mesh and a trim mesh (glass, tyres, alloy wheels, lights, chrome) at its real size', () => {
    for (const [style, name] of Object.entries(VEHICLE_MESHES) as [BodyStyle, string][]) {
      const paint = get(name);
      const trim = get(`${name}-trim`);
      expect(paint).toBeInstanceOf(InstancedMesh);
      expect(trim).toBeInstanceOf(InstancedMesh);
      if (!(paint instanceof InstancedMesh) || !(trim instanceof InstancedMesh)) return;
      expect(paint.count, style).toBe(sim.vehicles.filter((v) => v.body === style).length);
      expect(trim.count).toBe(paint.count);
      const spec = BODY_SPECS[style];
      const bb = new Box3().setFromBufferAttribute(paint.geometry.attributes.position as never).union(new Box3().setFromBufferAttribute(trim.geometry.attributes.position as never));
      const size = bb.getSize(new Vector3());
      expect(size.x, `${style} length`).toBeCloseTo(spec.length, 1);
      expect(Math.abs(size.z - spec.width), `${style} width (mirrors included)`).toBeLessThanOrEqual(0.25);
      expect(Math.abs(size.y - spec.height), `${style} height`).toBeLessThanOrEqual(0.12);
      expect(trim.geometry.attributes.position?.count ?? 0, `${style} detailed wheels and glass`).toBeGreaterThanOrEqual(150);
      const mat = trim.material;
      expect(mat instanceof MeshStandardMaterial && mat.metalness > 0.2, 'chrome and glass shine').toBe(true);
    }
  });

  it('paints are refined (pearl white, graphite, deep navy, champagne, racing green) and stay above the mood floor', () => {
    for (const k of ['pearl', 'graphite', 'navy', 'champagne', 'racingGreen'] as const) expect(CAR_PAINTS[k], k).toBeTypeOf('number');
    const allowed = new Set(Object.values(CAR_PAINTS));
    const c = new Color();
    const hsl = { h: 0, s: 0, l: 0 };
    const used = new Set<number>();
    for (const name of ['city-cars', 'city-tourers', 'city-suvs', 'city-convertibles', 'city-taxis']) {
      const m = get(name);
      if (!(m instanceof InstancedMesh) || !m.instanceColor) throw new Error(name);
      for (let i = 0; i < m.count; i++) {
        c.setRGB(m.instanceColor.getX(i), m.instanceColor.getY(i), m.instanceColor.getZ(i));
        used.add(c.getHex());
        expect(allowed.has(c.getHex()), `${name} ${i} ${c.getHexString()}`).toBe(true);
        expect(c.getHSL(hsl, SRGBColorSpace).l, `${name} ${i}`).toBeGreaterThanOrEqual(0.55);
      }
    }
    expect(used.size, 'a mix of paints on the road').toBeGreaterThanOrEqual(4);
  });

  it('boutique fronts and hotel lobbies glow warm (softly by day, fully at night); uplights and bollard lights come on at night', () => {
    const fronts = get('city-shopfronts').material;
    if (!(fronts instanceof MeshStandardMaterial)) throw new Error('fronts');
    city.setNight(false);
    const day = fronts.emissiveIntensity;
    expect(day).toBeGreaterThan(0);
    const up = get('city-uplights');
    expect(up.visible).toBe(false);
    city.setNight(true);
    expect(fronts.emissiveIntensity).toBeGreaterThan(day * 3);
    const hsl = { h: 0, s: 0, l: 0 };
    fronts.emissive.getHSL(hsl, SRGBColorSpace);
    expect(hsl.h < 0.15 && hsl.s > 0.5, 'warm interior light').toBe(true);
    expect(up.visible).toBe(true);
    expect(up.material instanceof MeshBasicMaterial && up.material.opacity > 0).toBe(true);
    const bollards = get('city-bollards');
    expect(bollards instanceof InstancedMesh && bollards.count).toBe(plan.bollards.length);
    city.setNight(false);
  });

  it('well-dressed people: a doorman stands at the hotel door, everyone is about 1.7 m tall', () => {
    const peds = get('city-pedestrians');
    const heads = get('city-ped-heads');
    if (!(peds instanceof InstancedMesh) || !(heads instanceof InstancedMesh)) throw new Error('people');
    const m = new Matrix4();
    const p = new Vector3();
    let doorman = false;
    for (let i = 0; i < peds.count; i++) {
      peds.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      if (Math.hypot(p.x - plan.hotel.doorman.x, p.z - plan.hotel.doorman.z) < 0.05 && p.y < 0.05) doorman = true;
    }
    expect(doorman).toBe(true);
    heads.geometry.computeBoundingBox();
    const top = heads.geometry.boundingBox?.max.y ?? 0;
    expect(top).toBeGreaterThanOrEqual(1.62);
    expect(top).toBeLessThanOrEqual(1.85);
  });

  it('the hotel, the sculpture and the plaza are drawn', () => {
    const names = meshes(city.group).map((m) => m.name);
    for (const n of ['city-shopfronts', 'city-bollards', 'city-uplights', 'city-sculpture']) expect(names).toContain(n);
    const s = get('city-sculpture');
    s.geometry.computeBoundingBox();
    const bb = s.geometry.boundingBox ?? new Box3();
    expect(bb.max.y).toBeLessThanOrEqual(plan.sculpture.h + 1e-6);
    expect(bb.max.y).toBeGreaterThanOrEqual(plan.sculpture.h - 0.3);
    expect(bb.min.x).toBeGreaterThanOrEqual(plan.sculpture.x - plan.sculpture.r - 1e-6);
    expect(bb.max.x).toBeLessThanOrEqual(plan.sculpture.x + plan.sculpture.r + 1e-6);
  });
});
