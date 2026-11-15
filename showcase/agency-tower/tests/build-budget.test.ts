// Build-cost guard (perf, page load): the procedural tower stays within a vertex budget.
// (File name kept from a profiling run; candidate for rename to build-budget.test.ts.)
// KARARLAR Rev 40: the 700 000 budget is counted EXPANDED (every InstancedMesh instance is drawn by the GPU),
// over the full app scene (tower + staff + props + room life + city), visible meshes only.
import { it, expect } from 'vitest';
import { InstancedMesh, Mesh, type Object3D } from 'three';
import { buildTower } from '../src/scene/model';
import { createStaff } from '../src/scene/staff';
import { createRoomLife } from '../src/scene/roomLife';
import { createProps, propRobotsOf } from '../src/scene/props';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

const data = () => {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
};

/** Drawn: the mesh, every ancestor and every material are visible. */
const drawn = (m: Mesh): boolean => {
  for (let p: Object3D | null = m; p; p = p.parent) if (!p.visible) return false;
  return (Array.isArray(m.material) ? m.material : [m.material]).some((x) => x.visible);
};

it('the whole tower stays under 700k vertices', () => {
  let verts = 0;
  buildTower(data()).root.traverse((o) => {
    if (o instanceof Mesh) verts += o.geometry.attributes.position?.count ?? 0;
  });
  console.info(`[budget] vertices=${verts}`);
  expect(verts).toBeLessThan(700_000);
});

it('the full app scene stays under 700k EXPANDED vertices (instances counted, visible meshes only; Rev 40)', () => {
  // Built the way sceneApp.ts builds it: tower (with city, campus, grounds, facade), props, room life, staff.
  const model = buildTower(data());
  createProps({ robots: propRobotsOf(model), model });
  model.root.add(createRoomLife({ seed: 1 }).group);
  model.root.add(createStaff({ layouts: model.layouts, seed: 1, reducedMotion: false }).group);
  let expanded = 0;
  let once = 0;
  const byPart = new Map<string, number>();
  model.root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const n = o.geometry.attributes.position?.count ?? 0;
    once += n;
    if (!drawn(o)) return;
    const e = n * (o instanceof InstancedMesh ? o.count : 1);
    expanded += e;
    let top: Object3D = o;
    while (top.parent && top.parent !== model.root) top = top.parent;
    const part = top.name.replace(/^floor-\d+$/, 'floors') || '?';
    byPart.set(part, (byPart.get(part) ?? 0) + e);
  });
  const parts = [...byPart].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ');
  console.info(`[budget] full scene vertices(expanded)=${expanded} vertices(once)=${once}; ${parts}`);
  expect(once).toBeLessThan(700_000);
  expect(expanded).toBeLessThan(700_000);
});
