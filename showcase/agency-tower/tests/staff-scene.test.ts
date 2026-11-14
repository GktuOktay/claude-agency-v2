// Staff NPC meshes (KARARLAR rev 31): budgets, not pickable, no unit ids, floor-view visibility, org freeze,
// reduced-motion static poses, lobby props on floor 0 inside their footprints.
import { describe, it, expect } from 'vitest';
import { Box3, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { buildTower } from '../src/scene/model';
import { createStaff } from '../src/scene/staff';
import { FLOOR_HEIGHT, LOBBY_FLOOR, lobbyPropFootprints } from '../src/sim/layout';
import { pickRobot } from '../src/scene/picking';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

function tower() {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

function count(root: Object3D): { meshes: number; verts: number } {
  let meshes = 0;
  let verts = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) {
      meshes++;
      verts += o.geometry.attributes.position?.count ?? 0;
    }
  });
  return { meshes, verts };
}

describe('staff meshes', () => {
  const model = tower();
  const staff = createStaff({ layouts: model.layouts, seed: 1 });

  it('stays within its share: at most 30 meshes and 25k vertices; tower + staff under 700k and 1000', () => {
    const s = count(staff.group);
    const t = count(model.root);
    console.info(`[budget] staff meshes=${s.meshes} vertices=${s.verts}; tower+staff meshes=${s.meshes + t.meshes} vertices=${s.verts + t.verts}`);
    expect(s.meshes).toBeLessThanOrEqual(30);
    expect(s.verts).toBeLessThanOrEqual(25_000);
    expect(s.verts + t.verts).toBeLessThan(700_000);
    expect(s.meshes + t.meshes).toBeLessThan(1000);
  });

  it('is not pickable and carries no unit id', () => {
    model.root.add(staff.group);
    staff.group.updateMatrixWorld(true);
    let ids = 0;
    staff.group.traverse((o) => {
      if (o.userData.unitId !== undefined) ids++;
    });
    expect(ids).toBe(0);
    for (const v of staff.snapshot()) {
      const origin = new Vector3(v.x, v.floor * FLOOR_HEIGHT + 5, v.z);
      const rc = new Raycaster(origin, new Vector3(0, -1, 0));
      expect(rc.intersectObject(staff.group, true)).toHaveLength(0);
      const hit = pickRobot(model, rc.ray);
      if (hit) expect(hit.unit.id.startsWith('staff:')).toBe(false);
    }
    model.root.remove(staff.group);
  });

  it('moves its characters to the sim positions on step', () => {
    const s = createStaff({ layouts: model.layouts, seed: 2 });
    for (let i = 0; i < 50; i++) s.step(0.1);
    for (const v of s.snapshot()) {
      const g = s.group.getObjectByName(v.id);
      expect(g, v.id).toBeDefined();
      expect(g!.position.x).toBeCloseTo(v.x, 6);
      expect(g!.position.z).toBeCloseTo(v.z, 6);
      expect(g!.position.y).toBeCloseTo(v.floor * FLOOR_HEIGHT + 0.14, 6);
    }
  });

  it('floor view shows only the focused floor; overview shows all', () => {
    const s = createStaff({ layouts: model.layouts, seed: 3 });
    s.setView({ mode: 'floor', focusFloor: 4 });
    for (const v of s.snapshot()) expect(s.group.getObjectByName(v.id)!.visible, v.id).toBe(v.floor === 4);
    expect(s.group.getObjectByName('staff-props')!.visible).toBe(false);
    s.setView({ mode: 'floor', focusFloor: LOBBY_FLOOR });
    expect(s.group.getObjectByName('staff-props')!.visible).toBe(true);
    s.setView({ mode: 'overview', focusFloor: 0 });
    for (const v of s.snapshot()) expect(s.group.getObjectByName(v.id)!.visible).toBe(true);
  });

  it('org mode freezes poses and positions', () => {
    const s = createStaff({ layouts: model.layouts, seed: 4 });
    for (let i = 0; i < 30; i++) s.step(0.1);
    s.setOrg(true);
    const snap = (): number[] => {
      const out: number[] = [];
      s.group.traverse((o) => out.push(o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z));
      return out;
    };
    s.step(0.1);
    const a = snap();
    for (let i = 0; i < 100; i++) s.step(0.1);
    expect(snap()).toEqual(a);
  });

  it('reduced motion: limbs hold a static pose that depends only on the state, never on time', () => {
    const s = createStaff({ layouts: model.layouts, seed: 5, reducedMotion: true });
    const limbs = (): string => {
      const out: string[] = [];
      s.group.traverse((o) => {
        if (o.name.startsWith('staff-limb')) out.push(`${o.rotation.x.toFixed(6)},${o.rotation.z.toFixed(6)}`);
      });
      return out.join(';');
    };
    const seen = new Map<string, string>();
    for (let i = 0; i < 600; i++) {
      s.step(0.1);
      const states = s.snapshot().map((v) => v.state).join();
      const pose = limbs();
      expect(pose.length).toBeGreaterThan(0);
      const prev = seen.get(states);
      if (prev !== undefined) expect(pose).toBe(prev);
      else seen.set(states, pose);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('the security desk and turnstile stand on floor 0 inside their layout footprints', () => {
    const s = createStaff({ layouts: model.layouts, seed: 6 });
    const props = s.group.getObjectByName('staff-props')!;
    props.updateMatrixWorld(true);
    const fps = lobbyPropFootprints();
    props.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const pos = o.geometry.attributes.position!;
      const p = new Vector3();
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        expect(p.y).toBeGreaterThanOrEqual(LOBBY_FLOOR * FLOOR_HEIGHT);
        expect(p.y).toBeLessThan(LOBBY_FLOOR * FLOOR_HEIGHT + 1.2);
        const ok = fps.some((r) => p.x >= r.x0 - 1e-6 && p.x <= r.x1 + 1e-6 && p.z >= r.z0 - 1e-6 && p.z <= r.z1 + 1e-6);
        expect(ok, `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(true);
      }
    });
    expect(new Box3().setFromObject(props).isEmpty()).toBe(false);
  });
});
