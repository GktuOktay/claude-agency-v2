// Room life meshes (KARARLAR Rev 39; budget Rev 40): the wider team, stylized business-casual humans in the
// art direction of the CEO (src/scene/human.ts: same rig pivots and proportions), drawn as a handful of
// shared low-poly InstancedMeshes (torso, head, two hair styles, arms, hands, legs, held props) plus one
// vertex-coloured furniture mesh per wing level for the few pieces they bring (treadmills, a ping-pong table,
// a foosball table, bean bags, a mat, stools, a recliner). Not units: no unit id, never pickable, not in the
// unit list, cards or org lines. Behaviour lives in src/sim/roomLifeSim.ts (pure, seedable).
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { PALETTE } from './furniture';
import { Sculptor, type Vec3 } from './outfits';
import { FLOOR_HEIGHT, FLOOR_TOP, wingX } from '../sim/layout';
import { createRoomLifeSim, LIFE_ANCHORS, type HeldProp, type LifeActivity, type LifeAnchor, type LifeOutfit, type LifeView, type RoomLifeSim } from '../sim/roomLifeSim';

/** Draw-call ceiling of the room life (Rev 39: <= 20). */
export const ROOM_LIFE_MAX_MESHES = 16;
/** Same base scale as the robots and the CEO (robot.ts ROBOT_BASE_SCALE), kept local. */
const BASE_SCALE = 1.4;
const ORG_OPACITY = 0.12;

export interface RoomLifeViewState {
  mode: 'overview' | 'floor';
  focusFloor: number;
}

export interface RoomLifeOptions {
  seed?: number;
  reducedMotion?: boolean;
  /** Office time at start ("HH:MM" or minutes since 00:00). */
  officeTime?: string | number;
}

export interface RoomLife {
  group: Group;
  sim: RoomLifeSim;
  /** Advances animation and arrivals; frozen in org mode. Call it only while the sim clock runs. */
  step(dtSeconds: number): void;
  setView(v: RoomLifeViewState): void;
  setOrg(on: boolean): void;
  setReducedMotion(on: boolean): void;
  setOfficeTime(hhmm: string | number): void;
  /** Instance matrix of a person's torso (null for an unknown id); zero scale when hidden or absent. */
  torsoMatrix(id: string): Matrix4 | null;
}

/** Loop hook: room life follows the office clock and stops with the clock's global pause reasons. */
export function frameRoomLife(life: Pick<RoomLife, 'step' | 'setOfficeTime'>, clock: { readonly paused: boolean }, dtSeconds: number, officeMinutes: number): void {
  if (clock.paused) return;
  life.setOfficeTime(officeMinutes);
  life.step(dtSeconds);
}

// ---------------------------------------------------------------- geometry (low poly, Rev 40)

const LO = {
  torso: new CapsuleGeometry(0.115, 0.08, 1, 6),
  head: new SphereGeometry(1, 6, 4),
  hair: new SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2),
  plane: new PlaneGeometry(1, 1),
  tube: new CylinderGeometry(1, 0.88, 1, 5, 1, true),
  ball: new SphereGeometry(1, 4, 2),
  box: new BoxGeometry(1, 1, 1),
  pod: new SphereGeometry(1, 6, 3),
} satisfies Record<string, BufferGeometry>;

function bake(fill: (s: Sculptor) => void): BufferGeometry {
  const s = new Sculptor();
  fill(s);
  const mesh = s.bake('p', () => new MeshStandardMaterial())[0];
  if (!mesh) throw new Error('room life: empty geometry');
  (mesh.material as MeshStandardMaterial).dispose();
  return mesh.geometry;
}
const part = (s: Sculptor, shape: BufferGeometry, color: number, pos: Vec3, scale: Vec3, rot: Vec3 = [0, 0, 0]): void => s.add('p', 'base', shape, color, pos, scale, rot);

// Rig (inner, pre-scale units; human.ts): torso on the body pivot, head pivot at y 0.4, arm pivots at
// (+-0.135, 0.33), leg pivots at (+-0.052, 0.1). White parts take the instance colour; dark parts stay dark.
const GEO = {
  torso: bake((s) => part(s, LO.torso, 0xffffff, [0, 0.24, 0], [0.9, 1, 0.8])),
  head: bake((s) => {
    part(s, LO.tube, 0xffffff, [0, 0.0, 0], [0.034, 0.06, 0.034]);
    part(s, LO.head, 0xffffff, [0, 0.115, 0], [0.1, 0.11, 0.095]);
    for (const x of [-1, 1]) part(s, LO.plane, 0x2a2522, [x * 0.035, 0.12, 0.094], [0.022, 0.026, 1]);
    part(s, LO.plane, 0x9c5a4a, [0, 0.075, 0.09], [0.034, 0.008, 1]);
  }),
  hairShort: bake((s) => part(s, LO.hair, 0xffffff, [0, 0.128, -0.006], [0.106, 0.1, 0.101], [-0.35, 0, 0])),
  hairLong: bake((s) => {
    part(s, LO.hair, 0xffffff, [0, 0.128, -0.006], [0.107, 0.1, 0.102], [-0.3, 0, 0]);
    part(s, LO.box, 0xffffff, [0, 0.06, -0.06], [0.2, 0.18, 0.07]);
  }),
  arm: bake((s) => part(s, LO.tube, 0xffffff, [0, -0.07, 0], [0.032, 0.15, 0.032])),
  hand: bake((s) => part(s, LO.ball, 0xffffff, [0, -0.16, 0], [0.03, 0.032, 0.03])),
  leg: bake((s) => {
    part(s, LO.tube, 0xffffff, [0, -0.035, 0], [0.037, 0.11, 0.037]);
    part(s, LO.ball, 0x2a2a2a, [0, -0.088, 0.015], [0.034, 0.018, 0.05]);
  }),
} as const;

const HELD_GEO: Record<HeldProp, BufferGeometry> = {
  cup: bake((s) => part(s, new CylinderGeometry(1, 0.8, 1, 5, 1, true), 0xf7f5f1, [0, -0.19, 0.035], [0.028, 0.06, 0.028])),
  book: bake((s) => part(s, LO.box, PALETTE.books[0], [0, -0.19, 0.05], [0.11, 0.15, 0.025], [0.5, 0, 0])),
  tablet: bake((s) => part(s, LO.box, 0x2b3036, [0, -0.19, 0.05], [0.15, 0.1, 0.012], [0.9, 0, 0])),
  paddle: bake((s) => part(s, LO.box, 0xc0392b, [0, -0.22, 0.02], [0.09, 0.11, 0.012])),
  dumbbell: bake((s) => part(s, LO.box, 0x30343a, [0, -0.17, 0.02], [0.13, 0.03, 0.03])),
};

// ---------------------------------------------------------------- outfits (business casual)

const SKIN = [0xf1c7a5, 0xe6b48f, 0xc98e66, 0xa86f4c, 0x7a4e35, 0xf5d6be];
const HAIR = [0x3a2a1f, 0x1c1714, 0x6b4a2f, 0xa77b4f, 0xd6b47a, 0x8d8a86, 0x7a3222];
const TOPS: Readonly<Record<LifeOutfit, readonly number[]>> = {
  office: [0x9fbedc, 0xf2f2ee, 0x8b9098, 0x7d2f3c, 0x6b7448, 0xe8dcc4, 0x2f6b6b, 0xb8925f, 0xd9735f],
  smart: [0x2f4468, 0x3b3f46, 0x5a4636, 0x283a52, 0x6a6f78],
  gym: [0xe2574c, 0x2f8f9d, 0x1f2328, 0x7fb069, 0xf2b134],
  chef: [0xf4f4f0],
};
const BOTTOMS: Readonly<Record<LifeOutfit, readonly number[]>> = {
  office: [0x26324a, 0x33363c, 0xb5a27c, 0x3d5878, 0x6c7078],
  smart: [0x22262e, 0x2c3340, 0x3a3d44],
  gym: [0x1f2328, 0x2b2f36, 0x3d5878],
  chef: [0x22252a],
};

function pick<T>(list: readonly T[], u: number): T {
  const v = list[Math.floor(u * list.length) % list.length];
  if (v === undefined) throw new Error('room life: empty palette');
  return v;
}
function unit(seed: number, i: number, salt: number): number {
  let h = Math.imul((seed + 1) ^ (i * 0x9e3779b1) ^ (salt * 0x85ebca6b), 0x27d4eb2d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- poses

interface Pose {
  bodyY: number;
  pitch: number;
  roll: number;
  headX: number;
  headY: number;
  aLX: number;
  aLZ: number;
  aRX: number;
  aRZ: number;
  lLX: number;
  lRX: number;
  lLZ: number;
  lRZ: number;
}
const REST: Pose = { bodyY: 0, pitch: 0, roll: 0, headX: 0, headY: 0, aLX: 0, aLZ: 0, aRX: 0, aRZ: 0, lLX: 0, lRX: 0, lLZ: 0, lRZ: 0 };

/** Looping pose of an activity at time t (t = 0 under reduced motion gives the static pose). */
function poseFor(a: LifeActivity, t: number): Pose {
  const p: Pose = { ...REST };
  const s = Math.sin;
  switch (a) {
    case 'run': {
      const w = s(t * 14);
      p.lLX = w * 0.9;
      p.lRX = -w * 0.9;
      p.aLX = -0.9 - w * 0.6;
      p.aRX = -0.9 + w * 0.6;
      p.pitch = 0.18;
      p.bodyY = Math.abs(w) * 0.03;
      break;
    }
    case 'lift': {
      const c = 0.5 + 0.5 * s(t * 3);
      p.aRX = -0.3 - 1.6 * c;
      p.aLX = -0.3 - 1.6 * (1 - c);
      break;
    }
    case 'stretch':
      p.aLZ = 2.6;
      p.aRZ = -2.6;
      p.roll = 0.35 * s(t * 1.2);
      p.lLZ = -0.18;
      p.lRZ = 0.18;
      break;
    case 'coach':
      p.aRX = -0.9 + 0.35 * s(t * 2.2);
      p.aLX = -0.2;
      p.headY = 0.2 * s(t * 0.7);
      break;
    case 'pingpong':
      p.aRX = -0.9 + 0.5 * s(t * 5);
      p.aRZ = -0.35 + 0.25 * s(t * 5);
      p.aLX = -0.4;
      p.pitch = 0.12;
      p.bodyY = Math.abs(s(t * 5)) * 0.015;
      break;
    case 'foosball':
      p.aLX = -1.3 + 0.15 * s(t * 9);
      p.aRX = -1.3 + 0.15 * s(t * 9 + 1.7);
      p.pitch = 0.15;
      p.roll = 0.07 * s(t * 4);
      break;
    case 'chat-low':
      p.pitch = -0.22;
      p.aRX = -0.5 + 0.3 * s(t * 1.5);
      p.aLX = -0.3;
      p.headY = 0.12 * s(t * 0.6);
      break;
    case 'present':
      p.aRZ = -1.4 + 0.2 * s(t * 1.5);
      p.aRX = -0.3;
      p.aLX = -0.5 + 0.2 * s(t * 1.1);
      p.headY = 0.35 * s(t * 0.5);
      break;
    case 'watch':
      p.aLX = -1.2;
      p.aRX = -1.2;
      p.aLZ = 0.55;
      p.aRZ = -0.55;
      p.roll = 0.03 * s(t * 0.8);
      p.headX = -0.12 + 0.05 * s(t * 0.4);
      break;
    case 'whiteboard':
      p.aRX = -2.0 + 0.15 * s(t * 6);
      p.aRZ = -0.15 * s(t * 3);
      p.headX = -0.1;
      break;
    case 'bench':
      p.aLX = -0.95 + 0.1 * s(t * 7);
      p.aRX = -0.95 + 0.1 * s(t * 7 + 2);
      p.pitch = 0.12;
      p.headX = 0.3;
      break;
    case 'devices':
      p.aRX = -1.6 + 0.2 * s(t * 2);
      p.aLX = -1.0;
      p.headX = -0.05;
      break;
    case 'server':
      p.aLX = -1.0;
      p.aRX = -1.0;
      p.headX = 0.25 + 0.08 * s(t * 0.9);
      break;
    case 'discuss':
      p.aRX = -0.6 + 0.4 * s(t * 2);
      p.aLX = -0.4 + 0.3 * s(t * 2 + 1.3);
      p.headX = 0.06 * s(t * 1.7);
      break;
    case 'dine':
      p.aRX = -1.2 - 0.6 * (0.5 + 0.5 * s(t * 2));
      p.aLX = -1.1;
      p.headX = 0.12;
      break;
    case 'cook':
      p.aRX = -1.1;
      p.aRZ = -0.3 * s(t * 4);
      p.aLX = -0.9;
      p.headX = 0.25;
      break;
    case 'barista':
      p.aRX = -1.2 + 0.2 * s(t * 3);
      p.aLX = -1.0;
      p.headX = 0.15;
      break;
    case 'coffee':
      p.aRX = -1.5 + 0.45 * s(t * 0.8);
      p.aLX = -0.2;
      p.headY = 0.1 * s(t * 0.5);
      break;
    case 'talk':
      p.aLX = -0.35 + 0.25 * s(t * 1.8);
      p.aRX = -0.25;
      p.headY = 0.12 * s(t * 0.9);
      break;
    case 'read':
      p.aLX = -1.25;
      p.aRX = -1.25;
      p.aLZ = 0.25;
      p.aRZ = -0.25;
      p.headX = 0.35 + 0.04 * s(t * 0.3);
      break;
    case 'browse':
      p.aRX = -1.7 + 0.4 * s(t * 1.1);
      p.aLX = -0.9;
      p.headX = -0.15;
      break;
    case 'nap':
      p.aLX = -0.15;
      p.aRX = -0.15;
      p.bodyY = 0.004 * s(t * 1.4);
      break;
    case 'type':
      p.aLX = -1.15 + s(t * 13) * 0.14;
      p.aRX = -1.15 + s(t * 13 + Math.PI) * 0.14;
      p.headX = 0.15;
      break;
    case 'visit':
      p.aLX = 0.15;
      p.aRX = -0.2;
      p.headY = 0.3 * s(t * 0.5);
      p.roll = 0.02 * s(t * 0.7);
      break;
  }
  return p;
}

// ---------------------------------------------------------------- furniture they bring

function furniture(floor: number): BufferGeometry | null {
  const y = floor * FLOOR_HEIGHT + FLOOR_TOP;
  const X = wingX;
  const box = (s: Sculptor, c: number, x: number, yy: number, z: number, w: number, h: number, d: number): void => part(s, LO.box, c, [x, y + yy, z], [w, h, d]);
  const books = PALETTE.books;
  switch (floor) {
    case 0:
      return bake((s) => {
        // Cube stools for the extra diners.
        for (const a of LIFE_ANCHORS) if (a.floor === 0 && a.activity === 'dine') box(s, books[1], a.x, 0.165, a.z, 0.3, 0.33, 0.3);
      });
    case 1:
      return bake((s) => {
        for (const lx of [0.3, 5.05]) {
          box(s, PALETTE.charcoal, X(lx), 0.05, -4.0, 0.66, 0.1, 1.5); // treadmill deck
          box(s, PALETTE.graphite, X(lx), 0.5, -4.85, 0.6, 0.9, 0.05); // upright
          box(s, PALETTE.charcoal, X(lx), 1.03, -4.9, 0.64, 0.16, 0.2); // console
        }
        box(s, books[4], X(-3.6), 0.006, -1.8, 1.0, 0.012, 0.55); // stretching mat
        box(s, books[1], X(3.0), 0.38, 1.75, 0.84, 0.04, 1.5); // ping-pong top
        box(s, PALETTE.white, X(3.0), 0.44, 1.75, 0.9, 0.08, 0.02); // net
        box(s, PALETTE.charcoal, X(3.0), 0.18, 1.75, 0.5, 0.36, 1.0); // base
        box(s, PALETTE.oak, X(4.4), 0.42, 1.8, 1.1, 0.25, 0.65); // foosball body
        box(s, PALETTE.charcoal, X(4.4), 0.15, 1.8, 0.9, 0.3, 0.5); // foosball stand
        for (const [z, c] of [[3.05, books[0]], [4.25, books[2]]] as const) part(s, LO.pod, c, [X(-4.95), y + 0.12, z], [0.3, 0.165, 0.3]);
      });
    case 2:
      return bake((s) => {
        box(s, PALETTE.fabricBlue, X(-2.95), 0.14, -2.5, 0.5, 0.28, 1.2); // recliner
        box(s, PALETTE.fabric, X(-2.95), 0.32, -2.98, 0.48, 0.1, 0.3); // headrest
      });
    default:
      return null;
  }
}

// ---------------------------------------------------------------- model

const FURNITURE_FLOORS = [0, 1, 2] as const;

export function createRoomLife(options: RoomLifeOptions = {}): RoomLife {
  const seed = options.seed ?? 1;
  const sim = createRoomLifeSim({ seed, reducedMotion: options.reducedMotion, officeTime: options.officeTime });
  const group = new Group();
  group.name = 'room-life';
  group.userData.pickable = false;
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, vertexColors: true });
  const anchors = LIFE_ANCHORS;
  const n = anchors.length;

  const inst = (name: string, geo: BufferGeometry, count: number): InstancedMesh => {
    const m = new InstancedMesh(geo, material, Math.max(1, count));
    m.name = `room-life:${name}`;
    m.count = count;
    m.frustumCulled = false; // instances move between floors; one bounding sphere would be stale
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
    return m;
  };
  const longHair = anchors.map((_, i) => unit(seed, i, 3) < 0.45);
  const torso = inst('torso', GEO.torso, n);
  const head = inst('head', GEO.head, n);
  const hairS = inst('hair-short', GEO.hairShort, longHair.filter((l) => !l).length);
  const hairL = inst('hair-long', GEO.hairLong, longHair.filter((l) => l).length);
  const arm = inst('arm', GEO.arm, 2 * n);
  const hand = inst('hand', GEO.hand, 2 * n);
  const leg = inst('leg', GEO.leg, 2 * n);
  const heldKinds: HeldProp[] = ['cup', 'book', 'tablet', 'paddle', 'dumbbell'];
  const held = new Map<HeldProp, { mesh: InstancedMesh; owners: number[] }>();
  for (const k of heldKinds) {
    const owners = anchors.flatMap((a, i) => (a.held.includes(k) ? [i] : []));
    if (owners.length) held.set(k, { mesh: inst(`held-${k}`, HELD_GEO[k], owners.length), owners });
  }
  const furnitureMeshes: Mesh[] = [];
  for (const f of FURNITURE_FLOORS) {
    const g = furniture(f);
    if (!g) continue;
    const m = new Mesh(g, material);
    m.name = `room-life:furniture-${f}`;
    m.userData.floor = f;
    furnitureMeshes.push(m);
    group.add(m);
  }

  // Colours (fixed per person).
  const hairIndex: number[] = [];
  let si = 0;
  let li = 0;
  const c = new Color();
  anchors.forEach((a, i) => {
    hairIndex.push(longHair[i] ? li++ : si++);
    const skin = pick(SKIN, unit(seed, i, 1));
    const top = pick(TOPS[a.outfit], unit(seed, i, 2));
    const bottom = pick(BOTTOMS[a.outfit], unit(seed, i, 4));
    torso.setColorAt(i, c.setHex(top));
    head.setColorAt(i, c.setHex(skin));
    (longHair[i] ? hairL : hairS).setColorAt(hairIndex[i] ?? 0, c.setHex(a.outfit === 'chef' ? 0xf4f4f0 : pick(HAIR, unit(seed, i, 5))));
    for (const s of [0, 1]) {
      arm.setColorAt(2 * i + s, c.setHex(top));
      hand.setColorAt(2 * i + s, c.setHex(skin));
      leg.setColorAt(2 * i + s, c.setHex(bottom));
    }
  });
  for (const k of heldKinds) {
    const h = held.get(k);
    if (h) h.owners.forEach((_, j) => h.mesh.setColorAt(j, c.setHex(0xffffff)));
  }

  const heights = anchors.map((_, i) => BASE_SCALE * (0.94 + 0.12 * unit(seed, i, 6)));
  let view: RoomLifeViewState = { mode: 'overview', focusFloor: 0 };
  let org = false;
  const visibleOn = (floor: number): boolean => view.mode === 'overview' || floor === view.focusFloor;

  const P = new Matrix4();
  const B = new Matrix4();
  const H = new Matrix4();
  const M = new Matrix4();
  const R = new Matrix4();
  const T = new Matrix4();
  const e = new Euler();
  const ZERO = new Matrix4().makeScale(0, 0, 0);
  const rot = (x: number, y: number, z: number): Matrix4 => R.makeRotationFromEuler(e.set(x, y, z));
  const armMats: [Matrix4, Matrix4] = [new Matrix4(), new Matrix4()];

  const place = (i: number, a: LifeAnchor, v: LifeView): void => {
    const s = heights[i] ?? BASE_SCALE;
    const scale = v.appear * (visibleOn(a.floor) ? 1 : 0);
    if (scale <= 0) {
      torso.setMatrixAt(i, ZERO);
      head.setMatrixAt(i, ZERO);
      (longHair[i] ? hairL : hairS).setMatrixAt(hairIndex[i] ?? 0, ZERO);
      for (const k of [0, 1]) {
        arm.setMatrixAt(2 * i + k, ZERO);
        hand.setMatrixAt(2 * i + k, ZERO);
        leg.setMatrixAt(2 * i + k, ZERO);
      }
      for (const h of held.values()) {
        const j = h.owners.indexOf(i);
        if (j >= 0) h.mesh.setMatrixAt(j, ZERO);
      }
      return;
    }
    const p = poseFor(v.activity, v.t);
    const base = a.floor * FLOOR_HEIGHT + FLOOR_TOP;
    const hip = 0.1 * s;
    if (v.posture === 'lie') {
      P.makeTranslation(v.x, base + v.seat + 0.12, v.z).multiply(rot(0, v.facing, 0)).multiply(T.makeTranslation(0, 0, 0.48)).multiply(rot(-Math.PI / 2, 0, 0));
    } else {
      const lift = v.posture === 'stand' ? 0 : v.seat - hip + 0.01;
      P.makeTranslation(v.x, base + lift, v.z).multiply(rot(0, v.facing, 0));
      if (v.posture === 'sit') {
        p.lLX = -1.35;
        p.lRX = -1.35;
      } else if (v.posture === 'low') {
        p.lLX = -1.2;
        p.lRX = -1.2;
      }
    }
    P.multiply(T.makeScale(s * scale, s * scale, s * scale));
    B.copy(P).multiply(T.makeTranslation(0, p.bodyY, 0)).multiply(rot(p.pitch, 0, p.roll));
    torso.setMatrixAt(i, B);
    H.copy(B).multiply(T.makeTranslation(0, 0.4, 0)).multiply(rot(p.headX, p.headY, 0));
    head.setMatrixAt(i, H);
    (longHair[i] ? hairL : hairS).setMatrixAt(hairIndex[i] ?? 0, H);
    const arms: [number, number, number][] = [
      [-0.135, p.aLX, p.aLZ],
      [0.135, p.aRX, p.aRZ],
    ];
    arms.forEach(([x, rx, rz], k) => {
      const am = armMats[k as 0 | 1].copy(B).multiply(T.makeTranslation(x, 0.33, 0)).multiply(rot(rx, 0, rz));
      arm.setMatrixAt(2 * i + k, am);
      hand.setMatrixAt(2 * i + k, am);
    });
    const legs: [number, number, number][] = [
      [-0.052, p.lLX, p.lLZ],
      [0.052, p.lRX, p.lRZ],
    ];
    legs.forEach(([x, rx, rz], k) => {
      M.copy(P).multiply(T.makeTranslation(x, 0.1, 0)).multiply(rot(rx, 0, rz));
      leg.setMatrixAt(2 * i + k, M);
    });
    for (const h of held.values()) {
      const j = h.owners.indexOf(i);
      if (j >= 0) h.mesh.setMatrixAt(j, armMats[1]);
    }
  };

  const setOpacity = (o: number): void => {
    const transparent = o < 1;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = o;
    material.depthWrite = o >= 0.5;
  };

  const apply = (): void => {
    const views = sim.snapshot();
    views.forEach((v, i) => {
      const a = anchors[i];
      if (a) place(i, a, v);
    });
    for (const m of [torso, head, hairS, hairL, arm, hand, leg, ...[...held.values()].map((h) => h.mesh)]) {
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = view.mode === 'floor' && !org;
    }
    for (const m of furnitureMeshes) m.visible = visibleOn(typeof m.userData.floor === 'number' ? m.userData.floor : -1);
    setOpacity(org ? ORG_OPACITY : 1);
  };
  // Colour buffers are written once.
  for (const m of [torso, head, hairS, hairL, arm, hand, leg, ...[...held.values()].map((h) => h.mesh)]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  apply();

  return {
    group,
    sim,
    step(dt) {
      if (org) return;
      sim.step(dt);
      apply();
    },
    setView(v) {
      view = { ...v };
      apply();
    },
    setOrg(on) {
      org = on;
      sim.setOrg(on);
      apply();
    },
    setReducedMotion(on) {
      sim.setReducedMotion(on);
      apply();
    },
    setOfficeTime(hhmm) {
      sim.setOfficeTime(hhmm);
    },
    torsoMatrix(id) {
      const i = anchors.findIndex((a) => a.id === id);
      if (i < 0) return null;
      const m = new Matrix4();
      torso.getMatrixAt(i, m);
      return m;
    },
  };
}
