// Procedural furniture kit for the office diorama. Pure geometry + materials; no renderer, no assets.
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatOptions } from './robot';

/** Shadow role, read by `TowerModel.setView`: objects cast + receive, surfaces receive, slabs cast in overview. */
export type ShadowRole = 'object' | 'surface' | 'slab' | 'none';

export const PALETTE = {
  oak: 0xdcb98e,
  oakDark: 0xb98d5e,
  white: 0xf7f5f1,
  offWhite: 0xece8e1,
  charcoal: 0x3a3f47,
  graphite: 0x5a616b,
  fabric: 0xd3cbbf,
  fabricBlue: 0x8fa3b5,
  leaf: 0x6d9a63,
  leafDark: 0x52804f,
  pot: 0xe9e2d6,
  frame: 0xe7eaee,
  glass: 0xcfe4ec,
  floorOak: 0xe6cba5,
  hatch: 0xebe6de,
  books: [0xd98b6a, 0x7fa7c9, 0xe2c26c, 0x9bbf8a, 0xb79ad0, 0xf0ece4],
} as const;

const geoCache = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export interface KitTextures {
  wood: Texture | null;
  hatch: Texture | null;
  blob: Texture | null;
}

export interface KitSinks {
  contents: Material[];
  slab: Material[];
  tinted: Material[];
}

/** Per-floor material/mesh factory. Materials are cached per floor so opacity can change per floor. */
export class Kit {
  private readonly mats = new Map<string, Material>();
  private blobMat: Material | null = null;
  /** Materials that light up at night (emissive intensity lerps day -> night). */
  readonly glows: MeshStandardMaterial[] = [];

  constructor(
    private readonly sinks: KitSinks,
    readonly textures: KitTextures,
  ) {}

  /** Opaque interior material (contents category). */
  m(color: number, opts: MatOptions = {}): Material {
    const key = `c:${color}:${opts.emissive ?? ''}:${opts.emissiveIntensity ?? ''}:${opts.roughness ?? ''}:${opts.metalness ?? ''}`;
    let mat = this.mats.get(key);
    if (!mat) {
      mat = new MeshStandardMaterial({
        color,
        roughness: opts.roughness ?? 0.7,
        metalness: opts.metalness ?? 0,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
      });
      this.sinks.contents.push(mat);
      this.mats.set(key, mat);
    }
    return mat;
  }

  /** Night-light material (contents category): emissive intensity `day` by day, `night` at night. */
  glow(color: number, emissive: number, day: number, night: number): Material {
    const key = `g:${color}:${emissive}:${day}:${night}`;
    let mat = this.mats.get(key);
    if (!mat) {
      const m = new MeshStandardMaterial({ color, emissive, emissiveIntensity: day, roughness: 0.8 });
      m.userData.glow = { day, night };
      this.sinks.contents.push(m);
      this.glows.push(m);
      this.mats.set(key, m);
      mat = m;
    }
    return mat;
  }

  /** Floor surface material (slab category), optionally textured. */
  surface(color: number, map: Texture | null): Material {
    const key = `s:${color}:${map ? map.uuid : ''}`;
    let mat = this.mats.get(key);
    if (!mat) {
      mat = new MeshStandardMaterial({ color: map ? 0xffffff : color, map, roughness: 0.8 });
      this.sinks.slab.push(mat);
      this.mats.set(key, mat);
    }
    return mat;
  }

  /** Translucent material whose opacity is `base` times the floor visibility (tinted category). */
  tint(color: number, base: number): Material {
    const key = `t:${color}:${base}`;
    let mat = this.mats.get(key);
    if (!mat) {
      mat = new MeshStandardMaterial({ color, transparent: true, opacity: base, roughness: 0.1, depthWrite: false });
      mat.userData.baseOpacity = base;
      this.sinks.tinted.push(mat);
      this.mats.set(key, mat);
    }
    return mat;
  }

  place(parent: Group, geo: BufferGeometry, mat: Material, x: number, y: number, z: number, role: ShadowRole = 'object', name = ''): Mesh {
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.name = name;
    mesh.userData.shadow = role;
    parent.add(mesh);
    return mesh;
  }

  /** Rounded box with its base at y. */
  box(parent: Group, w: number, h: number, d: number, r: number, mat: Material, x: number, y: number, z: number, role: ShadowRole = 'object', name = ''): Mesh {
    const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    // Vertex budget: tiny radii render as plain boxes; only large pieces get two rounding segments.
    const seg = Math.max(w, h, d) > 0.6 && rr >= 0.03 ? 2 : 1;
    const geo = rr >= 0.02 ? cached(`rb:${w}:${h}:${d}:${rr}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rr)) : cached(`b:${w}:${h}:${d}`, () => new BoxGeometry(w, h, d));
    return this.place(parent, geo, mat, x, y + h / 2, z, role, name);
  }

  /** Cylinder with its base at y. */
  cyl(parent: Group, rTop: number, rBottom: number, h: number, mat: Material, x: number, y: number, z: number, seg = 20, role: ShadowRole = 'object'): Mesh {
    const geo = cached(`cy:${rTop}:${rBottom}:${h}:${seg}`, () => new CylinderGeometry(rTop, rBottom, h, seg));
    return this.place(parent, geo, mat, x, y + h / 2, z, role);
  }

  ball(parent: Group, r: number, mat: Material, x: number, y: number, z: number, lowPoly = false): Mesh {
    const geo = cached(`sp:${r}:${lowPoly}`, () => (lowPoly ? new IcosahedronGeometry(r, 1) : new SphereGeometry(r, 14, 10)));
    return this.place(parent, geo, mat, x, y, z);
  }

  /** Soft contact shadow (texture only; skipped when no texture is available, e.g. in tests). */
  blob(parent: Group, w: number, d: number, x: number, z: number, y = 0.02): Mesh | null {
    const map = this.textures.blob;
    if (!map) return null;
    if (!this.blobMat) {
      this.blobMat = new MeshBasicMaterial({ color: 0x2a2118, map, transparent: true, opacity: 0.42, depthWrite: false });
      this.blobMat.userData.baseOpacity = 0.42;
      this.sinks.tinted.push(this.blobMat);
    }
    const geo = cached('blob', () => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    const mesh = this.place(parent, geo, this.blobMat, x, y, z, 'none', 'contact-shadow');
    mesh.scale.set(w, 1, d);
    mesh.raycast = () => undefined;
    return mesh;
  }
}

// ---------------------------------------------------------------- furniture

export function desk(k: Kit, wide = false): Group {
  const g = new Group();
  const w = wide ? 2.0 : 1.2;
  const d = wide ? 0.85 : 0.62;
  k.blob(g, w + 0.5, d + 0.5, 0, 0);
  k.box(g, w, 0.045, d, 0.02, k.m(wide ? PALETTE.oakDark : PALETTE.oak, { roughness: 0.6 }), 0, 0.32, 0);
  const leg = k.m(wide ? PALETTE.charcoal : PALETTE.white);
  for (const x of [-(w / 2 - 0.06), w / 2 - 0.06]) k.box(g, 0.05, 0.32, d - 0.08, 0.015, leg, x, 0, 0);
  k.box(g, w - 0.2, 0.16, 0.03, 0.01, leg, 0, 0.15, -(d / 2 - 0.08));
  return g;
}

/** Monitor facing +z; returns the group and the screen-face position for the code texture. */
export function monitor(k: Kit, faceMat: Material, wide = false): Group {
  const g = new Group();
  const w = wide ? 0.62 : 0.46;
  const dark = k.m(PALETTE.charcoal, { roughness: 0.4 });
  k.cyl(g, 0.02, 0.02, 0.08, dark, 0, 0, 0, 10);
  k.box(g, 0.16, 0.012, 0.1, 0.004, dark, 0, 0, 0);
  k.box(g, w, 0.3, 0.03, 0.012, dark, 0, 0.07, 0);
  const face = k.place(g, cached(`pl:${w}`, () => new PlaneGeometry(w - 0.04, 0.26)), faceMat, 0, 0.22, 0.016, 'none', 'screen');
  face.userData.shadow = 'none';
  return g;
}

export function keyboard(k: Kit): Group {
  const g = new Group();
  k.box(g, 0.3, 0.012, 0.1, 0.004, k.m(0xdfe2e6), 0, 0, 0);
  k.box(g, 0.05, 0.01, 0.07, 0.004, k.m(0xdfe2e6), 0.25, 0, 0);
  return g;
}

/** Office chair whose backrest faces +z (the sitter faces -z). */
export function chair(k: Kit, accent: number, big = false): Group {
  const g = new Group();
  const s = big ? 1.25 : 1;
  const dark = k.m(PALETTE.charcoal, { roughness: 0.5 });
  k.blob(g, 0.55 * s, 0.55 * s, 0, 0);
  k.cyl(g, 0.17 * s, 0.17 * s, 0.025, dark, 0, 0, 0, 5);
  k.cyl(g, 0.018, 0.018, 0.14, k.m(PALETTE.graphite, { metalness: 0.4, roughness: 0.4 }), 0, 0.02, 0, 8);
  k.box(g, 0.34 * s, 0.05, 0.32 * s, 0.022, k.m(big ? PALETTE.charcoal : accent, { roughness: 0.8 }), 0, 0.15, 0);
  k.box(g, 0.34 * s, 0.32 * s, 0.05, 0.022, dark, 0, 0.2, 0.16 * s);
  return g;
}

export function plant(k: Kit, size = 1): Group {
  const g = new Group();
  k.blob(g, 0.5 * size, 0.5 * size, 0, 0);
  k.cyl(g, 0.12 * size, 0.09 * size, 0.22 * size, k.m(PALETTE.pot, { roughness: 0.9 }), 0, 0, 0, 16);
  const leaf = k.m(PALETTE.leaf, { roughness: 0.85 });
  const leafDark = k.m(PALETTE.leafDark, { roughness: 0.85 });
  k.ball(g, 0.17 * size, leaf, 0, 0.36 * size, 0, true);
  k.ball(g, 0.13 * size, leafDark, 0.09 * size, 0.5 * size, 0.03 * size, true);
  k.ball(g, 0.12 * size, leaf, -0.08 * size, 0.55 * size, -0.04 * size, true);
  if (size > 1.2) k.ball(g, 0.1 * size, leafDark, 0.02 * size, 0.68 * size, 0.06 * size, true);
  return g;
}

/** Bookshelf against a wall, front facing +z. */
export function bookshelf(k: Kit, w = 1.4, h = 0.95, seed = 0): Group {
  const g = new Group();
  const frame = k.m(PALETTE.white);
  k.blob(g, w + 0.3, 0.6, 0, 0);
  k.box(g, w, 0.04, 0.3, 0.01, frame, 0, 0, 0);
  k.box(g, w, 0.04, 0.3, 0.01, frame, 0, h - 0.04, 0);
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) k.box(g, 0.04, h, 0.3, 0.01, frame, x, 0, 0);
  k.box(g, w, h, 0.02, 0, k.m(PALETTE.offWhite), 0, 0, -0.14);
  const shelves = 3;
  for (let s = 0; s < shelves; s++) {
    const y = 0.04 + (s * (h - 0.08)) / shelves;
    if (s > 0) k.box(g, w - 0.04, 0.025, 0.28, 0, frame, 0, y - 0.0125, 0);
    let x = -w / 2 + 0.08;
    let i = seed + s * 3;
    while (x < w / 2 - 0.2) {
      const bw = 0.05 + ((i * 7) % 4) * 0.015;
      const bh = 0.16 + ((i * 5) % 3) * 0.03;
      const color = PALETTE.books[i % PALETTE.books.length] ?? PALETTE.white;
      const book = k.box(g, bw, bh, 0.2, 0.006, k.m(color, { roughness: 0.8 }), x + bw / 2, y, 0.01);
      if (i % 5 === 4) book.rotation.z = 0.18;
      x += bw + 0.008 + (i % 6 === 5 ? 0.15 : 0);
      i++;
    }
  }
  return g;
}

/** Sofa with its back toward -z (sitters face +z). */
export function sofa(k: Kit, color: number, cushion: number, w = 1.6): Group {
  const g = new Group();
  const fabric = k.m(color, { roughness: 0.95 });
  k.blob(g, w + 0.5, 1.1, 0, 0);
  k.box(g, w, 0.2, 0.72, 0.06, fabric, 0, 0.03, 0);
  k.box(g, w, 0.4, 0.2, 0.07, fabric, 0, 0.03, -0.26);
  for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) k.box(g, 0.18, 0.32, 0.72, 0.07, fabric, x, 0.03, 0);
  const seat = k.m(color, { roughness: 1 });
  const half = (w - 0.36) / 2;
  for (const x of [-half / 2, half / 2]) k.box(g, half - 0.02, 0.09, 0.5, 0.04, seat, x, 0.23, 0.06);
  const pillow = k.m(cushion, { roughness: 1 });
  k.box(g, 0.28, 0.24, 0.08, 0.04, pillow, -w / 2 + 0.38, 0.3, -0.12).rotation.z = 0.12;
  for (let y = 0; y < 3; y++) k.cyl(g, 0.025, 0.02, 0.03, k.m(PALETTE.oakDark), -w / 2 + 0.1 + (y % 2) * (w - 0.2), 0, y < 2 ? 0.28 : -0.28, 8);
  return g;
}

export function coffeeTable(k: Kit, w = 0.9, d = 0.5): Group {
  const g = new Group();
  k.blob(g, w + 0.3, d + 0.3, 0, 0);
  k.box(g, w, 0.045, d, 0.02, k.m(PALETTE.oak, { roughness: 0.6 }), 0, 0.2, 0);
  k.box(g, w - 0.12, 0.2, d - 0.12, 0.02, k.m(PALETTE.white), 0, 0, 0);
  k.cyl(g, 0.035, 0.03, 0.06, k.m(PALETTE.white), w / 4, 0.245, 0, 12);
  k.box(g, 0.22, 0.03, 0.16, 0.01, k.m(PALETTE.books[1] ?? PALETTE.white), -w / 5, 0.245, 0.02);
  return g;
}

export function rug(k: Kit, w: number, d: number, color: number, border: number): Group {
  const g = new Group();
  k.box(g, w, 0.008, d, 0.004, k.m(border, { roughness: 1 }), 0, 0.002, 0, 'surface');
  k.box(g, w - 0.16, 0.008, d - 0.16, 0.004, k.m(color, { roughness: 1 }), 0, 0.004, 0, 'surface');
  return g;
}

/** Framed picture facing +z, bottom edge at y. */
export function wallArt(k: Kit, accent: number, w = 0.6, h = 0.42): Group {
  const g = new Group();
  k.box(g, w, h, 0.03, 0.008, k.m(PALETTE.white), 0, 0, 0, 'none');
  k.box(g, w - 0.08, h - 0.08, 0.01, 0, k.m(0xf3eee6), 0, 0.04, 0.016, 'none');
  k.cyl(g, h * 0.22, h * 0.22, 0.012, k.m(accent), -w * 0.12, 0.17, 0.02, 24, 'none').rotation.x = Math.PI / 2;
  k.box(g, w * 0.3, h * 0.12, 0.012, 0, k.m(PALETTE.charcoal), w * 0.12, h * 0.25, 0.02, 'none');
  k.box(g, w * 0.4, 0.015, 0.012, 0, k.m(PALETTE.oakDark), 0, h * 0.52, 0.02, 'none');
  return g;
}

export function floorLamp(k: Kit): Group {
  const g = new Group();
  k.blob(g, 0.4, 0.4, 0, 0);
  k.cyl(g, 0.1, 0.11, 0.02, k.m(PALETTE.charcoal), 0, 0, 0);
  k.cyl(g, 0.012, 0.012, 0.9, k.m(PALETTE.charcoal), 0, 0.02, 0, 8);
  k.cyl(g, 0.09, 0.14, 0.16, k.glow(0xfff4dc, 0xffd18a, 0.6, 3.0), 0, 0.88, 0);
  return g;
}

export function stool(k: Kit, seatColor: number): Group {
  const g = new Group();
  k.blob(g, 0.35, 0.35, 0, 0);
  k.cyl(g, 0.012, 0.012, 0.28, k.m(PALETTE.charcoal), 0, 0, 0, 8);
  k.cyl(g, 0.1, 0.12, 0.012, k.m(PALETTE.charcoal), 0, 0, 0, 16);
  k.cyl(g, 0.12, 0.12, 0.05, k.m(seatColor, { roughness: 0.8 }), 0, 0.28, 0);
  return g;
}

/** Coffee island facing +z: counter, machine with an accent light, cups. */
export function coffeeIsland(k: Kit, accent: number): Group {
  const g = new Group();
  k.blob(g, 2.6, 0.9, 0, 0);
  k.box(g, 2.2, 0.36, 0.55, 0.03, k.m(PALETTE.white), 0, 0, 0, 'object', 'coffee-counter');
  k.box(g, 2.28, 0.04, 0.6, 0.015, k.m(PALETTE.oak, { roughness: 0.55 }), 0, 0.36, 0);
  const dark = k.m(PALETTE.charcoal, { roughness: 0.35, metalness: 0.2 });
  k.box(g, 0.3, 0.32, 0.26, 0.04, dark, 0.45, 0.4, -0.05, 'object', 'coffee-machine');
  k.box(g, 0.12, 0.03, 0.02, 0.008, k.m(accent, { emissive: accent, emissiveIntensity: 1.2 }), 0.45, 0.64, 0.085, 'none');
  k.box(g, 0.2, 0.01, 0.12, 0, k.m(PALETTE.graphite), 0.45, 0.4, 0.1, 'none');
  for (const [x, c] of [[-0.2, PALETTE.white], [-0.05, accent], [-0.55, PALETTE.white]] as const) {
    k.cyl(g, 0.035, 0.03, 0.07, k.m(c), x, 0.4, 0.12, 12);
  }
  k.box(g, 0.32, 0.2, 0.16, 0.03, k.m(PALETTE.books[0] ?? PALETTE.white), -0.75, 0.4, -0.1);
  return g;
}

export function fridge(k: Kit): Group {
  const g = new Group();
  k.blob(g, 0.8, 0.7, 0, 0);
  k.box(g, 0.55, 1.05, 0.5, 0.05, k.m(0xf1f0ed, { roughness: 0.35 }), 0, 0, 0);
  k.box(g, 0.02, 0.3, 0.03, 0.01, k.m(PALETTE.graphite, { metalness: 0.5 }), 0.2, 0.6, 0.26);
  return g;
}

export function bistroTable(k: Kit): Group {
  const g = new Group();
  k.blob(g, 0.8, 0.8, 0, 0);
  k.cyl(g, 0.15, 0.17, 0.02, k.m(PALETTE.charcoal), 0, 0, 0);
  k.cyl(g, 0.02, 0.02, 0.36, k.m(PALETTE.charcoal), 0, 0.02, 0, 8);
  k.cyl(g, 0.3, 0.3, 0.03, k.m(PALETTE.white, { roughness: 0.4 }), 0, 0.38, 0, 28);
  return g;
}

/** Glass partition from (x0,z0) to (x1,z1): light frame (contents) and a tinted pane. */
export function glassPartition(k: Kit, x0: number, z0: number, x1: number, z1: number, h = 0.95): Group {
  const g = new Group();
  g.name = 'glass-partition';
  const len = Math.hypot(x1 - x0, z1 - z0);
  g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  const frame = k.m(0xffffff, { roughness: 0.35 });
  k.box(g, len, 0.05, 0.07, 0.01, frame, 0, 0, 0, 'none');
  k.box(g, len + 0.06, 0.055, 0.08, 0.012, frame, 0, h - 0.055, 0, 'none');
  const posts = Math.max(1, Math.round(len / 1.0));
  for (let i = 0; i <= posts; i++) k.box(g, 0.06, h, 0.08, 0.012, frame, -len / 2 + (i * len) / posts, 0, 0, 'none');
  k.box(g, len, h - 0.1, 0.012, 0, k.tint(0xbcd9e6, 0.38), 0, 0.05, 0, 'none');
  return g;
}

/** Exterior shell of one floor as one merged mesh: skirting, top rail and window mullions. */
export function shellGeometry(halfW: number, halfD: number, height: number, mullionStep = 1.3): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const t = 0.07;
  const side = (len: number, cx: number, cz: number, alongX: boolean): void => {
    const add = (w: number, h: number, y: number, offset: number): void => {
      const geo = alongX ? new BoxGeometry(w, h, t) : new BoxGeometry(t, h, w);
      geo.translate(alongX ? cx + offset : cx, y + h / 2, alongX ? cz : cz + offset);
      parts.push(geo);
    };
    add(len, 0.14, 0, 0);
    add(len, 0.08, height - 0.08, 0);
    add(len, 0.04, height * 0.42, 0);
    const n = Math.max(1, Math.round(len / mullionStep));
    for (let i = 0; i <= n; i++) add(0.06, height, 0, -len / 2 + (i * len) / n);
  };
  side(halfW * 2, 0, halfD, true);
  side(halfW * 2, 0, -halfD, true);
  side(halfD * 2, halfW, 0, false);
  side(halfD * 2, -halfW, 0, false);
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged ?? new BoxGeometry(0.01, 0.01, 0.01);
}

export function globe(k: Kit, accent: number): Group {
  const g = new Group();
  k.blob(g, 0.7, 0.7, 0, 0);
  k.cyl(g, 0.16, 0.2, 0.04, k.m(PALETTE.oakDark), 0, 0, 0);
  k.cyl(g, 0.02, 0.02, 0.42, k.m(PALETTE.oakDark), 0, 0.04, 0, 8);
  k.ball(g, 0.24, k.m(0x6fa6d6, { roughness: 0.6 }), 0, 0.68, 0);
  k.ball(g, 0.1, k.m(PALETTE.leaf), 0.12, 0.74, 0.14, true).scale.set(1, 0.5, 0.6);
  k.ball(g, 0.08, k.m(PALETTE.leaf), -0.15, 0.62, 0.12, true).scale.set(0.8, 0.6, 0.6);
  const ring = k.place(g, cached('globe-ring', () => new TorusGeometry(0.28, 0.012, 8, 40)), k.m(accent, { metalness: 0.5, roughness: 0.3 }), 0, 0.68, 0);
  ring.rotation.y = Math.PI / 2;
  ring.rotation.x = 0.4;
  return g;
}

/**
 * Merges the static meshes under `floor` into one mesh per (material, shadow role) to keep draw calls low.
 * Named groups stay in place (empty) so the floor keeps its structure; screens (one material each) and
 * single meshes are left alone.
 */
export function mergeStatic(floor: Group): void {
  floor.updateMatrixWorld(true);
  const inv = floor.matrixWorld.clone().invert();
  const buckets = new Map<string, Mesh[]>();
  floor.traverse((o) => {
    // Named meshes (screens, shell, slab, counters) keep their identity; anonymous parts and contact shadows merge.
    if (!(o instanceof Mesh) || (o.name !== '' && o.name !== 'contact-shadow')) return;
    const mat: unknown = o.material;
    if (!(mat instanceof MeshStandardMaterial || mat instanceof MeshBasicMaterial)) return;
    const key = `${mat.uuid}|${String(o.userData.shadow)}|${o.geometry.index ? 'i' : 'n'}|${o.name === 'contact-shadow' ? 'b' : ''}`;
    const list = buckets.get(key) ?? [];
    list.push(o);
    buckets.set(key, list);
  });
  for (const list of buckets.values()) {
    const first = list[0];
    if (!first || list.length < 2) continue;
    const geos: BufferGeometry[] = list.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld.clone().premultiply(inv));
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      return g;
    });
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new Mesh(merged, first.material);
    mesh.name = first.name === 'contact-shadow' ? 'contact-shadow' : 'merged';
    mesh.userData.shadow = first.userData.shadow;
    if (first.name === 'contact-shadow') mesh.raycast = () => undefined;
    for (const m of list) m.removeFromParent();
    floor.add(mesh);
  }
}
