// Flexible, green floor dressing (KARARLAR Revizyon 31, item 3): moss walls, tall, hanging and divider plants,
// sit-stand desks, focus pods, high tables, lounge chairs, a tea corner at every coffee station, glass meeting
// nooks, and on the penthouse a roof terrace garden and a skyline lounge.
// Decoration only: nothing here is walked to or sat on by robots. Every piece is placed from the item table
// below, which is also the single source of its footprint (`dressingFootprints`); tests keep those footprints
// clear of every waypoint edge, lane and spot of src/sim/layout.ts (which this module never changes).
import { BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PENTHOUSE, MEETING_FLOOR, FLOOR_HEIGHT, FLOOR_TOP, type Rect } from '../sim/layout';
import { Kit, PALETTE, coffeeTable, floorLamp, glassPartition, rug, sofa } from './furniture';
import { softwareDecorFootprints } from './softwareLayout';
import { Foliage, GREENS, hangingPlant, leafAt, mossWall, planterBox, smallPlant, tallHalf, tallPlant, type Leaf, type TallKind } from './greenery';

/** Name prefix of every dressing group and of the per-floor foliage mesh. */
export const DRESSING_PREFIX = 'flex:';

/** Ceiling height above the floor surface (underside of the next slab), for hung cords. */
const CEILING = FLOOR_HEIGHT - FLOOR_TOP - 0.02;
/** Warm accent rug (one new material per floor). */
const RUG_WARM = 0xe3b08f;
const RUG_BORDER = 0xdccbb3;
const WARM_LIGHT = [0xfff1d6, 0xffcf8a, 0.15, 3.5] as const;
const LAMP_LIGHT = [0xfff4dc, 0xffd18a, 0.6, 3.0] as const;

type ItemName =
  | 'moss-wall'
  | 'tall-plant'
  | 'hanging-plant'
  | 'planter-divider'
  | 'tea-corner'
  | 'sit-stand-desk'
  | 'focus-pod'
  | 'high-table'
  | 'lounge-chair'
  | 'meeting-nook'
  | 'pergola'
  | 'terrace-planter'
  | 'terrace-seating'
  | 'skyline-lounge';

interface Ctx {
  readonly k: Kit;
  readonly g: Group;
  readonly leaf: Leaf;
  readonly accent: number;
}

interface Item {
  readonly name: ItemName;
  /** Centre (floor-local). */
  readonly x: number;
  readonly z: number;
  /** Footprint relative to the centre: [x0, x1, z0, z1]. */
  readonly box: readonly [number, number, number, number];
  /** Builds the piece in its group (origin at the centre, y = floor surface). */
  readonly build: (c: Ctx) => void;
  /** Child of the penthouse terrace container. */
  readonly terrace?: boolean;
}

const sym = (hw: number, hd: number): readonly [number, number, number, number] => [-hw, hw, -hd, hd];

// ---------------------------------------------------------------- pieces

function loungeChair(k: Kit, g: Group, color: number, accent: number): void {
  const fabric = k.m(color, { roughness: 0.95 });
  k.blob(g, 0.8, 0.8, 0, 0);
  for (const x of [-0.22, 0.22]) k.box(g, 0.04, 0.08, 0.46, 0, k.m(PALETTE.oakDark), x, 0, 0);
  k.box(g, 0.56, 0.1, 0.52, 0, fabric, 0, 0.08, 0);
  k.box(g, 0.56, 0.34, 0.12, 0, fabric, 0, 0.12, 0.2).rotation.x = -0.12;
  for (const x of [-0.25, 0.25]) k.box(g, 0.07, 0.14, 0.48, 0, fabric, x, 0.18, 0);
  k.box(g, 0.4, 0.06, 0.38, 0, k.m(color, { roughness: 1 }), 0, 0.18, -0.03);
  k.box(g, 0.22, 0.18, 0.06, 0, k.m(accent, { roughness: 1 }), 0.08, 0.24, 0.13).rotation.z = 0.15;
}

function pendant(k: Kit, g: Group, x: number, z: number, y: number): void {
  k.cyl(g, 0.004, 0.004, CEILING - y - 0.1, k.m(PALETTE.charcoal), x, y + 0.1, z, 4);
  k.cyl(g, 0.05, 0.12, 0.1, k.glow(...WARM_LIGHT), x, y, z, 10, 'none');
}

function highStool(k: Kit, g: Group, x: number, z: number, accent: number, h = 0.42): void {
  k.cyl(g, 0.1, 0.11, 0.015, k.m(PALETTE.charcoal), x, 0, z, 6);
  k.cyl(g, 0.012, 0.012, h, k.m(PALETTE.charcoal), x, 0, z, 4);
  k.cyl(g, 0.11, 0.11, 0.04, k.m(accent, { roughness: 0.8 }), x, h, z, 8);
}

function focusPod(c: Ctx): void {
  const { k, g, leaf, accent } = c;
  const H = 1.12;
  const white = k.m(PALETTE.white);
  const frame = k.m(PALETTE.charcoal, { roughness: 0.5 });
  const glass = k.tint(0xbcd9e6, 0.38);
  k.box(g, 0.9, 0.02, 0.9, 0, k.m(PALETTE.graphite), 0, 0, 0, 'surface');
  k.box(g, 0.05, H, 0.9, 0, white, -0.425, 0, 0); // solid back toward the west wall
  for (const z of [-0.425, 0.425]) {
    k.box(g, 0.85, H - 0.04, 0.02, 0, glass, 0.02, 0.02, z, 'none');
    k.box(g, 0.05, H, 0.05, 0, frame, 0.425, 0, z);
  }
  k.box(g, 0.02, H - 0.04, 0.4, 0, glass, 0.43, 0.02, -0.2, 'none'); // half-open glass door facing east
  k.box(g, 0.94, 0.05, 0.94, 0, white, 0, H, 0);
  k.box(g, 0.94, 0.03, 0.02, 0, k.m(accent), 0, H + 0.01, 0.455);
  k.box(g, 0.3, 0.2, 0.62, 0, k.m(PALETTE.oak, { roughness: 0.6 }), -0.24, 0, 0);
  k.box(g, 0.28, 0.06, 0.6, 0, k.m(accent, { roughness: 0.8 }), -0.24, 0.2, 0);
  k.box(g, 0.22, 0.02, 0.36, 0, k.m(PALETTE.oak, { roughness: 0.6 }), 0.1, 0.42, 0);
  k.cyl(g, 0.08, 0.08, 0.015, k.glow(...WARM_LIGHT), 0, H - 0.015, 0, 10, 'none');
  // Trailing plant on the roof.
  k.cyl(g, 0.09, 0.07, 0.1, k.m(PALETTE.pot, { roughness: 0.9 }), 0.2, H + 0.05, 0.2, 8);
  leaf(0.2, H + 0.2, 0.2, 0.12, GREENS.leaf, 1.2, 0.6, 1.2);
  for (const [dx, dz] of [[0.42, 0.28], [0.3, 0.42]] as const) leaf(dx, H - 0.02, dz, 1, GREENS.fresh, 0.03, 0.16, 0.03);
}

function sitStandDesk(c: Ctx, raised: boolean): void {
  const { k, g, leaf, accent } = c;
  const top = raised ? 0.56 : 0.36;
  k.blob(g, 1.4, 0.9, 0, 0);
  const metal = k.m(PALETTE.charcoal);
  for (const x of [-0.46, 0.46]) {
    k.box(g, 0.06, top, 0.06, 0, metal, x, 0, 0);
    k.box(g, 0.06, 0.03, 0.54, 0, metal, x, 0, 0);
  }
  k.box(g, 0.86, 0.05, 0.03, 0, metal, 0, top - 0.12, 0.12);
  k.box(g, 1.1, 0.04, 0.6, 0, k.m(PALETTE.oak, { roughness: 0.6 }), 0, top, 0);
  // Laptop: base and an open lid facing the sitter (north).
  k.box(g, 0.3, 0.012, 0.2, 0, k.m(PALETTE.graphite), 0, top + 0.04, 0.02);
  k.box(g, 0.3, 0.2, 0.012, 0, metal, 0, top + 0.05, 0.12).rotation.x = -0.25;
  if (raised) smallPlant(k, g, leaf, 0.42, top + 0.04, 0.12);
  else {
    k.cyl(g, 0.006, 0.006, 0.24, metal, -0.42, top + 0.04, 0.15, 4);
    k.cyl(g, 0.03, 0.06, 0.06, k.glow(...LAMP_LIGHT), -0.42, top + 0.26, 0.12, 8);
  }
  highStool(k, g, 0, -0.5, accent, raised ? 0.42 : 0.26);
}

function at<T extends Group>(o: T, x: number, z: number, yaw = 0): T {
  o.position.set(x, 0, z);
  o.rotation.y = yaw;
  return o;
}

function highTable(c: Ctx): void {
  const { k, g, accent } = c;
  k.blob(g, 1.6, 0.9, 0, 0);
  const metal = k.m(PALETTE.charcoal);
  for (const x of [-0.45, 0.45]) {
    k.box(g, 0.05, 0.55, 0.05, 0, metal, x, 0, 0);
    k.box(g, 0.05, 0.02, 0.36, 0, metal, x, 0, 0);
  }
  k.box(g, 1.2, 0.04, 0.42, 0, k.m(PALETTE.oakDark, { roughness: 0.6 }), 0, 0.55, 0);
  for (const [x, z] of [[-0.35, -0.36], [0.35, -0.36], [0, 0.36]] as const) highStool(k, g, x, z, accent);
  k.cyl(g, 0.035, 0.03, 0.07, k.m(PALETTE.white), 0.25, 0.59, 0, 8);
  pendant(k, g, -0.25, 0, 0.98);
  pendant(k, g, 0.25, 0, 0.98);
}

function teaCorner(c: Ctx): void {
  const { k, g, leaf, accent } = c;
  const white = k.m(PALETTE.white);
  const oak = k.m(PALETTE.oak, { roughness: 0.55 });
  const back = -0.235; // wall side
  k.box(g, 1.5, 0.36, 0.42, 0, white, 0, 0, back + 0.21, 'object');
  for (const x of [-0.375, 0.375]) k.box(g, 0.005, 0.3, 0.01, 0, k.m(PALETTE.graphite), x, 0.03, back + 0.425, 'none');
  k.box(g, 1.54, 0.04, 0.46, 0, oak, 0, 0.36, back + 0.23);
  // Kettle, teapot, cups and canisters on the counter.
  const dark = k.m(PALETTE.charcoal, { roughness: 0.35, metalness: 0.2 });
  k.cyl(g, 0.05, 0.06, 0.12, dark, -0.5, 0.4, back + 0.22, 8);
  k.cyl(g, 0.065, 0.055, 0.09, k.m(PALETTE.white), -0.25, 0.4, back + 0.24, 8);
  k.cyl(g, 0.02, 0.02, 0.02, k.m(accent), -0.25, 0.49, back + 0.24, 6);
  for (const [x, col] of [[0, accent], [0.1, PALETTE.white]] as const) k.cyl(g, 0.03, 0.026, 0.06, k.m(col), x, 0.4, back + 0.3, 8);
  PALETTE.books.slice(0, 3).forEach((col, i) => k.cyl(g, 0.04, 0.04, 0.1, k.m(col, { roughness: 0.8 }), 0.32 + i * 0.11, 0.4, back + 0.12, 6));
  smallPlant(k, g, leaf, 0.64, 0.4, back + 0.3);
  // Open wall shelf with jars and a warm under-shelf light.
  k.box(g, 1.4, 0.03, 0.2, 0, oak, 0, 0.8, back + 0.1);
  k.box(g, 1.3, 0.015, 0.03, 0, k.glow(...LAMP_LIGHT), 0, 0.785, back + 0.16);
  for (let i = 0; i < 4; i++) k.cyl(g, 0.04, 0.04, 0.12, k.tint(0xbcd9e6, 0.38), -0.5 + i * 0.22, 0.83, back + 0.1, 8, 'none');
  smallPlant(k, g, leaf, 0.5, 0.83, back + 0.1);
}

function meetingNook(c: Ctx): void {
  const { k, g, leaf, accent } = c;
  // Local frame: the nook spans x -1.11..1.11 and z -1.24..1.24 around its centre.
  g.add(at(rug(k, 1.9, 1.8, RUG_WARM, RUG_BORDER), 0.05, 0.1));
  g.add(glassPartition(k, -1.08, -1.19, 1.08, -1.19, 0.95));
  g.add(glassPartition(k, 1.06, -1.19, 1.06, 0.75, 0.95));
  k.cyl(g, 0.15, 0.17, 0.02, k.m(PALETTE.charcoal), 0.05, 0, 0.1, 10);
  k.cyl(g, 0.025, 0.025, 0.34, k.m(PALETTE.charcoal), 0.05, 0.02, 0.1, 6);
  k.cyl(g, 0.42, 0.42, 0.03, k.m(PALETTE.oak, { roughness: 0.6 }), 0.05, 0.36, 0.1, 14);
  smallPlant(k, g, leaf, 0.15, 0.39, 0.0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = 0.05 + Math.sin(a) * 0.68;
    const z = 0.1 + Math.cos(a) * 0.68;
    const ch = new Group();
    ch.position.set(x, 0, z);
    ch.rotation.y = a;
    k.cyl(ch, 0.012, 0.012, 0.16, k.m(PALETTE.graphite), 0, 0, 0, 5);
    k.box(ch, 0.32, 0.05, 0.3, 0, k.m(accent, { roughness: 0.8 }), 0, 0.16, 0);
    k.box(ch, 0.32, 0.26, 0.04, 0, k.m(PALETTE.charcoal, { roughness: 0.5 }), 0, 0.2, 0.15);
    g.add(ch);
  }
  // Screen on a slim stand at the north glass, facing the table (+z).
  k.box(g, 0.04, 0.6, 0.04, 0, k.m(PALETTE.graphite), -0.6, 0, -1.05);
  k.box(g, 0.3, 0.02, 0.2, 0, k.m(PALETTE.graphite), -0.6, 0, -1.05);
  k.box(g, 0.7, 0.4, 0.03, 0, k.m(PALETTE.charcoal, { roughness: 0.4 }), -0.6, 0.55, -1.03);
  pendant(k, g, 0.05, 0.1, 0.95);
}

function plantDivider(c: Ctx, w: number): void {
  planterBox(c.k, c.g, c.leaf, w, 0.3, 0.3);
}

function pergola(c: Ctx): void {
  const { k, g, leaf } = c;
  // Local frame: posts at x +-1.8, z +-1.7; beams at 1.12; slats across.
  const wood = k.m(PALETTE.oakDark, { roughness: 0.7 });
  const top = 1.12;
  for (const x of [-1.8, 1.8]) for (const z of [-1.7, 1.7]) k.box(g, 0.08, top, 0.08, 0, wood, x, 0, z);
  for (const z of [-1.7, 1.7]) k.box(g, 3.72, 0.07, 0.07, 0, wood, 0, top, z);
  for (let i = 0; i < 9; i++) k.box(g, 0.05, 0.04, 3.52, 0, k.m(PALETTE.oak, { roughness: 0.6 }), -1.6 + i * 0.4, top + 0.07, 0);
  // Climbers up two posts and over the slats.
  for (const [x, z] of [[-1.72, 1.62], [1.72, 1.62]] as const) {
    for (let j = 0; j < 3; j++) leaf(x, 0.3 + j * 0.32, z, 0.1, j % 2 ? GREENS.fresh : GREENS.leaf, 1, 1.3, 1);
  }
  for (let i = 0; i < 5; i++) leaf(-1.4 + i * 0.7, top + 0.12, 1.55 - (i % 2) * 0.5, 0.17, i % 2 ? GREENS.dark : GREENS.leaf, 1.4, 0.45, 1.1);
  // Hanging planters under the south beam.
  for (const x of [-1.2, 1.1]) {
    const hp = new Group();
    hp.position.set(x, 0, 1.55);
    hangingPlant(k, hp, (lx, ly, lz, r, col, sx, sy, sz, yaw, tilt) => leaf(x + lx, ly, 1.55 + lz, r, col, sx, sy, sz, yaw, tilt), 0.74, top, x);
    g.add(hp);
  }
}

function terraceSeating(c: Ctx): void {
  const { k, g, accent } = c;
  // Local frame around the seating centre: sofa north (sitters face south), table, two chairs facing in.
  g.add(at(sofa(k, PALETTE.fabric, accent, 1.6), 0, -0.6));
  g.add(at(coffeeTable(k, 0.8, 0.5), 0, 0.35));
  const left = new Group();
  loungeChair(k, left, PALETTE.fabricBlue, accent);
  g.add(at(left, -1.2, 0.4, -Math.PI / 2));
  const right = new Group();
  loungeChair(k, right, PALETTE.fabricBlue, accent);
  g.add(at(right, 1.2, 0.4, Math.PI / 2));
  k.cyl(g, 0.05, 0.05, 0.1, k.glow(...LAMP_LIGHT), -0.2, 0.245, 0.35, 8); // lantern on the table
}

function skylineLounge(c: Ctx): void {
  const { k, g, leaf, accent } = c;
  // Two armchairs turned to the north glass and the skyline; side table and a warm lamp.
  g.add(at(rug(k, 2.0, 0.9, RUG_WARM, RUG_BORDER), 0.1, 0.05));
  for (const x of [-0.3, 0.6]) {
    const ch = new Group();
    loungeChair(k, ch, PALETTE.fabric, accent);
    g.add(at(ch, x, 0));
  }
  k.cyl(g, 0.14, 0.14, 0.03, k.m(PALETTE.oak, { roughness: 0.6 }), 0.15, 0.3, -0.05, 14);
  k.cyl(g, 0.02, 0.02, 0.3, k.m(PALETTE.charcoal), 0.15, 0, -0.05, 5);
  smallPlant(k, g, leaf, 0.15, 0.33, -0.05);
  g.add(at(floorLamp(k), -0.85, -0.2));
}

// ---------------------------------------------------------------- item table

const TEA = { x: 6.05, z: -5.215 } as const;
const POD_X = -7.42;
const LOUNGE_CHAIR_Z = 3.9;

function items(floor: number): Item[] {
  const penthouse = floor === PENTHOUSE;
  const meeting = floor === MEETING_FLOOR;
  const out: Item[] = [];
  const tall = (x: number, z: number, kind: TallKind, s = 1): void => {
    out.push({ name: 'tall-plant', x, z, box: sym(tallHalf(s), tallHalf(s)), build: (c) => tallPlant(c.k, c.g, c.leaf, kind, s, x + z) });
  };
  const hanging = (x: number, z: number, bottom = 1.45): void => {
    out.push({ name: 'hanging-plant', x, z, box: sym(0.18, 0.18), build: (c) => hangingPlant(c.k, c.g, c.leaf, bottom, CEILING, x) });
  };

  // Living moss wall on the north window wall, behind the desk row.
  const moss = penthouse ? { x0: -6.75, x1: -3.05 } : { x0: -4.5, x1: -0.55 };
  out.push({
    name: 'moss-wall',
    x: (moss.x0 + moss.x1) / 2,
    z: -5.41,
    box: [-(moss.x1 - moss.x0) / 2, (moss.x1 - moss.x0) / 2, -0.04, 0.11],
    build: (c) => mossWall(c.k, c.g, c.leaf, moss.x1 - moss.x0 - 0.06, 0.85),
  });

  // Tea corner on the north wall of the coffee station, with two hanging plants over it.
  out.push({ name: 'tea-corner', x: TEA.x, z: TEA.z, box: sym(0.8, 0.235), build: teaCorner });
  hanging(5.6, -5.2);
  hanging(6.5, -5.2);
  hanging(7.7, 4.0, 1.4);
  hanging(-7.7, 3.2, 1.4);

  // Tall plants: east of the coffee station, at the west end of the corridor, and in the lounge corner.
  tall(7.55, -3.75, 'fig');
  tall(-7.55, -0.9, 'snake');
  if (!penthouse && !meeting) tall(-0.8, 4.95, 'bird');
  if (meeting) tall(4.05, 3.9, 'bird');

  // Standing bar table in the dead end of the corridor (west of the work-room door).
  out.push({ name: 'high-table', x: -5.5, z: -0.9, box: sym(0.75, 0.5), build: highTable });

  // Two focus pods (phone booths) along the west wall of the south-west room.
  for (const z of [0.45, 1.4]) out.push({ name: 'focus-pod', x: POD_X, z, box: sym(0.47, 0.47), build: focusPod });

  // Two sit-stand desks (one raised, one lowered) along the south windows, stools on the north side.
  for (const [x, raised] of [[-5.4, true], [-4.0, false]] as const) {
    out.push({ name: 'sit-stand-desk', x, z: 4.85, box: [-0.56, 0.56, -0.75, 0.31], build: (c) => sitStandDesk(c, raised) });
  }

  // Planter divider between the corridor and the lounge.
  const div = meeting ? { x0: 3.9, x1: 5.35 } : { x0: 1.45, x1: 5.35 };
  const dw = div.x1 - div.x0;
  out.push({ name: 'planter-divider', x: (div.x0 + div.x1) / 2, z: 0.55, box: sym(dw / 2 + 0.02, 0.17), build: (c) => plantDivider(c, dw) });

  // Two lounge chairs facing the sofa across the coffee table.
  const lx = meeting ? [5.05, 6.15] : [2.75, 3.85];
  lx.forEach((x, i) => {
    out.push({
      name: 'lounge-chair',
      x,
      z: LOUNGE_CHAIR_Z,
      box: sym(0.31, 0.31),
      build: (c) => loungeChair(c.k, c.g, i ? PALETTE.fabricBlue : PALETTE.fabric, c.accent),
    });
  });

  // Glass meeting nook east of the south partition (floor 3 has its meeting room there; penthouse its terrace).
  if (!penthouse && !meeting) out.push({ name: 'meeting-nook', x: -0.01, z: 2.16, box: [-1.11, 1.11, -1.24, 1.24], build: meetingNook });

  if (penthouse) {
    // Roof terrace garden: deck, pergola with seating under it, planters along the south and west.
    out.push({ name: 'pergola', x: -0.65, z: 2.45, box: [-1.86, 1.86, -1.76, 1.76], build: pergola, terrace: true });
    out.push({ name: 'terrace-seating', x: -0.65, z: 2.2, box: [-1.55, 1.55, -1.05, 0.75], build: terraceSeating, terrace: true });
    out.push({ name: 'terrace-planter', x: -0.75, z: 5.0, box: sym(1.82, 0.24), build: (c) => planterBox(c.k, c.g, c.leaf, 3.6, 0.44, 0.32, true), terrace: true });
    out.push({ name: 'terrace-planter', x: -2.68, z: 2.6, box: sym(0.16, 1.75), build: (c) => {
      const g = new Group();
      g.rotation.y = Math.PI / 2;
      // planterBox lays out along x; build it along z by swapping the leaf axes.
      planterBox(c.k, g, (x, y, z, r, col, sx, sy, sz, yaw, tilt) => c.leaf(z, y, -x, r, col, sz, sy, sx, yaw, tilt), 3.46, 0.28, 0.32, true);
      c.g.add(g);
    }, terrace: true });
    // Skyline lounge: armchairs turned to the north glass.
    out.push({ name: 'skyline-lounge', x: 1.45, z: -4.75, box: [-1.0, 1.0, -0.42, 0.4], build: skylineLounge });
  }
  return out;
}

/**
 * Folds every opaque, non-glowing dressing mesh into one vertex-coloured mesh per shadow role, so the dressing
 * adds a couple of draw calls per floor instead of one per colour. Glow and glass parts keep their shared Kit
 * materials (they merge into the floor's existing buckets in mergeStatic).
 */
export function bakeStatic(k: Kit, root: Group, prefix = DRESSING_PREFIX): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, BufferGeometry[]>();
  const baked: Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o instanceof InstancedMesh || o.name !== '') return;
    const mat: unknown = o.material;
    if (!(mat instanceof MeshStandardMaterial) || mat.transparent || mat.vertexColors || mat.userData.glow !== undefined) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld.clone().premultiply(inv));
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    const n = geo.attributes.position?.count ?? 0;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([mat.color.r, mat.color.g, mat.color.b], i * 3);
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    const key = `${String(o.userData.shadow)}|${geo.index ? 'i' : 'n'}`;
    const list = buckets.get(key) ?? [];
    list.push(geo);
    buckets.set(key, list);
    baked.push(o);
  });
  for (const m of baked) m.removeFromParent();
  for (const [key, geos] of buckets) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const role = key.split('|')[0] ?? 'object';
    const mesh = new Mesh(merged, k.vertexColored());
    mesh.name = `${prefix}static-${role}`;
    mesh.userData.shadow = role;
    root.add(mesh);
  }
}

/**
 * Footprints of the decoration on `floor` (floor-local), one per piece, named after the piece: the green
 * dressing plus the floor-standing software-company decor (src/scene/softwareDecor.ts, KARARLAR Rev 35),
 * so both are held to the same clearance and coverage rules.
 */
export function dressingFootprints(floor: number): Rect[] {
  const own = items(floor).map((it) => ({ name: it.name, x0: it.x + it.box[0], x1: it.x + it.box[1], z0: it.z + it.box[2], z1: it.z + it.box[3] }));
  return [...own, ...softwareDecorFootprints(floor)];
}

/**
 * Builds the dressing of one floor: a group at the floor surface with one named group per piece and the
 * floor's instanced foliage. Materials come from the floor Kit, so floor opacity and night glow apply.
 */
export function buildFloorDressing(k: Kit, floor: number, accent: number): Group {
  const root = new Group();
  root.name = `${DRESSING_PREFIX}dressing`;
  root.position.y = FLOOR_TOP;
  const foliage = new Foliage();
  let terrace: Group | null = null;
  if (floor === PENTHOUSE) {
    terrace = new Group();
    terrace.name = `${DRESSING_PREFIX}roof-terrace`;
    // Deck boards over the terrace (flat, walk-over height).
    terrace.add(at(rug(k, 4.1, 4.75, PALETTE.oak, PALETTE.oakDark), -0.65, 2.9));
    root.add(terrace);
  }
  for (const it of items(floor)) {
    const g = new Group();
    g.name = `${DRESSING_PREFIX}${it.name}`;
    g.position.set(it.x, 0, it.z);
    it.build({ k, g, leaf: leafAt(foliage, it.x, it.z), accent });
    (it.terrace && terrace ? terrace : root).add(g);
  }
  bakeStatic(k, root);
  const mesh = foliage.build(k, `${DRESSING_PREFIX}foliage`);
  if (mesh) root.add(mesh);
  return root;
}
