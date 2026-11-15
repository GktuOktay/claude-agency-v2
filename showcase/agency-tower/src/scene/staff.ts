// Staff NPC meshes (CEO-authorized expansion, KARARLAR rev 31): procedural robots in the agency art direction,
// dressed as staff (cleaner with cart and mop, tea server with a tray of tulip glasses, guards with peaked
// caps), plus the floor-0 security desk and speed-gate turnstile. Each character is five merged,
// vertex-coloured meshes (body, two arms, two legs); the props are one mesh. Never pickable, no unit ids.
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLOOR_HEIGHT, FLOOR_TOP, LOBBY_FLOOR, SECURITY_DESK, TURNSTILE, type FloorLayout } from '../sim/layout';
import { createStaffSim, type SpeechEvent, type StaffEvent, type StaffRole, type StaffView } from '../sim/staffSim';

/** Same enlargement as the agency robots (robot.ts ROBOT_BASE_SCALE), kept local so staff stay decoupled. */
const STAFF_SCALE = 1.4;
/** Head-top height above the feet (for speech-bubble anchors). */
export const STAFF_HEAD_Y = 0.69 * STAFF_SCALE + 0.06;
const TURN_RATE = 10; // rad/s of yaw easing (cut under reduced motion and org mode)

export interface StaffViewState {
  mode: 'overview' | 'floor';
  focusFloor: number;
}

export interface StaffOptions {
  layouts: readonly FloorLayout[];
  seed: number;
  reducedMotion?: boolean;
}

export interface StaffModel {
  group: Group;
  /** Advances the sim by dt seconds and updates the meshes. Frozen in org mode. */
  step(dtSeconds: number): void;
  snapshot(): StaffView[];
  setView(v: StaffViewState): void;
  setOrg(on: boolean): void;
  setReducedMotion(on: boolean): void;
  onSpeech(listener: (e: SpeechEvent) => void): () => void;
  drainEvents(): StaffEvent[];
  /** World-space anchor above a staff member's head (bubble placement), or null for an unknown id. */
  headPosition(id: string): Vector3 | null;
}

// ---------------------------------------------------------------- geometry helpers

interface PartOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

/** A transformed, vertex-coloured copy of a primitive, ready to merge. */
function part(g: BufferGeometry, color: number, x: number, y: number, z: number, o: PartOpts = {}): BufferGeometry {
  // RoundedBoxGeometry is non-indexed; index it so every part merges (and shares its seam-free vertices).
  const p = g.index ? g.clone() : mergeVertices(g);
  p.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  if (o.rx) p.rotateX(o.rx);
  if (o.ry) p.rotateY(o.ry);
  if (o.rz) p.rotateZ(o.rz);
  p.translate(x, y, z);
  const c = new Color(color);
  const n = p.attributes.position?.count ?? 0;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) rgb.set([c.r, c.g, c.b], i * 3);
  p.setAttribute('color', new Float32BufferAttribute(rgb, 3));
  return p;
}

function merge(parts: BufferGeometry[], name: string): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error(`staff geometry ${name} did not merge`);
  for (const p of parts) p.dispose();
  return g;
}

// Low-segment primitives (staff are small at diorama scale).
const P = {
  torso: new CapsuleGeometry(0.115, 0.08, 4, 12),
  band: new CylinderGeometry(0.119, 0.112, 0.07, 14),
  head: new RoundedBoxGeometry(0.27, 0.2, 0.23, 2, 0.06),
  visor: new RoundedBoxGeometry(0.21, 0.1, 0.03, 1, 0.015),
  eye: new SphereGeometry(0.021, 8, 6),
  ear: new CylinderGeometry(0.035, 0.035, 0.03, 10),
  antenna: new CylinderGeometry(0.008, 0.008, 0.06, 5),
  tip: new SphereGeometry(0.022, 8, 6),
  arm: new CapsuleGeometry(0.03, 0.1, 3, 6),
  hand: new SphereGeometry(0.034, 8, 6),
  leg: new CapsuleGeometry(0.035, 0.04, 3, 6),
  box: new BoxGeometry(1, 1, 1),
  cyl: new CylinderGeometry(1, 1, 1, 10),
  ring: new TorusGeometry(0.118, 0.014, 5, 16),
  /** Turkish tulip tea glass (ince belli): foot, waist, bulb, flared rim. */
  tulip: new LatheGeometry(
    [new Vector2(0, 0), new Vector2(0.012, 0), new Vector2(0.008, 0.006), new Vector2(0.012, 0.02), new Vector2(0.008, 0.033), new Vector2(0.012, 0.05), new Vector2(0.013, 0.056), new Vector2(0, 0.052)],
    8,
  ),
};

const C = {
  shell: 0xf5f6f8,
  limb: 0xc9ced6,
  visor: 0x1f2a33,
  eye: 0xbff3ff,
  cleaner: 0x3fa58f,
  cleanerTrim: 0x2a7a69,
  cart: 0xf2c14e,
  bucket: 0x3f7fd0,
  wheel: 0x2b2f36,
  mopStick: 0x8a8f98,
  mopHead: 0xe9e4d6,
  shirt: 0xf4f1ea,
  vest: 0x3b2a2a,
  bowtie: 0xb3262e,
  tray: 0xd8dbe0,
  tea: 0xa8461c,
  saucer: 0xc8102e,
  guard: 0x2a3a5c,
  guardTrim: 0x1b2640,
  badge: 0xe0b43c,
  radio: 0x23262b,
  deskWhite: 0xf3f1ec,
  oak: 0xc89b6a,
  steel: 0xb8bfc7,
  glass: 0xbfe3ef,
  go: 0x4cc38a,
  screen: 0x274a6b,
};

// ---------------------------------------------------------------- characters

interface Character {
  id: string;
  role: StaffRole;
  group: Group;
  body: Mesh;
  armL: Mesh;
  armR: Mesh;
  legL: Mesh;
  legR: Mesh;
  material: MeshStandardMaterial;
  yaw: number;
}

const noRaycast = (): void => undefined;

function mesh(geo: BufferGeometry, mat: MeshStandardMaterial, name: string, x: number, y: number, z: number): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.position.set(x, y, z);
  m.raycast = noRaycast;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function bodyParts(role: StaffRole): BufferGeometry[] {
  const cleaner = role === 'cleaner';
  const tea = role === 'tea';
  const guard = role === 'guard-desk' || role === 'guard-patrol';
  const suit = cleaner ? C.cleaner : tea ? C.shirt : C.guard;
  const trim = cleaner ? C.cleanerTrim : tea ? C.vest : C.guardTrim;
  const out: BufferGeometry[] = [
    part(P.torso, suit, 0, 0.24, 0, { sz: 0.88 }),
    part(P.band, trim, 0, 0.165, 0, { sz: 0.9 }),
    part(P.head, C.shell, 0, 0.5, 0),
    part(P.visor, C.visor, 0, 0.505, 0.11),
    part(P.eye, C.eye, -0.048, 0.508, 0.125, { sy: 1.15, sz: 0.5 }),
    part(P.eye, C.eye, 0.048, 0.508, 0.125, { sy: 1.15, sz: 0.5 }),
    part(P.ear, trim, -0.142, 0.5, 0, { rz: Math.PI / 2 }),
    part(P.ear, trim, 0.142, 0.5, 0, { rz: Math.PI / 2 }),
  ];
  if (!guard) out.push(part(P.antenna, C.limb, 0, 0.625, 0), part(P.tip, trim, 0, 0.668, 0));
  if (cleaner) {
    // Headband, then the cleaning cart pushed in front: frame, bucket, handle, four wheels.
    out.push(part(P.ring, C.cleanerTrim, 0, 0.56, 0, { rx: Math.PI / 2, sz: 0.9 }));
    out.push(part(P.box, C.cart, 0, 0.17, 0.34, { sx: 0.2, sy: 0.16, sz: 0.22 }));
    out.push(part(P.cyl, C.bucket, 0, 0.29, 0.36, { sx: 0.065, sy: 0.08, sz: 0.065 }));
    out.push(part(P.cyl, C.mopStick, -0.11, 0.27, 0.22, { sx: 0.008, sy: 0.24, sz: 0.008, rz: Math.PI / 2 }));
    for (const [x, z] of [[-0.08, 0.25], [0.08, 0.25], [-0.08, 0.43], [0.08, 0.43]] as const) out.push(part(P.cyl, C.wheel, x, 0.035, z, { sx: 0.03, sy: 0.02, sz: 0.03, rz: Math.PI / 2 }));
  } else if (tea) {
    // Black vest panels and a red bow tie; the round tray with four tulip glasses on red saucers.
    out.push(part(P.box, C.vest, 0, 0.25, 0.088, { sx: 0.16, sy: 0.13, sz: 0.02 }));
    out.push(part(P.box, C.bowtie, 0, 0.345, 0.1, { sx: 0.06, sy: 0.022, sz: 0.02 }));
    out.push(part(P.cyl, C.tray, 0, 0.285, 0.2, { sx: 0.105, sy: 0.012, sz: 0.105 }));
    for (const [x, z] of [[-0.045, 0.165], [0.045, 0.165], [-0.045, 0.235], [0.045, 0.235]] as const) {
      out.push(part(P.cyl, C.saucer, x, 0.294, z, { sx: 0.024, sy: 0.005, sz: 0.024 }));
      out.push(part(P.tulip, C.tea, x, 0.297, z));
    }
  } else {
    // Peaked cap, gold badge; the patrol guard carries a radio on the belt.
    out.push(part(P.cyl, C.guard, 0, 0.625, 0, { sx: 0.125, sy: 0.055, sz: 0.125 }));
    out.push(part(P.cyl, C.guardTrim, 0, 0.6, 0.06, { sx: 0.13, sy: 0.012, sz: 0.11 }));
    out.push(part(P.cyl, C.badge, 0.05, 0.3, 0.1, { sx: 0.03, sy: 0.012, sz: 0.03, rx: Math.PI / 2 }));
    if (role === 'guard-patrol') out.push(part(P.box, C.radio, -0.1, 0.17, 0.06, { sx: 0.04, sy: 0.07, sz: 0.03 }));
  }
  return out;
}

function armParts(role: StaffRole, right: boolean): BufferGeometry[] {
  const sleeve = role === 'cleaner' ? C.cleaner : role === 'tea' ? C.shirt : C.guard;
  const out = [part(P.arm, sleeve, 0, -0.08, 0), part(P.hand, C.shell, 0, -0.155, 0)];
  if (role === 'cleaner' && right) {
    // Mop in the right hand: stick down to the floor and a flat head.
    out.push(part(P.cyl, C.mopStick, 0, -0.15, 0.03, { sx: 0.008, sy: 0.36, sz: 0.008 }));
    out.push(part(P.box, C.mopHead, 0, -0.325, 0.03, { sx: 0.12, sy: 0.02, sz: 0.05 }));
  }
  return out;
}

function createCharacter(id: string, role: StaffRole): Character {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 });
  const group = new Group();
  group.name = id;
  const inner = new Group();
  inner.scale.setScalar(STAFF_SCALE);
  group.add(inner);
  const body = mesh(merge(bodyParts(role), `${id}-body`), material, 'staff-body', 0, 0, 0);
  const armL = mesh(merge(armParts(role, false), `${id}-armL`), material, 'staff-limb-arm-l', -0.145, 0.33, 0);
  const armR = mesh(merge(armParts(role, true), `${id}-armR`), material, 'staff-limb-arm-r', 0.145, 0.33, 0);
  const legGeo = (): BufferGeometry => merge([part(P.leg, C.limb, 0, -0.045, 0)], `${id}-leg`);
  const legL = mesh(legGeo(), material, 'staff-limb-leg-l', -0.055, 0.1, 0);
  const legR = mesh(legGeo(), material, 'staff-limb-leg-r', 0.055, 0.1, 0);
  body.add(armL, armR);
  inner.add(body, legL, legR);
  return { id, role, group, body, armL, armR, legL, legR, material, yaw: 0 };
}

// ---------------------------------------------------------------- lobby props

function createProps(): { group: Group; material: MeshStandardMaterial } {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15 });
  const d = SECURITY_DESK;
  const t = TURNSTILE;
  const parts: BufferGeometry[] = [
    // Security desk: white body, oak top, navy front band, a monitor facing the guard (north side).
    part(P.box, C.deskWhite, d.x, d.height / 2 - 0.02, d.z, { sx: d.hw * 2 - 0.04, sy: d.height - 0.04, sz: d.hd * 2 - 0.04 }),
    part(new RoundedBoxGeometry(d.hw * 2, 0.04, d.hd * 2, 1, 0.015), C.oak, d.x, d.height - 0.02, d.z),
    part(P.box, C.guard, d.x, d.height * 0.55, d.z + d.hd - 0.025, { sx: d.hw * 2 - 0.1, sy: 0.06, sz: 0.01 }),
    part(P.box, C.radio, d.x + 0.15, d.height + 0.11, d.z + 0.02, { sx: 0.3, sy: 0.18, sz: 0.025 }),
    part(P.box, C.screen, d.x + 0.15, d.height + 0.11, d.z + 0.005, { sx: 0.27, sy: 0.15, sz: 0.008 }),
    part(P.cyl, C.radio, d.x + 0.15, d.height + 0.02, d.z + 0.03, { sx: 0.02, sy: 0.04, sz: 0.02 }),
  ];
  // Speed-gate turnstile: two steel cabinets with dark tops, glass fins and green "go" lights.
  const off = t.gap / 2 + t.cabinetHw;
  for (const side of [-1, 1]) {
    const x = t.x + side * off;
    parts.push(part(P.box, C.steel, x, t.height / 2, t.z, { sx: t.cabinetHw * 2, sy: t.height, sz: t.cabinetHd * 2 }));
    parts.push(part(P.box, C.radio, x, t.height + 0.01, t.z, { sx: t.cabinetHw * 2, sy: 0.02, sz: t.cabinetHd * 2 }));
    parts.push(part(P.box, C.glass, x, t.height + 0.12, t.z, { sx: 0.012, sy: 0.2, sz: t.cabinetHd * 1.6 }));
    parts.push(part(P.box, C.go, x, t.height + 0.025, t.z + t.cabinetHd - 0.04, { sx: 0.05, sy: 0.012, sz: 0.04 }));
  }
  const group = new Group();
  group.name = 'staff-props';
  group.position.y = LOBBY_FLOOR * FLOOR_HEIGHT + FLOOR_TOP;
  const m = mesh(merge(parts, 'staff-props'), material, 'staff-lobby-props', 0, 0, 0);
  m.userData.shadow = 'object';
  group.add(m);
  return { group, material };
}

// ---------------------------------------------------------------- poses

/** Limb pose for a staff state. `t` and `walkPhase` are 0 when still (reduced motion, org): a static pose. */
function pose(c: Character, v: StaffView, t: number, still: boolean): void {
  const walkPhase = still ? 0 : v.walkPhase;
  const time = still ? 0 : t;
  for (const m of [c.armL, c.armR, c.legL, c.legR]) m.rotation.set(0, 0, 0);
  c.body.position.y = 0;
  c.body.rotation.set(0, 0, 0);
  const tray = c.role === 'tea';
  if (tray) {
    c.armL.rotation.x = -1.25;
    c.armR.rotation.x = -1.25;
  }
  switch (v.state) {
    case 'walk': {
      const s = Math.sin(walkPhase * 2.2);
      c.legL.rotation.x = s * 0.7;
      c.legR.rotation.x = -s * 0.7;
      c.body.position.y = Math.abs(s) * 0.02;
      if (c.role === 'cleaner') {
        c.armL.rotation.x = -1.1; // pushes the cart
        c.armR.rotation.x = -s * 0.2; // the mop trails
      } else if (!tray) {
        c.armL.rotation.x = -s * 0.5;
        c.armR.rotation.x = s * 0.5;
      }
      break;
    }
    case 'mop':
      c.armL.rotation.x = -0.5;
      c.armR.rotation.x = -0.25 + Math.sin(time * 3) * 0.35;
      c.armR.rotation.z = Math.sin(time * 1.5) * 0.12;
      c.body.rotation.x = 0.08;
      break;
    case 'serve':
      c.armR.rotation.x = -1.45; // offers the tray
      c.body.rotation.x = 0.1; // a small bow
      break;
    case 'refill':
      c.armR.rotation.x = -1.6;
      break;
    case 'guard':
      c.armL.rotation.z = 0.12;
      c.armR.rotation.z = -0.12;
      c.body.position.y = Math.sin(time * 1.6) * 0.006;
      break;
    default:
      if (c.role === 'cleaner') c.armL.rotation.x = -0.6;
      c.body.position.y = tray ? 0 : Math.sin(time * 2) * 0.006;
  }
}

const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- model

export function createStaff(options: StaffOptions): StaffModel {
  const sim = createStaffSim(options.layouts, options.seed);
  let reduced = options.reducedMotion ?? false;
  if (reduced) sim.setReducedMotion(true);
  let org = false;
  let clock = 0;
  let view: StaffViewState = { mode: 'overview', focusFloor: 0 };
  let beforeOrg: StaffViewState = view;

  const group = new Group();
  group.name = 'staff';
  const chars = new Map<string, Character>();
  for (const v of sim.snapshot()) {
    const c = createCharacter(v.id, v.role);
    c.yaw = v.facing;
    chars.set(v.id, c);
    group.add(c.group);
  }
  const props = createProps();
  group.add(props.group);

  const visibleOn = (floor: number): boolean => view.mode === 'overview' || floor === view.focusFloor;
  const setOpacity = (m: MeshStandardMaterial, o: number): void => {
    const transparent = o < 1;
    if (m.transparent !== transparent) {
      m.transparent = transparent;
      m.needsUpdate = true;
    }
    m.opacity = o;
    m.depthWrite = o >= 0.5;
  };

  const apply = (dt: number): void => {
    const still = reduced || org;
    for (const v of sim.snapshot()) {
      const c = chars.get(v.id);
      if (!c) continue;
      c.group.position.set(v.x, v.floor * FLOOR_HEIGHT + FLOOR_TOP, v.z);
      if (still) c.yaw = v.facing;
      else {
        const d = wrapAngle(v.facing - c.yaw);
        const stepMax = TURN_RATE * dt;
        c.yaw = Math.abs(d) <= stepMax ? v.facing : c.yaw + Math.sign(d) * stepMax;
      }
      c.group.rotation.y = c.yaw;
      setOpacity(c.material, v.opacity);
      c.group.visible = visibleOn(v.floor) && v.opacity > 0.001;
      const focused = view.mode === 'floor' && v.floor === view.focusFloor;
      c.group.traverse((o) => {
        if (o instanceof Mesh) o.castShadow = focused;
      });
      pose(c, v, clock + v.id.length, still);
    }
    props.group.visible = visibleOn(LOBBY_FLOOR);
    setOpacity(props.material, org ? 0.1 : 1);
  };
  apply(0);

  return {
    group,
    step(dtSeconds) {
      if (org) return; // frozen: no sim step, no pose change (AC-14 style)
      const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
      sim.step(dt);
      clock += dt;
      apply(dt);
    },
    snapshot: () => sim.snapshot(),
    setView(v) {
      view = { ...v };
      apply(0);
    },
    setOrg(on) {
      if (on === org) return;
      org = on;
      sim.setOrg(on);
      // Like TowerModel.setOrg: org shows the overview; leaving it restores the previous view.
      if (on) {
        beforeOrg = view;
        view = { mode: 'overview', focusFloor: 0 };
      } else view = beforeOrg;
      apply(0);
    },
    setReducedMotion(on) {
      reduced = on;
      sim.setReducedMotion(on);
      apply(0);
    },
    onSpeech: (l) => sim.onSpeech(l),
    drainEvents: () => sim.drainEvents(),
    headPosition(id) {
      const c = chars.get(id);
      if (!c) return null;
      return new Vector3(c.group.position.x, c.group.position.y + STAFF_HEAD_Y, c.group.position.z);
    },
  };
}
