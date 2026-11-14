// QA round 2B reproduction: Rev 37 asks for luxury, realistic finishes (brushed metal, brass, marble).
// bakeStatic (src/scene/flexOffice.ts) folds every opaque, non-glow, unnamed decor mesh into one
// vertex-coloured material (Kit.vertexColored: roughness 0.75, metalness 0), so the authored metalness and
// roughness are dropped. Brass is also authored with metalness 0 (k.m(PALETTE.brass)).
import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { Kit, PALETTE } from '../src/scene/furniture';
import { buildSoftwareDecor } from '../src/scene/softwareDecor';

const kit = (): Kit => new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });

function mats(floor: number): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  buildSoftwareDecor(kit(), floor, 0x88aacc).traverse((o) => {
    if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) out.push(o.material);
  });
  return out;
}

describe('QA r2B: metal, brass and marble keep their sheen after the static bake', () => {
  it('the lobby decor (stone reception, brass trim, brass pendant caps) keeps a metallic material', () => {
    expect(mats(0).some((m) => m.metalness >= 0.5)).toBe(true);
  });
  it('a brass material is metallic', () => {
    const brass = kit().m(PALETTE.brass) as MeshStandardMaterial;
    expect(brass.metalness).toBeGreaterThanOrEqual(0.5);
  });
});
