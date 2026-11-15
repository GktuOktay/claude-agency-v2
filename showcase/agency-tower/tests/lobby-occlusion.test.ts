// Floor-0 view occlusion (QA r2B risk 2): nothing opaque hangs over the reception in floor view. The oak slat
// ceiling raft covered ~3 % of the frame, roughly the whole reception; it now hides while floor 0 is focused,
// the way upper floors ghost. Pendants (small globes on cords) stay.
import { describe, expect, it } from 'vitest';
import { Box3, Mesh, type Material, type Object3D } from 'three';
import { buildTower, type TowerModel } from '../src/scene/model';
import { DECOR_PREFIX } from '../src/scene/softwareDecor';
import { FLOOR_TOP, PROP_AT } from '../src/sim/layout';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

function tower(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

const shown = (o: Object3D): boolean => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
const opaque = (m: Material | Material[]): boolean => (Array.isArray(m) ? m : [m]).some((x) => !x.transparent || x.opacity > 0.5);

/** Reception top (the stone counter around PROP_AT, floor-local; floor 0 sits at y = 0). */
const RECEPTION = { x0: PROP_AT.x - 1.27, x1: PROP_AT.x + 1.27, z0: PROP_AT.z - 0.34, z1: PROP_AT.z + 0.34 };
const AREA = (RECEPTION.x1 - RECEPTION.x0) * (RECEPTION.z1 - RECEPTION.z0);

/** Shown, opaque floor-0 meshes above head height covering at least a quarter of the reception from above. */
function covers(model: TowerModel): string[] {
  const out: string[] = [];
  const floor0 = model.floors.find((f) => f.id === 0)!;
  floor0.group.updateMatrixWorld(true);
  floor0.group.traverse((o) => {
    if (!(o instanceof Mesh) || !shown(o) || !opaque(o.material)) return;
    const b = new Box3().setFromObject(o);
    if (b.min.y < FLOOR_TOP + 1.9) return;
    const w = Math.max(0, Math.min(b.max.x, RECEPTION.x1) - Math.max(b.min.x, RECEPTION.x0));
    const d = Math.max(0, Math.min(b.max.z, RECEPTION.z1) - Math.max(b.min.z, RECEPTION.z0));
    if (w * d >= AREA / 4) out.push(`${o.name || '(anon)'} ${((100 * w * d) / AREA).toFixed(0)} %`);
  });
  return out;
}

describe('lobby occlusion in floor view (QA r2B)', () => {
  it('floor-0 view: no shown opaque mesh above head height covers the reception; the slat ceiling is hidden', () => {
    const model = tower();
    model.setView({ mode: 'floor', focusFloor: 0 });
    expect(covers(model)).toEqual([]);
    const slat = model.floors[0]!.group.getObjectByName(`${DECOR_PREFIX}slat-ceiling`)!;
    expect(slat).toBeDefined();
    expect(shown(slat)).toBe(false);
  });

  it('overview and another floor view keep the slat ceiling (it is decor, not removed)', () => {
    const model = tower();
    const slat = model.floors[0]!.group.getObjectByName(`${DECOR_PREFIX}slat-ceiling`)!;
    model.setView({ mode: 'overview', focusFloor: 0 });
    expect(shown(slat)).toBe(true);
    let meshes = 0;
    slat.traverse((o) => void (o instanceof Mesh && meshes++));
    expect(meshes).toBeGreaterThan(0);
    expect(meshes).toBeLessThanOrEqual(2); // baked into its own mesh, not 14 parts
    model.setView({ mode: 'floor', focusFloor: 0 });
    model.setView({ mode: 'overview', focusFloor: 0 });
    expect(shown(slat)).toBe(true);
  });
});
