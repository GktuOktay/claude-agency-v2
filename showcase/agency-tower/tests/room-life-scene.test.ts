// Room life meshes (KARARLAR Rev 39, budget Rev 40): instanced team occupants, never pickable.
import { describe, expect, it } from 'vitest';
import { InstancedMesh, Mesh, MeshStandardMaterial, Ray, Vector3, type Object3D } from 'three';
import { buildTower } from '../src/scene/model';
import { pickRobot } from '../src/scene/picking';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { createRoomLife, frameRoomLife, ROOM_LIFE_MAX_MESHES } from '../src/scene/roomLife';
import { LIFE_ANCHORS } from '../src/sim/roomLifeSim';
import { FLOOR_HEIGHT, FLOOR_TOP } from '../src/sim/layout';

const data = () => {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
};
const meshesOf = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
};
const verts = (m: Mesh): number => m.geometry.attributes.position?.count ?? 0;
const expanded = (m: Mesh): number => verts(m) * (m instanceof InstancedMesh ? m.count : 1);
const matrices = (root: Object3D): string =>
  meshesOf(root)
    .filter((m): m is InstancedMesh => m instanceof InstancedMesh)
    .map((m) => Array.from(m.instanceMatrix.array, (v) => v.toFixed(5)).join(','))
    .join('|');

describe('room life: budget (Rev 40: expanded vertices)', () => {
  it(`uses at most ${ROOM_LIFE_MAX_MESHES} meshes and at most 12 000 expanded vertices`, () => {
    const life = createRoomLife({ seed: 1 });
    const ms = meshesOf(life.group);
    const once = ms.reduce((s, m) => s + verts(m), 0);
    const exp = ms.reduce((s, m) => s + expanded(m), 0);
    console.info(`[budget] room life meshes=${ms.length} vertices(once)=${once} vertices(expanded)=${exp} people=${LIFE_ANCHORS.length}`);
    expect(ROOM_LIFE_MAX_MESHES).toBeLessThanOrEqual(20);
    expect(ms.length).toBeLessThanOrEqual(ROOM_LIFE_MAX_MESHES);
    expect(exp).toBeLessThanOrEqual(12_000);
    expect(ms.some((m) => m instanceof InstancedMesh && m.count >= LIFE_ANCHORS.length)).toBe(true);
  });

  it('the whole tower plus room life stays under 700k vertices (counted once and expanded) and 1000 meshes', () => {
    const model = buildTower(data());
    model.root.add(createRoomLife({ seed: 1 }).group);
    const ms = meshesOf(model.root);
    const once = ms.reduce((s, m) => s + verts(m), 0);
    const exp = ms.reduce((s, m) => s + expanded(m), 0);
    console.info(`[budget] tower+room life meshes=${ms.length} vertices(once)=${once} vertices(expanded)=${exp}`);
    expect(once).toBeLessThan(700_000);
    expect(exp, 'Rev 40: every instance counts').toBeLessThan(700_000);
    expect(ms.length).toBeLessThan(1000);
  });
});

describe('room life: not units', () => {
  it('carries no unit id, is never pickable, and adds no robot', () => {
    const model = buildTower(data(), { city: false, grounds: false, facade: false });
    const robots = model.robots.length;
    const life = createRoomLife({ seed: 1, officeTime: '10:00' });
    model.root.add(life.group);
    life.group.traverse((o) => {
      expect(o.userData.unitId).toBeUndefined();
    });
    expect(model.robots.length).toBe(robots);
    model.root.updateMatrixWorld(true);
    // A ray straight down through an Ar-Ge researcher (wing level 2, where no robot sits) picks nothing.
    const a = LIFE_ANCHORS.find((x) => x.id === 'life:lab-lead')!;
    const top = a.floor * FLOOR_HEIGHT + FLOOR_TOP + 2;
    expect(pickRobot(model, new Ray(new Vector3(a.x, top, a.z), new Vector3(0, -1, 0)))).toBeNull();
    model.setOrg(true);
    expect(pickRobot(model, new Ray(new Vector3(a.x, top, a.z), new Vector3(0, -1, 0)))).toBeNull();
  });

  it('places every present person on its anchor floor at human height (like the CEO)', () => {
    const life = createRoomLife({ seed: 1, officeTime: '10:00', reducedMotion: true });
    for (const a of LIFE_ANCHORS) {
      const m = life.torsoMatrix(a.id);
      expect(m).not.toBeNull();
      const p = new Vector3().setFromMatrixPosition(m!);
      const present = life.sim.snapshot().find((v) => v.id === a.id)!.present;
      if (!present) continue;
      const base = a.floor * FLOOR_HEIGHT + FLOOR_TOP;
      expect(p.y).toBeGreaterThanOrEqual(base - 0.01);
      expect(p.y).toBeLessThan(base + 0.8);
      if (a.posture !== 'lie') expect(Math.hypot(p.x - a.x, p.z - a.z)).toBeLessThan(0.05);
    }
  });
});

describe('room life: view, org and motion', () => {
  it('ghosting follows the floor: floor view shows only the focused floor (people and their furniture)', () => {
    const life = createRoomLife({ seed: 1, officeTime: '10:30' });
    const lab = LIFE_ANCHORS.find((x) => x.id === 'life:lab-lead')!;
    const gym = LIFE_ANCHORS.find((x) => x.id === 'life:trainer')!;
    const scale = (id: string): number => new Vector3().setFromMatrixScale(life.torsoMatrix(id)!).x;
    expect(scale(lab.id)).toBeGreaterThan(0);
    life.setView({ mode: 'floor', focusFloor: 1 });
    expect(scale(lab.id)).toBe(0);
    expect(scale(gym.id)).toBeGreaterThan(0);
    const furniture = meshesOf(life.group).filter((m) => !(m instanceof InstancedMesh));
    expect(furniture.length).toBeGreaterThan(0);
    for (const m of furniture) expect(m.visible).toBe(m.userData.floor === 1);
    life.setView({ mode: 'overview', focusFloor: 0 });
    expect(scale(lab.id)).toBeGreaterThan(0);
    for (const m of furniture) expect(m.visible).toBe(true);
  });

  it('animates in normal motion', () => {
    const life = createRoomLife({ seed: 1, officeTime: '10:00' });
    life.step(0.1);
    const a = matrices(life.group);
    life.step(0.25);
    expect(matrices(life.group)).not.toBe(a);
  });

  it('org mode dims and freezes them', () => {
    const life = createRoomLife({ seed: 1, officeTime: '10:00' });
    life.step(0.1);
    life.setOrg(true);
    const a = matrices(life.group);
    life.setOfficeTime('22:00');
    for (let i = 0; i < 20; i++) life.step(0.1);
    expect(matrices(life.group)).toBe(a);
    for (const m of meshesOf(life.group)) {
      const mat = m.material as MeshStandardMaterial;
      expect(mat.opacity).toBeLessThan(0.5);
      expect(mat.transparent).toBe(true);
    }
    life.setOrg(false);
    for (const m of meshesOf(life.group)) expect((m.material as MeshStandardMaterial).opacity).toBe(1);
  });

  it('reduced motion holds static poses', () => {
    const life = createRoomLife({ seed: 1, officeTime: '10:00' });
    life.setReducedMotion(true);
    life.step(0.1);
    const a = matrices(life.group);
    for (let i = 0; i < 20; i++) life.step(0.1);
    expect(matrices(life.group)).toBe(a);
  });

  it('the frame hook respects the global pause reasons of the simulation clock', () => {
    const life = createRoomLife({ seed: 1, officeTime: '10:00' });
    life.step(0.1);
    const a = matrices(life.group);
    for (let i = 0; i < 10; i++) frameRoomLife(life, { paused: true }, 0.1, 22 * 60);
    expect(matrices(life.group)).toBe(a);
    frameRoomLife(life, { paused: false }, 0.1, 10 * 60 + 1);
    expect(matrices(life.group)).not.toBe(a);
  });

  it('is deterministic for a seed', () => {
    const run = (): string => {
      const life = createRoomLife({ seed: 3, officeTime: '12:40' });
      for (let i = 0; i < 10; i++) life.step(0.1);
      return matrices(life.group);
    };
    expect(run()).toBe(run());
  });
});
