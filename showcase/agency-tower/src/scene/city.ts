// City life around the campus (KARARLAR rev 31): streets, neighbouring buildings, traffic and pedestrians.
// Everything lives "in the shade": desaturated, darker, low-contrast materials with a soft distance haze
// toward the page background, so the tower and the wing stay the focus. Procedural geometry only, merged
// static meshes and instancing; nothing here is pickable and nothing casts or receives shadows.
//
// Ruling: the haze is a per-material shader mix (onBeforeCompile) keyed on the distance to the campus
// footprint, not scene.fog — the scene (src/app) owns the fog slot and the tower must stay unfogged — if
// wrong, swap the mix for scene.fog in one place.
// Ruling: thin street furniture (lamp and signal poles, <= 0.3 m) is not part of the occlusion check; like
// a real foreground pole it may cross a wall edge in a low orbit view — if wrong, move the poles outward.
import {
  BufferAttribute,
  BufferGeometry,
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

// ---- palette: desaturated, a little darker than the white tower, low contrast ----
const C = {
  base: 0xb4b1a9,
  plaza: 0xd3cfc7,
  road: 0x8e9093,
  walk: 0xc2beb6,
  marking: 0xd3d1cb,
  grass: 0xa1aa8f,
  path: 0xc9c2b2,
  roof: 0x8f8c87,
  trunk: 0x7b7166,
  crown: [0x8c9a7d, 0x97a287, 0x83917a],
  pole: 0x6b6e72,
  lampHead: 0xd6d2ca,
  windowGlass: 0x6d747c,
  windowGlow: 0xffd49a,
  lampGlow: 0xffe2b0,
  buildings: [0xb7b1a7, 0xa6aaac, 0xbfb8ab, 0x9da3a5, 0xb0a695, 0xadb2af],
  cars: [0x9aa3ab, 0xb6b2aa, 0x8a8e92, 0xa38e85, 0x7f8b96, 0xc6c2ba],
  taxis: [0xcfb764, 0xc9b25f],
  buses: [0x7f99a5, 0xae8170],
  clothes: [0x7b8794, 0x9a8b7c, 0x6f7a6d, 0xa79c8e, 0x857a8c, 0x8c9a9e],
  skin: 0xc5b19e,
  signalOff: 0x3b3d40,
  signal: { red: 0xe0574a, yellow: 0xe8b84a, green: 0x5fc27a } as Record<Signal, number>,
} as const;

/** Haze toward the page background: day bg-3 and night bottom of src/scene/daynight.ts. */
const HAZE_DAY = [230, 226, 218] as const;
const HAZE_NIGHT = [52, 50, 72] as const;
const HAZE_NEAR = 8;
const HAZE_FAR = 42;
const SHADE = 0.12;
const ORG_DIM = 0.55;

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
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: number | Color, bottom = false): void {
    this.flat(x0, x1, z0, z1, y1, color);
    this.wall('x', x1, z0, z1, y0, y1, 1, color);
    this.wall('x', x0, z0, z1, y0, y1, -1, color);
    this.wall('z', z1, x0, x1, y0, y1, 1, color);
    this.wall('z', z0, x0, x1, y0, y1, -1, color);
    if (bottom) this.quad([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], color);
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
  // Campus plaza: the whole centre block inside the ring sidewalks.
  const r = plan.ring;
  b.flat(r.w + R + WALK_WIDTH, r.e - R - WALK_WIDTH, r.n + R + WALK_WIDTH, r.s - R - WALK_WIDTH, -0.06, C.plaza);
  for (const s of plan.sidewalks) b.flat(s.x0, s.x1, s.z0, s.z1, -0.055, C.walk);
  for (const road of plan.roads) b.flat(road.x0, road.x1, road.z0, road.z1, -0.05, C.road);
  // Park lawn and paths.
  const p = plan.park;
  b.flat(p.x0, p.x1, p.z0, p.z1, -0.048, C.grass);
  const pc = { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
  b.flat(p.x0, p.x1, pc.z - 0.9, pc.z + 0.9, -0.045, C.path);
  b.flat(pc.x - 0.9, pc.x + 0.9, p.z0, p.z1, -0.045, C.path);
  // Lane markings: dashed centre lines, skipped across intersections and crosswalks.
  const keepOut = STOP_DIST + 0.3;
  const free = (x: number, z: number): boolean => !plan.intersections.some((n) => Math.abs(n.x - x) < keepOut && Math.abs(n.z - z) < keepOut);
  for (const z of [r.n, r.s]) for (let x = e.x0 + 1; x < e.x1 - 2; x += 4) if (free(x + 1, z)) b.flat(x, x + 2, z - 0.07, z + 0.07, -0.044, C.marking);
  for (const x of [r.w, r.e]) for (let z = e.z0 + 1; z < e.z1 - 2; z += 4) if (free(x, z + 1)) b.flat(x - 0.07, x + 0.07, z, z + 2, -0.044, C.marking);
  // Stop lines across each approach lane (right of the heading).
  for (const n of plan.intersections) {
    const s = STOP_DIST - 0.25;
    b.flat(n.x - s - 0.3, n.x - s, n.z, n.z + R - 0.2, -0.044, C.marking); // eastbound
    b.flat(n.x + s, n.x + s + 0.3, n.z - R + 0.2, n.z, -0.044, C.marking); // westbound
    b.flat(n.x - R + 0.2, n.x, n.z - s - 0.3, n.z - s, -0.044, C.marking); // southbound
    b.flat(n.x, n.x + R - 0.2, n.z + s, n.z + s + 0.3, -0.044, C.marking); // northbound
  }
  // Zebra crosswalks: stripes run along the walking direction.
  for (const c of plan.crosswalks) {
    if (c.walk === 'z') for (let z = c.z0 + 0.25; z < c.z1 - 0.3; z += 1.0) b.flat(c.x0 + 0.15, c.x1 - 0.15, z, z + 0.5, -0.043, C.marking);
    else for (let x = c.x0 + 0.25; x < c.x1 - 0.3; x += 1.0) b.flat(x, x + 0.5, c.z0 + 0.15, c.z1 - 0.15, -0.043, C.marking);
  }
  return b.build();
}

function buildBuildings(plan: CityPlan, seed: number): { body: BufferGeometry; lit: BufferGeometry; dark: BufferGeometry } {
  const body = new Builder();
  const lit = new Builder();
  const dark = new Builder();
  const rng = createRng(seed ^ 0xb11d);
  const glass = C.windowGlass;
  for (const bd of plan.buildings) {
    const tone = C.buildings[bd.tone % C.buildings.length] ?? C.buildings[0];
    // Body, roof cap and, on taller ones, a rooftop plant room; all within the plan height `h`.
    const plant = bd.floors >= 3 ? 0.9 : 0;
    const top = bd.h - plant;
    body.box(bd.x0, bd.x1, 0, top - 0.2, bd.z0, bd.z1, tone);
    body.box(bd.x0 + 0.25, bd.x1 - 0.25, top - 0.2, top, bd.z0 + 0.25, bd.z1 - 0.25, C.roof);
    if (plant > 0) {
      const cx = (bd.x0 + bd.x1) / 2;
      const cz = (bd.z0 + bd.z1) / 2;
      body.box(cx - 1.2, cx + 1.2, top, bd.h, cz - 0.9, cz + 0.9, C.roof);
    }
    const facades: ['x' | 'z', number, number, number, 1 | -1][] = [
      ['z', bd.z1 + 0.03, bd.x0, bd.x1, 1],
      ['z', bd.z0 - 0.03, bd.x0, bd.x1, -1],
      ['x', bd.x1 + 0.03, bd.z0, bd.z1, 1],
      ['x', bd.x0 - 0.03, bd.z0, bd.z1, -1],
    ];
    for (const [axis, at, a0, a1, facing] of facades) {
      const n = Math.floor((a1 - a0 - 0.8) / 2.4);
      if (n < 1) continue;
      const step = (a1 - a0) / n;
      for (let f = 0; f < bd.floors; f++) {
        const y0 = f * STOREY + 1.0;
        for (let i = 0; i < n; i++) {
          const c = a0 + step * (i + 0.5);
          (rng() < 0.42 ? lit : dark).wall(axis, at, c - 0.55, c + 0.55, y0, y0 + 1.3, facing, glass);
        }
      }
    }
  }
  return { body: body.build(), lit: lit.build(), dark: dark.build() };
}

function buildProps(plan: CityPlan): BufferGeometry {
  const b = new Builder();
  const wood = 0x9a8b78;
  const metal = 0x6f7276;
  for (const bench of plan.benches) {
    // Seat faces +z at yaw 0 and -z at yaw PI; benches here are axis aligned.
    const s = Math.cos(bench.yaw) >= 0 ? 1 : -1;
    const { x, z } = bench;
    b.box(x - 0.8, x + 0.8, 0.4, 0.46, z - 0.22, z + 0.22, wood);
    b.box(x - 0.8, x + 0.8, 0.5, 0.85, z - s * 0.26, z - s * 0.2, wood);
    for (const dx of [-0.7, 0.7]) b.box(x + dx - 0.04, x + dx + 0.04, 0, 0.4, z - 0.2, z + 0.2, metal);
  }
  // Fountain: low square basin with a centre column, where the park paths cross.
  const p = plan.park;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  const stone = 0xbdb7ad;
  const w = 2.2;
  b.box(cx - w, cx + w, 0, 0.45, cz - w, cz - w + 0.3, stone);
  b.box(cx - w, cx + w, 0, 0.45, cz + w - 0.3, cz + w, stone);
  b.box(cx - w, cx - w + 0.3, 0, 0.45, cz - w, cz + w, stone);
  b.box(cx + w - 0.3, cx + w, 0, 0.45, cz - w, cz + w, stone);
  b.flat(cx - w + 0.3, cx + w - 0.3, cz - w + 0.3, cz + w - 0.3, 0.3, 0x8fa2a8);
  b.box(cx - 0.25, cx + 0.25, 0, 1.2, cz - 0.25, cz + 0.25, stone);
  // Low hedges along the park's street edges.
  b.box(p.x0, p.x1, 0, 0.55, p.z0, p.z0 + 0.5, 0x87957a);
  return b.build();
}

// ---- instanced parts ----

function vehicleGeometry(kind: VehicleKind): BufferGeometry {
  const b = new Builder();
  const glass = new Color(0.42, 0.44, 0.47);
  const tyre = new Color(0.16, 0.16, 0.17);
  if (kind === 'bus') {
    b.box(-5, 5, 0.35, 3.0, -1.2, 1.2, 0xffffff);
    b.box(-4.6, 4.9, 1.6, 2.6, -1.22, 1.22, glass);
    for (const x of [-3.2, 3.4]) b.box(x - 0.5, x + 0.5, 0, 0.9, -1.25, 1.25, tyre);
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

function lampGeometry(): BufferGeometry {
  const b = new Builder();
  b.box(-0.06, 0.06, 0, 3.6, -0.06, 0.06, 0xffffff);
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
  const litMat = std({ color: C.windowGlass, roughness: 0.45, emissive: C.windowGlow, emissiveIntensity: 0 });
  const darkMat = std({ color: C.windowGlass, roughness: 0.45, emissive: 0x000000, emissiveIntensity: 0 });
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

  // Trees.
  const trunks = add(new InstancedMesh(new CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0), std({ color: C.trunk }), plan.trees.length), 'city-tree-trunks');
  const crowns = add(new InstancedMesh(new IcosahedronGeometry(1, 0), std({ color: 0xffffff, flatShading: true }), plan.trees.length), 'city-tree-crowns');
  plan.trees.forEach((t, i) => {
    trunks.setMatrixAt(i, compose(t.x, 0, t.z, 0, 1, t.h * 0.5, 1));
    const r = t.h * 0.3;
    crowns.setMatrixAt(i, compose(t.x, t.h * 0.68, t.z, 0, r, r, r));
    crowns.setColorAt(i, col.setHex(C.crown[i % C.crown.length] ?? C.crown[0]));
  });

  // Street lamps.
  const lampPoles = add(new InstancedMesh(lampGeometry(), std({ color: C.pole }), plan.lamps.length), 'city-lamp-poles');
  const lampHeads = add(new InstancedMesh(new CylinderGeometry(0.26, 0.3, 0.12, 6), std({ color: C.lampHead, emissive: C.lampGlow, emissiveIntensity: 0 }), plan.lamps.length), 'city-lamp-heads');
  plan.lamps.forEach((l, i) => {
    const yaw = Math.atan2(-l.dz, l.dx);
    lampPoles.setMatrixAt(i, compose(l.x, 0, l.z, yaw));
    lampHeads.setMatrixAt(i, compose(l.x + l.dx * 0.95, 3.48, l.z + l.dz * 0.95, 0));
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
    list.forEach((v, i) => mesh.setColorAt(i, col.setHex(tones[v.tone % tones.length] ?? tones[0])));
    return { mesh, list };
  });
  const lightsMat = basic({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const lights = add(new InstancedMesh(vehicleLightGeometry(), lightsMat, sim.vehicles.length), 'city-vehicle-lights');
  lights.frustumCulled = false;
  lights.visible = false;

  // Pedestrians: bodies and heads.
  const peds = add(new InstancedMesh(new CylinderGeometry(0.15, 0.2, 1.2, 6).translate(0, 0.6, 0), std({ color: 0xffffff }), sim.pedestrians.length), 'city-pedestrians');
  const heads = add(new InstancedMesh(new IcosahedronGeometry(0.13, 0).translate(0, 1.38, 0), std({ color: C.skin }), sim.pedestrians.length), 'city-ped-heads');
  peds.frustumCulled = false;
  heads.frustumCulled = false;
  sim.pedestrians.forEach((p, i) => peds.setColorAt(i, col.setHex(C.clothes[p.tone % C.clothes.length] ?? C.clothes[0])));

  const syncMovers = (): void => {
    for (const { mesh, list } of fleets) {
      list.forEach((v, i) => mesh.setMatrixAt(i, compose(v.x, 0, v.z, v.yaw)));
      mesh.instanceMatrix.needsUpdate = true;
    }
    sim.vehicles.forEach((v, i) => {
      const w = v.kind === 'bus' ? 2.4 / 1.8 : 1;
      lights.setMatrixAt(i, compose(v.x, 0, v.z, v.yaw, v.length + 0.02, v.kind === 'bus' ? 1.4 : 1, w));
    });
    lights.instanceMatrix.needsUpdate = true;
    sim.pedestrians.forEach((p, i) => {
      const bob = p.walking ? Math.abs(Math.sin(p.phase)) * 0.05 : 0;
      const m = compose(p.x, bob, p.z, p.yaw);
      peds.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
    });
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
      litMat.emissiveIntensity = 0.95 * n;
      lampHeads.material.emissiveIntensity = 1.6 * n;
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
