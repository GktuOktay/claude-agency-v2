// Spec 0002 T-5/T-8: the scene model is built from src/sim/layout.ts, and the layout footprints the
// waypoint edges keep clear of (AC-12) cover every piece of furniture the model actually builds.
import { describe, it, expect } from 'vitest';
import { InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { FLOOR_COUNT, FLOOR_TOP, HALF_WIDTH, floorLayout, type FloorLayout } from '../src/sim/layout';
import { buildTower } from '../src/scene/model';
import { dressingFootprints } from '../src/scene/flexOffice';
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

function layouts(d: TowerData): FloorLayout[] {
  return Array.from({ length: FLOOR_COUNT }, (_, f) =>
    floorLayout(
      f,
      sortUnits(d.units)
        .filter((u) => u.floor === f)
        .map((u) => ({ id: u.id, ceo: u.tier === 'ceo' })),
    ),
  );
}

describe('layout <-> scene model consistency', () => {
  const d = data();
  const model = buildTower(d);
  const lays = layouts(d);

  it('robot work, home and coffee points are the layout seat, home and coffee spots', () => {
    for (const r of model.robots) {
      const desk = lays[r.floor]!.desks.find((x) => x.owner === r.unit.id)!;
      const y = r.floor * 3 + FLOOR_TOP;
      expect([r.workPoint.x, r.workPoint.y, r.workPoint.z]).toEqual([desk.seat.x, y, desk.seat.z]);
      expect([r.homePoint.x, r.homePoint.z]).toEqual([desk.home.x, desk.home.z]);
      expect([r.coffeePoint.x, r.coffeePoint.z]).toEqual([desk.coffee.x, desk.coffee.z]);
    }
    expect(model.layouts.map((l) => l.floor)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(model.layouts).toEqual(lays);
  });

  it('every furniture vertex of every floor lies inside a layout footprint, chair zone or dressing footprint (footprints cover the model)', () => {
    // Dressing footprints (src/scene/flexOffice.ts) are held to the same edge clearance in flex-office.test.ts.
    model.root.updateMatrixWorld(true);
    const v = new Vector3();
    for (const f of model.floors) {
      const lay = lays[f.id]!;
      const rects = [...lay.footprints, ...lay.seatZones, ...dressingFootprints(f.id)];
      const base = f.group.position.y;
      const misses = new Map<string, number>();
      f.group.traverse((o) => {
        if (!(o instanceof Mesh) || o.name === 'floor-slab') return;
        const pos = o.geometry.attributes.position;
        if (!pos) return;
        // Instanced meshes are checked once per instance.
        const mats: Matrix4[] = [];
        if (o instanceof InstancedMesh) {
          for (let j = 0; j < o.count; j++) {
            const im = new Matrix4();
            o.getMatrixAt(j, im);
            mats.push(im.premultiply(o.matrixWorld));
          }
        } else mats.push(o.matrixWorld);
        for (const mw of mats) for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mw);
          const h = v.y - base - FLOOR_TOP;
          if (h <= 0.03 || h > 1.3) continue; // floor surfaces, rugs and floor lights; skyline far below
          if (Math.abs(v.x) > HALF_WIDTH + 0.06 || Math.abs(v.z) > 5.56) continue; // outside the building
          const hit = rects.some((r) => v.x >= r.x0 - 0.02 && v.x <= r.x1 + 0.02 && v.z >= r.z0 - 0.02 && v.z <= r.z1 + 0.02);
          if (!hit) {
            const k = `${o.name || 'merged'} @ ${v.x.toFixed(1)},${v.z.toFixed(1)}`;
            misses.set(k, (misses.get(k) ?? 0) + 1);
          }
        }
      });
      expect([...misses.keys()].slice(0, 12), `floor ${f.id}`).toEqual([]);
    }
  });
});
