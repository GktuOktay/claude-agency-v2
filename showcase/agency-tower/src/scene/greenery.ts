// Procedural greenery for the floor dressing (KARARLAR Revizyon 31): every leaf clump of a floor is one
// instance of a single low-poly InstancedMesh (per-instance colour), so plants cost one draw call per floor.
// Pots, planters and frames are ordinary Kit meshes that mergeStatic folds into the floor's merged meshes.
import { Color, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, type Kit } from './furniture';

/** Leaf and flower tones (instance colours; the shared material is white). */
export const GREENS = {
  leaf: PALETTE.leaf,
  dark: PALETTE.leafDark,
  fresh: 0x8db46a,
  moss: 0x5f8a4a,
  deep: 0x3f6b3f,
  sage: 0xa3b98c,
  lime: 0xb4c96b,
  blossom: 0xf2b6c3,
  sun: 0xf3d36b,
} as const;

let clumpGeo: BufferGeometry | null = null;
/** Unit leaf clump: an indexed, smooth-shaded icosahedron (12 vertices, a soft lumpy ball). */
function clumpGeometry(): BufferGeometry {
  if (!clumpGeo) {
    const ico = new IcosahedronGeometry(1, 0);
    ico.deleteAttribute('normal');
    ico.deleteAttribute('uv');
    clumpGeo = mergeVertices(ico);
    clumpGeo.computeVertexNormals();
    ico.dispose();
  }
  return clumpGeo;
}

interface Clump {
  readonly m: Matrix4;
  readonly color: number;
}

/** Collects leaf clumps in the dressing's local frame (floor-local x/z, y above the floor surface). */
export class Foliage {
  private readonly clumps: Clump[] = [];
  private readonly q = new Quaternion();
  private readonly e = new Euler();

  get count(): number {
    return this.clumps.length;
  }

  /** A clump of radius `r` at (x, y, z), squashed by (sx, sy, sz), turned by `yaw` and tilted by `tilt` about x. */
  clump(x: number, y: number, z: number, r: number, color: number, sx = 1, sy = 1, sz = 1, yaw = 0, tilt = 0): void {
    this.e.set(tilt, yaw, 0, 'YXZ'); // tilt first, then turn: a leaning blade leans toward `yaw`
    this.q.setFromEuler(this.e);
    const m = new Matrix4().compose(new Vector3(x, y, z), this.q, new Vector3(r * sx, r * sy, r * sz));
    this.clumps.push({ m, color });
  }

  /** One InstancedMesh for every clump collected so far (null when empty). */
  build(k: Kit, name: string): InstancedMesh | null {
    if (!this.clumps.length) return null;
    const mesh = new InstancedMesh(clumpGeometry(), k.m(0xffffff, { roughness: 0.86 }), this.clumps.length);
    mesh.name = name;
    mesh.userData.shadow = 'object';
    const c = new Color();
    this.clumps.forEach((cl, i) => {
      mesh.setMatrixAt(i, cl.m);
      mesh.setColorAt(i, c.setHex(cl.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

/** Deterministic jitter in [-1, 1) from an integer seed (no Math.random: the scene is reproducible). */
export function jitter(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Leaf-clump adder offset to an item's centre. */
export type Leaf = (x: number, y: number, z: number, r: number, color: number, sx?: number, sy?: number, sz?: number, yaw?: number, tilt?: number) => void;

export function leafAt(f: Foliage, ox: number, oz: number): Leaf {
  return (x, y, z, r, color, sx, sy, sz, yaw, tilt) => f.clump(ox + x, y, oz + z, r, color, sx, sy, sz, yaw, tilt);
}

export type TallKind = 'fig' | 'snake' | 'bird';
/** Footprint half size of a tall plant of size `s`. */
export const tallHalf = (s: number): number => 0.3 * s;

/** Tall floor plant (about 1.1 u at s = 1) in a pot: fiddle-leaf fig, snake plant or bird of paradise. */
export function tallPlant(k: Kit, g: Group, leaf: Leaf, kind: TallKind, s = 1, seed = 0): void {
  const potColor = kind === 'snake' ? PALETTE.charcoal : kind === 'bird' ? PALETTE.white : PALETTE.pot;
  k.cyl(g, 0.17 * s, 0.13 * s, 0.34 * s, k.m(potColor, { roughness: 0.9 }), 0, 0, 0, 8);
  if (kind === 'fig') {
    k.cyl(g, 0.018 * s, 0.022 * s, 0.6 * s, k.m(PALETTE.oakDark), 0, 0.34 * s, 0, 5);
    const tiers = [
      [0.62, 0.2],
      [0.78, 0.19],
      [0.94, 0.17],
      [1.06, 0.13],
    ] as const;
    tiers.forEach(([y, r], i) => {
      const a = i * 2.1 + seed;
      leaf(Math.cos(a) * 0.06 * s, y * s, Math.sin(a) * 0.06 * s, r * s, i % 2 ? GREENS.deep : GREENS.dark, 1, 0.75, 1, a);
    });
    leaf(0.1 * s, 0.7 * s, -0.08 * s, 0.11 * s, GREENS.leaf, 1, 0.7, 1);
  } else if (kind === 'snake') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      const h = (0.34 + (i % 3) * 0.08) * s;
      leaf(Math.cos(a) * 0.07 * s, 0.34 * s + h, Math.sin(a) * 0.07 * s, 1, i % 2 ? GREENS.dark : GREENS.lime, 0.05 * s, h, 0.025 * s, a, (i % 2 ? 0.12 : -0.1));
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      const tilt = 0.35 + (i % 2) * 0.15;
      leaf(Math.cos(a) * 0.12 * s, (0.72 + (i % 3) * 0.08) * s, Math.sin(a) * 0.12 * s, 1, i % 2 ? GREENS.leaf : GREENS.fresh, 0.09 * s, 0.32 * s, 0.03 * s, -a + Math.PI / 2, tilt);
    }
  }
}

/** Ceiling-hung plant: cord from `top`, bowl at `bottom`, trailing vines below it. */
export function hangingPlant(k: Kit, g: Group, leaf: Leaf, bottom: number, top: number, seed = 0): void {
  k.cyl(g, 0.005, 0.005, top - bottom - 0.12, k.m(PALETTE.oakDark), 0, bottom + 0.12, 0, 4);
  k.cyl(g, 0.11, 0.07, 0.12, k.m(PALETTE.white, { roughness: 0.9 }), 0, bottom, 0, 8);
  leaf(0, bottom + 0.15, 0, 0.13, GREENS.leaf, 1.1, 0.6, 1.1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + seed;
    const len = 0.16 + (i % 2) * 0.08;
    leaf(Math.cos(a) * 0.1, bottom + 0.02 - len * 0.6, Math.sin(a) * 0.1, 1, i % 2 ? GREENS.fresh : GREENS.dark, 0.035, len, 0.035, a);
  }
}

/** Living moss wall panel of width `w` and height `h` against a wall; the face looks toward +z. */
export function mossWall(k: Kit, g: Group, leaf: Leaf, w: number, h: number, bottom = 0.12): void {
  const frame = k.m(PALETTE.oak, { roughness: 0.6 });
  k.box(g, w, h, 0.05, 0, k.m(PALETTE.leafDark, { roughness: 0.85 }), 0, bottom, 0, 'object');
  k.box(g, w + 0.06, 0.04, 0.08, 0, frame, 0, bottom - 0.04, 0.01);
  k.box(g, w + 0.06, 0.04, 0.08, 0, frame, 0, bottom + h, 0.01);
  for (const x of [-w / 2 - 0.015, w / 2 + 0.015]) k.box(g, 0.03, h, 0.08, 0, frame, x, bottom, 0.01);
  const cols = Math.max(3, Math.round(w / 0.36));
  const tones = [GREENS.moss, GREENS.deep, GREENS.fresh, GREENS.sage, GREENS.leaf];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) {
      const i = c * 2 + r;
      const x = -w / 2 + ((c + 0.5) * w) / cols + jitter(i) * 0.05;
      const y = bottom + h * (0.3 + r * 0.42) + jitter(i + 50) * 0.05;
      leaf(x, y, 0.045, 0.14 + jitter(i + 90) * 0.02, tones[i % tones.length] ?? GREENS.moss, 1, 0.9, 0.35, 0, 0);
    }
  }
}

/** Long low planter box (`w` along x, `d` along z) with shrubs and grass tufts: a room divider. */
export function planterBox(k: Kit, g: Group, leaf: Leaf, w: number, d: number, h = 0.3, flowers = false): void {
  k.box(g, w, h, d, 0, k.m(PALETTE.white), 0, 0, 0);
  k.box(g, w + 0.04, 0.03, d + 0.04, 0, k.m(PALETTE.oak, { roughness: 0.6 }), 0, h, 0);
  const n = Math.max(2, Math.round(w / 0.4));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    leaf(x, h + 0.1, jitter(i + 7) * d * 0.12, Math.min(0.17, d * 0.55), i % 3 === 0 ? GREENS.dark : GREENS.leaf, 0.85, 0.8, 0.85, i);
    if (i % 2 === 1) leaf(x + 0.05, h + 0.28, 0, 1, GREENS.lime, 0.03, 0.2, 0.03, i, 0.2);
    if (flowers && i % 2 === 0) leaf(x + 0.08, h + 0.22, d * 0.15, 0.06, i % 4 === 0 ? GREENS.blossom : GREENS.sun);
  }
}

/** Small potted plant (desk or shelf), base at y. */
export function smallPlant(k: Kit, g: Group, leaf: Leaf, x: number, y: number, z: number): void {
  k.cyl(g, 0.05, 0.04, 0.08, k.m(PALETTE.pot, { roughness: 0.9 }), x, y, z, 8);
  leaf(x, y + 0.14, z, 0.08, GREENS.fresh, 1, 0.9, 1);
}
