// Pure scene model: builds the tower from validated data. No renderer needed (testable in jsdom).
// Art direction: an isometric "office diorama" — oak floors, white shell, glass rooms, rounded furniture.
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShadowMaterial,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { TowerData, Unit } from '../data/types';
import { tr } from '../i18n/tr';
import { accentCss, floorAccent } from '../ui/accents';
import { sortUnits } from '../ui/unitList';
import {
  Kit,
  PALETTE,
  bistroTable,
  bookshelf,
  chair,
  coffeeIsland,
  coffeeTable,
  desk,
  floorLamp,
  fridge,
  glassPartition,
  globe,
  keyboard,
  mergeStatic,
  monitor,
  plant,
  rug,
  shellGeometry,
  sofa,
  stool,
  wallArt,
  type KitTextures,
  type ShadowRole,
} from './furniture';
import { createRobot, type MatOptions, type RobotParts } from './robot';
import { Screen } from './screen';

export const FLOOR_HEIGHT = 3;
export const FLOOR_COUNT = 6;
export const HALF_WIDTH = 8; // x extent of the building
export const HALF_DEPTH = 5.5; // z extent of the building
export const SHAFT_X = -9.3;
export const SHAFT_Z = -2.4;
/** Height of the walkable floor surface above a floor's base. */
export const FLOOR_TOP = 0.14;
export const WALL_HEIGHT = 1.2;
/** Height (above the floor surface) where room labels are anchored. */
export const ROOM_LABEL_Y = 1.25;

export { accentCss, floorAccent };

export interface FloorMaterials {
  walls: Material[];
  slab: Material[];
  contents: Material[];
  robots: Material[];
  /** Inherently translucent materials (glass panes, contact shadows): opacity = base × floor visibility. */
  tinted: Material[];
}

export interface FloorEntry {
  id: number;
  group: Group;
  materials: FloorMaterials;
  coffee: Vector3; // world-space station position
}

export interface RobotEntry {
  unit: Unit;
  floor: number;
  group: Group;
  parts: RobotParts;
  screen: Screen;
  workPoint: Vector3; // world space: seated position at its desk
  homePoint: Vector3; // world space: idle spot beside the desk
  coffeePoint: Vector3; // world space: spot at the coffee station
}

export interface RoomLabel {
  floor: number;
  text: string;
  /** The department's main room: the only label per floor shown in overview. */
  primary: boolean;
  position: Vector3; // world space anchor
}

export type ViewMode = 'overview' | 'floor';
export interface ViewState {
  mode: ViewMode;
  focusFloor: number;
}

export interface Cabin {
  group: Group;
  setHeight(y: number): void;
  getHeight(): number;
  setDoorsOpen(t: number): void;
  getDoorsOpen(): number;
}

export interface TowerModel {
  root: Group;
  floors: FloorEntry[];
  robots: RobotEntry[];
  rooms: RoomLabel[];
  cabin: Cabin;
  view: ViewState;
  setView(v: ViewState): void;
  pickableFloors(): Set<number>;
  /** Org-chart mode (REQ-17): translucent shell, every robot visible; off restores the previous view. */
  setOrg(on: boolean): void;
  isOrg(): boolean;
  /** 0 = day, 1 = night: window, floor-light and lamp glow. */
  setNight(n: number): void;
  nightMaterials(): MeshStandardMaterial[];
}

export interface BuildOptions {
  screenTexture?: () => Texture | null;
  textures?: Partial<KitTextures>;
}

const WALL_OVERVIEW = 0.25;
const GHOST = 0.08;
const BELOW_SLAB = 0.4;
const ORG_SHELL = 0.1;

const FLOOR_PROPS = ['reception-desk', 'server-rack', 'review-board', 'blueprint-table', 'meeting-table', 'globe'] as const;
type PropName = (typeof FLOOR_PROPS)[number];

// Layout (floor-local x/z). Desks line the back of the work room facing the back wall; robots idle in the
// aisle in front of them and queue at the coffee island on the same line, so straight walks stay clear.
const DESK_Z = -3.9;
const SEAT_OFFSET = 0.55;
const AISLE_Z = -2.3;
const DESK_SPACING = 2.0;
const WORK_CENTER_X = -2.4;
const COFFEE = { x: 5.6, z: -3.45 };
const PROP_AT = { x: -4.5, z: 2.6 };
const LOUNGE_AT = { x: 3.3, z: 2.4 };

/** Positions an object and returns it (Object3D.position is read-only, so no Object.assign). */
function at<T extends Group>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

function deskXs(count: number): number[] {
  const step = count <= 5 ? DESK_SPACING : 10 / Math.max(1, count - 1);
  const start = WORK_CENTER_X - ((count - 1) * step) / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function setOpacity(m: Material, o: number): void {
  const transparent = o < 1;
  if (m.transparent !== transparent) {
    m.transparent = transparent;
    m.needsUpdate = true;
  }
  m.opacity = o;
  m.depthWrite = o >= 0.5;
  m.visible = o > 0.001;
}

function setTinted(m: Material, factor: number): void {
  const base = typeof m.userData.baseOpacity === 'number' ? m.userData.baseOpacity : 0.2;
  m.transparent = true;
  m.opacity = base * factor;
  m.depthWrite = false;
  m.visible = m.opacity > 0.001;
}

function roleOf(o: Mesh): ShadowRole {
  const r: unknown = o.userData.shadow;
  return r === 'object' || r === 'surface' || r === 'slab' || r === 'none' ? r : 'object';
}

function buildProp(k: Kit, name: PropName, accent: number): Group {
  const g = new Group();
  g.name = `floor-prop:${name}`;
  g.position.set(PROP_AT.x, FLOOR_TOP, PROP_AT.z);
  switch (name) {
    case 'reception-desk': {
      k.blob(g, 3, 1.2, 0, 0);
      k.box(g, 2.4, 0.5, 0.55, 0.06, k.m(PALETTE.white), 0, 0, 0);
      k.box(g, 2.5, 0.04, 0.65, 0.02, k.m(PALETTE.oak), 0, 0.5, 0);
      k.box(g, 2.0, 0.05, 0.02, 0.01, k.m(accent, { emissive: accent, emissiveIntensity: 0.6 }), 0, 0.3, 0.285, 'none');
      g.add(at(chair(k, accent), 0, 0, -0.65));
      for (const x of [-1.6, 1.6]) g.add(at(plant(k, 1.3), x, 0, -0.3));
      g.add(at(rug(k, 2.4, 1.2, 0xe9dfd0, 0xd9cbb6), 0, 0, 1.2));
      break;
    }
    case 'server-rack': {
      for (let i = 0; i < 3; i++) {
        const x = -1 + i * 0.75;
        k.blob(g, 0.9, 0.9, x, 0);
        k.box(g, 0.6, 1.15, 0.6, 0.04, k.m(PALETTE.charcoal, { roughness: 0.4 }), x, 0, 0);
        for (let r = 0; r < 6; r++) {
          const led = r % 3 === 0 ? 0x7fe3ff : accent;
          k.box(g, 0.4, 0.02, 0.01, 0, k.m(led, { emissive: led, emissiveIntensity: 1.3 }), x, 0.2 + r * 0.15, 0.305, 'none');
        }
      }
      g.add(at(plant(k, 1.1), 1.4, 0, 0.4));
      break;
    }
    case 'review-board': {
      k.blob(g, 2.2, 0.6, 0, -0.6);
      for (const x of [-0.85, 0.85]) k.box(g, 0.05, 1.05, 0.05, 0.015, k.m(PALETTE.graphite), x, 0, -0.6);
      k.box(g, 1.85, 0.95, 0.05, 0.02, k.m(PALETTE.white, { roughness: 0.3 }), 0, 0.18, -0.6);
      const notes = [0xf6d55c, 0x9bd3ae, 0xf3a3a0, 0x9cc4ef, 0xf6d55c, accent];
      notes.forEach((c, i) => k.box(g, 0.16, 0.16, 0.01, 0, k.m(c, { roughness: 0.9 }), -0.6 + (i % 3) * 0.5, 0.45 + Math.floor(i / 3) * 0.3, -0.57, 'none'));
      for (const x of [-0.7, 0, 0.7]) {
        const c = chair(k, accent);
        c.position.set(x, 0, 0.7);
        g.add(c);
      }
      break;
    }
    case 'blueprint-table': {
      k.blob(g, 2.6, 1.4, 0, 0);
      k.box(g, 2.0, 0.045, 1.0, 0.02, k.m(PALETTE.oakDark), 0, 0.36, 0);
      for (const x of [-0.9, 0.9]) for (const z of [-0.4, 0.4]) k.box(g, 0.05, 0.36, 0.05, 0.015, k.m(PALETTE.charcoal), x, 0, z);
      k.box(g, 1.5, 0.006, 0.75, 0, k.m(0x4f7fc0, { roughness: 0.9 }), 0, 0.405, 0, 'none');
      for (let i = 0; i < 4; i++) k.box(g, 0.5, 0.004, 0.006, 0, k.m(0xdbe8f7), -0.3 + (i % 2) * 0.5, 0.411, -0.2 + i * 0.12, 'none');
      for (let i = 0; i < 2; i++) {
        const tube = k.cyl(g, 0.04, 0.04, 0.6, k.m(i ? 0xdbe8f7 : PALETTE.white), 0.6, 0.41, -0.25 + i * 0.1, 12);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.45;
      }
      for (const [x, z] of [[-0.6, 0.75], [0.6, 0.75], [-1.3, 0], [1.3, 0]] as const) g.add(at(stool(k, accent), x, 0, z));
      break;
    }
    case 'meeting-table': {
      k.blob(g, 3.2, 1.8, 0, 0);
      k.place(g, new RoundedBoxGeometry(2.4, 0.045, 1.1, 3, 0.02), k.m(PALETTE.oak), 0, 0.36, 0);
      k.box(g, 1.6, 0.34, 0.5, 0.08, k.m(PALETTE.white), 0, 0, 0);
      for (const x of [-0.75, 0, 0.75]) {
        for (const side of [-1, 1]) {
          const c = chair(k, accent);
          c.position.set(x, 0, side * 0.85);
          c.rotation.y = side > 0 ? 0 : Math.PI;
          g.add(c);
        }
      }
      k.cyl(g, 0.1, 0.08, 0.12, k.m(PALETTE.pot), 0, 0.38, 0, 14);
      k.ball(g, 0.1, k.m(PALETTE.leaf), 0, 0.56, 0, true);
      break;
    }
    case 'globe': {
      g.add(globe(k, accent));
      const arm = sofa(k, PALETTE.fabricBlue, accent, 0.9);
      arm.position.set(1.2, 0, 0.2);
      arm.rotation.y = -Math.PI / 2;
      g.add(arm);
      g.add(at(bookshelf(k, 1.6, 1.0, 3), -0.6, 0, -1.2));
      g.add(at(floorLamp(k), 1.3, 0, -0.9));
      break;
    }
  }
  return g;
}

function buildLounge(k: Kit, accent: number): Group {
  const g = new Group();
  g.name = 'lounge';
  g.position.set(LOUNGE_AT.x, FLOOR_TOP, LOUNGE_AT.z);
  g.add(at(rug(k, 3.4, 2.4, 0xefe6d8, 0xdccbb3), 0, 0, 0.3));
  g.add(at(sofa(k, PALETTE.fabric, accent, 1.8), 0, 0, -0.55));
  const side = sofa(k, PALETTE.fabricBlue, PALETTE.white, 1.3);
  side.position.set(1.85, 0, 0.45);
  side.rotation.y = -Math.PI / 2;
  g.add(side);
  g.add(at(coffeeTable(k), 0, 0, 0.45));
  g.add(at(floorLamp(k), -1.6, 0, -0.75));
  g.add(at(plant(k, 1.6), 4.0, 0, 2.5));
  g.add(at(plant(k, 1.2), -1.9, 0, 2.5));
  const shelf = bookshelf(k, 1.6, 0.95, 7);
  shelf.position.set(4.25, 0, 0.2);
  shelf.rotation.y = -Math.PI / 2;
  g.add(shelf);
  return g;
}

function buildCoffeeNook(k: Kit, accent: number, solidWall: boolean): Group {
  const g = new Group();
  g.name = 'coffee-station';
  g.position.set(COFFEE.x, FLOOR_TOP, COFFEE.z);
  g.add(coffeeIsland(k, accent));
  g.add(at(fridge(k), 1.7, 0, -1.6));
  g.add(at(bistroTable(k), -1.1, 0, -1.3));
  for (const x of [-1.5, -0.7]) g.add(at(stool(k, accent), x, 0, -1.3));
  g.add(at(plant(k, 1.4), 1.85, 0, 1.4));
  if (solidWall) {
    // Short solid wall between the work room and the coffee nook, with a picture on the coffee side.
    k.box(g, 0.08, WALL_HEIGHT * 0.9, 1.4, 0.02, k.m(PALETTE.white), -2.3, 0, -1.25, 'object');
    const art = wallArt(k, accent);
    art.position.set(-2.25, 0.42, -1.25);
    art.rotation.y = Math.PI / 2;
    g.add(art);
  }
  return g;
}

export function buildTower(data: TowerData, options: BuildOptions = {}): TowerModel {
  const root = new Group();
  root.name = 'tower';
  const floors: FloorEntry[] = [];
  const robots: RobotEntry[] = [];
  const rooms: RoomLabel[] = [];
  const kits: Kit[] = [];
  const textures: KitTextures = { wood: options.textures?.wood ?? null, hatch: options.textures?.hatch ?? null, blob: options.textures?.blob ?? null };
  const floorName = (id: number): string => data.floors.find((f) => f.id === id)?.nameTr ?? `${tr.floorShort} ${id}`;

  // Ground: catches only the tower's shadow (no visible plane), plus a soft contact shadow.
  const ground = new Mesh(new PlaneGeometry(140, 140).rotateX(-Math.PI / 2), new ShadowMaterial({ opacity: 0.1 }));
  ground.name = 'ground';
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  ground.userData.shadow = 'none';
  root.add(ground);
  if (textures.blob) {
    const base = new Mesh(new PlaneGeometry(HALF_WIDTH * 2 + 9, HALF_DEPTH * 2 + 7).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x3a2e22, map: textures.blob, transparent: true, opacity: 0.35, depthWrite: false }));
    base.name = 'ground-shadow';
    base.userData.shadow = 'none';
    base.raycast = () => undefined;
    root.add(base);
  }

  for (let id = 0; id < FLOOR_COUNT; id++) {
    const group = new Group();
    group.name = `floor-${id}`;
    group.position.y = id * FLOOR_HEIGHT;
    root.add(group);

    const materials: FloorMaterials = { walls: [], slab: [], contents: [], robots: [], tinted: [] };
    const k = new Kit(materials, textures);
    kits.push(k);
    const accent = floorAccent(id);
    const isPenthouse = id === FLOOR_COUNT - 1;

    // Slab with a wood floor and, on office floors, a hatched corridor.
    const slabMat = new MeshStandardMaterial({ color: PALETTE.white, roughness: 0.9 });
    materials.slab.push(slabMat);
    k.place(group, new RoundedBoxGeometry(HALF_WIDTH * 2 + 0.3, FLOOR_TOP, HALF_DEPTH * 2 + 0.3, 2, 0.05), slabMat, 0, FLOOR_TOP / 2, 0, 'slab', 'floor-slab');
    k.place(group, new PlaneGeometry(HALF_WIDTH * 2, HALF_DEPTH * 2).rotateX(-Math.PI / 2), k.surface(PALETTE.floorOak, textures.wood), 0, FLOOR_TOP + 0.002, 0, 'surface', 'floor-wood');
    const woodMat = k.surface(PALETTE.floorOak, textures.wood);
    if (woodMat instanceof MeshStandardMaterial) {
      woodMat.emissive.setHex(0xffb878);
      woodMat.emissiveIntensity = 0;
      woodMat.userData.glow = { day: 0, night: 0.16 }; // interior lights warm the floor at night
      k.glows.push(woodMat);
    }
    // Floor lights: small glowing pucks along the corridor, lit at night.
    for (const x of [-6, -3, 0, 3, 6]) {
      for (const z of isPenthouse ? [-1.2] : [-1.5, -0.3]) {
        k.cyl(group, 0.06, 0.07, 0.025, k.glow(0xfff1d6, 0xffcf8a, 0.15, 3.5), x, FLOOR_TOP, z, 14, 'none');
      }
    }
    if (!isPenthouse) {
      const corridor = new PlaneGeometry(HALF_WIDTH * 2 - 0.1, 1.4).rotateX(-Math.PI / 2);
      k.place(group, corridor, k.surface(PALETTE.hatch, textures.hatch), 0, FLOOR_TOP + 0.004, -0.9, 'surface', 'corridor');
    }

    // Exterior shell: white frames (glass on the penthouse).
    const wallName = isPenthouse ? 'glass-wall' : 'exterior-wall';
    const wallMat = new MeshStandardMaterial({ color: isPenthouse ? 0xe4f0f5 : PALETTE.white, roughness: 0.6, emissive: 0xffc27a, emissiveIntensity: 0 });
    wallMat.userData.glow = { day: 0, night: 1.1 }; // lit windows at night
    materials.walls.push(wallMat);
    k.glows.push(wallMat);
    k.place(group, shellGeometry(HALF_WIDTH, HALF_DEPTH, WALL_HEIGHT), wallMat, 0, FLOOR_TOP, 0, 'none', wallName);
    if (isPenthouse) {
      const paneMat = new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.1 });
      materials.walls.push(paneMat);
      for (const z of [-HALF_DEPTH, HALF_DEPTH]) k.box(group, HALF_WIDTH * 2, WALL_HEIGHT - 0.2, 0.02, 0, paneMat, 0, FLOOR_TOP + 0.14, z, 'none', 'glass-wall');
      for (const x of [-HALF_WIDTH, HALF_WIDTH]) k.box(group, 0.02, WALL_HEIGHT - 0.2, HALF_DEPTH * 2, 0, paneMat, x, FLOOR_TOP + 0.14, 0, 'none', 'glass-wall');
    }

    // Bridge to the elevator shaft.
    k.box(group, 0.9, 0.06, 1.4, 0.02, slabMat, SHAFT_X + 0.75, FLOOR_TOP - 0.06, SHAFT_Z, 'slab');

    // Rooms.
    group.add(buildCoffeeNook(k, accent, true));
    group.add(buildLounge(k, accent));
    const propName = FLOOR_PROPS[id] ?? 'meeting-table';
    group.add(buildProp(k, propName, accent));
    if (!isPenthouse) {
      group.add(glassPartition(k, -HALF_WIDTH + 0.1, -1.6, -3.1, -1.6));
      group.add(glassPartition(k, -2.1, -1.6, 3.25, -1.6));
      group.add(glassPartition(k, -HALF_WIDTH + 0.1, -0.2, -3.4, -0.2));
      group.add(glassPartition(k, -2.5, -0.2, -1.2, -0.2));
      group.add(glassPartition(k, -1.2, -0.2, -1.2, HALF_DEPTH - 0.1));
      for (const [x, z, s] of [[-7.45, -5.05, 1.3], [2.95, -1.85, 1.0], [-7.4, 4.95, 1.4], [-1.65, 0.25, 0.9]] as const) {
        group.add(at(plant(k, s), x, FLOOR_TOP, z));
      }
      for (const [x, seed] of [[-6.5, 1], [0.6, 4]] as const) {
        group.add(at(bookshelf(k, 1.3, 0.9, seed + id), x + 1, FLOOR_TOP, -5.18));
      }
    } else {
      group.add(at(rug(k, 4.2, 2.6, 0xeee3d3, PALETTE.oakDark), -1.2, FLOOR_TOP, -3.6));
      group.add(at(bookshelf(k, 3.0, 1.0, 11), -1.2, FLOOR_TOP, -5.15));
      for (const [x, z, s] of [[-7.4, -5.0, 1.7], [3.0, -5.0, 1.5], [-7.4, 5.0, 1.6], [7.4, 5.0, 1.6]] as const) {
        group.add(at(plant(k, s), x, FLOOR_TOP, z));
      }
      // Procedural skyline kept as a very faint, low ground-line silhouette on the horizon (no tall blocks).
      const sky = new Group();
      sky.name = 'skyline';
      const skyMat = k.m(0xe8e4dd, { roughness: 1 });
      for (let s = 0; s < 22; s++) {
        const h = 0.25 + ((s * 7) % 5) * 0.18;
        const w = 1.6 + (s % 3) * 0.8;
        k.box(sky, w, h, w * 0.6, 0.1, skyMat, -40 + s * 3.8, -id * FLOOR_HEIGHT, -30 - (s % 3) * 1.5, 'none', 'skyline-building');
      }
      group.add(sky);
    }

    rooms.push({ floor: id, text: floorName(id), primary: true, position: new Vector3(isPenthouse ? -1.2 : WORK_CENTER_X, id * FLOOR_HEIGHT + FLOOR_TOP + ROOM_LABEL_Y, -3.6) });
    rooms.push({ floor: id, text: tr.rooms.coffee, primary: false, position: new Vector3(COFFEE.x, id * FLOOR_HEIGHT + FLOOR_TOP + ROOM_LABEL_Y * 0.9, COFFEE.z - 0.6) });
    rooms.push({ floor: id, text: isPenthouse ? tr.rooms.sitting : tr.rooms.lounge, primary: false, position: new Vector3(LOUNGE_AT.x, id * FLOOR_HEIGHT + FLOOR_TOP + ROOM_LABEL_Y * 0.9, LOUNGE_AT.z) });
    rooms.push({ floor: id, text: tr.rooms[propName], primary: false, position: new Vector3(PROP_AT.x, id * FLOOR_HEIGHT + FLOOR_TOP + ROOM_LABEL_Y * 0.9, PROP_AT.z) });

    floors.push({ id, group, materials, coffee: new Vector3(COFFEE.x, id * FLOOR_HEIGHT + FLOOR_TOP, COFFEE.z) });
  }

  // Desks and robots per floor.
  for (const entry of floors) {
    const k = kits[entry.id];
    if (!k) continue;
    const units = sortUnits(data.units).filter((u) => u.floor === entry.id);
    const accent = floorAccent(entry.id);
    const robotMats = new Map<string, Material>();
    const robotMat = (color: number, opts: MatOptions = {}): Material => {
      const key = `${color}:${opts.emissive ?? ''}:${opts.roughness ?? ''}:${opts.metalness ?? ''}:${opts.emissiveIntensity ?? ''}`;
      let m = robotMats.get(key);
      if (!m) {
        m = new MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0, emissive: opts.emissive ?? 0, emissiveIntensity: opts.emissiveIntensity ?? 1 });
        entry.materials.robots.push(m);
        robotMats.set(key, m);
      }
      return m;
    };
    const baseY = entry.id * FLOOR_HEIGHT + FLOOR_TOP;
    const xs = deskXs(units.length);

    // One desk per unit; the CEO uses the signing desk. Units on a floor are ordered tier then name.
    units.forEach((unit, idx) => {
      const isCeo = unit.tier === 'ceo';
      const dx = isCeo ? -1.2 : (xs[idx] ?? 0);
      const deskGroup = desk(k, isCeo);
      deskGroup.name = isCeo ? 'signing-desk' : 'desk';
      deskGroup.position.set(dx, FLOOR_TOP, DESK_Z);
      entry.group.add(deskGroup);

      const texture = options.screenTexture ? options.screenTexture() : null;
      const screen = new Screen(texture);
      const screenMat: Material = texture ? new MeshBasicMaterial({ map: texture, toneMapped: false }) : new MeshBasicMaterial({ color: 0x1f6f4a });
      entry.materials.contents.push(screenMat);
      const mon = monitor(k, screenMat, isCeo);
      mon.position.set(0, 0.365, -0.12);
      deskGroup.add(mon);
      const kb = keyboard(k);
      kb.position.set(0, 0.365, 0.12);
      deskGroup.add(kb);
      if (idx % 2 === 0 || isCeo) {
        const p = plant(k, 0.45);
        p.position.set(isCeo ? -0.8 : -0.45, 0.365, -0.12);
        deskGroup.add(p);
      }

      const seatZ = DESK_Z + (isCeo ? 0.7 : SEAT_OFFSET);
      const seat = chair(k, accent, isCeo);
      seat.position.set(dx, FLOOR_TOP, seatZ);
      entry.group.add(seat);

      const { group, parts } = createRobot(unit, accent, robotMat);
      k.blob(group, 0.6, 0.6, 0, 0, 0.012);
      group.traverse((o) => {
        if (o instanceof Mesh && o.name !== 'contact-shadow') o.userData.shadow = 'object';
      });
      const work = new Vector3(dx, baseY, seatZ);
      const home = new Vector3(dx + (isCeo ? 1.6 : 0.55), baseY, AISLE_Z);
      const coffeePoint = new Vector3(entry.coffee.x - 0.85 + (idx % 3) * 0.85, baseY, entry.coffee.z + 0.7 + Math.floor(idx / 3) * 0.5);
      group.position.copy(home);
      root.add(group);
      robots.push({ unit, floor: entry.id, group, parts, screen, workPoint: work, homePoint: home, coffeePoint });
    });

    // Every floor has at least one desk (the penthouse adds a side desk next to the signing desk).
    if (!entry.group.children.some((c) => c.name === 'desk')) {
      const extra = desk(k);
      extra.name = 'desk';
      extra.position.set(entry.id === FLOOR_COUNT - 1 ? -5.8 : WORK_CENTER_X, FLOOR_TOP, DESK_Z);
      const lamp = floorLamp(k);
      lamp.scale.setScalar(0.4);
      lamp.position.set(0.4, 0.365, -0.1);
      extra.add(lamp);
      entry.group.add(extra);
    }
  }

  for (const f of floors) mergeStatic(f.group);
  const glowMats = kits.flatMap((k) => k.glows);
  let org = false;
  let beforeOrg: ViewState = { mode: 'overview', focusFloor: 0 };

  // Elevator: slim white shaft outside the west wall and a glass cabin.
  const shaft = new Group();
  shaft.name = 'shaft';
  const postMat = new MeshStandardMaterial({ color: PALETTE.white, roughness: 0.5 });
  const shaftH = FLOOR_COUNT * FLOOR_HEIGHT;
  const postGeo = new CylinderGeometry(0.05, 0.05, shaftH, 10);
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]] as const) {
    const post = new Mesh(postGeo, postMat);
    post.position.set(SHAFT_X + x, shaftH / 2, SHAFT_Z + z);
    post.userData.shadow = 'slab';
    shaft.add(post);
  }
  root.add(shaft);

  const cabinGroup = new Group();
  cabinGroup.name = 'cabin';
  const cabinMat = new MeshStandardMaterial({ color: PALETTE.white, roughness: 0.4 });
  const glassMat = new MeshStandardMaterial({ color: PALETTE.glass, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false });
  const doorMat = new MeshStandardMaterial({ color: 0xd9dee4, roughness: 0.35, metalness: 0.2 });
  const cabinBody = new Mesh(new RoundedBoxGeometry(1.25, 0.08, 1.25, 2, 0.03), cabinMat);
  cabinBody.position.y = 0.04;
  const cabinRoof = new Mesh(new RoundedBoxGeometry(1.25, 0.08, 1.25, 2, 0.03), cabinMat);
  cabinRoof.position.y = 1.5;
  const backWall = new Mesh(new RoundedBoxGeometry(1.2, 1.4, 0.04, 2, 0.015), glassMat);
  backWall.position.set(0, 0.78, -0.6);
  const doorL = new Mesh(new RoundedBoxGeometry(0.58, 1.38, 0.04, 2, 0.015), doorMat);
  const doorR = new Mesh(new RoundedBoxGeometry(0.58, 1.38, 0.04, 2, 0.015), doorMat);
  doorL.position.set(-0.3, 0.77, 0.6);
  doorR.position.set(0.3, 0.77, 0.6);
  const light = new Mesh(new RoundedBoxGeometry(0.5, 0.02, 0.5, 2, 0.008), new MeshBasicMaterial({ color: 0xfff3d6 }));
  light.position.y = 1.45;
  cabinGroup.add(cabinBody, cabinRoof, backWall, doorL, doorR, light);
  cabinGroup.position.set(SHAFT_X, FLOOR_TOP, SHAFT_Z);
  root.add(cabinGroup);

  let doorsOpen = 0;
  const cabin: Cabin = {
    group: cabinGroup,
    setHeight(y) {
      cabinGroup.position.y = y;
    },
    getHeight: () => cabinGroup.position.y,
    setDoorsOpen(t) {
      doorsOpen = Math.min(1, Math.max(0, t));
      doorL.position.x = -0.3 - 0.27 * doorsOpen;
      doorR.position.x = 0.3 + 0.27 * doorsOpen;
    },
    getDoorsOpen: () => doorsOpen,
  };

  const model: TowerModel = {
    root,
    floors,
    robots,
    rooms,
    cabin,
    view: { mode: 'overview', focusFloor: 0 },
    setView(v) {
      org = false;
      model.view = { ...v };
      for (const f of floors) {
        let walls = WALL_OVERVIEW;
        let rest = 1;
        const focused = v.mode === 'floor' && f.id === v.focusFloor;
        if (v.mode === 'floor') {
          if (f.id > v.focusFloor) {
            walls = GHOST;
            rest = GHOST;
          } else if (focused) {
            walls = 0;
          }
        }
        for (const m of f.materials.walls) setOpacity(m, walls);
        for (const m of [...f.materials.slab, ...f.materials.contents, ...f.materials.robots]) setOpacity(m, rest);
        for (const m of f.materials.tinted) setTinted(m, rest);
        // Floor view: other floors keep only their slab (ghosted above, dimmed below); their contents are
        // hidden so nothing draws over the focused floor.
        if (v.mode === 'floor' && f.id < v.focusFloor) for (const m of f.materials.slab) setOpacity(m, BELOW_SLAB);
        for (const child of f.group.children) child.visible = v.mode === 'overview' || focused || child.name === 'floor-slab';

        // Shadows: only the focused floor casts and receives, so floors never shadow each other; in
        // overview only the slabs cast (onto the ground) and contact shadows stand in for the rest.
        f.group.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          const role = roleOf(o);
          o.castShadow = (role === 'object' && focused) || (role === 'slab' && v.mode === 'overview');
          o.receiveShadow = (role === 'object' || role === 'surface') && focused;
        });
      }
      shaft.visible = v.mode === 'overview';
      for (const r of robots) {
        const focused = v.mode === 'floor' && r.floor === v.focusFloor;
        r.group.visible = v.mode === 'overview' || focused;
        r.group.traverse((o) => {
          if (o instanceof Mesh) {
            o.castShadow = focused && o.name !== 'contact-shadow';
            o.receiveShadow = false;
          }
        });
      }
    },
    setOrg(on) {
      if (on === org) return;
      if (!on) {
        model.setView(beforeOrg);
        return;
      }
      beforeOrg = { ...model.view };
      model.setView({ mode: 'overview', focusFloor: 0 });
      org = true;
      for (const f of floors) {
        for (const m of [...f.materials.walls, ...f.materials.slab, ...f.materials.contents]) setOpacity(m, ORG_SHELL);
        for (const m of f.materials.tinted) setTinted(m, ORG_SHELL);
        for (const m of f.materials.robots) setOpacity(m, 1);
        f.group.traverse((o) => {
          if (o instanceof Mesh) {
            o.castShadow = false;
            o.receiveShadow = false;
          }
        });
      }
    },
    isOrg: () => org,
    setNight(n) {
      const t = Math.min(1, Math.max(0, n));
      for (const m of glowMats) {
        const g: unknown = m.userData.glow;
        if (g && typeof g === 'object' && 'day' in g && 'night' in g && typeof g.day === 'number' && typeof g.night === 'number') {
          m.emissiveIntensity = g.day + (g.night - g.day) * t;
        }
      }
    },
    nightMaterials: () => glowMats,
    pickableFloors() {
      if (org) return new Set(floors.map((f) => f.id));
      return model.view.mode === 'floor' ? new Set([model.view.focusFloor]) : new Set(floors.map((f) => f.id));
    },
  };
  model.setView(model.view);
  return model;
}
