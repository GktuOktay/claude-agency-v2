// Build-cost guard (perf, page load): the procedural tower stays within a vertex budget.
// (File name kept from a profiling run; candidate for rename to build-budget.test.ts.)
import { it, expect } from 'vitest';
import { Mesh } from 'three';
import { buildTower } from '../src/scene/model';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

it('the whole tower stays under 700k vertices', () => {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  let verts = 0;
  buildTower(r.data).root.traverse((o) => {
    if (o instanceof Mesh) verts += o.geometry.attributes.position?.count ?? 0;
  });
  console.info(`[budget] vertices=${verts}`);
  expect(verts).toBeLessThan(700_000);
});
