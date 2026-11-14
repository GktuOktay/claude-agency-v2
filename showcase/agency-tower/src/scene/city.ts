// City life around the campus (KARARLAR rev 31; calm, prestige and warmth rework rev 33): tree-lined
// boulevards, elegant mid-rise buildings (arcades, balconies, set-back penthouses, planted roof terraces),
// a park with a fountain plaza, a pond and a café, calm traffic, cyclists and strolling people.
// Warm pastel diorama palette (cream, sand, warm stone, soft terracotta, sage, sky-blue glass) under a light,
// warm atmospheric fade toward the page background: lighter and lower in contrast than the campus, so the
// tower and the wing stay the focus. Procedural geometry only, merged static meshes and instancing; nothing
// here is pickable and nothing casts or receives shadows.
//
// Ruling: the fade is a per-material shader mix (onBeforeCompile) keyed on the distance to the campus
// footprint, not scene.fog — the scene (src/app) owns the fog slot and the tower must stay unfogged — if
// wrong, swap the mix for scene.fog in one place.
// Ruling: arcades, balconies, awnings, cornices and roof planters stay inside each plan footprint and below
// its plan height, so the occlusion check on the plan boxes still covers them — if wrong, they would need
// their own boxes in the test.
// Ruling: thin street furniture (lamp and signal poles, <= 0.3 m) is not part of the occlusion check; like
// a real foreground pole it may cross a wall edge in a low orbit view — if wrong, move the poles outward.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
} from 'three';
import { CAMPUS_BOUNDS } from '../sim/layout';
import {
  ROAD_HALF,
  STOP_DIST,
  STOREY,
  WALK_WIDTH,
  type Pedestrian,
  cityPlan,
  createCitySim,
  signalState,
  stepCitySim,
  type CityPlan,
  type CityRect,
  type CitySim,
  type Signal,
  type VehicleKind,
} from '../sim/citySim';
import { createRng } from './rng';

export interface City {
  group: Group;
  /** Advances traffic and pedestrians by `dt` seconds (no-op under reduced motion and in org mode). */
  step(dt: number): void;
  /** Night lights: boolean, or the 0..1 smoothed night factor the tower uses. */
  setNight(on: boolean | number): void;
  /** Org mode: the city dims further and freezes. */
  setOrg(on: boolean): void;
  /** Reduced motion: vehicles and pedestrians stand still. */
  setReducedMotion(on: boolean): void;
}

export interface CityOptions {
  seed?: number;
  /** Campus footprint the city keeps clear of (default CAMPUS_BOUNDS). */
  bounds?: CityRect;
}

// ---- palette: warm pastel diorama, same family as the tower (src/scene/furniture.ts PALETTE) ----
const C = {
  base: 0xeadfc8,
  lawn: 0xcfdcae,
  plaza: 0xf4ecdd,
  road: 0xcfc6b8,
  walk: 0xefe5d3,
  marking: 0xfbf8f1,
  bike: 0xe3b9a0,
  median: 0xbcd197,
  grass: 0xc2d89d,
  path: 0xf0e4ca,
  water: 0xa7d6e2,
  stone: 0xf6f0e4,
  roof: 0xe9dcc6,
  trunk: 0xb0916f,
  crown: [0x9fc487, 0xb5d394, 0x8cbb80, 0xc4d99a],
  hedge: 0xa9c98d,
  flowers: [0xf3b9c4, 0xf7da8c, 0xcdb9e6, 0xf5c8a6],
  pole: 0xa39684,
  lampHead: 0xfbf3e2,
  windowGlass: 0xa9cfdf,
  windowGlow: 0xffc982,
  lampGlow: 0xffd9a0,
  buildings: [0xf3e7d1, 0xead4b2, 0xf6efe3, 0xe8bba1, 0xd8e0c6, 0xf1d6c3],
  accents: [0xd99a7e, 0x9fbf8f, 0xe7c27e, 0x8fb5c9],
  cars: [0xefe9dd, 0xaecbdc, 0xe0bfab, 0xc6d6b6, 0xf6f3ec, 0xcdc6df],
  taxis: [0xf3d37c, 0xf0cc70],
  buses: [0xf6f2ea, 0xd4e6d8],
  umbrellas: [0xf7f1e6, 0xe3a98f, 0xb7d1a5, 0xf1d58e],
  clothes: [0xe9a68f, 0x8fb6d9, 0xf1d27c, 0xa9c98f, 0xd6a9c9, 0xf3efe6, 0x86a9c4],
  dogs: [0xd9b48a, 0xf1e6d4],
  skin: 0xe6c6a6,
  signalOff: 0x5e6064,
  signal: { red: 0xe0574a, yellow: 0xe8b84a, green: 0x5fc27a } as Record<Signal, number>,
} as const;

/** Light, warm fade toward the page background (day bottom / night bottom of src/scene/daynight.ts, a touch warmer). */
const HAZE_DAY = [240, 233, 220] as const;
const HAZE_NIGHT = [62, 53, 66] as const;
const HAZE_NEAR = 12;
const HAZE_FAR = 52;
const SHADE = 0.1;
const ORG_DIM = 0.55;
const LIT_SHARE = 0.55;

// ---- geometry builder (positions, normals, vertex colours, index) ----

class Builder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private c = new Color();

  private quad(p: readonly number[], n: readonly [number, number, number], color: number | Color): void {
    const base = this.pos.length / 3;
    if (color instanceof Color) this.c.copy(color);
    else this.c.setHex(color);
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0, p[i * 3 + 2] ?? 0);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Horizontal quad facing up. */
  flat(x0: number, x1: number, z0: number, z1: number, y: number, color: number | Color): void {
    this.quad([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], [0, 1, 0], color);
  }

  /** Vertical quad on the plane x = const (facing sign) or z = const. */
  wall(axis: 'x' | 'z', at: number, a0: number, a1: number, y0: number, y1: number, facing: 1 | -1, color: number | Color): void {
    if (axis === 'x') {
      const [za, zb] = facing > 0 ? [a1, a0] : [a0, a1];
      this.quad([at, y0, za, at, y0, zb, at, y1, zb, at, y1, za], [facing, 0, 0], color);
    } else {
      const [xa, xb] = facing > 0 ? [a0, a1] : [a1, a0];
      this.quad([xa, y0, at, xb, y0, at, xb, y1, at, xa, y1, at], [0, 0, facing], color);
    }
  }

  /** Axis-aligned box (bottom face omitted unless asked). */
  box(xa: number, xb: number, y0: number, y1: number, za: number, zb: number, color: number | Color, bottom = false): void {
    const [x0, x1] = xa <= xb ? [xa, xb] : [xb, xa];
    const [z0, z1] = za <= zb ? [za, zb] : [zb, za];
    this.flat(x0, x1, z0, z1, y1, color);
    this.wall('x', x1, z0, z1, y0, y1, 1, color);
    this.wall('x', x0, z0, z1, y0, y1, -1, color);
    this.wall('z', z1, x0, x1, y0, y1, 1, color);
    this.wall('z', z0, x0, x1, y0, y1, -1, color);
    if (bottom) this.quad([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], color);
  }

  /** Flat n-gon facing up (a fan; the last vertex is the centre). */
  disc(cx: number, cz: number, r: number, y: number, n: number, color: number): void {
    const base = this.pos.length / 3;
    this.c.setHex(color);
    for (let i = 0; i <= n; i++) {
      const a = i < n ? (i / n) * Math.PI * 2 : 0;
      this.pos.push(i < n ? cx + Math.cos(a) * r : cx, y, i < n ? cz + Math.sin(a) * r : cz);
      this.nor.push(0, 1, 0);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    for (let i = 0; i < n; i++) this.idx.push(base + n, base + ((i + 1) % n), base + i);
  }

  /** Upright n-sided prism with a top (round basins, columns, bowls). */
  prism(cx: number, cz: number, r: number, y0: number, y1: number, n: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const m = (a0 + a1) / 2;
      const p = (a: number, y: number): number[] => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad([...p(a1, y0), ...p(a0, y0), ...p(a0, y1), ...p(a1, y1)], [Math.cos(m), 0, Math.sin(m)], color);
    }
    this.disc(cx, cz, r, y1, n, color);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new BufferAttribute(new Uint32Array(this.idx), 1) : new BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---- haze material ----

interface HazeUniforms {
  uHaze: { value: Vector3 };
  uCampus: { value: [number, number, number, number] };
  uHazeRange: { value: [number, number] };
  uShade: { value: number };
  uDim: { value: number };
}

function hazed<T extends Material>(m: T, u: HazeUniforms): T {
  m.userData.cityHaze = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n{ vec4 cw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ncw = instanceMatrix * cw;\n#endif\nvCityWorld = (modelMatrix * cw).xyz; }',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;\nuniform vec3 uHaze;\nuniform vec4 uCampus;\nuniform vec2 uHazeRange;\nuniform float uShade;\nuniform float uDim;')
      .replace(
        '#include <fog_fragment>',
        '#include <fog_fragment>\n{ vec2 q = vCityWorld.xz; float hx = max(max(uCampus.x - q.x, q.x - uCampus.y), 0.0); float hz = max(max(uCampus.z - q.y, q.y - uCampus.w), 0.0);\nfloat f = uShade + (1.0 - uShade) * smoothstep(uHazeRange.x, uHazeRange.y, length(vec2(hx, hz)));\nf = mix(f, 1.0, uDim); gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp(f, 0.0, 0.92)); }',
      );
  };
  m.customProgramCacheKey = () => 'city-haze';
  return m;
}

const noRaycast = (): void => undefined;

function named<T extends Mesh>(m: T, name: string): T {
  m.name = name;
  m.raycast = noRaycast;
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.shadow = 'none';
  return m;
}

// ---- static parts ----

function buildGround(plan: CityPlan): BufferGeometry {
  const b = new Builder();
  const e = plan.extent;
  const R = ROAD_HALF;
  b.flat(e.x0, e.x1, e.z0, e.z1, -0.07, C.base);
  // Every block is a soft lawn under its buildings (courtyards, front gardens, open lots).
  for (const bl of plan.blocks) b.flat(bl.x0, bl.x1, bl.z0, bl.z1, -0.062, C.lawn);
  // Campus plaza: the whole centre block inside the ring sidewalks.
  const r = plan.ring;
  b.flat(r.w + R + WALK_WIDTH, r.e - R - WALK_WIDTH, r.n + R + WALK_WIDTH, r.s - R - WALK_WIDTH, -0.06, C.plaza);
  for (const s of plan.sidewalks) b.flat(s.x0, s.x1, s.z0, s.z1, -0.055, C.walk);
  for (const road of plan.roads) b.flat(road.x0, road.x1, road.z0, road.z1, -0.05, C.road);
  for (const l of plan.bikeLanes) b.flat(l.x0, l.x1, l.z0, l.z1, -0.047, C.bike);
  for (const m of plan.medians) b.flat(m.x0, m.x1, m.z0, m.z1, -0.046, C.median);
  // Park lawn, cross paths, the fountain plaza and the promenade along the pond.
  const p = plan.park;
  b.flat(p.x0, p.x1, p.z0, p.z1, -0.048, C.grass);
  const pc = { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
  b.flat(p.x0, p.x1, pc.z - 0.9, pc.z + 0.9, -0.045, C.path);
  b.flat(pc.x - 0.9, pc.x + 0.9, p.z0, p.z1, -0.045, C.path);
  b.flat(plan.pond.x0 - 1, plan.pond.x1 + 1, plan.pond.z0 - 1.6, plan.pond.z0 - 0.4, -0.045, C.path);
  b.disc(pc.x, pc.z, 4.2, -0.044, 16, C.plaza);
  // Stop lines across each approach lane (right of the heading).
  for (const n of plan.intersections) {
    const s = STOP_DIST - 0.25;
    b.flat(n.x - s - 0.3, n.x - s, n.z, n.z + R - 0.75, -0.044, C.marking); // eastbound
    b.flat(n.x + s, n.x + s + 0.3, n.z - R + 0.75, n.z, -0.044, C.marking); // westbound
    b.flat(n.x - R + 0.75, n.x, n.z - s - 0.3, n.z - s, -0.044, C.marking); // southbound
    b.flat(n.x, n.x + R - 0.75, n.z + s, n.z + s + 0.3, -0.044, C.marking); // northbound
  }
  // Zebra crosswalks: stripes run along the walking direction.
  for (const c of plan.crosswalks) {
    if (c.walk === 'z') for (let z = c.z0 + 0.25; z < c.z1 - 0.3; z += 1.0) b.flat(c.x0 + 0.15, c.x1 - 0.15, z, z + 0.5, -0.043, C.marking);
    else for (let x = c.x0 + 0.25; x < c.x1 - 0.3; x += 1.0) b.flat(x, x + 0.5, c.z0 + 0.15, c.z1 - 0.15, -0.043, C.marking);
  }
  return b.build();
}

/**
 * Elegant mid-rise buildings, all inside the plan footprint and below the plan height `h`:
 * an arcade (or awnings on one-storey shops) at street level, balconies on the upper floors, a stone
 * cornice, a set-back penthouse on 3+ floors and planted roof terraces.
 */
function buildBuildings(plan: CityPlan, seed: number): { body: BufferGeometry; lit: BufferGeometry; dark: BufferGeometry } {
  const body = new Builder();
  const lit = new Builder();
  const dark = new Builder();
  const rng = createRng(seed ^ 0xb11d);
  const glass = C.windowGlass;
  const win = (axis: 'x' | 'z', at: number, c: number, half: number, y0: number, y1: number, facing: 1 | -1, share = LIT_SHARE): void => (rng() < share ? lit : dark).wall(axis, at, c - half, c + half, y0, y1, facing, glass);
  const GI = 1.5; // ground-floor inset on the z faces (arcade or shop-front depth)
  const ZI = 0.6; // upper-floor inset on the z faces (balcony depth)
  for (const bd of plan.buildings) {
    const tone = C.buildings[bd.tone % C.buildings.length] ?? C.buildings[0];
    const accent = C.accents[bd.tone % C.accents.length] ?? C.accents[0];
    const { x0, x1, z0, z1 } = bd;
    const F = bd.floors;
    const pent = F >= 3;
    const mainTop = (pent ? F - 1 : F) * STOREY;
    const zi = F >= 2 ? ZI : GI;
    const bays = Math.max(1, Math.floor((x1 - x0 - 0.8) / 2.4));
    const step = (x1 - x0) / bays;
    // Street level: recessed shop fronts.
    body.box(x0, x1, 0, Math.min(STOREY, mainTop), z0 + GI, z1 - GI, tone);
    for (const [at, f] of [[z0 + GI - 0.03, -1], [z1 - GI + 0.03, 1]] as const) for (let i = 0; i < bays; i++) win('z', at, x0 + step * (i + 0.5), step * 0.36, 0.35, 2.3, f, 0.75);
    if (F >= 2) {
      // Arcade: columns on the outer line, a stone belt, then the upper floors.
      const n = Math.max(2, Math.round((x1 - x0) / 3.4) + 1);
      for (let i = 0; i < n; i++) {
        const x = x0 + 0.22 + ((x1 - x0 - 0.44) * i) / (n - 1);
        for (const z of [z0 + ZI + 0.2, z1 - ZI - 0.2]) body.box(x - 0.17, x + 0.17, 0, STOREY - 0.25, z - 0.17, z + 0.17, C.stone);
      }
      body.box(x0, x1, STOREY - 0.25, STOREY, z0 + ZI, z1 - ZI, C.stone);
      body.box(x0, x1, STOREY, mainTop, z0 + ZI, z1 - ZI, tone);
      const upper = mainTop / STOREY;
      for (let f = 1; f < upper; f++) {
        const y = f * STOREY;
        for (const [at, out, fc] of [[z0 + ZI, z0 + 0.04, -1], [z1 - ZI, z1 - 0.04, 1]] as const) {
          for (let i = 0; i < bays; i++) {
            const c = x0 + step * (i + 0.5);
            win('z', at + fc * 0.03, c, 0.5, y + 0.5, y + 2.4, fc);
            if ((i + f) % 2 !== 0) continue;
            // Balcony: slab and railing within the inset, now and then a planter.
            const [za, zb] = fc < 0 ? [out, at] : [at, out];
            body.box(c - 0.85, c + 0.85, y, y + 0.12, za, zb, C.stone);
            body.wall('z', out, c - 0.85, c + 0.85, y + 0.12, y + 1.0, fc, C.stone);
            if (rng() < 0.4) body.box(c - 0.7, c - 0.3, y + 0.12, y + 0.5, za + 0.06, zb - 0.06, C.hedge);
          }
        }
        // Side windows on the x faces.
        const nz = Math.max(1, Math.floor((z1 - z0 - 2 * ZI - 0.8) / 2.4));
        const sz = (z1 - z0 - 2 * ZI) / nz;
        for (let i = 0; i < nz; i++) {
          const c = z0 + ZI + sz * (i + 0.5);
          win('x', x1 + 0.03, c, 0.5, y + 0.7, y + 2.2, 1);
          win('x', x0 - 0.03, c, 0.5, y + 0.7, y + 2.2, -1);
        }
      }
    } else {
      // One-storey shops: striped awnings over the shop fronts.
      for (const [za, zb] of [[z0 + 0.3, z0 + GI], [z1 - GI, z1 - 0.3]] as const) body.box(x0 + 0.4, x1 - 0.4, 2.35, 2.5, za, zb, accent);
    }
    // Stone cornice and the roof terrace with planters (a roof lawn on some).
    const cz = Math.max(0, zi - 0.25);
    body.box(x0, x1, mainTop, mainTop + 0.25, z0 + cz, z1 - cz, C.stone);
    const ry = mainTop + 0.25;
    for (const [za, zb] of [[z0 + cz + 0.1, z0 + cz + 0.55], [z1 - cz - 0.55, z1 - cz - 0.1]] as const) {
      body.box(x0 + 0.4, x1 - 0.4, ry, ry + 0.22, za, zb, accent);
      body.box(x0 + 0.45, x1 - 0.45, ry + 0.22, ry + 0.35, za + 0.05, zb - 0.05, C.hedge);
    }
    if (pent) {
      // Set-back penthouse with a glass band and its own thin roof.
      const P = 1.4;
      const [px0, px1, pz0, pz1] = [x0 + P, x1 - P, z0 + cz + P, z1 - cz - P];
      body.box(px0, px1, ry, F * STOREY, pz0, pz1, C.stone);
      body.box(px0 - 0.2, px1 + 0.2, F * STOREY, F * STOREY + 0.2, pz0 - 0.2, pz1 + 0.2, tone);
      win('z', pz1 + 0.03, (px0 + px1) / 2, (px1 - px0) / 2 - 0.3, ry + 0.4, F * STOREY - 0.4, 1, 0.8);
      win('z', pz0 - 0.03, (px0 + px1) / 2, (px1 - px0) / 2 - 0.3, ry + 0.4, F * STOREY - 0.4, -1, 0.8);
    } else if (rng() < 0.6) body.flat(x0 + 0.4, x1 - 0.4, z0 + cz + 0.7, z1 - cz - 0.7, ry + 0.01, C.lawn);
  }
  return { body: body.build(), lit: lit.build(), dark: dark.build() };
}

function buildProps(plan: CityPlan): BufferGeometry {
  const b = new Builder();
  const wood = 0xd2ab7f;
  const metal = 0xb3a692;
  for (const bench of plan.benches) {
    // Seat faces +z at yaw 0 and -z at yaw PI; benches here are axis aligned.
    const s = Math.cos(bench.yaw) >= 0 ? 1 : -1;
    const { x, z } = bench;
    b.box(x - 0.8, x + 0.8, 0.4, 0.46, z - 0.22, z + 0.22, wood);
    b.box(x - 0.8, x + 0.8, 0.5, 0.85, z - s * 0.26, z - s * 0.2, wood);
    for (const dx of [-0.7, 0.7]) b.box(x + dx - 0.04, x + dx + 0.04, 0, 0.4, z - 0.2, z + 0.2, metal);
  }
  // Fountain on the plaza where the park paths cross: a round basin, a column and an upper bowl.
  const p = plan.park;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  b.prism(cx, cz, 2.4, 0, 0.45, 16, C.stone);
  b.disc(cx, cz, 2.15, 0.46, 16, C.water);
  b.prism(cx, cz, 0.28, 0.46, 1.2, 8, C.stone);
  b.prism(cx, cz, 0.95, 1.2, 1.32, 12, C.stone);
  b.disc(cx, cz, 0.8, 1.33, 12, C.water);
  b.prism(cx, cz, 0.12, 1.33, 1.75, 6, C.water);
  // Calm pond with a stone edge and a small bridge carrying the north-south path.
  const w = plan.pond;
  b.flat(w.x0, w.x1, w.z0, w.z1, 0.02, C.water);
  b.box(w.x0 - 0.3, w.x1 + 0.3, 0, 0.18, w.z0 - 0.3, w.z0, C.stone);
  b.box(w.x0 - 0.3, w.x1 + 0.3, 0, 0.18, w.z1, w.z1 + 0.3, C.stone);
  for (const x of [w.x0 - 0.3, w.x1]) b.box(x, x + 0.3, 0, 0.18, w.z0, w.z1, C.stone);
  b.box(cx - 1.0, cx + 1.0, 0, 0.3, w.z0 - 0.8, w.z1 + 0.8, C.stone);
  b.box(cx - 1.0, cx + 1.0, 0.3, 0.45, w.z0 + 0.6, w.z1 - 0.6, C.stone);
  for (const x of [cx - 1.0, cx + 0.92]) b.box(x, x + 0.08, 0.45, 1.0, w.z0 + 0.4, w.z1 - 0.4, wood);
  // Hedges along the park's street edge (open where the path enters), flower beds behind the north benches.
  b.box(p.x0, cx - 1.1, 0, 0.55, p.z0, p.z0 + 0.5, C.hedge);
  b.box(cx + 1.1, p.x1, 0, 0.55, p.z0, p.z0 + 0.5, C.hedge);
  [-11, -5, 5, 11].forEach((dx, i) => b.box(cx + dx - 1.6, cx + dx + 1.6, 0, 0.22, cz - 2.95, cz - 2.35, C.flowers[i % C.flowers.length] ?? C.flowers[0]));
  // Park café kiosk with an awning.
  const k = plan.kiosk;
  b.box(k.x0, k.x1, 0, 2.5, k.z0, k.z1, C.stone);
  b.box(k.x0 - 0.2, k.x1 + 0.2, 2.5, 2.7, k.z0 - 0.2, k.z1 + 0.2, C.accents[0]);
  b.box(k.x0 - 0.1, k.x1 + 0.1, 2.0, 2.1, k.z0 - 0.9, k.z0, C.accents[0]);
  // Café tables and chairs (the umbrellas are instanced).
  for (const t of plan.tables) {
    b.box(t.x - 0.38, t.x + 0.38, 0.72, 0.76, t.z - 0.38, t.z + 0.38, C.stone);
    b.box(t.x - 0.04, t.x + 0.04, 0, 2.2, t.z - 0.04, t.z + 0.04, metal);
    for (const s of [-1, 1]) {
      const x = t.x + s * 0.62;
      b.box(x - 0.2, x + 0.2, 0.42, 0.46, t.z - 0.2, t.z + 0.2, wood);
      b.box(x + s * 0.17, x + s * 0.21, 0.46, 0.85, t.z - 0.2, t.z + 0.2, wood);
    }
  }
  // Boulevard medians: a low hedge with flower beds along it.
  for (const m of plan.medians) {
    const alongX = m.x1 - m.x0 > m.z1 - m.z0;
    b.box(m.x0 + 0.08, m.x1 - 0.08, 0, 0.32, m.z0 + 0.08, m.z1 - 0.08, C.hedge);
    const [a0, a1] = alongX ? [m.x0, m.x1] : [m.z0, m.z1];
    let i = 0;
    for (let t = a0 + 6; t < a1 - 1.5; t += 9, i++) {
      const col = C.flowers[i % C.flowers.length] ?? C.flowers[0];
      if (alongX) b.box(t - 1, t + 1, 0.32, 0.42, m.z0 + 0.1, m.z1 - 0.1, col);
      else b.box(m.x0 + 0.1, m.x1 - 0.1, 0.32, 0.42, t - 1, t + 1, col);
    }
  }
  return b.build();
}

// ---- instanced parts ----

function vehicleGeometry(kind: VehicleKind): BufferGeometry {
  const b = new Builder();
  const glass = new Color(0.68, 0.8, 0.86);
  const tyre = new Color(0.3, 0.29, 0.28);
  if (kind === 'bus') {
    // Small electric shuttle: rounded-looking box, wide glass band, a roof battery pod.
    b.box(-3.1, 3.1, 0.3, 2.4, -1.0, 1.0, 0xffffff);
    b.box(-2.9, 3.0, 1.15, 2.1, -1.02, 1.02, glass);
    b.box(-1.6, 1.6, 2.4, 2.62, -0.7, 0.7, 0xffffff);
    for (const x of [-2.0, 2.0]) b.box(x - 0.42, x + 0.42, 0, 0.8, -1.05, 1.05, tyre);
  } else {
    b.box(-2.0, 2.0, 0.3, 0.95, -0.9, 0.9, 0xffffff);
    b.box(-1.0, 0.9, 0.95, 1.45, -0.78, 0.78, glass);
    for (const x of [-1.25, 1.25]) b.box(x - 0.32, x + 0.32, 0, 0.62, -0.95, 0.95, tyre);
    if (kind === 'taxi') b.box(-0.25, 0.25, 1.45, 1.65, -0.3, 0.3, 0xffffff);
  }
  return b.build();
}

function vehicleLightGeometry(): BufferGeometry {
  const b = new Builder();
  const front = new Color(1, 0.93, 0.75);
  const rear = new Color(0.85, 0.2, 0.15);
  for (const z of [-0.7, 0.7]) {
    b.wall('x', 0.505, z - 0.15, z + 0.15, 0.55, 0.75, 1, front);
    b.wall('x', -0.505, z - 0.15, z + 0.15, 0.55, 0.75, -1, rear);
  }
  return b.build();
}

/** Bicycle (local +x forward); the rider is drawn with the people. */
function bikeGeometry(): BufferGeometry {
  const b = new Builder();
  const tyre = new Color(0.35, 0.33, 0.31);
  for (const x of [-0.55, 0.55]) b.box(x - 0.34, x + 0.34, 0.02, 0.7, -0.03, 0.03, tyre);
  b.box(-0.55, 0.55, 0.42, 0.5, -0.04, 0.04, 0xffffff);
  b.box(-0.2, -0.12, 0.42, 0.86, -0.04, 0.04, 0xffffff);
  b.box(0.42, 0.5, 0.5, 1.02, -0.04, 0.04, 0xffffff);
  b.box(0.4, 0.52, 0.98, 1.04, -0.28, 0.28, 0xffffff);
  return b.build();
}

function dogGeometry(): BufferGeometry {
  const b = new Builder();
  b.box(-0.28, 0.24, 0.2, 0.4, -0.1, 0.1, 0xffffff);
  b.box(0.18, 0.4, 0.32, 0.52, -0.09, 0.09, 0xffffff);
  for (const x of [-0.2, 0.16]) b.box(x - 0.04, x + 0.04, 0, 0.22, -0.09, 0.09, 0xffffff);
  b.box(-0.4, -0.26, 0.36, 0.42, -0.03, 0.03, 0xffffff);
  return b.build();
}

function lampGeometry(): BufferGeometry {
  const b = new Builder();
  b.box(-0.06, 0.06, 0, 3.6, -0.06, 0.06, 0xffffff);
  b.box(-0.12, 0.12, 0, 0.5, -0.12, 0.12, 0xffffff);
  b.box(0, 1.0, 3.5, 3.6, -0.04, 0.04, 0xffffff);
  return b.build();
}

function signalPoleGeometry(): BufferGeometry {
  // Local +x faces the approaching traffic.
  const b = new Builder();
  b.box(-0.06, 0.06, 0, 2.2, -0.06, 0.06, 0xffffff);
  b.box(-0.1, 0.1, 2.15, 3.05, -0.16, 0.16, 0xffffff);
  return b.build();
}

// ---- city ----

export function createCity(options: CityOptions = {}): City {
  const seed = options.seed ?? 7;
  const bounds = options.bounds ?? CAMPUS_BOUNDS;
  const plan = cityPlan(bounds, seed);
  const sim: CitySim = createCitySim(plan, seed);
  const group = new Group();
  group.name = 'city';
  group.userData.pickable = false;

  const uniforms: HazeUniforms = {
    uHaze: { value: new Vector3(HAZE_DAY[0] / 255, HAZE_DAY[1] / 255, HAZE_DAY[2] / 255) },
    uCampus: { value: [bounds.x0, bounds.x1, bounds.z0, bounds.z1] },
    uHazeRange: { value: [HAZE_NEAR, HAZE_FAR] },
    uShade: { value: SHADE },
    uDim: { value: 0 },
  };
  const std = (params: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial => hazed(new MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...params }), uniforms);
  const basic = (params: ConstructorParameters<typeof MeshBasicMaterial>[0]): MeshBasicMaterial => hazed(new MeshBasicMaterial(params), uniforms);

  const vertexMat = std({ vertexColors: true });
  const add = <T extends Mesh>(m: T, name: string): T => {
    group.add(named(m, name));
    return m;
  };

  add(new Mesh(buildGround(plan), std({ vertexColors: true, roughness: 1 })), 'city-ground');
  const blds = buildBuildings(plan, seed);
  add(new Mesh(blds.body, vertexMat), 'city-buildings');
  const litMat = std({ color: C.windowGlass, roughness: 0.4, emissive: C.windowGlow, emissiveIntensity: 0 });
  const darkMat = std({ color: C.windowGlass, roughness: 0.4, emissive: 0x000000, emissiveIntensity: 0 });
  add(new Mesh(blds.lit, litMat), 'city-windows-lit');
  add(new Mesh(blds.dark, darkMat), 'city-windows-dark');
  add(new Mesh(buildProps(plan), vertexMat), 'city-props');

  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const v3 = new Vector3();
  const s3 = new Vector3();
  const col = new Color();
  const compose = (x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, sz = 1): Matrix4 => {
    q.setFromAxisAngle(up, yaw);
    return m4.compose(v3.set(x, y, z), q, s3.set(sx, sy, sz));
  };
  const pick = (list: readonly number[], i: number): number => list[((i % list.length) + list.length) % list.length] ?? 0xffffff;

  // Trees.
  const trunks = add(new InstancedMesh(new CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0), std({ color: C.trunk }), plan.trees.length), 'city-tree-trunks');
  const crowns = add(new InstancedMesh(new IcosahedronGeometry(1, 0), std({ color: 0xffffff, flatShading: true }), plan.trees.length), 'city-tree-crowns');
  plan.trees.forEach((t, i) => {
    trunks.setMatrixAt(i, compose(t.x, 0, t.z, 0, 1, t.h * 0.5, 1));
    const r = t.h * 0.3;
    crowns.setMatrixAt(i, compose(t.x, t.h * 0.68, t.z, 0, r, r, r));
    crowns.setColorAt(i, col.setHex(pick(C.crown, i)));
  });

  // Café umbrellas.
  const umbrellas = add(new InstancedMesh(new CylinderGeometry(0.04, 1.05, 0.32, 8).translate(0, 2.25, 0), std({ color: 0xffffff, flatShading: true }), Math.max(1, plan.tables.length)), 'city-umbrellas');
  umbrellas.count = plan.tables.length;
  plan.tables.forEach((t, i) => {
    umbrellas.setMatrixAt(i, compose(t.x, 0, t.z, 0));
    umbrellas.setColorAt(i, col.setHex(pick(C.umbrellas, t.tone)));
  });

  // Street lamps and their warm pools of light (night only).
  const lampPoles = add(new InstancedMesh(lampGeometry(), std({ color: C.pole }), plan.lamps.length), 'city-lamp-poles');
  const lampHeads = add(new InstancedMesh(new CylinderGeometry(0.26, 0.3, 0.12, 6), std({ color: C.lampHead, emissive: C.lampGlow, emissiveIntensity: 0 }), plan.lamps.length), 'city-lamp-heads');
  const poolMat = basic({ color: C.lampGlow, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
  const pools = add(new InstancedMesh(new CircleGeometry(2.4, 12).rotateX(-Math.PI / 2), poolMat, plan.lamps.length), 'city-lamp-pools');
  pools.visible = false;
  plan.lamps.forEach((l, i) => {
    const yaw = Math.atan2(-l.dz, l.dx);
    lampPoles.setMatrixAt(i, compose(l.x, 0, l.z, yaw));
    lampHeads.setMatrixAt(i, compose(l.x + l.dx * 0.95, 3.48, l.z + l.dz * 0.95, 0));
    pools.setMatrixAt(i, compose(l.x + l.dx * 0.95, 0.02, l.z + l.dz * 0.95, 0));
  });

  // Traffic lights: a pole and housing per head, three lamps on its face.
  const sigPoles = add(new InstancedMesh(signalPoleGeometry(), std({ color: C.pole }), plan.signals.length), 'city-signal-poles');
  const sigLamps = add(new InstancedMesh(new IcosahedronGeometry(0.1, 0), basic({ color: 0xffffff }), plan.signals.length * 3), 'city-signal-lamps');
  plan.signals.forEach((h, i) => {
    const yaw = Math.atan2(-h.fz, h.fx);
    sigPoles.setMatrixAt(i, compose(h.x, 0, h.z, yaw));
    [2.85, 2.6, 2.35].forEach((y, k) => {
      sigLamps.setMatrixAt(i * 3 + k, compose(h.x + h.fx * 0.11, y, h.z + h.fz * 0.11, 0));
      sigLamps.setColorAt(i * 3 + k, col.setHex(C.signalOff));
    });
  });
  const shown: (Signal | null)[] = plan.signals.map(() => null);
  const syncSignals = (): void => {
    let dirty = false;
    plan.signals.forEach((h, i) => {
      const s = signalState(sim, h.node, h.axis);
      if (shown[i] === s) return;
      shown[i] = s;
      dirty = true;
      (['red', 'yellow', 'green'] as const).forEach((lamp, k) => sigLamps.setColorAt(i * 3 + k, col.setHex(lamp === s ? C.signal[lamp] : C.signalOff)));
    });
    if (dirty && sigLamps.instanceColor) sigLamps.instanceColor.needsUpdate = true;
  };

  // Vehicles: one instanced mesh per kind, plus head/tail lights for all of them (night only).
  const vehicleMat = std({ vertexColors: true, roughness: 0.6 });
  const fleets = (['car', 'taxi', 'bus'] as const).map((kind) => {
    const list = sim.vehicles.filter((v) => v.kind === kind);
    const mesh = add(new InstancedMesh(vehicleGeometry(kind), vehicleMat, Math.max(1, list.length)), `city-${kind === 'bus' ? 'buses' : `${kind}s`}`);
    mesh.count = list.length;
    mesh.frustumCulled = false;
    const tones = kind === 'car' ? C.cars : kind === 'taxi' ? C.taxis : C.buses;
    list.forEach((v, i) => mesh.setColorAt(i, col.setHex(pick(tones, v.tone))));
    return { mesh, list };
  });
  const lightsMat = basic({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const lights = add(new InstancedMesh(vehicleLightGeometry(), lightsMat, sim.vehicles.length), 'city-vehicle-lights');
  lights.frustumCulled = false;
  lights.visible = false;

  // Bicycles (riders sit with the people below) and dogs.
  const bikes = add(new InstancedMesh(bikeGeometry(), vehicleMat, Math.max(1, sim.cyclists.length)), 'city-bikes');
  bikes.count = sim.cyclists.length;
  bikes.frustumCulled = false;
  sim.cyclists.forEach((c, i) => bikes.setColorAt(i, col.setHex(pick(C.accents, c.tone))));
  const walkers: Pedestrian[] = [...sim.pedestrians, ...sim.parkGoers];
  const dogOwners = walkers.filter((p) => p.dog);
  const dogs = add(new InstancedMesh(dogGeometry(), std({ color: 0xffffff }), Math.max(1, dogOwners.length)), 'city-dogs');
  dogs.count = dogOwners.length;
  dogs.frustumCulled = false;
  dogOwners.forEach((_, i) => dogs.setColorAt(i, col.setHex(pick(C.dogs, i))));

  // People: walkers, park goers, riders and the seated (one body and one head mesh for all).
  const people = walkers.length + sim.cyclists.length + plan.sitters.length;
  const peds = add(new InstancedMesh(new CylinderGeometry(0.15, 0.2, 1.2, 6).translate(0, 0.6, 0), std({ color: 0xffffff }), people), 'city-pedestrians');
  const heads = add(new InstancedMesh(new IcosahedronGeometry(0.13, 0).translate(0, 1.38, 0), std({ color: C.skin }), people), 'city-ped-heads');
  peds.frustumCulled = false;
  heads.frustumCulled = false;
  walkers.forEach((p, i) => peds.setColorAt(i, col.setHex(pick(C.clothes, p.tone))));
  sim.cyclists.forEach((c, i) => peds.setColorAt(walkers.length + i, col.setHex(pick(C.clothes, c.tone + 2))));
  const seated0 = walkers.length + sim.cyclists.length;
  plan.sitters.forEach((s, i) => {
    // Seated: shorter body on the seat.
    const m = compose(s.x, 0.3, s.z, s.yaw, 1, 0.72, 1);
    peds.setMatrixAt(seated0 + i, m);
    heads.setMatrixAt(seated0 + i, m);
    peds.setColorAt(seated0 + i, col.setHex(pick(C.clothes, s.tone)));
  });

  const syncMovers = (): void => {
    for (const { mesh, list } of fleets) {
      list.forEach((v, i) => mesh.setMatrixAt(i, compose(v.x, 0, v.z, v.yaw)));
      mesh.instanceMatrix.needsUpdate = true;
    }
    sim.vehicles.forEach((v, i) => {
      const w = v.kind === 'bus' ? 2.0 / 1.8 : 1;
      lights.setMatrixAt(i, compose(v.x, 0, v.z, v.yaw, v.length + 0.02, v.kind === 'bus' ? 1.2 : 1, w));
    });
    lights.instanceMatrix.needsUpdate = true;
    walkers.forEach((p, i) => {
      const bob = p.walking ? Math.abs(Math.sin(p.phase)) * (p.jog ? 0.09 : 0.04) : 0;
      const m = compose(p.x, bob, p.z, p.yaw);
      peds.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
    });
    sim.cyclists.forEach((c, i) => {
      bikes.setMatrixAt(i, compose(c.x, 0, c.z, c.yaw));
      const m = compose(c.x - Math.cos(c.yaw) * 0.12, 0.62, c.z + Math.sin(c.yaw) * 0.12, c.yaw, 1, 0.8, 1);
      peds.setMatrixAt(walkers.length + i, m);
      heads.setMatrixAt(walkers.length + i, m);
    });
    bikes.instanceMatrix.needsUpdate = true;
    dogOwners.forEach((p, i) => {
      // Trotting just ahead and to the outside of the owner.
      const fx = Math.cos(p.yaw);
      const fz = -Math.sin(p.yaw);
      const off = 0.35;
      dogs.setMatrixAt(i, compose(p.x + fx * 0.9 - fz * off, 0, p.z + fz * 0.9 + fx * off, p.yaw));
    });
    dogs.instanceMatrix.needsUpdate = true;
    peds.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };
  syncMovers();
  syncSignals();

  let reduced = false;
  let org = false;
  const dayHaze = new Vector3(HAZE_DAY[0] / 255, HAZE_DAY[1] / 255, HAZE_DAY[2] / 255);
  const nightHaze = new Vector3(HAZE_NIGHT[0] / 255, HAZE_NIGHT[1] / 255, HAZE_NIGHT[2] / 255);

  return {
    group,
    step(dt) {
      if (reduced || org || !(dt > 0)) return;
      stepCitySim(sim, dt);
      syncMovers();
      syncSignals();
    },
    setNight(on) {
      const n = typeof on === 'boolean' ? (on ? 1 : 0) : Math.min(1, Math.max(0, Number.isFinite(on) ? on : 0));
      litMat.emissiveIntensity = 1.05 * n;
      lampHeads.material.emissiveIntensity = 1.8 * n;
      poolMat.opacity = 0.3 * n;
      pools.visible = n > 0.02;
      lightsMat.opacity = n;
      lights.visible = n > 0.02;
      uniforms.uHaze.value.lerpVectors(dayHaze, nightHaze, n);
    },
    setOrg(on) {
      org = on;
      uniforms.uDim.value = on ? ORG_DIM : 0;
    },
    setReducedMotion(on) {
      reduced = on;
    },
  };
}

