// City life around the campus (KARARLAR rev 31; calm, prestige and warmth rework rev 33; luxury and
// realism rev 37): a grand tree-lined boulevard ring with stone paving and granite kerbs, refined stone and
// glass mid-rises (vertical fins, boutique arcades with awnings and warm interiors, setback terraces, roof
// gardens), glass towers further back, a grand hotel with a porte-cochère and a doorman, a landscaped plaza
// with a sculpture and a reflecting pool, premium cars, well-dressed people, café terraces.
// Warm, light diorama palette under a light, warm atmospheric fade toward the page background: lighter and
// lower in contrast than the campus, so the tower and the wing stay the focus. Procedural geometry only,
// merged static meshes and instancing; nothing here is pickable and nothing casts or receives shadows.
//
// Ruling: the fade is a per-material shader mix (onBeforeCompile) keyed on the distance to the campus
// footprint, not scene.fog — the scene (src/app) owns the fog slot and the tower must stay unfogged — if
// wrong, swap the mix for scene.fog in one place.
// Ruling: arcades, fins, balconies, awnings, cornices, mansards and roof planters stay inside each plan
// footprint and below its plan height, so the occlusion check on the plan boxes still covers them — if
// wrong, they would need their own boxes in the test.
// Ruling: thin street furniture (lamp and signal poles, bollards, <= 0.3 m) is not part of the occlusion
// check; like a real foreground pole it may cross a wall edge in a low orbit view — if wrong, move them.
// Ruling: each vehicle body style is a paint mesh (instance colour = paint) plus a trim mesh (glass, tyres,
// alloys, chrome, lenses) sharing its matrices, so trim keeps its own colours — if wrong, merge per style.
// Ruling: paints keep the rev 33 mood floor (sRGB lightness >= 0.55); graphite, navy and racing green read
// deep through a metallic, low-roughness paint instead of a dark base colour — if wrong, lower the floor.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
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
  BODY_SPECS,
  CROSSWALK_WIDTH,
  ROAD_HALF,
  STOP_DIST,
  STOREY,
  WALK_WIDTH,
  type BodyStyle,
  type Building,
  type Pedestrian,
  cityPlan,
  createCitySim,
  signalState,
  stepCitySim,
  type CityPlan,
  type CityRect,
  type CitySim,
  type Signal,
} from '../sim/citySim';
import { createRng, type Rng } from './rng';

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

/** Refined car paints (rev 37); every one stays at or above the mood floor. */
export const CAR_PAINTS = {
  pearl: 0xf2efe8,
  silver: 0xc9ccd0,
  graphite: 0x8d9096,
  navy: 0x7286ab,
  champagne: 0xd8c9a8,
  racingGreen: 0x78a389,
} as const;
const P = CAR_PAINTS;
const PAINTS: Record<BodyStyle, readonly number[]> = {
  sedan: [P.pearl, P.graphite, P.navy, P.champagne, P.silver],
  tourer: [P.racingGreen, P.graphite, P.pearl, P.navy],
  suv: [P.pearl, P.graphite, P.navy, P.silver],
  convertible: [P.champagne, P.racingGreen, P.pearl],
  limousine: [P.graphite, P.navy, P.pearl],
  shuttle: [P.pearl, P.champagne],
};
const FLEET: readonly (readonly [BodyStyle, string])[] = [
  ['sedan', 'city-cars'],
  ['tourer', 'city-tourers'],
  ['suv', 'city-suvs'],
  ['convertible', 'city-convertibles'],
  ['limousine', 'city-taxis'],
  ['shuttle', 'city-buses'],
];

// ---- palette: warm, light stone and glass, same family as the tower (src/scene/furniture.ts PALETTE) ----
const C = {
  base: 0xeadfc8,
  lawn: 0xcfdcae,
  plaza: 0xf4ecdd,
  road: 0xcfc7ba,
  walk: [0xefe6d5, 0xe7dcc8] as const,
  kerb: 0xd6d0c5,
  pavers: 0xe0d0b6,
  drive: 0xd9d1c4,
  marking: 0xfbf8f1,
  bike: 0xe3b9a0,
  median: 0xbcd197,
  grass: 0xc2d89d,
  path: 0xf0e4ca,
  water: 0xa7d6e2,
  stone: 0xf6f0e4,
  granite: 0xd8d1c6,
  roof: 0xe9dcc6,
  frame: 0xe2ddd3,
  bronze: 0xcdb592,
  zinc: 0xc4c7c9,
  hotel: 0xf4ebdc,
  trunk: 0xa88a69,
  crown: [0x9fc487, 0xb5d394, 0x8cbb80, 0xc4d99a],
  hedge: 0xa9c98d,
  flowers: [0xf3b9c4, 0xf7da8c, 0xcdb9e6, 0xf5c8a6],
  pole: 0x8f8170,
  lampHead: 0xfbf3e2,
  windowGlass: 0xa9cfdf,
  windowGlow: 0xffc982,
  shopGlass: 0xeedcbf,
  shopGlow: 0xffc27a,
  lampGlow: 0xffd9a0,
  buildings: [0xf3e7d1, 0xead8bd, 0xf6efe3, 0xe8ccb3, 0xdcd8c8, 0xf0dcc6],
  accents: [0x8fae94, 0x8a9cb8, 0xc28f8f, 0xd9c29a],
  umbrellas: [0xf7f1e6, 0xd9c29a, 0xb7d1a5, 0xe6d3c0],
  clothes: [0xc8a27a, 0x7d8fb0, 0xd9d0c1, 0xf1ebe0, 0xb88486, 0x9db39d, 0x9a9ca0],
  trousers: [0x5f6470, 0x8c8170, 0x6d7385, 0xb7ab97],
  livery: 0xb07f84,
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

type Col = number | Color;
type V3 = readonly [number, number, number];
/** Loft station: x, bottom and top height, half widths at the bottom and the top (symmetric about z = 0). */
interface Station {
  readonly x: number;
  readonly y0: number;
  readonly y1: number;
  readonly w0: number;
  readonly w1: number;
}

class Builder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private c = new Color();

  private quad(p: readonly number[], n: V3, color: Col | readonly Color[]): void {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      if (Array.isArray(color)) this.c.copy(color[i] ?? color[0] ?? this.c);
      else if (color instanceof Color) this.c.copy(color);
      else if (typeof color === 'number') this.c.setHex(color);
      this.pos.push(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0, p[i * 3 + 2] ?? 0);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Quad through four corners; its normal comes from the winding and is flipped to face `want` if given. */
  q4(a: V3, b: V3, c: V3, d: V3, color: Col | readonly Color[], want?: V3): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: [number, number, number] = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) {
      this.quad([...d, ...c, ...b, ...a], [-n[0], -n[1], -n[2]], Array.isArray(color) ? [...color].reverse() : color);
      return;
    }
    this.quad([...a, ...b, ...c, ...d], n, color);
  }

  /** Horizontal quad facing up. */
  flat(x0: number, x1: number, z0: number, z1: number, y: number, color: Col): void {
    this.quad([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], [0, 1, 0], color);
  }

  /** Vertical quad on the plane x = const (facing sign) or z = const. */
  wall(axis: 'x' | 'z', at: number, a0: number, a1: number, y0: number, y1: number, facing: 1 | -1, color: Col | readonly Color[]): void {
    if (axis === 'x') {
      const [za, zb] = facing > 0 ? [a1, a0] : [a0, a1];
      this.quad([at, y0, za, at, y0, zb, at, y1, zb, at, y1, za], [facing, 0, 0], color);
    } else {
      const [xa, xb] = facing > 0 ? [a0, a1] : [a1, a0];
      this.quad([xa, y0, at, xb, y0, at, xb, y1, at, xa, y1, at], [0, 0, facing], color);
    }
  }

  /** Axis-aligned box (bottom face omitted unless asked). */
  box(xa: number, xb: number, y0: number, y1: number, za: number, zb: number, color: Col, bottom = false): void {
    const [x0, x1] = xa <= xb ? [xa, xb] : [xb, xa];
    const [z0, z1] = za <= zb ? [za, zb] : [zb, za];
    this.flat(x0, x1, z0, z1, y1, color);
    this.wall('x', x1, z0, z1, y0, y1, 1, color);
    this.wall('x', x0, z0, z1, y0, y1, -1, color);
    this.wall('z', z1, x0, x1, y0, y1, 1, color);
    this.wall('z', z0, x0, x1, y0, y1, -1, color);
    if (bottom) this.quad([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], color);
  }

  /** Vertical fin on a z face: front and two sides (top hidden), from the wall at `at` out to `out`. */
  fin(x: number, half: number, at: number, out: number, y0: number, y1: number, color: Col): void {
    const fc: 1 | -1 = out > at ? 1 : -1;
    const [za, zb] = at < out ? [at, out] : [out, at];
    this.wall('z', out, x - half, x + half, y0, y1, fc, color);
    this.wall('x', x + half, za, zb, y0, y1, 1, color);
    this.wall('x', x - half, za, zb, y0, y1, -1, color);
  }

  /** Box turned by `yaw` about its centre (sculpture slabs). */
  obox(cx: number, cz: number, hx: number, hz: number, y0: number, y1: number, yaw: number, color: Col): void {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const p = (u: number, v: number, y: number): V3 => [cx + u * c - v * s, y, cz + u * s + v * c];
    const corners: [number, number][] = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let i = 0; i < 4; i++) {
      const [u0, v0] = corners[i]!;
      const [u1, v1] = corners[(i + 1) % 4]!;
      const mid = p((u0 + u1) / 2, (v0 + v1) / 2, 0);
      this.q4(p(u0, v0, y0), p(u1, v1, y0), p(u1, v1, y1), p(u0, v0, y1), color, [mid[0] - cx, 0, mid[2] - cz]);
    }
    this.q4(p(-hx, hz, y1), p(hx, hz, y1), p(hx, -hz, y1), p(-hx, -hz, y1), color, [0, 1, 0]);
  }

  /** Lofted body along x through `st` (top and both sides; end caps when asked), centred on z = 0. */
  loft(st: readonly Station[], color: Col, caps = true, dz = 0): void {
    for (let i = 0; i + 1 < st.length; i++) {
      const a = st[i]!;
      const b = st[i + 1]!;
      this.q4([a.x, a.y1, dz + a.w1], [b.x, b.y1, dz + b.w1], [b.x, b.y1, dz - b.w1], [a.x, a.y1, dz - a.w1], color, [0, 1, 0]);
      this.q4([a.x, a.y0, dz + a.w0], [b.x, b.y0, dz + b.w0], [b.x, b.y1, dz + b.w1], [a.x, a.y1, dz + a.w1], color, [0, 0, 1]);
      this.q4([b.x, b.y0, dz - b.w0], [a.x, a.y0, dz - a.w0], [a.x, a.y1, dz - a.w1], [b.x, b.y1, dz - b.w1], color, [0, 0, -1]);
    }
    if (!caps) return;
    const f = st[st.length - 1];
    const r = st[0];
    if (f) this.q4([f.x, f.y0, dz + f.w0], [f.x, f.y0, dz - f.w0], [f.x, f.y1, dz - f.w1], [f.x, f.y1, dz + f.w1], color, [1, 0, 0]);
    if (r) this.q4([r.x, r.y0, dz - r.w0], [r.x, r.y0, dz + r.w0], [r.x, r.y1, dz + r.w1], [r.x, r.y1, dz - r.w1], color, [-1, 0, 0]);
  }

  /** Fan in a plane: centre `c`, axes `u` and `v`; ring vertices alternate between `rim` and `alt`. */
  fan(c: V3, u: V3, v: V3, r: number, n: number, normal: V3, centre: Col, rim: Col, alt: Col = rim): void {
    const base = this.pos.length / 3;
    const put = (p: V3, color: Col): void => {
      if (color instanceof Color) this.c.copy(color);
      else this.c.setHex(color);
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(normal[0], normal[1], normal[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    };
    put(c, centre);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * r;
      put([c[0] + u[0] * ca + v[0] * sa, c[1] + u[1] * ca + v[1] * sa, c[2] + u[2] * ca + v[2] * sa], i % 2 === 0 ? rim : alt);
    }
    // Wind counter-clockwise about `normal` (u x v points along the normal or against it).
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const ccw = cr[0]! * normal[0] + cr[1]! * normal[1] + cr[2]! * normal[2] > 0;
    for (let i = 0; i < n; i++) {
      const a = base + 1 + i;
      const b = base + 1 + ((i + 1) % n);
      if (ccw) this.idx.push(base, a, b);
      else this.idx.push(base, b, a);
    }
  }

  /** Flat n-gon facing up. */
  disc(cx: number, cz: number, r: number, y: number, n: number, color: Col): void {
    this.fan([cx, y, cz], [1, 0, 0], [0, 0, 1], r, n, [0, 1, 0], color, color);
  }

  /** Upright n-sided prism with a top (round basins, columns, posts). */
  prism(cx: number, cz: number, r: number, y0: number, y1: number, n: number, color: Col): void {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const m = (a0 + a1) / 2;
      const p = (a: number, y: number): number[] => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad([...p(a1, y0), ...p(a0, y0), ...p(a0, y1), ...p(a1, y1)], [Math.cos(m), 0, Math.sin(m)], color);
    }
    this.disc(cx, cz, r, y1, n, color);
  }

  /** Wheel on the z axis: tyre tread, the tyre wall and an alloy face with spokes on the outer side `s`. */
  wheel(x: number, z: number, r: number, w: number, s: 1 | -1, tyre: Col, alloy: Col, spoke: Col): void {
    const n = 8;
    const zi = z - (s * w) / 2;
    const zo = z + (s * w) / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const m = (a0 + a1) / 2;
      const p = (a: number, zz: number): V3 => [x + Math.cos(a) * r, r + Math.sin(a) * r, zz];
      this.q4(p(a0, zi), p(a1, zi), p(a1, zo), p(a0, zo), tyre, [Math.cos(m), Math.sin(m), 0]);
    }
    this.fan([x, r, zo], [1, 0, 0], [0, 1, 0], r, n, [0, 0, s], tyre, tyre);
    this.fan([x, r, zo + s * 0.006], [1, 0, 0], [0, 1, 0], r * 0.68, 10, [0, 0, s], spoke, alloy, spoke);
  }

  get vertexCount(): number {
    return this.pos.length / 3;
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

/** Pieces of [a0, a1] with `keep` cut out around each cut. */
function pieces(a0: number, a1: number, cuts: readonly number[], keep: number): [number, number][] {
  const out: [number, number][] = [];
  let s = a0;
  for (const c of [...cuts].sort((p, q) => p - q)) {
    if (c - keep > s) out.push([s, c - keep]);
    s = Math.max(s, c + keep);
  }
  if (a1 > s) out.push([s, a1]);
  return out;
}

// ---- static parts ----

function buildGround(plan: CityPlan): BufferGeometry {
  const b = new Builder();
  const e = plan.extent;
  const R = ROAD_HALF;
  const r = plan.ring;
  b.flat(e.x0, e.x1, e.z0, e.z1, -0.07, C.base);
  // Every block is a soft lawn under its buildings (courtyards, front gardens, open lots).
  for (const bl of plan.blocks) b.flat(bl.x0, bl.x1, bl.z0, bl.z1, -0.062, C.lawn);
  // Campus plaza: the whole centre block inside the ring sidewalks.
  b.flat(r.w + R + WALK_WIDTH, r.e - R - WALK_WIDTH, r.n + R + WALK_WIDTH, r.s - R - WALK_WIDTH, -0.06, C.plaza);
  // Limestone sidewalks in 3 m slabs of two tones (cut where a road crosses).
  for (const s of plan.sidewalks) {
    const alongX = s.x1 - s.x0 > s.z1 - s.z0;
    const cuts = alongX ? [r.w, r.e] : [r.n, r.s];
    for (const [a0, a1] of pieces(alongX ? s.x0 : s.z0, alongX ? s.x1 : s.z1, cuts, R)) {
      for (let t = a0, k = 0; t < a1 - 1e-6; t += 3, k++) {
        const t1 = Math.min(a1, t + 3);
        const tone = C.walk[k % 2] ?? C.walk[0];
        if (alongX) b.flat(t, t1, s.z0, s.z1, -0.055, tone);
        else b.flat(s.x0, s.x1, t, t1, -0.055, tone);
      }
    }
  }
  for (const road of plan.roads) b.flat(road.x0, road.x1, road.z0, road.z1, -0.05, C.road);
  for (const l of plan.bikeLanes) b.flat(l.x0, l.x1, l.z0, l.z1, -0.047, C.bike);
  for (const m of plan.medians) b.flat(m.x0, m.x1, m.z0, m.z1, -0.046, C.median);
  // Granite kerbs along both road edges, dropped at the crosswalks.
  const K = 0.25;
  const keep = R + CROSSWALK_WIDTH;
  for (const z of [r.n, r.s]) for (const [a0, a1] of pieces(e.x0, e.x1, [r.w, r.e], keep)) for (const sgn of [-1, 1]) b.box(a0, a1, -0.06, 0.05, z + sgn * R, z + sgn * (R + K), C.kerb);
  for (const x of [r.w, r.e]) for (const [a0, a1] of pieces(e.z0, e.z1, [r.n, r.s], keep)) for (const sgn of [-1, 1]) b.box(x + sgn * R, x + sgn * (R + K), -0.06, 0.05, a0, a1, C.kerb);
  // Park lawn, cross paths, the stone plaza with a granite border and the promenade along the pond.
  const p = plan.park;
  b.flat(p.x0, p.x1, p.z0, p.z1, -0.048, C.grass);
  const pc = { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
  b.flat(p.x0, p.x1, pc.z - 0.9, pc.z + 0.9, -0.045, C.path);
  b.flat(pc.x - 0.9, pc.x + 0.9, p.z0, p.z1, -0.045, C.path);
  b.flat(plan.pond.x0 - 1, plan.pond.x1 + 1, plan.pond.z0 - 1.6, plan.pond.z0 - 0.4, -0.045, C.path);
  const pz = plan.plaza;
  b.flat(pz.x0, pz.x1, pz.z0, pz.z1, -0.044, C.granite);
  b.flat(pz.x0 + 0.5, pz.x1 - 0.5, pz.z0 + 0.5, pz.z1 - 0.5, -0.042, C.plaza);
  // Hotel forecourt: warm granite pavers with a pale drive loop under the porte-cochère.
  const f = plan.hotel.forecourt;
  const cn = plan.hotel.canopy;
  b.flat(f.x0, f.x1, f.z0, f.z1, -0.058, C.pavers);
  b.flat(cn.x0 - 1.5, cn.x1 + 1.5, f.z0 + 0.4, f.z1, -0.056, C.drive);
  // Stop lines across each approach lane (right of the heading).
  for (const n of plan.intersections) {
    const s = STOP_DIST - 0.25;
    b.flat(n.x - s - 0.3, n.x - s, n.z, n.z + R - 1.6, -0.044, C.marking); // eastbound
    b.flat(n.x + s, n.x + s + 0.3, n.z - R + 1.6, n.z, -0.044, C.marking); // westbound
    b.flat(n.x - R + 1.6, n.x, n.z - s - 0.3, n.z - s, -0.044, C.marking); // southbound
    b.flat(n.x, n.x + R - 1.6, n.z + s, n.z + s + 0.3, -0.044, C.marking); // northbound
  }
  // Zebra crosswalks: stripes run along the walking direction.
  for (const c of plan.crosswalks) {
    if (c.walk === 'z') for (let z = c.z0 + 0.25; z < c.z1 - 0.3; z += 1.0) b.flat(c.x0 + 0.15, c.x1 - 0.15, z, z + 0.5, -0.043, C.marking);
    else for (let x = c.x0 + 0.25; x < c.x1 - 0.3; x += 1.0) b.flat(x, x + 0.5, c.z0 + 0.15, c.z1 - 0.15, -0.043, C.marking);
  }
  return b.build();
}

interface Facades {
  body: Builder;
  lit: Builder;
  dark: Builder;
  /** Boutique fronts, lobbies and canopy fascia: warm interiors. */
  front: Builder;
  rng: Rng;
}
const GI = 1.5; // ground-floor inset on the z faces (arcade or shop-front depth)
const ZI = 0.6; // upper-floor inset on the z faces (balcony and fin depth)

function win(f: Facades, axis: 'x' | 'z', at: number, c: number, half: number, y0: number, y1: number, facing: 1 | -1, share = LIT_SHARE): void {
  (f.rng() < share ? f.lit : f.dark).wall(axis, at, c - half, c + half, y0, y1, facing, C.windowGlass);
}

/** Boutique row on both z faces: display windows with warm interiors, a bronze sign bar, awnings unless arcaded. */
function boutiques(f: Facades, bd: Building, bays: number, awnings: boolean): void {
  const { x0, x1, z0, z1 } = bd;
  const step = (x1 - x0) / bays;
  for (const [at, fc] of [[z0 + GI, -1], [z1 - GI, 1]] as const) {
    for (let i = 0; i < bays; i++) {
      const c = x0 + step * (i + 0.5);
      f.front.wall('z', at + fc * 0.03, c - step * 0.36, c + step * 0.36, 0.2, 2.55, fc, C.shopGlass);
      f.body.wall('z', at + fc * 0.02, c - step * 0.22, c + step * 0.22, 2.72, 2.92, fc, C.bronze);
      if (!awnings) continue;
      const [za, zb] = fc < 0 ? [z0 + 0.4, at] : [at, z1 - 0.4];
      f.body.box(c - step * 0.42, c + step * 0.42, 2.6, 2.7, za, zb, C.accents[(bd.tone + i) % C.accents.length] ?? C.accents[0]);
    }
  }
}

/** Refined mid-rise: boutique ground floor, stone upper floors with fins or balconies, cornice, setback penthouse, roof garden. */
function midrise(f: Facades, bd: Building): void {
  const { body } = f;
  const tone = C.buildings[bd.tone % C.buildings.length] ?? C.buildings[0];
  const { x0, x1, z0, z1 } = bd;
  const F = bd.floors;
  const pent = F >= 3;
  const mainTop = (pent ? F - 1 : F) * STOREY;
  const zi = F >= 2 ? ZI : GI;
  const bays = Math.max(1, Math.floor((x1 - x0 - 0.8) / 2.6));
  const step = (x1 - x0) / bays;
  const fins = F >= 3 && bd.tone % 2 === 0;
  const arcade = F >= 2 && bd.tone % 3 === 0;
  body.box(x0, x1, 0, Math.min(STOREY, mainTop), z0 + GI, z1 - GI, tone);
  boutiques(f, bd, bays, !arcade);
  if (F >= 2) {
    if (arcade) {
      const n = Math.max(2, Math.round((x1 - x0) / 3.6) + 1);
      for (let i = 0; i < n; i++) {
        const x = x0 + 0.22 + ((x1 - x0 - 0.44) * i) / (n - 1);
        for (const z of [z0 + ZI + 0.2, z1 - ZI - 0.2]) body.box(x - 0.17, x + 0.17, 0, STOREY - 0.25, z - 0.17, z + 0.17, C.stone);
      }
    }
    body.box(x0, x1, STOREY - 0.25, STOREY, z0 + ZI, z1 - ZI, C.stone);
    body.box(x0, x1, STOREY, mainTop, z0 + ZI, z1 - ZI, tone);
    const upper = mainTop / STOREY;
    for (let fl = 1; fl < upper; fl++) {
      const y = fl * STOREY;
      for (const [at, out, fc] of [[z0 + ZI, z0 + 0.04, -1], [z1 - ZI, z1 - 0.04, 1]] as const) {
        for (let i = 0; i < bays; i++) {
          const c = x0 + step * (i + 0.5);
          win(f, 'z', at + fc * 0.03, c, step * 0.3, y + 0.35, y + 2.9, fc);
          if (fins || (i + fl) % 2 !== 0) continue;
          // Balcony: stone slab and a glass-topped stone railing within the inset, now and then a planter.
          const [za, zb] = fc < 0 ? [out, at] : [at, out];
          body.box(c - 0.85, c + 0.85, y, y + 0.12, za, zb, C.stone);
          body.wall('z', out, c - 0.85, c + 0.85, y + 0.12, y + 1.0, fc, C.stone);
          if (f.rng() < 0.4) body.box(c - 0.7, c - 0.3, y + 0.12, y + 0.5, za + 0.06, zb - 0.06, C.hedge);
        }
      }
      const nz = Math.max(1, Math.floor((z1 - z0 - 2 * ZI - 0.8) / 2.6));
      const sz = (z1 - z0 - 2 * ZI) / nz;
      for (let i = 0; i < nz; i++) {
        const c = z0 + ZI + sz * (i + 0.5);
        win(f, 'x', x1 + 0.03, c, 0.55, y + 0.5, y + 2.7, 1);
        win(f, 'x', x0 - 0.03, c, 0.55, y + 0.5, y + 2.7, -1);
      }
    }
    if (fins) {
      // Vertical bronze fins between the bays from the first floor up to the cornice.
      for (const [at, out] of [[z0 + ZI, z0 + 0.2], [z1 - ZI, z1 - 0.2]] as const) for (let i = 0; i <= bays; i++) body.fin(Math.min(x1 - 0.09, Math.max(x0 + 0.09, x0 + step * i)), 0.08, at, out, STOREY, mainTop, C.bronze);
    }
  }
  // Stone cornice and the roof terrace with planters.
  const cz = Math.max(0, zi - 0.25);
  body.box(x0, x1, mainTop, mainTop + 0.25, z0 + cz, z1 - cz, C.stone);
  const ry = mainTop + 0.25;
  for (const [za, zb] of [[z0 + cz + 0.1, z0 + cz + 0.55], [z1 - cz - 0.55, z1 - cz - 0.1]] as const) {
    body.box(x0 + 0.4, x1 - 0.4, ry, ry + 0.22, za, zb, C.stone);
    body.box(x0 + 0.45, x1 - 0.45, ry + 0.22, ry + 0.35, za + 0.05, zb - 0.05, C.hedge);
  }
  if (pent) {
    // Setback glass penthouse with its own thin roof and a planted terrace around it.
    const PS = 1.4;
    const [px0, px1, pz0, pz1] = [x0 + PS, x1 - PS, z0 + cz + PS, z1 - cz - PS];
    body.box(px0, px1, ry, F * STOREY, pz0, pz1, C.stone);
    body.box(px0 - 0.2, px1 + 0.2, F * STOREY, F * STOREY + 0.2, pz0 - 0.2, pz1 + 0.2, tone);
    body.flat(px1 + 0.2, x1 - 0.4, z0 + cz + 0.6, z1 - cz - 0.6, ry + 0.01, C.lawn);
    win(f, 'z', pz1 + 0.03, (px0 + px1) / 2, (px1 - px0) / 2 - 0.3, ry + 0.3, F * STOREY - 0.3, 1, 0.8);
    win(f, 'z', pz0 - 0.03, (px0 + px1) / 2, (px1 - px0) / 2 - 0.3, ry + 0.3, F * STOREY - 0.3, -1, 0.8);
  } else if (f.rng() < 0.7) {
    // Roof garden: lawn and clipped shrubs.
    body.flat(x0 + 0.4, x1 - 0.4, z0 + cz + 0.7, z1 - cz - 0.7, ry + 0.01, C.lawn);
    body.box(x0 + 0.8, x0 + 1.6, ry, Math.min(ry + 0.5, bd.h), z0 + cz + 1.0, z0 + cz + 1.8, C.hedge);
  }
}

/** Glass tower: stone podium with a lobby, glass curtain wall in floor bands, slim mullion fins, a crown with a roof garden. */
function tower(f: Facades, bd: Building): void {
  const { body } = f;
  const { x0, x1, z0, z1 } = bd;
  const F = bd.floors;
  const top = F * STOREY;
  const S = 0.5;
  body.box(x0 + 0.2, x1 - 0.2, 0, STOREY, z0 + 0.2, z1 - 0.2, C.stone);
  for (const [at, fc] of [[z0 + 0.17, -1], [z1 - 0.17, 1]] as const) f.front.wall('z', at, x0 + 1, x1 - 1, 0.2, STOREY - 0.5, fc, C.shopGlass);
  body.box(x0 + S, x1 - S, STOREY, top, z0 + S, z1 - S, C.frame);
  for (let fl = 1; fl < F; fl++) {
    const y = fl * STOREY;
    const share = 0.5;
    win(f, 'z', z0 + S - 0.02, (x0 + x1) / 2, (x1 - x0) / 2 - S - 0.05, y + 0.25, y + STOREY - 0.08, -1, share);
    win(f, 'z', z1 - S + 0.02, (x0 + x1) / 2, (x1 - x0) / 2 - S - 0.05, y + 0.25, y + STOREY - 0.08, 1, share);
    win(f, 'x', x0 + S - 0.02, (z0 + z1) / 2, (z1 - z0) / 2 - S - 0.05, y + 0.25, y + STOREY - 0.08, -1, share);
    win(f, 'x', x1 - S + 0.02, (z0 + z1) / 2, (z1 - z0) / 2 - S - 0.05, y + 0.25, y + STOREY - 0.08, 1, share);
  }
  const n = Math.max(2, Math.round((x1 - x0 - 2 * S) / 2.2));
  for (const [at, out] of [[z0 + S, z0 + 0.22], [z1 - S, z1 - 0.22]] as const) for (let i = 1; i < n; i++) body.fin(x0 + S + ((x1 - x0 - 2 * S) * i) / n, 0.06, at, out, STOREY, top, C.frame);
  body.box(x0 + S - 0.1, x1 - S + 0.1, top, bd.h - 0.15, z0 + S - 0.1, z1 - S + 0.1, C.stone);
  body.box(x0 + S + 0.3, x1 - S - 0.3, bd.h - 0.15, bd.h, z0 + S + 0.3, z1 - S - 0.3, C.hedge);
}

/** Grand hotel block: rusticated stone base with a glowing lobby, balconied front, cornice and a zinc mansard. */
function hotelBlock(f: Facades, bd: Building, front: boolean): void {
  const { body } = f;
  const { x0, x1, z0, z1 } = bd;
  const F = bd.floors;
  const I = 0.1;
  const FI = 0.8;
  const walls = (F >= 3 ? F - 1 : F) * STOREY;
  const bays = Math.max(2, Math.floor((x1 - x0) / 3.2));
  const step = (x1 - x0) / bays;
  body.box(x0 + I, x1 - I, 0, STOREY, z0 + I, z1 - I, C.hotel);
  body.box(x0 + I, x1 - I, STOREY - 0.3, STOREY, z0 + I, z1 - I, C.stone);
  for (let i = 0; i < bays; i++) {
    const c = x0 + step * (i + 0.5);
    if (front) f.front.wall('z', z1 - I + 0.02, c - step * 0.3, c + step * 0.3, 0.1, 3.0, 1, C.shopGlass);
    else win(f, 'z', z1 - I + 0.02, c, step * 0.22, 0.6, 2.8, 1, 0.8);
  }
  if (walls > STOREY) body.box(x0 + I, x1 - I, STOREY, walls, z0 + I, z1 - FI, C.hotel);
  for (let fl = 1; fl < walls / STOREY; fl++) {
    const y = fl * STOREY;
    for (let i = 0; i < bays; i++) {
      const c = x0 + step * (i + 0.5);
      win(f, 'z', z1 - FI + 0.03, c, 0.6, y + 0.3, y + 2.7, 1, 0.78);
      win(f, 'z', z0 + I - 0.03, c, 0.6, y + 0.5, y + 2.6, -1, 0.78);
      body.box(c - 0.95, c + 0.95, y, y + 0.14, z1 - FI, z1 - I - 0.05, C.stone);
      body.wall('z', z1 - I - 0.05, c - 0.95, c + 0.95, y + 0.14, y + 1.0, 1, C.bronze);
    }
    const nz = Math.max(1, Math.floor((z1 - z0) / 3.2));
    for (let i = 0; i < nz; i++) {
      const c = z0 + ((z1 - z0) * (i + 0.5)) / nz;
      win(f, 'x', x1 - I + 0.03, c, 0.55, y + 0.5, y + 2.6, 1, 0.78);
      win(f, 'x', x0 + I - 0.03, c, 0.55, y + 0.5, y + 2.6, -1, 0.78);
    }
  }
  body.box(x0, x1, walls, walls + 0.3, z0, z1 - FI + 0.3, C.stone);
  if (F >= 3) {
    // Zinc mansard over the top floor with a row of lit dormers on the street side.
    const m = 0.9;
    const y0 = walls + 0.3;
    const y1 = bd.h;
    const zf = z1 - FI + 0.2;
    body.q4([x0 + 0.2, y0, zf], [x1 - 0.2, y0, zf], [x1 - m, y1, zf - m], [x0 + m, y1, zf - m], C.zinc, [0, 0.6, 1]);
    body.q4([x1 - 0.2, y0, z0 + 0.2], [x0 + 0.2, y0, z0 + 0.2], [x0 + m, y1, z0 + m], [x1 - m, y1, z0 + m], C.zinc, [0, 0.6, -1]);
    body.q4([x1 - 0.2, y0, zf], [x1 - 0.2, y0, z0 + 0.2], [x1 - m, y1, z0 + m], [x1 - m, y1, zf - m], C.zinc, [1, 0.6, 0]);
    body.q4([x0 + 0.2, y0, z0 + 0.2], [x0 + 0.2, y0, zf], [x0 + m, y1, zf - m], [x0 + m, y1, z0 + m], C.zinc, [-1, 0.6, 0]);
    body.flat(x0 + m, x1 - m, z0 + m, zf - m, y1, C.zinc);
    for (let i = 0; i < bays; i++) win(f, 'z', zf - m * 0.45 + 0.02, x0 + step * (i + 0.5), 0.45, y0 + 0.4, y0 + 2.0, 1, 0.85);
  }
}

/** Porte-cochère: slender stone columns, a bronze slab with a glowing fascia and a planted roof. */
function canopy(f: Facades, bd: Building): void {
  const { body } = f;
  const { x0, x1, z0, z1, h } = bd;
  for (const [x, z] of [[x0 + 0.35, z1 - 0.35], [x1 - 0.35, z1 - 0.35], [x0 + 0.35, z0 + 2.4], [x1 - 0.35, z0 + 2.4]] as const) body.box(x - 0.16, x + 0.16, 0, h - 0.45, z - 0.16, z + 0.16, C.stone);
  body.box(x0, x1, h - 0.45, h - 0.12, z0, z1, C.bronze);
  body.box(x0 + 0.25, x1 - 0.25, h - 0.12, h, z0 + 0.25, z1 - 0.25, C.hedge);
  f.front.wall('z', z1 + 0.01, x0, x1, h - 0.4, h - 0.28, 1, C.shopGlass);
  f.front.wall('x', x1 + 0.01, z0, z1, h - 0.4, h - 0.28, 1, C.shopGlass);
  f.front.wall('x', x0 - 0.01, z0, z1, h - 0.4, h - 0.28, -1, C.shopGlass);
}

function buildBuildings(plan: CityPlan, seed: number): { body: BufferGeometry; lit: BufferGeometry; dark: BufferGeometry; front: BufferGeometry } {
  const f: Facades = { body: new Builder(), lit: new Builder(), dark: new Builder(), front: new Builder(), rng: createRng(seed ^ 0xb11d) };
  const frontBlock = plan.hotel.blocks[0];
  for (const bd of plan.buildings) {
    if (bd.style === 'tower') tower(f, bd);
    else if (bd.style === 'hotel') hotelBlock(f, bd, bd === frontBlock);
    else if (bd.style === 'canopy') canopy(f, bd);
    else midrise(f, bd);
  }
  return { body: f.body.build(), lit: f.lit.build(), dark: f.dark.build(), front: f.front.build() };
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
  // Plaza: a granite-edged reflecting pool with low jets, the sculpture plinth, long stone planters.
  const p = plan.park;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  const pl = plan.pool;
  b.flat(pl.x0, pl.x1, pl.z0, pl.z1, 0.12, C.water);
  b.box(pl.x0 - 0.35, pl.x1 + 0.35, 0, 0.3, pl.z0 - 0.35, pl.z0, C.granite);
  b.box(pl.x0 - 0.35, pl.x1 + 0.35, 0, 0.3, pl.z1, pl.z1 + 0.35, C.granite);
  for (const x of [pl.x0 - 0.35, pl.x1]) b.box(x, x + 0.35, 0, 0.3, pl.z0, pl.z1, C.granite);
  for (let i = 0; i < 6; i++) {
    const x = pl.x0 + 0.8 + ((pl.x1 - pl.x0 - 1.6) * i) / 5;
    if (Math.abs(x - cx) > 1.2) for (const z of [pl.z0 + 0.5, pl.z1 - 0.5]) b.prism(x, z, 0.05, 0.12, 0.75, 4, C.water);
  }
  const sc = plan.sculpture;
  b.box(sc.x - 0.85, sc.x + 0.85, 0, 0.55, sc.z - 0.85, sc.z + 0.85, C.granite);
  const pz = plan.plaza;
  for (const z of [pz.z0 + 0.7, pz.z1 - 0.7]) for (const [a, c] of [[pz.x0 + 2, cx - 5.5], [cx + 5.5, pz.x1 - 2]] as const) {
    b.box(a, c, 0, 0.5, z - 0.4, z + 0.4, C.stone);
    b.box(a + 0.08, c - 0.08, 0.5, 0.85, z - 0.32, z + 0.32, C.hedge);
  }
  // Calm pond with a stone edge and a small bridge carrying the north-south path.
  const w = plan.pond;
  b.flat(w.x0, w.x1, w.z0, w.z1, 0.02, C.water);
  b.box(w.x0 - 0.3, w.x1 + 0.3, 0, 0.18, w.z0 - 0.3, w.z0, C.stone);
  b.box(w.x0 - 0.3, w.x1 + 0.3, 0, 0.18, w.z1, w.z1 + 0.3, C.stone);
  for (const x of [w.x0 - 0.3, w.x1]) b.box(x, x + 0.3, 0, 0.18, w.z0, w.z1, C.stone);
  b.box(cx - 1.0, cx + 1.0, 0, 0.3, w.z0 - 0.8, w.z1 + 0.8, C.stone);
  b.box(cx - 1.0, cx + 1.0, 0.3, 0.45, w.z0 + 0.6, w.z1 - 0.6, C.stone);
  for (const x of [cx - 1.0, cx + 0.92]) b.box(x, x + 0.08, 0.45, 1.0, w.z0 + 0.4, w.z1 - 0.4, wood);
  // Hedges along the park's street edge (open where the path enters), flower beds on the plaza.
  b.box(p.x0, cx - 1.9, 0, 0.6, p.z0, p.z0 + 0.5, C.hedge);
  b.box(cx + 1.9, p.x1, 0, 0.6, p.z0, p.z0 + 0.5, C.hedge);
  [-11, -6.2, 6.2, 11].forEach((dx, i) => b.box(cx + dx - 1.4, cx + dx + 1.4, 0, 0.22, cz - 3.1, cz - 2.5, C.flowers[i % C.flowers.length] ?? C.flowers[0]));
  // Park café kiosk with an awning.
  const k = plan.kiosk;
  b.box(k.x0, k.x1, 0, 2.5, k.z0, k.z1, C.stone);
  b.box(k.x0 - 0.2, k.x1 + 0.2, 2.5, 2.7, k.z0 - 0.2, k.z1 + 0.2, C.accents[0]);
  b.box(k.x0 - 0.1, k.x1 + 0.1, 2.0, 2.1, k.z0 - 0.9, k.z0, C.accents[0]);
  // Café tables and chairs (the parasols are instanced).
  for (const t of plan.tables) {
    b.box(t.x - 0.38, t.x + 0.38, 0.72, 0.76, t.z - 0.38, t.z + 0.38, C.stone);
    b.box(t.x - 0.04, t.x + 0.04, 0, 2.2, t.z - 0.04, t.z + 0.04, metal);
    for (const s of [-1, 1]) {
      const x = t.x + s * 0.62;
      b.box(x - 0.2, x + 0.2, 0.42, 0.46, t.z - 0.2, t.z + 0.2, wood);
      b.box(x + s * 0.17, x + s * 0.21, 0.46, 0.85, t.z - 0.2, t.z + 0.2, wood);
    }
  }
  // Hotel forecourt: stone planters along both sides and clipped topiaries in pots flanking the porte-cochère.
  const f = plan.hotel.forecourt;
  const cn = plan.hotel.canopy;
  for (const x of [f.x0 + 1.2, f.x1 - 1.2]) {
    b.box(x - 0.45, x + 0.45, 0, 0.55, f.z0 + 0.6, f.z1 - 1.2, C.stone);
    b.box(x - 0.38, x + 0.38, 0.55, 0.9, f.z0 + 0.68, f.z1 - 1.28, C.hedge);
  }
  for (const x of [cn.x0 - 0.9, cn.x1 + 0.9]) for (const z of [f.z0 + 0.8, cn.z1 - 0.6]) {
    b.prism(x, z, 0.32, 0, 0.6, 8, C.stone);
    b.prism(x, z, 0.26, 0.6, 1.5, 6, C.hedge);
  }
  // Boulevard medians: a low hedge with flower beds along it.
  for (const m of plan.medians) {
    const alongX = m.x1 - m.x0 > m.z1 - m.z0;
    b.box(m.x0 + 0.1, m.x1 - 0.1, 0, 0.32, m.z0 + 0.1, m.z1 - 0.1, C.hedge);
    const [a0, a1] = alongX ? [m.x0, m.x1] : [m.z0, m.z1];
    let i = 0;
    for (let t = a0 + 6; t < a1 - 1.5; t += 9, i++) {
      const col = C.flowers[i % C.flowers.length] ?? C.flowers[0];
      if (alongX) b.box(t - 1, t + 1, 0.32, 0.42, m.z0 + 0.12, m.z1 - 0.12, col);
      else b.box(m.x0 + 0.12, m.x1 - 0.12, 0.32, 0.42, t - 1, t + 1, col);
    }
  }
  return b.build();
}

/** Abstract polished-steel sculpture: a column of slabs twisting as it rises from the plinth. */
function sculptureGeometry(plan: CityPlan): BufferGeometry {
  const b = new Builder();
  const s = plan.sculpture;
  const n = 6;
  const y0 = 0.55;
  const dh = (s.h - y0) / n;
  for (let i = 0; i < n; i++) b.obox(s.x, s.z, 0.72 - i * 0.04, 0.15, y0 + i * dh, y0 + (i + 1) * dh - 0.04, i * 0.32, 0xe6dfd2);
  return b.build();
}

/** Soft warm uplights (additive, night only): facade washes at the hotel, the sculpture, plaza trees and bollard pools. */
function uplightGeometry(plan: CityPlan): BufferGeometry {
  const b = new Builder();
  const warm = new Color(1.0, 0.7, 0.4);
  const soft = new Color(0.55, 0.38, 0.22);
  const off = new Color(0, 0, 0);
  const grad: Color[] = [warm, warm, off, off];
  const front = plan.hotel.blocks[0];
  if (front) {
    const bays = Math.max(2, Math.floor((front.x1 - front.x0) / 3.2));
    for (let i = 0; i <= bays; i++) {
      const x = front.x0 + 0.3 + ((front.x1 - front.x0 - 0.6) * i) / bays;
      b.wall('z', front.z1 - 0.06, x - 0.5, x + 0.5, 0, Math.min(front.h - 1, 7), 1, grad);
    }
  }
  const s = plan.sculpture;
  b.wall('x', s.x, s.z - 1.1, s.z + 1.1, 0.5, s.h + 0.3, 1, grad);
  b.wall('z', s.z, s.x - 1.1, s.x + 1.1, 0.5, s.h + 0.3, 1, grad);
  for (const t of plan.trees) {
    if (!(t.x >= plan.plaza.x0 && t.x <= plan.plaza.x1 && t.z >= plan.plaza.z0 && t.z <= plan.plaza.z1)) continue;
    b.wall('x', t.x, t.z - 0.9, t.z + 0.9, 0, t.h * 0.8, 1, grad);
    b.wall('z', t.z, t.x - 0.9, t.x + 0.9, 0, t.h * 0.8, 1, grad);
  }
  for (const p of plan.bollards) b.fan([p.x, 0.03, p.z], [1, 0, 0], [0, 0, 1], 1.1, 8, [0, 1, 0], soft, off);
  return b.build();
}

// ---- instanced parts ----

const TYRE = new Color(0.13, 0.13, 0.14);
const ALLOY = new Color(0.78, 0.79, 0.8);
const SPOKE = new Color(0.36, 0.37, 0.39);
const GLASS = new Color(0.28, 0.34, 0.4);
const CHROME = new Color(0.86, 0.87, 0.88);
const BLACK = new Color(0.1, 0.1, 0.11);
const LENS = new Color(0.95, 0.94, 0.88);
const TAIL = new Color(0.6, 0.1, 0.1);
const LEATHER = new Color(0.66, 0.5, 0.36);

/** Side profile per body style as fractions of the half length (x) and absolute heights (m). */
interface Profile {
  /** Belt line height at the rear end, the rear axle, the front axle and the nose. */
  readonly belt: readonly [number, number, number, number];
  /** Greenhouse stations (x fraction): rear glass base, rear roof, front roof, windshield base. */
  readonly glass: readonly [number, number, number, number];
  readonly sill: number;
}
const PROFILES: Record<BodyStyle, Profile> = {
  sedan: { belt: [0.9, 1.0, 0.98, 0.74], glass: [-0.6, -0.3, 0.22, 0.58], sill: 0.22 },
  limousine: { belt: [0.92, 1.02, 1.0, 0.76], glass: [-0.62, -0.34, 0.2, 0.56], sill: 0.22 },
  tourer: { belt: [0.86, 0.9, 0.88, 0.66], glass: [-0.88, -0.36, 0.02, 0.36], sill: 0.2 },
  suv: { belt: [1.06, 1.1, 1.08, 0.96], glass: [-0.94, -0.82, 0.32, 0.56], sill: 0.32 },
  convertible: { belt: [0.86, 0.9, 0.88, 0.68], glass: [-0.4, -0.4, 0.2, 0.42], sill: 0.2 },
  shuttle: { belt: [1.05, 1.05, 1.05, 1.0], glass: [-0.98, -0.97, 0.9, 0.97], sill: 0.32 },
};

/** Premium vehicle (local +x forward): a paint shell and a trim set with glass, wheels, chrome, mirrors and lenses. */
function vehicleGeometry(style: BodyStyle): { paint: BufferGeometry; trim: BufferGeometry } {
  const spec = BODY_SPECS[style];
  const pr = PROFILES[style];
  const paint = new Builder();
  const trim = new Builder();
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  const H = spec.height;
  const wr = spec.wheelR;
  const fa = spec.wheelbase / 2;
  const arch = wr + 0.08;
  const archY = 2 * wr * 0.95;
  const [bR, bRa, bFa, bN] = pr.belt;
  const beltAt = (x: number): number => {
    const pts: [number, number][] = [[-hl, bR], [-fa, bRa], [fa, bFa], [hl, bN]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [xa, ya] = pts[i]!;
      const [xb, yb] = pts[i + 1]!;
      if (x <= xb) return ya + ((yb - ya) * (x - xa)) / (xb - xa);
    }
    return bN;
  };
  // Lower body: bumpers, sills and wheel arches; the plan view narrows at both ends.
  const xs = [-hl, -fa - arch, -fa + arch, fa - arch, fa + arch, hl];
  const bottoms = [pr.sill + 0.1, archY, pr.sill, archY, pr.sill + 0.1];
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const end0 = i === 0;
    const end1 = i === xs.length - 2;
    const y0 = bottoms[i]!;
    paint.loft(
      [
        { x: x0, y0, y1: beltAt(x0), w0: end0 ? hw - 0.1 : hw, w1: end0 ? hw - 0.22 : hw - 0.07 },
        { x: x1, y0, y1: beltAt(x1), w0: end1 ? hw - 0.1 : hw, w1: end1 ? hw - 0.22 : hw - 0.07 },
      ],
      0xffffff,
      end0 || end1,
    );
  }
  // Greenhouse: glass from the rear window over the roof to the windshield; a painted roof on closed bodies.
  const [g0, g1, g2, g3] = pr.glass.map((t) => t * hl) as [number, number, number, number];
  const roofY = H - 0.03;
  if (style === 'convertible') {
    // Open top: raked windshield, tan leather cabin, two seat backs and a folded hood.
    trim.loft([{ x: g2, y0: beltAt(g2), y1: H, w0: hw - 0.14, w1: hw - 0.24 }, { x: g3, y0: beltAt(g3), y1: beltAt(g3) + 0.02, w0: hw - 0.12, w1: hw - 0.14 }], GLASS, false);
    trim.flat(g0, g2, -hw + 0.22, hw - 0.22, beltAt(0) + 0.005, LEATHER);
    for (const dz of [-0.42, 0.42]) trim.box(-0.2 * hl - 0.12, -0.2 * hl + 0.04, beltAt(0), beltAt(0) + 0.42, dz - 0.26, dz + 0.26, LEATHER);
    trim.box(g0 - 0.3, g0, beltAt(g0), beltAt(g0) + 0.14, -hw + 0.3, hw - 0.3, BLACK);
  } else {
    trim.loft(
      [
        { x: g0, y0: beltAt(g0), y1: beltAt(g0) + 0.03, w0: hw - 0.08, w1: hw - 0.1 },
        { x: g1, y0: beltAt(g1), y1: roofY, w0: hw - 0.08, w1: hw - 0.3 },
        { x: g2, y0: beltAt(g2), y1: roofY, w0: hw - 0.08, w1: hw - 0.3 },
        { x: g3, y0: beltAt(g3), y1: beltAt(g3) + 0.03, w0: hw - 0.08, w1: hw - 0.1 },
      ],
      GLASS,
      style === 'shuttle',
    );
    paint.loft([{ x: g1 + 0.03, y0: roofY - 0.02, y1: H, w0: hw - 0.3, w1: hw - 0.33 }, { x: g2 - 0.03, y0: roofY - 0.02, y1: H, w0: hw - 0.3, w1: hw - 0.33 }], 0xffffff);
    if (style === 'suv') for (const dz of [-hw + 0.38, hw - 0.38]) trim.box(g1 + 0.1, g2 - 0.1, H - 0.02, H, dz - 0.03, dz + 0.03, BLACK);
    if (style === 'limousine') trim.box(-0.1, 0.1, H - 0.02, H, -0.18, 0.18, LENS);
  }
  // Wheels with alloy faces, chrome belt strips, black grille, lenses and mirrors.
  for (const x of [-fa, fa]) for (const s of [-1, 1] as const) trim.wheel(x, s * (hw - 0.15), wr, 0.24, s, TYRE, ALLOY, SPOKE);
  for (const s of [-1, 1] as const) {
    const xa = -hl + 0.3;
    const xb = hl - 0.4;
    const z = s * (hw - 0.07 + 0.006);
    trim.q4([xa, beltAt(xa) - 0.05, z], [xb, beltAt(xb) - 0.05, z], [xb, beltAt(xb) - 0.02, z], [xa, beltAt(xa) - 0.02, z], CHROME, [0, 0, s]);
    if (style !== 'shuttle') trim.box(g3 - 0.12, g3 + 0.02, beltAt(g3), beltAt(g3) + 0.12, s * (hw - 0.05), s * (hw + 0.11), BLACK);
  }
  const nose = beltAt(hl);
  trim.wall('x', hl + 0.005, -0.42, 0.42, nose - 0.28, nose - 0.08, 1, BLACK);
  for (const s of [-1, 1]) trim.wall('x', hl + 0.006, s > 0 ? hw - 0.5 : -hw + 0.24, s > 0 ? hw - 0.24 : -hw + 0.5, nose - 0.12, nose - 0.04, 1, LENS);
  const tail = beltAt(-hl);
  trim.wall('x', -hl - 0.005, -hw + 0.26, hw - 0.26, tail - 0.12, tail - 0.04, -1, TAIL);
  return { paint: paint.build(), trim: trim.build() };
}

/** Head and tail light glow (night): unit length, scaled per vehicle. */
function vehicleLightGeometry(): BufferGeometry {
  const b = new Builder();
  const front = new Color(1, 0.93, 0.75);
  const rear = new Color(0.85, 0.2, 0.15);
  for (const z of [-0.7, 0.7]) b.wall('x', 0.505, z - 0.15, z + 0.15, 0.6, 0.72, 1, front);
  b.wall('x', -0.505, -0.75, 0.75, 0.78, 0.86, -1, rear);
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

/** Trousers and shoes: two legs (local +x forward). */
function legsGeometry(): BufferGeometry {
  const b = new Builder();
  for (const z of [-0.08, 0.08]) b.box(-0.06, 0.06, 0, 0.62, z - 0.055, z + 0.055, 0xffffff);
  return b.build();
}

/** Elegant lamp post: stone plinth, slender bronze shaft with a collar and a swan-neck arm (lantern instanced). */
function lampGeometry(): BufferGeometry {
  const b = new Builder();
  b.prism(0, 0, 0.17, 0, 0.5, 8, 0xffffff);
  b.prism(0, 0, 0.065, 0.5, 4.45, 8, 0xffffff);
  b.prism(0, 0, 0.1, 2.3, 2.42, 8, 0xffffff);
  b.box(0, 0.62, 4.36, 4.44, -0.035, 0.035, 0xffffff);
  b.box(0.58, 0.9, 4.3, 4.38, -0.035, 0.035, 0xffffff);
  return b.build();
}

function bollardGeometry(): BufferGeometry {
  const b = new Builder();
  b.prism(0, 0, 0.09, 0, 0.82, 8, C.pole);
  b.prism(0, 0, 0.1, 0.82, 0.9, 8, C.bronze);
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
  const litMat = std({ color: C.windowGlass, roughness: 0.3, metalness: 0.2, emissive: C.windowGlow, emissiveIntensity: 0 });
  const darkMat = std({ color: C.windowGlass, roughness: 0.3, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 0 });
  add(new Mesh(blds.lit, litMat), 'city-windows-lit');
  add(new Mesh(blds.dark, darkMat), 'city-windows-dark');
  const frontMat = std({ color: C.shopGlass, roughness: 0.35, emissive: C.shopGlow, emissiveIntensity: 0.3 });
  add(new Mesh(blds.front, frontMat), 'city-shopfronts');
  add(new Mesh(buildProps(plan), vertexMat), 'city-props');
  add(new Mesh(sculptureGeometry(plan), std({ vertexColors: true, roughness: 0.22, metalness: 0.85 })), 'city-sculpture');
  const upMat = basic({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  const uplights = add(new Mesh(uplightGeometry(plan), upMat), 'city-uplights');
  uplights.visible = false;

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

  // Mature trees: a trunk and a two-lobed crown each.
  const trunks = add(new InstancedMesh(new CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0), std({ color: C.trunk }), plan.trees.length), 'city-tree-trunks');
  const crowns = add(new InstancedMesh(new IcosahedronGeometry(1, 0), std({ color: 0xffffff, flatShading: true }), plan.trees.length * 2), 'city-tree-crowns');
  plan.trees.forEach((t, i) => {
    const g = Math.max(1, t.h / 5);
    trunks.setMatrixAt(i, compose(t.x, 0, t.z, 0, g, t.h * 0.55, g));
    const r = t.h * 0.28;
    crowns.setMatrixAt(2 * i, compose(t.x, t.h * 0.66, t.z, 0, r, r * 0.95, r));
    crowns.setMatrixAt(2 * i + 1, compose(t.x + t.h * 0.09, t.h * 0.8, t.z - t.h * 0.05, 0, t.h * 0.19, t.h * 0.18, t.h * 0.19));
    crowns.setColorAt(2 * i, col.setHex(pick(C.crown, i)));
    crowns.setColorAt(2 * i + 1, col.setHex(pick(C.crown, i + 1)));
  });

  // Café parasols: square, in linen and soft tones.
  const umbrellas = add(new InstancedMesh(new CylinderGeometry(0.04, 1.25, 0.28, 4).rotateY(Math.PI / 4).translate(0, 2.24, 0), std({ color: 0xffffff, flatShading: true }), Math.max(1, plan.tables.length)), 'city-umbrellas');
  umbrellas.count = plan.tables.length;
  plan.tables.forEach((t, i) => {
    umbrellas.setMatrixAt(i, compose(t.x, 0, t.z, 0));
    umbrellas.setColorAt(i, col.setHex(pick(C.umbrellas, t.tone)));
  });

  // Street lamps, their lanterns and warm pools of light (night only); bollards.
  const lampPoles = add(new InstancedMesh(lampGeometry(), std({ color: C.pole, roughness: 0.5, metalness: 0.4 }), plan.lamps.length), 'city-lamp-poles');
  const lampHeads = add(new InstancedMesh(new CylinderGeometry(0.18, 0.26, 0.36, 6), std({ color: C.lampHead, emissive: C.lampGlow, emissiveIntensity: 0 }), plan.lamps.length), 'city-lamp-heads');
  const poolMat = basic({ color: C.lampGlow, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
  const pools = add(new InstancedMesh(new CircleGeometry(3.0, 12).rotateX(-Math.PI / 2), poolMat, plan.lamps.length), 'city-lamp-pools');
  pools.visible = false;
  plan.lamps.forEach((l, i) => {
    const yaw = Math.atan2(-l.dz, l.dx);
    lampPoles.setMatrixAt(i, compose(l.x, 0, l.z, yaw));
    lampHeads.setMatrixAt(i, compose(l.x + l.dx * 0.86, 4.1, l.z + l.dz * 0.86, 0));
    pools.setMatrixAt(i, compose(l.x + l.dx * 0.86, 0.02, l.z + l.dz * 0.86, 0));
  });
  const bollards = add(new InstancedMesh(bollardGeometry(), std({ vertexColors: true, roughness: 0.45, metalness: 0.5 }), Math.max(1, plan.bollards.length)), 'city-bollards');
  bollards.count = plan.bollards.length;
  plan.bollards.forEach((p, i) => bollards.setMatrixAt(i, compose(p.x, 0, p.z, 0)));

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

  // Vehicles: per body style a metallic paint mesh and a trim mesh, plus head/tail glow for all (night only).
  const paintMat = std({ vertexColors: true, roughness: 0.3, metalness: 0.35 });
  const trimMat = std({ vertexColors: true, roughness: 0.25, metalness: 0.55 });
  const fleets = FLEET.map(([style, name]) => {
    const list = sim.vehicles.filter((v) => v.body === style);
    const g = vehicleGeometry(style);
    const n = Math.max(1, list.length);
    const paint = add(new InstancedMesh(g.paint, paintMat, n), name);
    const trim = add(new InstancedMesh(g.trim, trimMat, n), `${name}-trim`);
    for (const m of [paint, trim]) {
      m.count = list.length;
      m.frustumCulled = false;
    }
    list.forEach((v, i) => paint.setColorAt(i, col.setHex(pick(PAINTS[style], v.tone))));
    return { paint, trim, list };
  });
  const lightsMat = basic({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const lights = add(new InstancedMesh(vehicleLightGeometry(), lightsMat, sim.vehicles.length), 'city-vehicle-lights');
  lights.frustumCulled = false;
  lights.visible = false;

  // Bicycles (riders sit with the people below) and dogs.
  const bikes = add(new InstancedMesh(bikeGeometry(), vertexMat, Math.max(1, sim.cyclists.length)), 'city-bikes');
  bikes.count = sim.cyclists.length;
  bikes.frustumCulled = false;
  sim.cyclists.forEach((c, i) => bikes.setColorAt(i, col.setHex(pick(C.accents, c.tone))));
  const walkers: Pedestrian[] = [...sim.pedestrians, ...sim.parkGoers];
  const dogOwners = walkers.filter((p) => p.dog);
  const dogs = add(new InstancedMesh(dogGeometry(), std({ color: 0xffffff }), Math.max(1, dogOwners.length)), 'city-dogs');
  dogs.count = dogOwners.length;
  dogs.frustumCulled = false;
  dogOwners.forEach((_, i) => dogs.setColorAt(i, col.setHex(pick(C.dogs, i))));

  // People (about 1.7 m): walkers, park goers, riders, the seated and the hotel doorman. Tailored coats, trousers.
  const people = walkers.length + sim.cyclists.length + plan.sitters.length + 1;
  const peds = add(new InstancedMesh(new CylinderGeometry(0.14, 0.2, 0.95, 7).translate(0, 1.025, 0), std({ color: 0xffffff }), people), 'city-pedestrians');
  const legs = add(new InstancedMesh(legsGeometry(), std({ color: 0xffffff }), people), 'city-ped-legs');
  const heads = add(new InstancedMesh(new IcosahedronGeometry(0.115, 0).translate(0, 1.6, 0), std({ color: C.skin }), people), 'city-ped-heads');
  for (const m of [peds, legs, heads]) m.frustumCulled = false;
  const dress = (i: number, tone: number): void => {
    peds.setColorAt(i, col.setHex(pick(C.clothes, tone)));
    legs.setColorAt(i, col.setHex(pick(C.trousers, tone + 1)));
  };
  const placePerson = (i: number, m: Matrix4): void => {
    peds.setMatrixAt(i, m);
    legs.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  };
  walkers.forEach((p, i) => dress(i, p.tone));
  sim.cyclists.forEach((c, i) => dress(walkers.length + i, c.tone + 2));
  const seated0 = walkers.length + sim.cyclists.length;
  plan.sitters.forEach((s, i) => {
    placePerson(seated0 + i, compose(s.x, 0.04, s.z, s.yaw, 1, 0.75, 1));
    dress(seated0 + i, s.tone);
  });
  const door = plan.hotel.doorman;
  const doorIdx = seated0 + plan.sitters.length;
  placePerson(doorIdx, compose(door.x, 0, door.z, door.yaw));
  peds.setColorAt(doorIdx, col.setHex(C.livery));
  legs.setColorAt(doorIdx, col.setHex(C.trousers[0]));

  const syncMovers = (): void => {
    for (const { paint, trim, list } of fleets) {
      list.forEach((v, i) => {
        const m = compose(v.x, 0, v.z, v.yaw);
        paint.setMatrixAt(i, m);
        trim.setMatrixAt(i, m);
      });
      paint.instanceMatrix.needsUpdate = true;
      trim.instanceMatrix.needsUpdate = true;
    }
    sim.vehicles.forEach((v, i) => {
      const spec = BODY_SPECS[v.body];
      const sy = v.body === 'shuttle' ? 1.4 : v.body === 'suv' ? 1.3 : 1;
      lights.setMatrixAt(i, compose(v.x, 0, v.z, v.yaw, v.length + 0.03, sy, spec.width / 1.9));
    });
    lights.instanceMatrix.needsUpdate = true;
    walkers.forEach((p, i) => {
      const bob = p.walking ? Math.abs(Math.sin(p.phase)) * (p.jog ? 0.09 : 0.04) : 0;
      placePerson(i, compose(p.x, bob, p.z, p.yaw));
    });
    sim.cyclists.forEach((c, i) => {
      bikes.setMatrixAt(i, compose(c.x, 0, c.z, c.yaw));
      placePerson(walkers.length + i, compose(c.x - Math.cos(c.yaw) * 0.12, 0.45, c.z + Math.sin(c.yaw) * 0.12, c.yaw, 1, 0.82, 1));
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
    legs.instanceMatrix.needsUpdate = true;
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
      frontMat.emissiveIntensity = 0.3 + 1.1 * n;
      lampHeads.material.emissiveIntensity = 1.8 * n;
      poolMat.opacity = 0.3 * n;
      pools.visible = n > 0.02;
      upMat.opacity = 0.85 * n;
      uplights.visible = n > 0.02;
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
