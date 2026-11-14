// Campus amenity wing (KARARLAR rev 31): a three-level glass wing west of the tower, joined to floors 0-2
// by glass sky-bridges, with a roof garden at floor-3 height. Procedural geometry only (no assets).
// Each wing level is built with the kit and materials of the tower floor of the same index and added to
// that floor's group, so it ghosts, casts shadows, glows at night and merges exactly like the floor.
import { BoxGeometry, Color, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, plant, type Kit, type KitTextures } from './furniture';
import type { FloorMaterials, RoomLabel } from './model';
import { anchorInstances, buildAmenities } from './amenities';
import {
  AMENITY_SPOTS,
  BRIDGE_DOOR,
  CAMPUS_ZONES,
  FLOOR_HEIGHT,
  FLOOR_TOP,
  HALF_DEPTH,
  HALF_WIDTH,
  ROOF_GARDEN_FLOOR,
  SKY_BRIDGE,
  STAFF_SHAFT,
  TERRACE,
  TERRACE_DOOR,
  WALL_HEIGHT,
  WING,
  WING_LEVELS,
  wingX,
  type AmenitySpot,
  type AmenityZone,
} from '../sim/layout';

export interface CampusFloor {
  readonly id: number;
  readonly group: Group;
  readonly materials: FloorMaterials;
}

export interface CampusOptions {
  /** Tower floors (at least 0..ROOF_GARDEN_FLOOR); wing levels are added to their groups. */
  readonly floors: readonly CampusFloor[];
  /** The tower floors' kits (same index), so wing materials share the floor's ghosting. */
  readonly kits: readonly Kit[];
  readonly textures: KitTextures;
}

export interface CampusLevel {
  readonly floor: number;
  /** Level contents (added to the tower floor group of the same index). */
  readonly group: Group;
}

export interface Campus {
  /** Campus grounds (lawn and trees around the wing); added to the scene root, never ghosted. */
  readonly group: Group;
  readonly levels: readonly CampusLevel[];
  readonly zones: readonly AmenityZone[];
  readonly spots: readonly AmenitySpot[];
  /** Zone floor labels (secondary room labels of their floor). */
  readonly rooms: RoomLabel[];
}

/** Height (above the floor surface) of the zone label anchors. */
const ZONE_LABEL_Y = 1.1;
const GLASS = 0xcfe4ec;
const LAWN = 0x93bf6b;

type Gap = { readonly from: number; readonly to: number } | null;

/** Frame side (skirting, two rails, mullions) along x or z, split around a door gap (offsets along the side). */
function frameSide(parts: BufferGeometry[], len: number, cx: number, cz: number, alongX: boolean, height: number, gap: Gap, step = 1.3): void {
  const t = 0.07;
  const add = (w: number, h: number, y: number, offset: number): void => {
    const geo = alongX ? new BoxGeometry(w, h, t) : new BoxGeometry(t, h, w);
    geo.translate(alongX ? cx + offset : cx, y + h / 2, alongX ? cz : cz + offset);
    parts.push(geo);
  };
  const rail = (h: number, y: number): void => {
    if (!gap) return add(len, h, y, 0);
    add(gap.from + len / 2, h, y, (-len / 2 + gap.from) / 2);
    add(len / 2 - gap.to, h, y, (gap.to + len / 2) / 2);
  };
  rail(0.14, 0);
  rail(0.08, height - 0.08);
  rail(0.04, height * 0.42);
  const n = Math.max(1, Math.round(len / step));
  for (let i = 0; i <= n; i++) {
    const o = -len / 2 + (i * len) / n;
    if (!gap || o < gap.from - 0.03 || o > gap.to + 0.03) add(0.06, height, 0, o);
  }
  if (gap) for (const o of [gap.from - 0.03, gap.to + 0.03]) add(0.06, height, 0, o);
}

/** Glass pane along a side, split around a door gap. */
function paneSide(parts: BufferGeometry[], len: number, cx: number, cz: number, alongX: boolean, height: number, gap: Gap): void {
  const h = height - 0.22;
  const add = (w: number, offset: number): void => {
    const geo = alongX ? new BoxGeometry(w, h, 0.012) : new BoxGeometry(0.012, h, w);
    geo.translate(alongX ? cx + offset : cx, 0.14 + h / 2, alongX ? cz : cz + offset);
    parts.push(geo);
  };
  if (!gap) return add(len, 0);
  add(gap.from + len / 2, (-len / 2 + gap.from) / 2);
  add(len / 2 - gap.to, (gap.to + len / 2) / 2);
}

const merged = (parts: BufferGeometry[]): BufferGeometry => {
  const g = mergeGeometries(parts) ?? new BoxGeometry(0.01, 0.01, 0.01);
  for (const p of parts) p.dispose();
  return g;
};

/**
 * Tower exterior shell with the east staff door and, on wing levels, a west door where the sky-bridge
 * lands. Same frame recipe as furniture.shellGeometry (skirting, rails, 1.3 u mullions).
 */
export function towerShellWithBridgeDoor(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const east = STAFF_SHAFT.doorGap;
  frameSide(parts, HALF_WIDTH * 2, 0, HALF_DEPTH, true, WALL_HEIGHT, null);
  frameSide(parts, HALF_WIDTH * 2, 0, -HALF_DEPTH, true, WALL_HEIGHT, null);
  frameSide(parts, HALF_DEPTH * 2, HALF_WIDTH, 0, false, WALL_HEIGHT, { from: east.z0, to: east.z1 });
  frameSide(parts, HALF_DEPTH * 2, -HALF_WIDTH, 0, false, WALL_HEIGHT, { from: BRIDGE_DOOR.z0, to: BRIDGE_DOOR.z1 });
  return merged(parts);
}

function wallMaterial(materials: FloorMaterials, kit: Kit, color: number, opts: { glow?: number; roughness?: number } = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.6, emissive: 0xffc27a, emissiveIntensity: 0 });
  if (opts.glow !== undefined) {
    m.userData.glow = { day: 0, night: opts.glow };
    kit.glows.push(m);
  }
  materials.walls.push(m);
  return m;
}

function named(geo: BufferGeometry, mat: Material, name: string, role: string): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.userData.shadow = role;
  return m;
}

/** Slab (wing floor plate, bridge deck, terrace deck) of one level as one named 'floor-slab' mesh. */
function buildSlab(floor: number, materials: FloorMaterials): Mesh {
  const parts: BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number): void => {
    parts.push(new BoxGeometry(w, h, d).translate(x, y, z));
  };
  const roof = floor === ROOF_GARDEN_FLOOR;
  box(WING.halfW * 2 + 0.3, FLOOR_TOP, WING.halfD * 2 + 0.3, WING.x, FLOOR_TOP / 2, WING.z);
  if (roof) box(WING.halfW * 2 + 0.5, 0.06, WING.halfD * 2 + 0.5, WING.x, 0.03, WING.z); // roof edge fascia
  if (!roof) {
    const b = SKY_BRIDGE;
    box(b.x1 - b.x0 + 0.1, 0.08, b.halfWidth * 2 + 0.1, (b.x0 + b.x1) / 2, FLOOR_TOP - 0.04, b.z);
  }
  if (floor === 0) box(TERRACE.x1 - TERRACE.x0, FLOOR_TOP, TERRACE.z1 - TERRACE.z0, (TERRACE.x0 + TERRACE.x1) / 2, FLOOR_TOP / 2, (TERRACE.z0 + TERRACE.z1) / 2);
  const mat = new MeshStandardMaterial({ color: PALETTE.white, roughness: 0.9 });
  materials.slab.push(mat);
  return named(merged(parts), mat, 'floor-slab', 'slab');
}

/** Glass curtain walls, corner columns and the sky-bridge of one wing level. */
function buildEnvelope(floor: number, kit: Kit, materials: FloorMaterials, level: Group): void {
  const frame: BufferGeometry[] = [];
  const glass: BufferGeometry[] = [];
  const W = WING.halfW;
  const D = WING.halfD;
  const terraceGap: Gap = floor === 0 ? { from: TERRACE_DOOR.x0 - WING.x, to: TERRACE_DOOR.x1 - WING.x } : null;
  const bridgeGap: Gap = { from: BRIDGE_DOOR.z0, to: BRIDGE_DOOR.z1 };
  frameSide(frame, W * 2, 0, -D, true, WALL_HEIGHT, null);
  frameSide(frame, W * 2, 0, D, true, WALL_HEIGHT, terraceGap);
  frameSide(frame, D * 2, -W, 0, false, WALL_HEIGHT, null);
  frameSide(frame, D * 2, W, 0, false, WALL_HEIGHT, bridgeGap);
  paneSide(glass, W * 2, 0, -D, true, WALL_HEIGHT, null);
  paneSide(glass, W * 2, 0, D, true, WALL_HEIGHT, terraceGap);
  paneSide(glass, D * 2, -W, 0, false, WALL_HEIGHT, null);
  paneSide(glass, D * 2, W, 0, false, WALL_HEIGHT, bridgeGap);
  // Slim columns at the corners, full storey height: the wing reads as one structure.
  for (const x of [-W, W]) for (const z of [-D, D]) frame.push(new CylinderGeometry(0.09, 0.09, FLOOR_HEIGHT - FLOOR_TOP, 10).translate(x, (FLOOR_HEIGHT - FLOOR_TOP) / 2, z));
  for (const g of [...frame, ...glass]) g.translate(WING.x, FLOOR_TOP, WING.z);

  // Sky-bridge: glass sides and roof on a light frame (merged into the wing frame), from the wing east
  // wall to the tower west wall.
  const b = SKY_BRIDGE;
  const len = b.x1 - b.x0;
  const cx = (b.x0 + b.x1) / 2;
  const h = 1.3;
  const bf = frame;
  const bg: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const z = b.z + side * b.halfWidth;
    bf.push(new BoxGeometry(len, 0.08, 0.06).translate(cx, FLOOR_TOP + 0.04, z));
    bf.push(new BoxGeometry(len, 0.05, 0.06).translate(cx, FLOOR_TOP + h, z));
    for (let i = 0; i <= 3; i++) bf.push(new BoxGeometry(0.05, h, 0.06).translate(b.x0 + (i * len) / 3, FLOOR_TOP + h / 2, z));
    bg.push(new BoxGeometry(len, h - 0.1, 0.012).translate(cx, FLOOR_TOP + 0.05 + (h - 0.1) / 2, z));
  }
  for (let i = 0; i <= 3; i++) bf.push(new BoxGeometry(0.05, 0.05, b.halfWidth * 2).translate(b.x0 + (i * len) / 3, FLOOR_TOP + h, b.z));
  bg.push(new BoxGeometry(len, 0.012, b.halfWidth * 2).translate(cx, FLOOR_TOP + h + 0.02, b.z));
  const frameMat = wallMaterial(materials, kit, PALETTE.white, { glow: 1.1 });
  const glassMat = wallMaterial(materials, kit, GLASS, { roughness: 0.1 });
  level.add(named(merged(frame), frameMat, 'wing-wall', 'none'));
  level.add(named(merged(glass), glassMat, 'wing-glass', 'none'));
  level.add(named(merged(bg), glassMat, 'sky-bridge', 'none'));

  // Floor surface (oak, like the tower floors).
  kit.place(level, new PlaneGeometry(W * 2, D * 2).rotateX(-Math.PI / 2), kit.surface(PALETTE.floorOak, kit.textures.wood), WING.x, FLOOR_TOP + 0.002, WING.z, 'surface');
}

/** Instanced trees (trunks + low-poly crowns) at floor-local points; `y` is the ground height. */
function trees(parent: Group, points: readonly (readonly [number, number, number])[], y: number, trunkMat: Material, crownMat: Material, prefix: string): void {
  const trunk = new InstancedMesh(new CylinderGeometry(0.06, 0.09, 1, 8).translate(0, 0.5, 0), trunkMat, points.length);
  const crown = new InstancedMesh(new IcosahedronGeometry(0.5, 1), crownMat, points.length * 2);
  const m = new Matrix4();
  const q = new Quaternion();
  const leaf = [new Color(PALETTE.leaf), new Color(PALETTE.leafDark), new Color(0x7fae5c)];
  points.forEach(([x, z, s], i) => {
    m.compose(new Vector3(x, y, z), q, new Vector3(s, s * 1.1, s));
    trunk.setMatrixAt(i, m);
    m.compose(new Vector3(x, y + s * 1.35, z), q, new Vector3(s * 1.05, s * 0.95, s * 1.05));
    crown.setMatrixAt(i * 2, m);
    m.compose(new Vector3(x + s * 0.25, y + s * 1.75, z - s * 0.1), q, new Vector3(s * 0.7, s * 0.65, s * 0.7));
    crown.setMatrixAt(i * 2 + 1, m);
    crown.setColorAt(i * 2, leaf[i % 3] ?? new Color(PALETTE.leaf));
    crown.setColorAt(i * 2 + 1, leaf[(i + 1) % 3] ?? new Color(PALETTE.leaf));
  });
  trunk.name = `${prefix}-trunks`;
  crown.name = `${prefix}-crowns`;
  for (const t of [trunk, crown]) {
    t.userData.shadow = 'object';
    anchorInstances(t, WING.x);
    parent.add(t);
  }
}

/** Roof garden on the wing roof (floor-3 height): lawn, deck paths, planters, trees, benches, pergola, railing. */
function buildRoofGarden(kit: Kit, level: Group): void {
  const k = kit;
  const y = FLOOR_TOP;
  const X = wingX;
  k.box(level, WING.halfW * 2 - 0.2, 0.02, WING.halfD * 2 - 0.2, 0, k.surface(LAWN, null), WING.x, y, WING.z, 'surface');
  const deck = k.m(PALETTE.oakDark, { roughness: 0.8 });
  k.box(level, WING.halfW * 2 - 0.6, 0.025, 1.0, 0, deck, WING.x, y + 0.01, -0.9);
  k.box(level, 1.0, 0.025, WING.halfD * 2 - 0.6, 0, deck, X(1.5), y + 0.01, 0);
  // Raised planters along the north and west edges with shrubs.
  const planter = k.m(PALETTE.white, { roughness: 0.7 });
  const shrub = k.m(PALETTE.leaf, { roughness: 0.85 });
  const shrubDark = k.m(PALETTE.leafDark, { roughness: 0.85 });
  k.box(level, 9.6, 0.35, 0.6, 0.05, planter, X(-0.2), y, -4.95);
  k.box(level, 0.6, 0.35, 8.0, 0.05, planter, X(-4.95), y, 0.5);
  for (let i = 0; i < 9; i++) k.ball(level, 0.28, i % 2 ? shrub : shrubDark, X(-4.6 + i * 1.1), y + 0.48, -4.95, true);
  for (let i = 0; i < 7; i++) k.ball(level, 0.28, i % 2 ? shrubDark : shrub, X(-4.95), y + 0.48, -3.0 + i * 1.1, true);
  // Benches and a pergola over the east seating area.
  const wood = k.m(PALETTE.oak, { roughness: 0.6 });
  const steel = k.m(PALETTE.graphite, { roughness: 0.45, metalness: 0.3 });
  for (const [lx, z] of [[-2.5, 1.2], [-2.5, 3.6], [3.6, 2.6]] as const) {
    k.box(level, 1.3, 0.05, 0.4, 0.02, wood, X(lx), y + 0.24, z);
    for (const dx of [-0.55, 0.55]) k.box(level, 0.05, 0.24, 0.36, 0, steel, X(lx + dx), y, z);
  }
  for (const lx of [2.6, 4.8]) for (const z of [1.2, 4.0]) k.box(level, 0.08, 1.5, 0.08, 0, wood, X(lx), y, z);
  for (let i = 0; i < 6; i++) k.box(level, 2.4, 0.06, 0.06, 0, wood, X(3.7), y + 1.5, 1.2 + i * 0.56);
  for (const z of [1.2, 4.0]) k.box(level, 2.5, 0.08, 0.08, 0, wood, X(3.7), y + 1.44, z);
  level.add(at(plant(k, 1.4), X(4.8), y, -4.6));
  level.add(at(plant(k, 1.2), X(-1.0), y, 4.8));
  trees(level, [[X(-3.2), -2.6, 0.9], [X(-0.4), 2.2, 1.0], [X(1.0), -3.4, 0.85], [X(-3.6), 4.6, 0.8], [X(4.3), -2.2, 0.75]], y, k.m(PALETTE.oakDark, { roughness: 0.9 }), k.m(0xffffff, { roughness: 0.85 }), 'roof-tree');
  // Glass railing around the roof edge.
  const rail = k.tint(0xbcd9e6, 0.38);
  const W = WING.halfW - 0.05;
  const D = WING.halfD - 0.05;
  k.box(level, W * 2, 0.8, 0.012, 0, rail, WING.x, y, -D, 'none');
  k.box(level, W * 2, 0.8, 0.012, 0, rail, WING.x, y, D, 'none');
  k.box(level, 0.012, 0.8, D * 2, 0, rail, WING.x - W, y, 0, 'none');
  k.box(level, 0.012, 0.8, D * 2, 0, rail, WING.x + W, y, 0, 'none');
}

function at<T extends Group>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

/** Lawn and trees around the wing and its terrace (campus grounds). */
function buildGrounds(): Group {
  const g = new Group();
  g.name = 'campus-grounds';
  const lawn = new MeshStandardMaterial({ color: LAWN, roughness: 1 });
  const path = new MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.95 });
  const x0 = WING.x - WING.halfW - 1.6;
  const x1 = WING.x + WING.halfW + 1.2;
  const z0 = -WING.halfD - 1.4;
  const z1 = TERRACE.z1 + 1.4;
  const lawnMesh = named(new PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), lawn, 'campus-lawn', 'surface');
  lawnMesh.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
  lawnMesh.receiveShadow = true;
  const walk = named(new PlaneGeometry(1.2, z1 - TERRACE.z1).rotateX(-Math.PI / 2), path, 'campus-path', 'surface');
  walk.position.set(wingX(1.0), 0.008, (TERRACE.z1 + z1) / 2);
  g.add(lawnMesh, walk);
  const trunk = new MeshStandardMaterial({ color: PALETTE.oakDark, roughness: 0.9 });
  const crown = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  trees(g, [[x0 + 0.6, -4.6, 1.2], [x0 + 0.7, 0.2, 1.0], [x0 + 0.6, 4.4, 1.3], [wingX(-4.2), z1 - 0.6, 1.1], [wingX(4.6), z1 - 0.5, 0.9], [x1 - 0.3, -6.0, 1.0]], 0, trunk, crown, 'campus-tree');
  return g;
}

/**
 * Builds the campus wing into the given tower floors (levels 0-2 and the roof garden at floor 3) and
 * returns the grounds group, zone metadata, break spots and zone labels.
 */
export function buildCampus(options: CampusOptions): Campus {
  const levels: CampusLevel[] = [];
  for (const f of [...WING_LEVELS, ROOF_GARDEN_FLOOR]) {
    const floor = options.floors[f];
    const kit = options.kits[f];
    if (!floor || !kit) continue;
    const level = new Group();
    level.name = f === ROOF_GARDEN_FLOOR ? 'roof-garden' : `campus-level-${f}`;
    floor.group.add(buildSlab(f, floor.materials));
    if (f === ROOF_GARDEN_FLOOR) buildRoofGarden(kit, level);
    else {
      buildEnvelope(f, kit, floor.materials, level);
      buildAmenities(kit, f, level, floor.materials);
      // The tower west wall opens where the bridge lands.
      const wall = floor.group.getObjectByName('exterior-wall');
      if (wall instanceof Mesh) {
        wall.geometry.dispose();
        wall.geometry = towerShellWithBridgeDoor();
      }
    }
    floor.group.add(level);
    levels.push({ floor: f, group: level });
  }
  const rooms: RoomLabel[] = CAMPUS_ZONES.flatMap((z) =>
    z.label === null ? [] : [{ floor: z.floor, text: z.label, primary: false, position: new Vector3(z.labelAt.x, z.floor * FLOOR_HEIGHT + FLOOR_TOP + ZONE_LABEL_Y, z.labelAt.z) }],
  );
  const group = buildGrounds();
  group.name = 'campus';
  group.userData.zones = CAMPUS_ZONES;
  return { group, levels, zones: CAMPUS_ZONES, spots: AMENITY_SPOTS, rooms };
}
