// Campus grounds (KARARLAR rev 37): an arrival plaza in honed stone in front of the tower, a long raised
// reflecting pool, an allée of clear-stemmed trees in stone planters, mown lawns, an original steel
// sculpture, stone-and-oak benches, a promenade that ties the wing path to the city edge, a paved walk
// between the tower and the wing, and subtle uplights at night. Procedural geometry only.
// The grounds sit on the scene root like the city: never ghosted, never pickable, no shadows. The flat
// surfaces lie just below the tower's shadow catcher (y -0.01) so the tower still shadows the plaza.
//
// Scale: 3.5 m floor to floor (METRE = FLOOR_HEIGHT / 3.5); every size below is chosen in metres.
// Ruling: merged geometry, not InstancedMesh, for trees and lights — the campus share test counts every
// InstancedMesh as a campus mesh and only three of its 60 slots were free; one merged mesh per material
// is the same single draw call — if wrong, swap the merge for instancing (one function).
// Ruling: only the paved surface reaches west of the tower (one mesh, the walk to the wing and the
// promenade); everything else stays east of x = -8.1 so the campus share grows by one mesh — if wrong,
// trees between the tower and the wing cost one more mesh each material.
// Ruling: the strips north and east of the tower are left free (parking and service are another task's
// scope) — if wrong, extend the lawns there (plan data only).
// Ruling: trees stand in one row close to the facade with a 2.9 m clear stem, so every camera ray to the
// tower passes under or over the crowns (checked against the preset views in the tests) — if wrong,
// trees elsewhere would cover the lobby from the overview.
import { BufferGeometry, CylinderGeometry, Color, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, TorusGeometry, BoxGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAMPUS_BOUNDS, FLOOR_HEIGHT, HALF_DEPTH, HALF_WIDTH, TERRACE, type Rect, type XZ } from '../sim/layout';
import { PLOT_MARGIN } from '../sim/citySim';
import { createRng } from './rng';

/** World units per metre: the tower's 3 u floor to floor reads as 3.5 m. */
export const METRE = FLOOR_HEIGHT / 3.5;

/** The free campus block inside the ring sidewalks (CAMPUS_BOUNDS plus the city's plot margin). */
export const SITE = {
  x0: CAMPUS_BOUNDS.x0 - PLOT_MARGIN,
  x1: CAMPUS_BOUNDS.x1 + PLOT_MARGIN,
  z0: CAMPUS_BOUNDS.z0 - PLOT_MARGIN,
  z1: CAMPUS_BOUNDS.z1 + PLOT_MARGIN,
} as const;

export interface GroundTree extends XZ {
  readonly crownR: number;
  readonly crownY0: number;
  readonly crownY1: number;
}

export interface GroundBench extends XZ {
  readonly len: number;
}

export interface GroundsPlan {
  readonly paving: readonly Rect[];
  readonly lawns: readonly Rect[];
  readonly promenade: Rect;
  /** Water surface of the reflecting pool (inside its stone coping). */
  readonly pool: Rect;
  readonly coping: Rect;
  readonly planters: readonly Rect[];
  readonly trees: readonly GroundTree[];
  readonly benches: readonly GroundBench[];
  readonly sculpture: XZ & { readonly h: number; readonly halfW: number; readonly halfD: number };
  readonly uplights: readonly (XZ & { readonly y: number })[];
  /** Every footprint the grounds occupy (for clearance checks). */
  readonly footprints: readonly Rect[];
}

export interface Grounds {
  readonly group: Group;
  readonly plan: GroundsPlan;
  /** Night-lit materials (uplights, pool, crowns): emissive 0 by day. */
  readonly glows: MeshStandardMaterial[];
  /** Org mode: the tall pieces (trees, sculpture) fade to ORG_FADE so nothing covers the org chart. */
  setOrg(on: boolean): void;
}

/** Opacity of the tall grounds pieces in org mode. */
export const ORG_FADE = 0.12;

const r = (name: string, x0: number, x1: number, z0: number, z1: number): Rect => ({ name, x0, x1, z0, z1 });

const SURFACE_Y = -0.02;
const EAST = SITE.x1 - 0.1;
const SOUTH = SITE.z1 - 0.1;
/** Plaza starts at the outer edge of the stone plinth. */
const FRONT = HALF_DEPTH + 0.45;
const ROW_POOL = 7.0;
const ROW_PROMENADE = 8.6;
const ROW_ALLEE = 9.45;
/** Where the campus lawn of the wing (campus.ts) ends to the south. */
const CAMPUS_LAWN_Z1 = TERRACE.z1 + 1.4;
const POOL_X0 = -1.2;
const POOL_X1 = 9.8;
/** West end of the promenade: where the wing's terrace path comes down (campus.ts path at wingX(1.0)). */
const PROMENADE_X0 = TERRACE.x0 + 5.4;
const WALK_X0 = -10;

const TREE_Z = 9.88;
const TREE_XS = [-5.6, -3.0, -0.4, 2.2, 4.8, 7.4, 10.0] as const;
const CROWN = { r: 0.7, y0: 2.35, y1: 3.9 } as const;
const PLANTER = { half: 0.5, h: 0.45 } as const;
/** Bench: 0.52 m deep, seat at 0.45 m. */
const BENCH = { d: 0.45, h: 0.45 * METRE } as const;
const SCULPTURE = { x: -1.9, z: 7.8, plinth: 0.3, ring: 0.42, tube: 0.05 } as const;

let cached: GroundsPlan | null = null;

/** Pure plan of the grounds (world x/z, metres via METRE). */
export function groundsPlan(): GroundsPlan {
  if (cached) return cached;
  const paving: Rect[] = [
    r('plaza-front', WALK_X0, EAST, FRONT, ROW_POOL),
    r('forecourt', -7.4, POOL_X0, ROW_POOL, ROW_PROMENADE),
    r('pool-surround', POOL_X0, POOL_X1, ROW_POOL, ROW_PROMENADE),
    r('tower-wing-walk', WALK_X0, -HALF_WIDTH - 0.15, -HALF_DEPTH, FRONT),
    r('promenade-link', WALK_X0, -7.4, ROW_ALLEE, SOUTH),
    r('promenade-west', PROMENADE_X0, WALK_X0, CAMPUS_LAWN_Z1, SOUTH),
  ];
  const lawns: Rect[] = [r('lawn-west', WALK_X0, -7.4, ROW_POOL, ROW_PROMENADE), r('lawn-east', POOL_X1, EAST, ROW_POOL, ROW_PROMENADE), r('lawn-allee', -7.4, EAST, ROW_ALLEE, SOUTH)];
  const promenade = r('promenade', WALK_X0, EAST, ROW_PROMENADE, ROW_ALLEE);
  const coping = r('pool-coping', POOL_X0 + 0.2, POOL_X1 - 0.2, ROW_POOL + 0.1, ROW_PROMENADE - 0.1);
  const pool = r('pool', coping.x0 + 0.15, coping.x1 - 0.15, coping.z0 + 0.15, coping.z1 - 0.15);
  const planters = TREE_XS.map((x) => r('planter', x - PLANTER.half, x + PLANTER.half, TREE_Z - PLANTER.half, TREE_Z + PLANTER.half));
  const trees = TREE_XS.map((x) => ({ x, z: TREE_Z, crownR: CROWN.r, crownY0: CROWN.y0, crownY1: CROWN.y1 }));
  // Benches in the allée between the planters, facing the pool.
  const benchZ = ROW_ALLEE + 0.35;
  const benches: GroundBench[] = [-4.3, 0.9, 3.5, 8.7].map((x) => ({ x, z: benchZ, len: 1.5 * METRE }));
  const s = SCULPTURE;
  const sculpture = { x: s.x, z: s.z, h: s.plinth + 2 * (s.ring + s.tube) + 0.01, halfW: s.ring + s.tube + 0.01, halfD: 0.47 };
  const uplights: (XZ & { y: number })[] = [];
  for (const x of TREE_XS) for (const dx of [-0.32, 0.32]) uplights.push({ x: x + dx, z: TREE_Z + 0.32, y: PLANTER.h });
  // Facade washers between the fins, east of the entrance canopy, and one at the west corner.
  for (let i = 0; i < 12; i++) {
    const x = -HALF_WIDTH + (i + 0.5) * ((HALF_WIDTH * 2) / 12);
    if (x < -7 || x > -1.5) uplights.push({ x, z: FRONT + 0.15, y: SURFACE_Y });
  }
  for (const dx of [-0.25, 0.25]) uplights.push({ x: s.x + dx, z: s.z + 0.33, y: s.plinth });
  const benchRects = benches.map((b) => r('bench', b.x - b.len / 2, b.x + b.len / 2, b.z - BENCH.d / 2, b.z + BENCH.d / 2));
  const footprints: Rect[] = [...paving, ...lawns, promenade, coping, ...planters, ...benchRects, r('sculpture', s.x - 0.4, s.x + 0.4, s.z - 0.4, s.z + 0.4)];
  cached = { paving, lawns, promenade, pool, coping, planters, trees, benches, sculpture, uplights, footprints };
  return cached;
}

// ------------------------------------------------------------------------------------------- geometry

const PAVING_TONES = [0xe6dfd3, 0xe1d9cb, 0xdcd3c4] as const;
const PROMENADE_TONES = [0xd3c8b6, 0xcbbfac, 0xd0c4b0] as const;
const LAWN_TONES = [0x86b25f, 0x7aa656] as const;

class Quads {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly idx: number[] = [];
  private readonly c = new Color();
  quad(x0: number, x1: number, z0: number, z1: number, y: number, hex: number): void {
    const base = this.pos.length / 3;
    this.pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    this.c.setHex(hex);
    for (let i = 0; i < 4; i++) this.col.push(this.c.r, this.c.g, this.c.b);
    this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/** Tiles a rect with `w` x `d` units (rows staggered by `stagger` of a tile), clipped at the edges. */
function tile(q: Quads, rect: Rect, w: number, d: number, stagger: number, tones: readonly number[], rnd: () => number): void {
  let row = 0;
  for (let z = rect.z0; z < rect.z1 - 1e-6; z += d, row++) {
    const z1 = Math.min(rect.z1, z + d);
    const shift = (row % 2) * stagger * w;
    for (let x = rect.x0 - shift; x < rect.x1 - 1e-6; x += w) {
      const xa = Math.max(rect.x0, x);
      const xb = Math.min(rect.x1, x + w);
      if (xb - xa < 1e-4) continue;
      q.quad(xa, xb, z, z1, SURFACE_Y, tones[Math.floor(rnd() * tones.length)] ?? tones[0] ?? 0xffffff);
    }
  }
}

function stripes(q: Quads, rect: Rect, width: number): void {
  let i = 0;
  for (let x = rect.x0; x < rect.x1 - 1e-6; x += width, i++) q.quad(x, Math.min(rect.x1, x + width), rect.z0, rect.z1, SURFACE_Y, LAWN_TONES[i % 2] ?? 0x86b25f);
}

function box(parts: BufferGeometry[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parts.push(g);
}

function finish(geo: BufferGeometry, mat: Material, name: string): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.userData.shadow = 'none';
  m.castShadow = false;
  m.receiveShadow = false;
  m.raycast = () => undefined; // never pickable
  return m;
}

function merged(parts: BufferGeometry[], mat: Material, name: string): Mesh {
  const geo = mergeGeometries(parts) ?? new BoxGeometry(0.01, 0.01, 0.01);
  for (const p of parts) p.dispose();
  return finish(geo, mat, name);
}

function glow(name: string, color: number, emissive: number, night: number, opts: { roughness?: number; metalness?: number; vertexColors?: boolean } = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0, vertexColors: opts.vertexColors ?? false });
  m.name = name;
  m.userData.glow = { day: 0, night };
  return m;
}

/** Builds the grounds group (add it to the scene root). */
export function createGrounds(): Grounds {
  const plan = groundsPlan();
  const rnd = createRng(37);
  const group = new Group();
  group.name = 'grounds';
  const glows: MeshStandardMaterial[] = [];

  // Flat surfaces: stone paving (1 m tiles), lawns with mowing stripes, the promenade in long planks.
  const q = new Quads();
  for (const p of plan.paving) tile(q, p, METRE, METRE, 0.5, PAVING_TONES, rnd);
  for (const l of plan.lawns) stripes(q, l, 0.7 * METRE);
  tile(q, plan.promenade, 2 * METRE, 0.5 * METRE, 0.5, PROMENADE_TONES, rnd);
  const surface = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 });
  surface.name = 'grounds-surface';
  group.add(finish(q.geometry(), surface, 'grounds-surface'));

  // Stone: raised pool coping, planters, the sculpture plinth, bench ends.
  const stoneParts: BufferGeometry[] = [];
  const c = plan.coping;
  const p = plan.pool;
  const copeTop = 0.14;
  box(stoneParts, c.x0, c.x1, SURFACE_Y, copeTop, c.z0, p.z0);
  box(stoneParts, c.x0, c.x1, SURFACE_Y, copeTop, p.z1, c.z1);
  box(stoneParts, c.x0, p.x0, SURFACE_Y, copeTop, p.z0, p.z1);
  box(stoneParts, p.x1, c.x1, SURFACE_Y, copeTop, p.z0, p.z1);
  for (const pl of plan.planters) box(stoneParts, pl.x0, pl.x1, SURFACE_Y, PLANTER.h, pl.z0, pl.z1);
  const s = plan.sculpture;
  box(stoneParts, s.x - 0.4, s.x + 0.4, SURFACE_Y, SCULPTURE.plinth, s.z - 0.4, s.z + 0.4);
  const woodParts: BufferGeometry[] = [];
  for (const b of plan.benches) {
    const x0 = b.x - b.len / 2;
    const x1 = b.x + b.len / 2;
    for (const x of [x0 + 0.06, x1 - 0.18]) box(stoneParts, x, x + 0.12, SURFACE_Y, BENCH.h - 0.05, b.z - BENCH.d / 2 + 0.03, b.z + BENCH.d / 2 - 0.03);
    for (let i = 0; i < 4; i++) {
      const z0 = b.z - BENCH.d / 2 + i * (BENCH.d / 4) + 0.01;
      box(woodParts, x0, x1, BENCH.h - 0.05, BENCH.h, z0, z0 + BENCH.d / 4 - 0.02);
    }
  }
  const stone = new MeshStandardMaterial({ color: 0xd8d1c4, roughness: 0.6 });
  stone.name = 'grounds-stone';
  group.add(merged(stoneParts, stone, 'grounds-stone'));
  const wood = new MeshStandardMaterial({ color: 0xb98d5e, roughness: 0.7 });
  wood.name = 'grounds-bench-wood';
  group.add(merged(woodParts, wood, 'grounds-bench-wood'));

  // Reflecting pool: a still, dark, glossy surface, softly lit from below at night.
  const water = glow('grounds-pool-water', 0x46707b, 0x2e8fb3, 0.45, { roughness: 0.05, metalness: 0.5 });
  glows.push(water);
  const wp: BufferGeometry[] = [];
  box(wp, p.x0, p.x1, SURFACE_Y, 0.1, p.z0, p.z1);
  group.add(merged(wp, water, 'grounds-pool-water'));

  // Trees: clear stems in the planters, rounded crowns of three soft blobs; under-planting in the planters.
  const trunkParts: BufferGeometry[] = [];
  const crownParts: BufferGeometry[] = [];
  const hedgeParts: BufferGeometry[] = [];
  const leaf = [new Color(0x6d9a63), new Color(0x5f8f57), new Color(0x78a66a)];
  const blob = (x: number, y: number, z: number, rad: number, sy: number, col: Color): void => {
    const g = new IcosahedronGeometry(rad, 1);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    g.deleteAttribute('uv');
    const n = g.attributes.position?.count ?? 0;
    g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => (i % 3 === 0 ? col.r : i % 3 === 1 ? col.g : col.b)), 3));
    crownParts.push(g);
  };
  plan.trees.forEach((t, i) => {
    const trunk = new CylinderGeometry(0.06, 0.09, CROWN.y0 + 0.6 - PLANTER.h, 7);
    trunk.translate(t.x, PLANTER.h + (CROWN.y0 + 0.6 - PLANTER.h) / 2, t.z);
    trunkParts.push(trunk);
    const a = leaf[i % 3] ?? leaf[0]!;
    const b = leaf[(i + 1) % 3] ?? leaf[0]!;
    // Main crown y 2.59..3.71, side blob y 2.37..3.23, top blob y 3.01..3.89; all within crownR of the stem.
    blob(t.x, 3.15, t.z, 0.66, 0.85, a);
    blob(t.x + 0.24, 2.8, t.z + 0.1, 0.43, 1, b);
    blob(t.x - 0.2, 3.45, t.z - 0.12, 0.43, 1, a);
    const hedge = new BoxGeometry(PLANTER.half * 2 - 0.12, 0.12, PLANTER.half * 2 - 0.12);
    hedge.translate(t.x, PLANTER.h + 0.04, t.z);
    hedgeParts.push(hedge);
  });
  const trunkMat = new MeshStandardMaterial({ color: 0x8a6d55, roughness: 0.9 });
  trunkMat.name = 'grounds-tree-trunk';
  group.add(merged(trunkParts, trunkMat, 'grounds-tree-trunks'));
  const crownMat = glow('grounds-tree-crown', 0xffffff, 0xffcf8a, 0.12, { roughness: 0.85, vertexColors: true });
  glows.push(crownMat);
  group.add(merged(crownParts, crownMat, 'grounds-tree-crowns'));
  const hedgeMat = new MeshStandardMaterial({ color: 0x5f8f57, roughness: 0.9 });
  hedgeMat.name = 'grounds-hedge';
  group.add(merged(hedgeParts, hedgeMat, 'grounds-hedges'));

  // Sculpture: two interlocking brushed-steel rings on the stone plinth at the west end of the pool.
  const ringParts: BufferGeometry[] = [];
  const cy = SCULPTURE.plinth + SCULPTURE.ring + SCULPTURE.tube;
  for (const yaw of [0, Math.PI / 3]) {
    const g = new TorusGeometry(SCULPTURE.ring, SCULPTURE.tube, 10, 40);
    g.rotateY(yaw);
    g.translate(s.x, cy, s.z);
    ringParts.push(g);
  }
  const steel = new MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.22 });
  steel.name = 'grounds-sculpture';
  group.add(merged(ringParts, steel, 'grounds-sculpture'));

  // Uplights: small flush fittings, dark by day, a soft warm glow at night.
  const lightParts = plan.uplights.map((u) => {
    const g = new CylinderGeometry(0.06, 0.06, 0.03, 8);
    g.translate(u.x, u.y + 0.015, u.z);
    return g;
  });
  const up = glow('grounds-uplight', 0xfff1d6, 0xffc98a, 1.6, { roughness: 0.5 });
  glows.push(up);
  group.add(merged(lightParts, up, 'grounds-uplights'));

  const tall: Material[] = [trunkMat, crownMat, steel];
  return {
    group,
    plan,
    glows,
    setOrg(on) {
      for (const m of tall) {
        if (m.transparent !== on) m.needsUpdate = true;
        m.transparent = on;
        m.opacity = on ? ORG_FADE : 1;
        m.depthWrite = !on;
      }
    },
  };
}
