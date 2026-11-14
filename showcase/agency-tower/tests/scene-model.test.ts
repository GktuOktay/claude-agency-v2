import { describe, it, expect } from 'vitest';
import { Mesh, Ray, Vector3, type Material, type Object3D } from 'three';
import { buildTower, FLOOR_HEIGHT, type TowerModel } from '../src/scene/model';
import { tierStyle } from '../src/scene/robot';
import { pickRobot } from '../src/scene/picking';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { TIERS } from '../src/data/types';

function model(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

function names(root: Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => out.push(o.name));
  return out;
}

function opacities(mats: readonly Material[]): number[] {
  return mats.map((m) => m.opacity);
}

describe('scene model (AC-6)', () => {
  it('has 6 floors and one robot per data unit, each on its overlay floor', () => {
    const m = model();
    expect(m.floors).toHaveLength(6);
    expect(m.robots).toHaveLength(20);
    for (const r of m.robots) {
      expect(r.floor).toBe(r.unit.floor);
      const y = r.group.position.y;
      expect(y).toBeGreaterThanOrEqual(r.floor * FLOOR_HEIGHT);
      expect(y).toBeLessThan((r.floor + 1) * FLOOR_HEIGHT);
    }
  });

  it('robot count follows the data, not a constant', () => {
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const fewer = { floors: r.data.floors, units: r.data.units.filter((u) => u.id !== 'scout') };
    expect(buildTower(fewer).robots).toHaveLength(19);
  });

  it('each floor has desks, a coffee station and a named floor-specific prop', () => {
    const m = model();
    const props = new Set<string>();
    for (const f of m.floors) {
      const n = names(f.group);
      expect(n.filter((x) => x === 'desk').length).toBeGreaterThanOrEqual(1);
      expect(n).toContain('coffee-station');
      const prop = n.find((x) => x.startsWith('floor-prop:'));
      expect(prop).toBeDefined();
      props.add(prop ?? '');
    }
    expect(props.size).toBe(6);
  });

  it('floor 5 has glass walls, a skyline, a signing desk and the ceo robot', () => {
    const m = model();
    const n = names(m.floors[5]!.group);
    expect(n).toContain('glass-wall');
    expect(n).toContain('skyline');
    expect(n).toContain('signing-desk');
    expect(m.robots.find((r) => r.floor === 5)?.unit.tier).toBe('ceo');
  });

  it('every robot owns a distinct desk', () => {
    const m = model();
    const keys = m.robots.map((r) => `${r.floor}:${r.workPoint.x.toFixed(2)},${r.workPoint.z.toFixed(2)}`);
    expect(new Set(keys).size).toBe(m.robots.length);
  });

  it('overview: exterior walls 0.25, all contents 1.0', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    for (const f of m.floors) {
      expect(new Set(opacities(f.materials.walls))).toEqual(new Set([0.25]));
      expect(new Set(opacities([...f.materials.slab, ...f.materials.contents, ...f.materials.robots]))).toEqual(new Set([1]));
    }
  });

  it('floor view: floors above the focus <= 0.10, focused floor walls see-through, floors below unchanged', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 3 });
    for (const id of [4, 5]) {
      const f = m.floors[id]!;
      const all = [...f.materials.walls, ...f.materials.slab, ...f.materials.contents, ...f.materials.robots];
      expect(Math.max(...opacities(all))).toBeLessThanOrEqual(0.1);
    }
    expect(Math.max(...opacities(m.floors[3]!.materials.walls))).toBeLessThanOrEqual(0.05);
    expect(new Set(opacities(m.floors[3]!.materials.robots))).toEqual(new Set([1]));
    expect(new Set(opacities(m.floors[2]!.materials.walls))).toEqual(new Set([0.25]));
    m.setView({ mode: 'overview', focusFloor: 0 });
    expect(new Set(opacities(m.floors[4]!.materials.contents))).toEqual(new Set([1]));
  });

  it('wall and slab meshes are not pickable robots (userData carries no unit id)', () => {
    const m = model();
    m.root.traverse((o) => {
      if (o instanceof Mesh && o.name === 'exterior-wall') expect(o.userData.unitId).toBeUndefined();
    });
  });
});

describe('picking (AC-6)', () => {
  function rayToward(target: Vector3, from: Vector3): Ray {
    return new Ray(from.clone(), target.clone().sub(from).normalize());
  }

  it('finds a robot in overview, through the semi-transparent shell', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    m.root.updateMatrixWorld(true);
    const robot = m.robots.find((r) => r.unit.id === 'qa-engineer')!;
    const target = robot.group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.8, 0));
    const hit = pickRobot(m, rayToward(target, target.clone().add(new Vector3(0, 0, 40))));
    expect(hit?.unit.id).toBe('qa-engineer');
  });

  it('a ray that only crosses the shell finds nothing', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    m.root.updateMatrixWorld(true);
    expect(pickRobot(m, new Ray(new Vector3(0, 40, 40), new Vector3(0, 0, -1)))).toBeNull();
    expect(pickRobot(m, new Ray(new Vector3(200, 2, 0), new Vector3(1, 0, 0)))).toBeNull();
  });

  it('floor view: finds robots on the focused floor only, not on ghosted floors', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 3 });
    m.root.updateMatrixWorld(true);
    const hitAt = (id: string) => {
      const r = m.robots.find((x) => x.unit.id === id)!;
      const t = r.group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.8, 0));
      return pickRobot(m, rayToward(t, t.clone().add(new Vector3(0, 0, 40))));
    };
    expect(hitAt('scout')?.unit.id).toBe('scout');
    expect(hitAt('chief-of-staff')).toBeNull();
    expect(hitAt('ceo')).toBeNull();
    expect(hitAt('qa-engineer')).toBeNull();
  });
});

describe('robot descriptors (AC-9)', () => {
  it('scale 1.35 / 1.2 / 1.1 / 1.0 and unique markers per tier', () => {
    expect(TIERS.map((t) => tierStyle(t).scale)).toEqual([1.35, 1.2, 1.1, 1.0]);
    expect(TIERS.map((t) => tierStyle(t).marker)).toEqual(['crown', 'badge', 'stripe', 'none']);
    expect(new Set(TIERS.map((t) => tierStyle(t).marker)).size).toBe(4);
    expect(tierStyle('ceo').color).toBe(tierStyle('management').color);
  });

  it('robot meshes carry their tier scale and marker', () => {
    const m = model();
    for (const r of m.robots) {
      const style = tierStyle(r.unit.tier);
      expect(r.group.scale.x).toBeCloseTo(style.scale);
      expect(names(r.group).includes(`marker:${style.marker}`)).toBe(style.marker !== 'none');
    }
  });
});
