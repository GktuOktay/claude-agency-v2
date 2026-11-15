// Static bake keeps finish classes (QA r2B, Rev 37): bakeStatic merges per shadow role and finish class, so the
// lobby's brass and brushed metal stay metallic and its marble stays polished; plain finishes keep one material.
import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { Kit } from '../src/scene/furniture';
import { DECOR_PREFIX, buildSoftwareDecor } from '../src/scene/softwareDecor';

const kit = (): Kit => new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });

function staticMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && o.name.startsWith(`${DECOR_PREFIX}static-`)) out.push(o);
  });
  return out;
}

describe('bakeStatic finish classes (QA r2B metal sheen)', () => {
  it('the lobby decor bakes a metal mesh (metalness >= 0.5) and a stone mesh (roughness <= 0.3, not metallic)', () => {
    const ms = staticMeshes(buildSoftwareDecor(kit(), 0, 0x88aacc));
    const metal = ms.filter((m) => m.name.endsWith('-metal'));
    const stone = ms.filter((m) => m.name.endsWith('-stone'));
    expect(metal.length).toBeGreaterThan(0);
    expect(stone.length).toBeGreaterThan(0);
    for (const m of metal) expect((m.material as MeshStandardMaterial).metalness).toBeGreaterThanOrEqual(0.5);
    for (const m of stone) {
      const mat = m.material as MeshStandardMaterial;
      expect(mat.roughness).toBeLessThanOrEqual(0.3);
      expect(mat.metalness).toBeLessThan(0.3);
    }
  });

  it('every baked mesh is vertex-coloured, and at most three finish meshes exist per shadow role', () => {
    for (const floor of [0, 1, 4]) {
      const ms = staticMeshes(buildSoftwareDecor(kit(), floor, 0x88aacc));
      expect(ms.length).toBeGreaterThan(0);
      for (const m of ms) expect((m.material as MeshStandardMaterial).vertexColors).toBe(true);
      const roles = new Map<string, number>();
      for (const m of ms) {
        const role = m.name.slice(`${DECOR_PREFIX}static-`.length).replace(/-(metal|stone)$/, '');
        roles.set(role, (roles.get(role) ?? 0) + 1);
      }
      for (const [role, n] of roles) expect(n, `floor ${floor} ${role}`).toBeLessThanOrEqual(3 * 2); // indexed / non-indexed
    }
  });
});
