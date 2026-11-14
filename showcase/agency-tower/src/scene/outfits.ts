// Character wardrobe (KARARLAR Revizyon 31): unit id -> work domain look, tier -> clothing, and the
// part sculptor that bakes every part of one pivot into one vertex-coloured mesh per material slot.
// Procedural geometry only; no images or model files.
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tier } from '../data/types';

// ------------------------------------------------------------------ domains

export const DOMAINS = [
  'executive',
  'coordination',
  'design',
  'analytic',
  'security',
  'testing',
  'audit',
  'operations',
  'marketing',
  'docs',
  'discovery',
  'architecture',
  'analysis',
  'delivery',
  'capacity',
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Unit id -> work domain. Covers every unit of roster.generated.json plus the CEO and the chief of staff. */
export const UNIT_DOMAINS: Readonly<Record<string, Domain>> = {
  ceo: 'executive',
  'chief-of-staff': 'coordination',
  'react-engineer': 'design',
  'dotnet-engineer': 'analytic',
  'polyglot-engineer': 'analytic',
  appsec: 'security',
  'qa-engineer': 'testing',
  'internal-auditor': 'audit',
  'quality-office': 'audit',
  'devops-sre': 'operations',
  marketing: 'marketing',
  'tech-comms': 'docs',
  'product-manager': 'discovery',
  scout: 'discovery',
  'software-architect': 'architecture',
  'architecture-board': 'architecture',
  'business-analyst': 'analysis',
  'spec-critic': 'analysis',
  'delivery-manager': 'delivery',
  'talent-capacity': 'capacity',
};

export function domainOf(id: string): Domain | null {
  return Object.prototype.hasOwnProperty.call(UNIT_DOMAINS, id) ? (UNIT_DOMAINS[id] ?? null) : null;
}

/** Named accessory parts per domain (what a viewer can point at). */
export const DOMAIN_ACCESSORIES: Readonly<Record<Domain, readonly string[]>> = {
  executive: ['crown', 'pocket-square'],
  coordination: ['headset'],
  design: ['beret', 'palette-badge', 'stylus'],
  analytic: ['glasses', 'scan-lines', 'terminal-badge'],
  security: ['shield-emblem'],
  testing: ['magnifier'],
  audit: ['clipboard'],
  operations: ['hard-hat'],
  marketing: ['megaphone-pin'],
  docs: ['book'],
  discovery: ['binoculars'],
  architecture: ['blueprint-roll'],
  analysis: ['document', 'pen'],
  delivery: ['kanban-board'],
  capacity: ['chart'],
};

// ------------------------------------------------------------------ outfits

export type OutfitKind = 'suit' | 'blazer' | 'vest' | 'hoodie';

export interface Outfit {
  kind: OutfitKind;
  tie: boolean;
  shoulderStripe: boolean;
  /** Main garment in the floor accent colour (specialists). */
  accentColoured: boolean;
  /** Shape features the outfit adds (tier is never shown by colour alone). */
  features: readonly string[];
}

export function outfitFor(tier: Tier): Outfit {
  switch (tier) {
    case 'ceo':
      return { kind: 'suit', tie: true, shoulderStripe: false, accentColoured: false, features: ['suit', 'tie', 'lapels', 'hair'] };
    case 'management':
      return { kind: 'blazer', tie: true, shoulderStripe: false, accentColoured: false, features: ['blazer', 'tie', 'lapels'] };
    case 'lead':
      return { kind: 'vest', tie: false, shoulderStripe: true, accentColoured: false, features: ['vest', 'buttons', 'shoulder-stripe'] };
    case 'specialist':
      return { kind: 'hoodie', tie: false, shoulderStripe: false, accentColoured: true, features: ['hoodie', 'hood', 'pocket'] };
  }
}

// ------------------------------------------------------------------ sculptor

/** Material slots of a baked pivot: `base` is vertex-coloured, `glow` and `eye` are emissive. */
export type Slot = 'base' | 'glow' | 'eye';
export type Vec3 = readonly [number, number, number];

const tmpColor = new Color();

/** Low-poly shared primitives (cloned per use; never mutated). */
export const SHAPES = {
  box: new BoxGeometry(1, 1, 1),
  sphere: new SphereGeometry(1, 10, 7),
  sphereLo: new SphereGeometry(1, 6, 4),
  hemi: new SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new CylinderGeometry(1, 1, 1, 10),
  cylLo: new CylinderGeometry(1, 1, 1, 6),
  prism: new CylinderGeometry(1, 0.0001, 1, 3), // downward triangle (shirt V)
  cone: new ConeGeometry(1, 1, 8),
  ring: new TorusGeometry(1, 0.2, 5, 14),
  arc: new TorusGeometry(1, 0.08, 4, 12, Math.PI),
} satisfies Record<string, BufferGeometry>;

/**
 * Collects parts per pivot and material slot, then bakes each bucket into one merged mesh
 * (BufferGeometryUtils.mergeGeometries): many parts, few draw calls.
 */
export class Sculptor {
  private readonly buckets = new Map<string, BufferGeometry[]>();
  private parts = 0;

  /** Adds a primitive at `pos` with Euler `rot` and per-axis `scale` (the primitive is unit-sized). */
  add(pivot: string, slot: Slot, shape: BufferGeometry, color: number, pos: Vec3, scale: Vec3, rot: Vec3 = [0, 0, 0]): void {
    const g = shape.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    const m = new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale));
    g.applyMatrix4(m);
    const n = g.attributes.position?.count ?? 0;
    if (!g.index) {
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new BufferAttribute(idx, 1));
    }
    if (slot === 'base') {
      tmpColor.setHex(color); // sRGB hex -> linear working space, as Material.color does
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
      g.setAttribute('color', new BufferAttribute(c, 3));
    }
    const key = `${pivot}|${slot}`;
    const list = this.buckets.get(key) ?? [];
    list.push(g);
    this.buckets.set(key, list);
    this.parts++;
  }

  get partCount(): number {
    return this.parts;
  }

  /** One mesh per non-empty slot of `pivot`. */
  bake(pivot: string, material: (slot: Slot) => Material, name = ''): Mesh[] {
    const out: Mesh[] = [];
    for (const slot of ['base', 'glow', 'eye'] as const) {
      const list = this.buckets.get(`${pivot}|${slot}`);
      if (!list || list.length === 0) continue;
      const merged = mergeGeometries(list);
      for (const g of list) g.dispose();
      if (!merged) throw new Error(`cannot merge ${pivot}/${slot}`);
      const mesh = new Mesh(merged, material(slot));
      mesh.name = slot === 'base' ? name : '';
      out.push(mesh);
    }
    this.buckets.delete(`${pivot}|base`);
    this.buckets.delete(`${pivot}|glow`);
    this.buckets.delete(`${pivot}|eye`);
    return out;
  }
}

// ------------------------------------------------------------------ accessories

/** Attachment points of a character rig, in its local (pre-scale) units. */
export interface Anchors {
  /** Pivot keys. */
  head: string;
  body: string;
  handL: string;
  /** Head top (y in the head pivot) and face front (z). */
  headTop: number;
  faceZ: number;
  eyeY: number;
  /** Right chest badge spot in the body pivot (front surface). */
  chest: Vec3;
  /** Held-item spot in the left arm pivot (just below the hand). */
  hand: Vec3;
}

export interface AccessoryResult {
  /** True if a hat covers the antenna. */
  hidesAntenna: boolean;
}

const BOX = SHAPES.box;

/** Adds the domain accessories of `domain` to the sculptor. */
export function addAccessories(s: Sculptor, domain: Domain, a: Anchors, accent: number): AccessoryResult {
  const [cx, cy, cz] = a.chest;
  const [hx, hy, hz] = a.hand;
  const H = a.head;
  const B = a.body;
  const L = a.handL;
  switch (domain) {
    case 'executive':
      s.add(B, 'base', BOX, 0xe0b43c, [-cx, cy + 0.005, cz], [0.03, 0.014, 0.01]); // gold pocket square
      return { hidesAntenna: true };
    case 'coordination': {
      s.add(H, 'base', SHAPES.arc, 0x2a2e36, [0, 0.105, 0], [0.142, 0.115, 0.14]); // headband over the head
      s.add(H, 'base', SHAPES.cylLo, 0x2a2e36, [0.115, 0.06, 0.08], [0.007, 0.1, 0.007], [Math.PI / 2.4, 0, 0]); // mic boom
      s.add(H, 'glow', SHAPES.sphereLo, accent, [0.1, 0.045, a.faceZ + 0.01], [0.012, 0.012, 0.012]); // mic tip
      return { hidesAntenna: false };
    }
    case 'design':
      s.add(H, 'base', SHAPES.sphere, 0xb0413e, [-0.02, a.headTop + 0.005, 0], [0.13, 0.04, 0.125], [0, 0, 0.18]); // beret
      s.add(H, 'base', SHAPES.sphereLo, 0xb0413e, [-0.01, a.headTop + 0.045, 0], [0.012, 0.012, 0.012]); // beret stem
      s.add(B, 'base', SHAPES.cyl, 0xf3e3c3, [cx, cy, cz], [0.034, 0.01, 0.034], [Math.PI / 2, 0, 0]); // palette badge
      for (const [dx, dy, c] of [[-0.013, 0.01, 0xe0463c], [0.013, 0.01, 0xf2c230], [0, -0.013, 0x3d7be0]] as const)
        s.add(B, 'base', SHAPES.sphereLo, c, [cx + dx, cy + dy, cz + 0.007], [0.008, 0.008, 0.005]);
      s.add(L, 'base', SHAPES.cylLo, 0x30343c, [hx, hy, hz], [0.006, 0.12, 0.006], [0.5, 0, 0]); // stylus
      s.add(L, 'glow', SHAPES.sphereLo, accent, [hx, hy - 0.052, hz + 0.028], [0.008, 0.008, 0.008]); // stylus tip
      return { hidesAntenna: false };
    case 'analytic':
      for (const x of [-0.048, 0.048]) s.add(H, 'base', SHAPES.ring, 0xe6e9ee, [x, a.eyeY, a.faceZ + 0.012], [0.036, 0.036, 0.036]); // glasses
      s.add(H, 'base', BOX, 0xe6e9ee, [0, a.eyeY + 0.008, a.faceZ + 0.012], [0.03, 0.007, 0.006]); // bridge
      for (const dy of [-0.03, 0.028]) s.add(H, 'glow', BOX, accent, [0, a.eyeY + dy, a.faceZ + 0.006], [0.17, 0.005, 0.004]); // data-visor scan lines
      s.add(B, 'base', BOX, 0x1b1f27, [cx, cy, cz + 0.002], [0.064, 0.046, 0.01]); // terminal badge
      s.add(B, 'glow', BOX, accent, [cx - 0.012, cy + 0.006, cz + 0.008], [0.022, 0.005, 0.004]); // prompt line
      s.add(B, 'glow', BOX, accent, [cx + 0.008, cy - 0.008, cz + 0.008], [0.006, 0.01, 0.004]); // caret
      return { hidesAntenna: false };
    case 'security':
      s.add(B, 'base', BOX, 0x3d6fb6, [cx, cy + 0.01, cz], [0.054, 0.032, 0.012]); // shield top
      s.add(B, 'base', SHAPES.cone, 0x3d6fb6, [cx, cy - 0.019, cz], [0.038, 0.03, 0.009], [Math.PI, Math.PI / 8, 0]); // shield point
      s.add(B, 'base', BOX, 0xffffff, [cx, cy + 0.002, cz + 0.007], [0.008, 0.04, 0.003]);
      s.add(B, 'base', BOX, 0xffffff, [cx, cy + 0.01, cz + 0.007], [0.034, 0.008, 0.003]);
      return { hidesAntenna: false };
    case 'testing':
      s.add(L, 'base', SHAPES.ring, 0x30343c, [hx, hy - 0.035, hz + 0.01], [0.032, 0.032, 0.032]); // magnifier rim
      s.add(L, 'base', SHAPES.cyl, 0xbfe6ff, [hx, hy - 0.035, hz + 0.01], [0.029, 0.004, 0.029], [Math.PI / 2, 0, 0]); // lens
      s.add(L, 'base', SHAPES.cylLo, 0x8a5a33, [hx, hy + 0.012, hz + 0.01], [0.008, 0.035, 0.008]); // handle
      return { hidesAntenna: false };
    case 'audit':
      s.add(L, 'base', BOX, 0xa0764a, [hx, hy - 0.03, hz], [0.09, 0.12, 0.008]); // clipboard
      s.add(L, 'base', BOX, 0xffffff, [hx, hy - 0.036, hz + 0.005], [0.074, 0.095, 0.003]); // paper
      s.add(L, 'base', BOX, 0xc3c9d2, [hx, hy + 0.028, hz + 0.006], [0.032, 0.012, 0.008]); // clip
      for (const dy of [-0.01, -0.03, -0.05]) s.add(L, 'base', BOX, 0x7b8494, [hx, hy + dy, hz + 0.007], [0.05, 0.004, 0.002]);
      return { hidesAntenna: false };
    case 'operations':
      s.add(H, 'base', SHAPES.hemi, 0xf2c230, [0, a.headTop - 0.035, 0], [0.152, 0.12, 0.14]); // hard hat dome
      s.add(H, 'base', SHAPES.cyl, 0xf2c230, [0, a.headTop - 0.032, 0.01], [0.17, 0.012, 0.16]); // brim
      return { hidesAntenna: true };
    case 'marketing':
      s.add(B, 'base', SHAPES.cone, 0xf07a2a, [cx, cy, cz + 0.006], [0.022, 0.045, 0.022], [0, 0, Math.PI / 2]); // megaphone pin
      s.add(B, 'base', SHAPES.cylLo, 0xffffff, [cx + 0.026, cy, cz + 0.006], [0.008, 0.012, 0.008], [0, 0, Math.PI / 2]);
      return { hidesAntenna: false };
    case 'docs':
      s.add(L, 'base', BOX, 0x3c5aa8, [hx, hy - 0.03, hz], [0.085, 0.11, 0.028]); // book cover
      s.add(L, 'base', BOX, 0xf4ecd8, [hx + 0.004, hy - 0.03, hz], [0.08, 0.1, 0.022]); // pages
      return { hidesAntenna: false };
    case 'discovery':
      for (const x of [-0.022, 0.022]) s.add(B, 'base', SHAPES.cyl, 0x2a2d33, [x, 0.235, 0.118], [0.019, 0.055, 0.019], [Math.PI / 2, 0, 0]); // binoculars
      s.add(B, 'base', BOX, 0x2a2d33, [0, 0.235, 0.118], [0.03, 0.014, 0.02]);
      for (const x of [-0.022, 0.022]) s.add(B, 'eye', SHAPES.cylLo, 0, [x, 0.235, 0.147], [0.013, 0.004, 0.013], [Math.PI / 2, 0, 0]); // lenses
      return { hidesAntenna: false };
    case 'architecture':
      s.add(L, 'base', SHAPES.cyl, 0x7fb3e6, [hx, hy - 0.01, hz + 0.01], [0.022, 0.16, 0.022], [Math.PI / 2.2, 0, 0]); // blueprint roll
      s.add(L, 'base', SHAPES.ring, 0xffffff, [hx, hy - 0.01, hz + 0.01], [0.023, 0.023, 0.023]); // band
      return { hidesAntenna: false };
    case 'analysis':
      s.add(L, 'base', BOX, 0xffffff, [hx, hy - 0.03, hz], [0.072, 0.096, 0.004]); // document
      for (const dy of [-0.008, -0.026, -0.044]) s.add(L, 'base', BOX, 0x7b8494, [hx, hy + dy, hz + 0.003], [0.05, 0.004, 0.002]);
      s.add(B, 'base', SHAPES.cylLo, 0x2f5fc0, [cx + 0.012, cy + 0.01, cz + 0.004], [0.006, 0.06, 0.006]); // pen in the chest pocket
      s.add(B, 'base', SHAPES.sphereLo, 0xc3c9d2, [cx + 0.012, cy + 0.04, cz + 0.004], [0.007, 0.007, 0.007]);
      return { hidesAntenna: false };
    case 'delivery':
      s.add(L, 'base', BOX, 0xffffff, [hx, hy - 0.025, hz], [0.11, 0.08, 0.008]); // kanban board
      for (const [dx, c] of [[-0.035, 0xf2c230], [0, 0x3d7be0], [0.035, 0x3fae6a]] as const) {
        s.add(L, 'base', BOX, c, [hx + dx, hy - 0.012, hz + 0.006], [0.024, 0.018, 0.003]);
        s.add(L, 'base', BOX, c, [hx + dx, hy - 0.04, hz + 0.006], [0.024, 0.018, 0.003]);
      }
      return { hidesAntenna: false };
    case 'capacity':
      s.add(L, 'base', BOX, 0x1b1f27, [hx, hy - 0.025, hz], [0.1, 0.075, 0.008]); // chart tablet
      for (const [dx, h] of [[-0.03, 0.02], [0, 0.035], [0.03, 0.05]] as const)
        s.add(L, 'glow', BOX, accent, [hx + dx, hy - 0.055 + h / 2, hz + 0.006], [0.016, h, 0.004]); // bars
      return { hidesAntenna: false };
  }
}
