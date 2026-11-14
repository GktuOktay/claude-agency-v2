// Floor layout (spec 0002 T-5): the single source of floor-local positions shared by the scene model
// (src/scene/model.ts) and the navigation graph (src/sim/nav.ts). Pure numbers, no three.js.
// Coordinates are floor-local x/z (the floor's walkable surface is at y = floorY(floor)).

export interface XZ {
  readonly x: number;
  readonly z: number;
}

/** Axis-aligned footprint on the floor plan. */
export interface Rect {
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

// ---------------------------------------------------------------- building

export const FLOOR_HEIGHT = 3;
export const FLOOR_COUNT = 6;
export const PENTHOUSE = FLOOR_COUNT - 1;
export const HALF_WIDTH = 8;
export const HALF_DEPTH = 5.5;
/** Height of the walkable floor surface above a floor's base. */
export const FLOOR_TOP = 0.14;
export const WALL_HEIGHT = 1.2;
/** Half thickness of the exterior shell (skirting and mullions are 0.07 deep). */
export const WALL_HALF_T = 0.035;
/** Visitor (camera) elevator of 0001/REQ-10, outside the west wall. Robots never use it. */
export const SHAFT_X = -9.3;
export const SHAFT_Z = -2.4;

export const floorY = (floor: number): number => floor * FLOOR_HEIGHT + FLOOR_TOP;

// ---------------------------------------------------------------- navigation constants (R-2, REQ-13)

/** Keep-right offset of the walking lanes on aisle (through) edges. */
export const LANE_OFFSET = 0.25;
/** Clearance between any through-edge (lanes included) and a stationary spot. */
export const SPOT_CLEARANCE = 0.45;
/** Clearance between any edge and any furniture footprint. */
export const FURNITURE_CLEARANCE = 0.25;
/** Minimum centre distance of two robots on one floor while either walks (outside exception zones). */
export const ROBOT_SEPARATION = 0.45;
/** §7.5c: meeting-seat exception zone radius. */
export const MEETING_SEAT_RADIUS = 0.35;
/** Radius of the other point-like exception zones (pair desk, coffee, landing, hand-over, signing). */
export const SPOT_ZONE_RADIUS = 0.3;

/** Corridor centre line (all floors). */
export const CORRIDOR_Z = -0.9;
/** Work-room aisle centre line, between the desks and the corridor partition (floors 0-4). */
export const WORK_AISLE_Z = -2.15;
/** Door in the corridor partition into the work room (floors 0-4). */
export const WORK_DOOR_X = -2.6;
/** Row of hand-over and home spots in front of the desks. */
export const SPOT_ROW_Z = -2.9;

// ---------------------------------------------------------------- desks

export const DESK_Z = -3.9;
export const DESK_SPACING = 2.0;
export const WORK_CENTER_X = -2.4;
/** Desk seat (the robot's work point) in front of a normal desk; keeps 0.25 u off the desk top. */
export const SEAT_OFFSET = 0.57;
export const CEO_SEAT_OFFSET = 0.7;
export const CEO_DESK_X = -1.2;
/** Penthouse side desk (no owner) next to the signing desk. */
export const SPARE_DESK_X = -5.8;
export const DESK_HALF = { w: 0.6, d: 0.31 } as const;
export const WIDE_DESK_HALF = { w: 1.0, d: 0.425 } as const;
/** Offsets from the desk x of the spots in front of a desk. */
export const HANDOVER_DX = 0.5;
export const HOME_DX = -1.0;
/** Second pair-desk position (the pair partner) beside the desk seat, reached through hand-over spot 0. */
export const PAIR_SPOT = { dx: -0.5, z: -3.3 } as const;

export function deskXs(count: number): number[] {
  const step = count <= 5 ? DESK_SPACING : 10 / Math.max(1, count - 1);
  const start = WORK_CENTER_X - ((count - 1) * step) / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

// ---------------------------------------------------------------- rooms and props

export const COFFEE = { x: 5.6, z: -3.45 } as const;
/** Six coffee-station spots in two staggered rows so every spot has its own clear spur. */
export const COFFEE_SPOTS: readonly XZ[] = [
  { x: 4.6, z: -2.8 },
  { x: 5.6, z: -2.8 },
  { x: 6.6, z: -2.8 },
  { x: 4.1, z: -2.25 },
  { x: 5.1, z: -2.25 },
  { x: 6.1, z: -2.25 },
];
export const PROP_AT = { x: -4.5, z: 2.6 } as const;
export const LOUNGE_AT = { x: 3.3, z: 2.4 } as const;
/** Floor 3 keeps a compact lounge east of the meeting room. */
export const LOUNGE_COMPACT_AT = { x: 5.6, z: 2.4 } as const;

/** Glass partitions on floors 0-4: [x0, z0, x1, z1]. */
export const PARTITIONS: readonly (readonly [number, number, number, number])[] = [
  [-HALF_WIDTH + 0.1, -1.6, -3.1, -1.6],
  [-2.1, -1.6, 3.25, -1.6],
  [-HALF_WIDTH + 0.1, -0.2, -3.4, -0.2],
  [-2.5, -0.2, -1.2, -0.2],
  [-1.2, -0.2, -1.2, HALF_DEPTH - 0.1],
];
/** Plants on floors 0-4 and on the penthouse: [x, z, size]. */
export const PLANTS: readonly (readonly [number, number, number])[] = [
  [-7.45, -5.05, 1.3],
  [2.95, -1.85, 1.0],
  [-7.4, 4.95, 1.4],
  [-1.65, 0.25, 0.9],
];
export const PENTHOUSE_PLANTS: readonly (readonly [number, number, number])[] = [
  [-7.4, -5.0, 1.7],
  [3.0, -5.0, 1.5],
  [-7.4, 5.0, 1.6],
  [7.4, 5.0, 1.6],
];
/** Back-wall bookshelves on floors 0-4: [x, width]. */
export const SHELVES: readonly (readonly [number, number])[] = [
  [-5.5, 1.3],
  [1.6, 1.3],
];
export const SHELF_Z = -5.18;
export const PENTHOUSE_SHELF = { x: -1.2, z: -5.15, w: 3.0 } as const;

// ---------------------------------------------------------------- floor 3 meeting room (REQ-15, T-8)

export const MEETING_FLOOR = 3;
export interface Seat extends XZ {
  /** Yaw of the seated robot (robot front is +z; yaw 0 faces +z). */
  readonly facing: number;
}
const SEAT_ZS = [2.3, 2.9, 3.5] as const;
const TABLE = { x: 1.2, z: 2.9, w: 0.9, d: 2.0 } as const;
export const MEETING_ROOM = {
  floor: MEETING_FLOOR,
  /** Room bounds: corridor edge to the south wall, floor-3 partition (x -1.2) to the room's glass wall (x 3.6). */
  bounds: { name: 'meeting-room', x0: -1.16, x1: 3.6, z0: -0.16, z1: HALF_DEPTH - 0.07 } as Rect,
  /** East glass wall of the room: [x0, z0, x1, z1]. */
  partition: [3.6, 0.3, 3.6, HALF_DEPTH - 0.1] as const,
  table: TABLE,
  tableHeight: 0.36,
  /** Six seats, three on each long side of the table, facing it. West seats face +x, east seats -x. */
  seats: [
    ...SEAT_ZS.map((z) => ({ x: TABLE.x - TABLE.w / 2 - 0.35, z, facing: Math.PI / 2 })),
    ...SEAT_ZS.map((z) => ({ x: TABLE.x + TABLE.w / 2 + 0.35, z, facing: -Math.PI / 2 })),
  ] as readonly Seat[],
  /** Whiteboard on a stand at the corridor end, its writing face toward +z (the floor-view camera). */
  whiteboard: { x: 1.2, z: 0.53, w: 1.8, h: 0.95, bottom: 0.25, tilt: 0.17, surfaceW: 1.7, surfaceH: 0.85 },
  /** Where the meeting lead stands, facing the seats with the board behind. */
  leadSpot: { x: 1.2, z: 1.1, facing: 0 } as Seat,
  /** Where the CEO stamps on the meeting table (a sign in the room takes no seat). */
  signSpot: { x: 1.2, z: 4.45, facing: Math.PI } as Seat,
  westAisleX: -0.4,
  eastAisleX: 2.8,
} as const;

/** §7.7 whiteboard texture size per quality tier. */
export function whiteboardTextureSize(quality: 'high' | 'low'): { width: number; height: number } {
  return quality === 'high' ? { width: 1024, height: 512 } : { width: 512, height: 256 };
}

// ---------------------------------------------------------------- east staff elevator (REQ-14, Q-2)

export const STAFF_SHAFT = {
  x: HALF_WIDTH + 1.3,
  z: CORRIDOR_Z,
  /** Half size of the cabin floor plate. */
  cabinHalf: 0.625,
  /** Door gap in the east exterior wall, centred on the corridor. */
  doorGap: { z0: CORRIDOR_Z - 0.6, z1: CORRIDOR_Z + 0.6 },
} as const;

export const STAFF_LANDING = {
  /** Boarding point at the cabin door (the end of the corridor aisle). */
  entry: { x: STAFF_SHAFT.x - 0.62, z: CORRIDOR_Z } as XZ,
  /** Spot in front of the call panel (call gesture). */
  callSpot: { x: 7.55, z: 0.05 } as XZ,
  /** Call panel on the inside of the east wall. */
  callPanel: { x: HALF_WIDTH - WALL_HALF_T - 0.02, z: 0.05, y: 0.5 },
  /** Three waiting spots per landing (§7.5c). */
  waitingSpots: [
    { x: 6.95, z: 0.05 },
    { x: 6.35, z: 0.05 },
    { x: 5.75, z: 0.05 },
  ] as readonly XZ[],
  /** Rider spots inside the cabin (floor-local x/z while the cabin stands at this landing); at most 3 riders. */
  riderSpots: [
    { x: STAFF_SHAFT.x - 0.1, z: CORRIDOR_Z - 0.3 },
    { x: STAFF_SHAFT.x - 0.1, z: CORRIDOR_Z + 0.3 },
    { x: STAFF_SHAFT.x + 0.3, z: CORRIDOR_Z },
  ] as readonly XZ[],
} as const;

/** Penthouse signing desk: the two visitor spots in front of it (the CEO uses its own seat). */
export const SIGNING_SPOTS: readonly XZ[] = [
  { x: CEO_DESK_X - 0.5, z: -2.6 },
  { x: CEO_DESK_X + 0.5, z: -2.6 },
];
export const CEO_HOME: XZ = { x: CEO_DESK_X + 1.7, z: -2.6 };

// ---------------------------------------------------------------- per-floor layout

export type SpotKind =
  | 'seat'
  | 'home'
  | 'handover'
  | 'pair'
  | 'coffee'
  | 'landing-wait'
  | 'landing-call'
  | 'signing'
  | 'meeting-seat'
  | 'meeting-lead'
  | 'meeting-sign'
  | 'cabin';

export interface Spot extends XZ {
  readonly id: string;
  readonly kind: SpotKind;
  /** Unit id for desk spots. */
  readonly owner?: string;
  /** Where the spur attaches: an aisle id, or another spot id (spur of a spur). */
  readonly via: string;
}

export interface Aisle {
  readonly id: string;
  readonly a: XZ;
  readonly b: XZ;
}

export interface DeskOwner {
  readonly id: string;
  readonly ceo: boolean;
}

export interface DeskPlace {
  readonly owner: string;
  readonly x: number;
  readonly z: number;
  readonly wide: boolean;
  readonly seat: XZ;
  readonly home: XZ;
  readonly coffee: XZ;
  readonly handover: readonly [XZ, XZ];
  readonly pair: XZ;
}

export interface Zone {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Circle radius; for the cabin zone, the half size of a square. */
  readonly r: number;
  readonly square?: boolean;
}

export interface FloorLayout {
  readonly floor: number;
  readonly desks: readonly DeskPlace[];
  /** Ownerless desks (the penthouse side desk). */
  readonly spareDesks: readonly XZ[];
  readonly spots: readonly Spot[];
  readonly aisles: readonly Aisle[];
  /** Furniture and walls the waypoint edges keep clear of (REQ-13). */
  readonly footprints: readonly Rect[];
  /** Chairs where robots sit; not obstacles, but part of the floor's furniture. */
  readonly seatZones: readonly Rect[];
  /** §7.5c exception zones for robot separation. */
  readonly zones: readonly Zone[];
}

const rect = (name: string, cx: number, cz: number, hw: number, hd: number): Rect => ({ name, x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd });
const span = (name: string, x0: number, z0: number, x1: number, z1: number): Rect => ({ name, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
const partitionRect = (p: readonly [number, number, number, number], name = 'partition'): Rect => {
  const t = 0.045; // frame half depth plus the end posts
  return span(name, Math.min(p[0], p[2]) - t, Math.min(p[1], p[3]) - t, Math.max(p[0], p[2]) + t, Math.max(p[1], p[3]) + t);
};
const plantRect = (x: number, z: number, s: number): Rect => rect('plant', x, z, 0.24 * s, 0.24 * s);

function wallRects(): Rect[] {
  const t = WALL_HALF_T + 0.01;
  const g = STAFF_SHAFT.doorGap;
  return [
    span('wall-north', -HALF_WIDTH - t, -HALF_DEPTH - t, HALF_WIDTH + t, -HALF_DEPTH + t),
    span('wall-south', -HALF_WIDTH - t, HALF_DEPTH - t, HALF_WIDTH + t, HALF_DEPTH + t),
    span('wall-west', -HALF_WIDTH - t, -HALF_DEPTH - t, -HALF_WIDTH + t, HALF_DEPTH + t),
    span('wall-east', HALF_WIDTH - t, -HALF_DEPTH - t, HALF_WIDTH + t, g.z0),
    span('wall-east', HALF_WIDTH - t, g.z1, HALF_WIDTH + t, HALF_DEPTH + t),
  ];
}

function coffeeRects(): Rect[] {
  const c = COFFEE;
  return [
    span('coffee-island', c.x - 1.16, c.z - 0.32, c.x + 1.16, c.z + 0.32),
    span('fridge', c.x + 1.4, c.z - 1.87, c.x + 2.0, c.z - 1.31),
    span('bistro', c.x - 1.64, c.z - 1.62, c.x - 0.56, c.z - 0.98),
    plantRect(c.x + 1.85, c.z + 1.4, 1.4),
    span('coffee-wall', c.x - 2.36, c.z - 1.97, c.x - 2.2, c.z - 0.53),
  ];
}

function loungeRects(compact: boolean): Rect[] {
  if (compact) {
    const l = LOUNGE_COMPACT_AT;
    return [
      span('sofa', l.x - 0.92, l.z - 0.93, l.x + 0.92, l.z - 0.17),
      span('coffee-table', l.x - 0.47, l.z + 0.18, l.x + 0.47, l.z + 0.72),
      rect('floor-lamp', l.x - 1.4, l.z - 0.75, 0.16, 0.16),
      plantRect(l.x + 1.75, l.z + 2.5, 1.6),
      plantRect(l.x - 1.5, l.z + 2.5, 1.2),
      span('bookshelf', l.x + 1.78, l.z - 0.62, l.x + 2.12, l.z + 1.02),
    ];
  }
  const l = LOUNGE_AT;
  return [
    span('sofa', l.x - 0.92, l.z - 0.93, l.x + 0.92, l.z - 0.17),
    span('sofa-side', l.x + 1.47, l.z - 0.22, l.x + 2.23, l.z + 1.12),
    span('coffee-table', l.x - 0.47, l.z + 0.18, l.x + 0.47, l.z + 0.72),
    rect('floor-lamp', l.x - 1.6, l.z - 0.75, 0.16, 0.16),
    plantRect(l.x + 4.0, l.z + 2.5, 1.6),
    plantRect(l.x - 1.9, l.z + 2.5, 1.2),
    span('bookshelf', l.x + 4.08, l.z - 0.62, l.x + 4.42, l.z + 1.02),
  ];
}

/** Floor-specific prop footprints (0001 props, anchored at PROP_AT). */
function propRect(floor: number): Rect {
  const p = PROP_AT;
  switch (floor) {
    case 0:
      return span('reception-desk', p.x - 1.9, p.z - 0.84, p.x + 1.92, p.z + 0.35);
    case 1:
      return span('server-rack', p.x - 1.33, p.z - 0.33, p.x + 1.67, p.z + 0.62);
    case 2:
      return span('review-board', p.x - 0.96, p.z - 0.66, p.x + 0.96, p.z + 0.92);
    case 3:
      return span('blueprint-table', p.x - 1.45, p.z - 0.53, p.x + 1.45, p.z + 0.9);
    case 4:
      return span('meeting-table', p.x - 1.25, p.z - 1.1, p.x + 1.25, p.z + 1.1);
    default:
      return span('globe-corner', p.x - 1.43, p.z - 1.38, p.x + 1.6, p.z + 0.68);
  }
}

function meetingRects(): { footprints: Rect[]; seats: Rect[] } {
  const m = MEETING_ROOM;
  const wb = m.whiteboard;
  return {
    footprints: [
      span('meeting-table', m.table.x - m.table.w / 2 - 0.02, m.table.z - m.table.d / 2 - 0.02, m.table.x + m.table.w / 2 + 0.02, m.table.z + m.table.d / 2 + 0.02),
      span('whiteboard', wb.x - wb.w / 2 - 0.04, wb.z - 0.22, wb.x + wb.w / 2 + 0.04, wb.z + 0.22),
      partitionRect(m.partition, 'meeting-partition'),
    ],
    seats: m.seats.map((s) => rect('meeting-chair', s.x, s.z, 0.24, 0.24)),
  };
}

/**
 * Layout of one floor for the given desk owners (in the scene's desk order: tier, then name).
 * The penthouse owner with `ceo` uses the signing desk.
 */
export function floorLayout(floor: number, owners: readonly DeskOwner[]): FloorLayout {
  const penthouse = floor === PENTHOUSE;
  const xs = deskXs(owners.length);
  const desks: DeskPlace[] = owners.map((o, idx) => {
    const x = o.ceo ? CEO_DESK_X : (xs[idx] ?? 0);
    const seat = { x, z: DESK_Z + (o.ceo ? CEO_SEAT_OFFSET : SEAT_OFFSET) };
    const handover: readonly [XZ, XZ] = o.ceo
      ? [SIGNING_SPOTS[0] ?? seat, SIGNING_SPOTS[1] ?? seat]
      : [
          { x: x - HANDOVER_DX, z: SPOT_ROW_Z },
          { x: x + HANDOVER_DX, z: SPOT_ROW_Z },
        ];
    return {
      owner: o.id,
      x,
      z: DESK_Z,
      wide: o.ceo,
      seat,
      home: o.ceo ? CEO_HOME : { x: x + HOME_DX, z: SPOT_ROW_Z },
      coffee: COFFEE_SPOTS[idx % COFFEE_SPOTS.length] ?? COFFEE_SPOTS[0] ?? seat,
      handover,
      pair: { x: x + PAIR_SPOT.dx, z: PAIR_SPOT.z },
    };
  });
  const spareDesks: XZ[] = penthouse || desks.length === 0 ? [{ x: penthouse ? SPARE_DESK_X : WORK_CENTER_X, z: DESK_Z }] : [];

  // Aisles: the corridor runs through the east wall door to the staff cabin; floors 0-4 add the
  // work-room aisle and its door; floor 3 adds the meeting-room aisles.
  const spots: Spot[] = [];
  for (const d of desks) {
    if (d.wide) {
      spots.push({ id: `seat:${d.owner}`, kind: 'seat', owner: d.owner, via: 'corridor', ...d.seat });
      spots.push({ id: `home:${d.owner}`, kind: 'home', owner: d.owner, via: 'corridor', ...d.home });
      continue;
    }
    spots.push({ id: `seat:${d.owner}`, kind: 'seat', owner: d.owner, via: 'work', ...d.seat });
    spots.push({ id: `home:${d.owner}`, kind: 'home', owner: d.owner, via: 'work', ...d.home });
    d.handover.forEach((h, i) => spots.push({ id: `handover:${d.owner}:${i}`, kind: 'handover', owner: d.owner, via: 'work', ...h }));
    spots.push({ id: `pair:${d.owner}`, kind: 'pair', owner: d.owner, via: `handover:${d.owner}:0`, ...d.pair });
  }
  if (penthouse) SIGNING_SPOTS.forEach((s, i) => spots.push({ id: `signing:${i}`, kind: 'signing', via: 'corridor', ...s }));
  COFFEE_SPOTS.forEach((c, i) => spots.push({ id: `coffee:${i}`, kind: 'coffee', via: 'corridor', ...c }));
  STAFF_LANDING.waitingSpots.forEach((w, i) => spots.push({ id: `wait:${i}`, kind: 'landing-wait', via: 'corridor', ...w }));
  spots.push({ id: 'call', kind: 'landing-call', via: 'corridor', ...STAFF_LANDING.callSpot });
  STAFF_LANDING.riderSpots.forEach((r, i) => spots.push({ id: `cabin:${i}`, kind: 'cabin', via: 'corridor', ...r }));

  const aisles: Aisle[] = [];
  const corridorXs = spots.filter((s) => s.via === 'corridor' && s.kind !== 'cabin').map((s) => s.x);
  if (!penthouse) corridorXs.push(WORK_DOOR_X);
  if (floor === MEETING_FLOOR) {
    const m = MEETING_ROOM;
    corridorXs.push(m.westAisleX, m.eastAisleX);
    m.seats.forEach((s, i) => spots.push({ id: `mseat:${i}`, kind: 'meeting-seat', via: s.x < m.table.x ? 'meeting-west' : 'meeting-east', x: s.x, z: s.z }));
    spots.push({ id: 'mlead', kind: 'meeting-lead', via: 'meeting-west', x: m.leadSpot.x, z: m.leadSpot.z });
    spots.push({ id: 'msign', kind: 'meeting-sign', via: 'meeting-west', x: m.signSpot.x, z: m.signSpot.z });
    aisles.push({ id: 'meeting-west', a: { x: m.westAisleX, z: CORRIDOR_Z }, b: { x: m.westAisleX, z: m.signSpot.z } });
    aisles.push({ id: 'meeting-east', a: { x: m.eastAisleX, z: CORRIDOR_Z }, b: { x: m.eastAisleX, z: Math.max(...m.seats.map((s) => s.z)) } });
  }
  aisles.unshift({ id: 'corridor', a: { x: Math.min(...corridorXs), z: CORRIDOR_Z }, b: STAFF_LANDING.entry });
  if (!penthouse && desks.length > 0) {
    const workXs = [WORK_DOOR_X, ...spots.filter((s) => s.via === 'work').map((s) => s.x)];
    aisles.push({ id: 'work', a: { x: Math.min(...workXs), z: WORK_AISLE_Z }, b: { x: Math.max(...workXs), z: WORK_AISLE_Z } });
    aisles.push({ id: 'work-door', a: { x: WORK_DOOR_X, z: CORRIDOR_Z }, b: { x: WORK_DOOR_X, z: WORK_AISLE_Z } });
  }

  // Footprints (obstacles) and chair zones.
  const footprints: Rect[] = [...wallRects(), ...coffeeRects(), propRect(floor)];
  const seatZones: Rect[] = [];
  for (const d of desks) {
    const half = d.wide ? WIDE_DESK_HALF : DESK_HALF;
    footprints.push(rect(d.wide ? 'signing-desk' : 'desk', d.x, d.z, half.w, half.d));
    seatZones.push(rect('desk-chair', d.seat.x, d.seat.z, d.wide ? 0.27 : 0.22, d.wide ? 0.27 : 0.22));
  }
  for (const s of spareDesks) footprints.push(rect('desk', s.x, s.z, DESK_HALF.w, DESK_HALF.d));
  if (penthouse) {
    footprints.push(rect('bookshelf', PENTHOUSE_SHELF.x, PENTHOUSE_SHELF.z, PENTHOUSE_SHELF.w / 2 + 0.02, 0.17));
    for (const [x, z, s] of PENTHOUSE_PLANTS) footprints.push(plantRect(x, z, s));
  } else {
    for (const p of PARTITIONS) footprints.push(partitionRect(p));
    for (const [x, z, s] of PLANTS) footprints.push(plantRect(x, z, s));
    for (const [x, w] of SHELVES) footprints.push(rect('bookshelf', x, SHELF_Z, w / 2 + 0.02, 0.17));
  }
  footprints.push(...loungeRects(floor === MEETING_FLOOR));
  if (floor === MEETING_FLOOR) {
    const m = meetingRects();
    footprints.push(...m.footprints);
    seatZones.push(...m.seats);
  }
  footprints.push(rect('call-panel', STAFF_LANDING.callPanel.x, STAFF_LANDING.callPanel.z, 0.04, 0.1));

  // §7.5c exception zones.
  const zones: Zone[] = [];
  const circle = (id: string, p: XZ, r = SPOT_ZONE_RADIUS): void => {
    zones.push({ id, x: p.x, z: p.z, r });
  };
  for (const s of spots) {
    if (s.kind === 'meeting-seat') circle(s.id, s, MEETING_SEAT_RADIUS);
    else if (s.kind === 'coffee' || s.kind === 'landing-wait' || s.kind === 'handover' || s.kind === 'signing' || s.kind === 'pair') circle(s.id, s);
  }
  for (const d of desks) if (!d.wide) circle(`pair-seat:${d.owner}`, d.seat);
  zones.push({ id: 'cabin', x: STAFF_SHAFT.x, z: STAFF_SHAFT.z, r: STAFF_SHAFT.cabinHalf, square: true });

  return { floor, desks, spareDesks, spots, aisles, footprints, seatZones, zones };
}

/** The exception zone containing `p`, or null (§7.5c). */
export function zoneAt(layout: FloorLayout, p: XZ): Zone | null {
  for (const z of layout.zones) {
    const inside = z.square ? Math.abs(p.x - z.x) <= z.r && Math.abs(p.z - z.z) <= z.r : Math.hypot(p.x - z.x, p.z - z.z) <= z.r;
    if (inside) return z;
  }
  return null;
}

/** Two robots may be closer than ROBOT_SEPARATION only when both stand inside exception zones. */
export function separationExempt(layout: FloorLayout, a: XZ, b: XZ): boolean {
  return zoneAt(layout, a) !== null && zoneAt(layout, b) !== null;
}

// ---------------------------------------------------------------- campus amenity wing (KARARLAR rev 31)
// A three-level wing west of the tower (opposite the east staff shaft), beyond the visitor shaft, joined
// to tower floors 0-2 by glass sky-bridges on the corridor line. Wing level n sits at tower floor n's
// height and ghosts with it (0001 REQ-8); the wing roof (floor-3 height) carries a roof garden.
// Coordinates are floor-local x/z like the rest of this file. Pure numbers, no three.js.

export const WING = { x: -16.7, z: 0, halfW: 5.5, halfD: 5.5 } as const;
export const WING_LEVELS: readonly number[] = [0, 1, 2];
/** The wing roof is at the height of this tower floor and ghosts with it. */
export const ROOF_GARDEN_FLOOR = 3;
export const WING_EAST_X = WING.x + WING.halfW;
export const WING_WEST_X = WING.x - WING.halfW;
/** Wing-local x to floor-local x. */
export const wingX = (lx: number): number => WING.x + lx;
/** Glass sky-bridge on the corridor line between the wing east wall (x0) and the tower west wall (x1). */
export const SKY_BRIDGE = { z: CORRIDOR_Z, halfWidth: 0.6, x0: WING_EAST_X, x1: -HALF_WIDTH } as const;
/** Door gaps (z range) cut into the tower west wall and the wing east wall where the bridge lands. */
export const BRIDGE_DOOR = { z0: CORRIDOR_Z - 0.6, z1: CORRIDOR_Z + 0.6 } as const;
/** Level-0 door in the wing south wall onto the cafeteria terrace (x range). */
export const TERRACE_DOOR = { x0: wingX(0.4), x1: wingX(1.6) } as const;
export const TERRACE = { x0: wingX(-5.0), x1: wingX(5.0), z0: WING.halfD, z1: WING.halfD + 2.8 } as const;
/** Whole campus footprint (tower, shafts, wing, terrace) for camera framing. */
export const CAMPUS_BOUNDS = { x0: WING_WEST_X - 0.4, x1: STAFF_SHAFT.x + 0.9, z0: -HALF_DEPTH, z1: TERRACE.z1 } as const;

export type AmenityZoneId = 'yemekhane' | 'snack-bar' | 'terrace' | 'gym' | 'game-room' | 'sleep-pods' | 'rnd-lab' | 'archive' | 'roof-garden';

export interface AmenityZone {
  readonly id: AmenityZoneId;
  readonly floor: number;
  /** Floor label (null: no label, e.g. the terrace belongs to the cafeteria). */
  readonly label: string | null;
  readonly bounds: Rect;
  /** Label anchor (floor-local x/z). */
  readonly labelAt: XZ;
}

const wingRect = (name: string, lx0: number, lz0: number, lx1: number, lz1: number): Rect => ({ name, x0: wingX(Math.min(lx0, lx1)), x1: wingX(Math.max(lx0, lx1)), z0: Math.min(lz0, lz1), z1: Math.max(lz0, lz1) });
const wingAt = (lx: number, z: number): XZ => ({ x: wingX(lx), z });

export const CAMPUS_ZONES: readonly AmenityZone[] = [
  { id: 'yemekhane', floor: 0, label: 'YEMEKHANE', bounds: wingRect('yemekhane', -5.5, -5.5, 5.5, 5.5), labelAt: wingAt(-2.4, 2.0) },
  { id: 'snack-bar', floor: 0, label: 'SNACK BAR', bounds: wingRect('snack-bar', 1.0, -5.5, 5.5, -1.6), labelAt: wingAt(2.9, -3.6) },
  { id: 'terrace', floor: 0, label: null, bounds: { name: 'terrace', ...TERRACE }, labelAt: wingAt(1.0, 7.0) },
  { id: 'gym', floor: 1, label: 'SPOR SALONU', bounds: wingRect('gym', -5.5, -5.5, 5.5, -1.3), labelAt: wingAt(-2.7, -3.4) },
  { id: 'game-room', floor: 1, label: 'OYUN ALANI', bounds: wingRect('game-room', -5.5, -0.5, 5.5, 5.5), labelAt: wingAt(-1.0, 2.9) },
  { id: 'sleep-pods', floor: 2, label: 'UYKU ODALARI', bounds: wingRect('sleep-pods', -5.5, -5.5, -0.3, -1.6), labelAt: wingAt(-2.95, -3.0) },
  { id: 'rnd-lab', floor: 2, label: 'AR-GE', bounds: wingRect('rnd-lab', -0.3, -5.5, 5.5, 5.5), labelAt: wingAt(2.9, -3.8) },
  { id: 'archive', floor: 2, label: 'ARŞİV', bounds: wingRect('archive', -5.5, -0.2, 0.6, 5.5), labelAt: wingAt(-2.4, 2.7) },
  { id: 'roof-garden', floor: ROOF_GARDEN_FLOOR, label: null, bounds: wingRect('roof-garden', -5.5, -5.5, 5.5, 5.5), labelAt: wingAt(0, 0) },
];

export type AmenityKind =
  | 'serving'
  | 'snack'
  | 'dining'
  | 'terrace'
  | 'treadmill'
  | 'weights'
  | 'mat'
  | 'ping-pong'
  | 'foosball'
  | 'arcade'
  | 'bean-bag'
  | 'pod'
  | 'lab-bench'
  | 'archive';

/** A break spot at an amenity: where a robot stands, sits or lies (a spur node of the campus graph). */
export interface AmenitySpot extends XZ {
  readonly id: string;
  readonly floor: number;
  readonly zone: AmenityZoneId;
  readonly kind: AmenityKind;
  /** Yaw of the robot at the spot (robot front is +z; yaw 0 faces +z). */
  readonly facing: number;
  /** Aisle id, or another amenity spot id (spur of a spur). */
  readonly via: string;
}

const FACE_N = Math.PI;
const FACE_S = 0;
const FACE_E = Math.PI / 2;
const FACE_W = -Math.PI / 2;

type SpotRow = readonly [kind: AmenityKind, zone: AmenityZoneId, via: string, facing: number, z: number, xs: readonly number[]];
const SPOT_ROWS: Readonly<Record<number, readonly SpotRow[]>> = {
  0: [
    ['serving', 'yemekhane', 'wing-spine', FACE_N, -2.35, [-3.8, -2.5, -1.2]],
    ['snack', 'snack-bar', 'wing-spine', FACE_N, -2.35, [1.9, 2.9, 3.9]],
    ['dining', 'yemekhane', 'wing-spine', FACE_S, -0.15, [-3.8, -2.3, -0.8, 2.3, 3.8]],
    ['dining', 'yemekhane', 'dining-w', FACE_S, 2.85, [-3.8, -2.3, -0.8]],
    ['dining', 'yemekhane', 'dining-e', FACE_S, 2.85, [2.3, 3.8]],
    ['terrace', 'terrace', 'terrace-door', FACE_S, 6.75, [0.0, 2.0]],
  ],
  1: [
    ['treadmill', 'gym', 'gym-w', FACE_N, -4.0, [-4.5, -3.3, -2.1, -0.9]],
    ['weights', 'gym', 'gym-e', FACE_N, -3.9, [2.0, 3.6]],
    ['mat', 'gym', 'wing-spine', FACE_N, -1.8, [1.6, 2.8, 4.0]],
    ['ping-pong', 'game-room', 'wing-spine', FACE_E, 2.2, [-4.25]],
    ['ping-pong', 'game-room', 'wing-spine', FACE_W, 2.2, [-1.75]],
    ['foosball', 'game-room', 'wing-spine', FACE_S, 0.35, [0.6]],
    ['foosball', 'game-room', 'game-arm', FACE_N, 2.05, [0.6]],
    ['arcade', 'game-room', 'game-arm', FACE_S, 4.1, [3.7]],
    ['bean-bag', 'game-room', 'game-lounge', FACE_N, 4.3, [-3.6, -2.3, -1.0]],
  ],
  2: [
    ['pod', 'sleep-pods', 'wing-spine', FACE_S, -4.3, [-4.6, -3.5, -2.4, -1.3]],
    ['lab-bench', 'rnd-lab', 'wing-spine', FACE_N, -2.1, [1.4, 2.2, 3.6, 4.4]],
    ['archive', 'archive', 'archive-1', FACE_W, 1.9, [-4.85]],
    ['archive', 'archive', 'archive-2', FACE_W, 3.5, [-4.85]],
  ],
};

function amenitySpotsOf(floor: number): AmenitySpot[] {
  const out: AmenitySpot[] = [];
  const count = new Map<AmenityKind, number>();
  for (const [kind, zone, via, facing, z, xs] of SPOT_ROWS[floor] ?? []) {
    for (const lx of xs) {
      const i = count.get(kind) ?? 0;
      count.set(kind, i + 1);
      out.push({ id: `amenity:${kind}:${i}`, floor, zone, kind, facing, via, x: wingX(lx), z });
    }
  }
  // The second arcade cabinet is reached through the first one's spot (spur of a spur).
  const first = out.find((s) => s.kind === 'arcade');
  if (first) out.push({ ...first, id: 'amenity:arcade:1', via: first.id, x: wingX(4.5) });
  return out;
}

/** Break spots per wing level (floor 0: cafeteria, snack bar, terrace; 1: gym, game room; 2: pods, lab, archive). */
export const AMENITY_SPOTS: readonly AmenitySpot[] = WING_LEVELS.flatMap(amenitySpotsOf);

/** Aisles of one wing level, floor-local: the wing spine on the corridor line plus zone aisles. */
export function wingAisles(floor: number): Aisle[] {
  const z = CORRIDOR_Z;
  const a = (id: string, lx0: number, z0: number, lx1: number, z1: number): Aisle => ({ id, a: wingAt(lx0, z0), b: wingAt(lx1, z1) });
  const spine: Aisle = { id: 'wing-spine', a: { x: WING_EAST_X, z }, b: wingAt(-4.8, z) };
  switch (floor) {
    case 0:
      return [spine, a('terrace-door', 1.0, z, 1.0, 6.3), a('dining-w', 1.0, 2.1, -4.4, 2.1), a('dining-e', 1.0, 2.1, 4.4, 2.1)];
    case 1:
      return [spine, a('gym-arm', 0.3, z, 0.3, -2.7), a('gym-w', 0.3, -2.7, -4.6, -2.7), a('gym-e', 0.3, -2.7, 4.2, -2.7), a('game-arm', 2.0, z, 2.0, 4.1), a('game-lounge', 2.0, 3.5, -4.0, 3.5)];
    case 2:
      return [spine, a('archive-arm', 0.9, z, 0.9, 3.5), a('archive-1', 0.9, 1.9, -4.2, 1.9), a('archive-2', 0.9, 3.5, -4.2, 3.5)];
    default:
      return [];
  }
}

/** Wing walls with their door gaps and the bridge glass sides, as nav obstacles. */
function wingWallRects(floor: number): Rect[] {
  const t = WALL_HALF_T + 0.01;
  const x0 = WING_WEST_X;
  const x1 = WING_EAST_X;
  const z0 = -WING.halfD;
  const z1 = WING.halfD;
  const out = [
    span('wing-wall-north', x0 - t, z0 - t, x1 + t, z0 + t),
    span('wing-wall-west', x0 - t, z0 - t, x0 + t, z1 + t),
    span('wing-wall-east', x1 - t, z0 - t, x1 + t, BRIDGE_DOOR.z0),
    span('wing-wall-east', x1 - t, BRIDGE_DOOR.z1, x1 + t, z1 + t),
  ];
  if (floor === 0) out.push(span('wing-wall-south', x0 - t, z1 - t, TERRACE_DOOR.x0, z1 + t), span('wing-wall-south', TERRACE_DOOR.x1, z1 - t, x1 + t, z1 + t));
  else out.push(span('wing-wall-south', x0 - t, z1 - t, x1 + t, z1 + t));
  const b = SKY_BRIDGE;
  out.push(span('bridge-side', b.x0, b.z - b.halfWidth - t, b.x1, b.z - b.halfWidth + t), span('bridge-side', b.x0, b.z + b.halfWidth - t, b.x1, b.z + b.halfWidth + t));
  return out;
}

/** Furniture footprints (obstacles) and seat/bed zones (not obstacles) of one wing level, floor-local. */
export function wingFurniture(floor: number): { footprints: Rect[]; seatZones: Rect[] } {
  const r = wingRect;
  const f: Rect[] = [];
  const s: Rect[] = [];
  const seats = (name: string, half: number, kinds: readonly AmenityKind[]): void => {
    for (const p of AMENITY_SPOTS) if (p.floor === floor && kinds.includes(p.kind)) s.push(rect(name, p.x, p.z, half, half));
  };
  switch (floor) {
    case 0:
      f.push(r('serving-counter', -4.6, -3.65, -0.4, -3.0), r('kitchen-pass', -4.9, -5.45, -0.2, -4.7));
      f.push(r('snack-counter', 1.4, -3.35, 4.4, -2.85), r('snack-fridges', 1.2, -5.45, 4.8, -4.9));
      f.push(r('dining-table', -4.6, 0.25, -0.1, 1.4), r('dining-table', 1.7, 0.25, 4.5, 1.4));
      f.push(r('dining-table', -4.6, 3.25, -0.1, 4.4), r('dining-table', 1.7, 3.25, 4.5, 4.4));
      f.push(r('green-wall', -5.5, -4.6, -5.2, 4.6), r('planter', 4.6, 4.7, 5.4, 5.4), r('planter', -4.7, 4.7, -1.6, 5.4));
      for (const lx of [0.0, 2.0]) f.push(r('bistro-table', lx - 0.33, 7.0, lx + 0.33, 7.66));
      f.push(r('terrace-planter', -5.0, 7.9, 5.0, 8.3));
      seats('stool', 0.2, ['snack', 'dining', 'terrace']);
      break;
    case 1:
      for (const lx of [-4.5, -3.3, -2.1, -0.9]) {
        f.push(r('treadmill-console', lx - 0.38, -5.1, lx + 0.38, -4.75));
        s.push(r('treadmill-belt', lx - 0.33, -4.75, lx + 0.33, -3.25));
      }
      f.push(r('dumbbell-rack', 1.4, -5.45, 4.6, -4.85), r('weight-bench', 2.55, -4.45, 3.05, -3.35));
      f.push(r('green-wall', -5.5, -5.2, -5.2, -1.6), r('planter', 4.7, -1.5, 5.4, -1.3));
      f.push(r('ping-pong-table', -3.75, 1.78, -2.25, 2.62), r('foosball', 0.05, 0.875, 1.15, 1.525));
      f.push(r('arcade-cabinet', 3.4, 4.75, 4.8, 5.4), r('planter', -5.4, 4.8, -4.6, 5.4), r('planter', 4.85, 0.0, 5.4, 1.4));
      seats('bean-bag', 0.32, ['bean-bag']);
      break;
    case 2:
      for (const lx of [-4.6, -3.5, -2.4, -1.3]) {
        f.push(r('pod-shell', lx - 0.5, -5.45, lx + 0.5, -4.95), r('pod-side', lx - 0.5, -4.95, lx - 0.4, -3.55), r('pod-side', lx + 0.4, -4.95, lx + 0.5, -3.55));
        s.push(r('pod-bed', lx - 0.4, -4.95, lx + 0.4, -3.55));
      }
      f.push(r('planter-divider', -0.5, -5.45, -0.1, -2.3));
      f.push(r('lab-bench', 1.0, -3.3, 2.6, -2.7), r('lab-bench', 3.2, -3.3, 4.8, -2.7), r('screen-wall', 0.4, -5.5, 5.1, -5.3));
      for (const lx of [1.2, 2.5, 3.8]) f.push(r('prototype-stand', lx - 0.22, -4.52, lx + 0.22, -4.08));
      for (const z of [1.1, 2.7, 4.3]) f.push(r('archive-shelf', -4.42, z - 0.22, -0.38, z + 0.22));
      for (const [lx, z] of [[2.6, 1.6], [4.0, 3.2], [2.6, 4.6]] as const) f.push(r('prototype-stand', lx - 0.3, z - 0.3, lx + 0.3, z + 0.3));
      f.push(r('planter', 4.6, 4.6, 5.4, 5.4), r('planter', 4.6, 0.0, 5.4, 0.8));
      seats('lab-stool', 0.2, ['lab-bench']);
      break;
  }
  return { footprints: f, seatZones: s };
}

/** Campus part of one tower floor's plan: the bridge aisle, wing aisles, break spots and obstacles. */
export interface CampusLevelLayout {
  readonly floor: number;
  readonly aisles: readonly Aisle[];
  readonly spots: readonly AmenitySpot[];
  /** Wing walls, bridge sides and wing furniture. */
  readonly footprints: readonly Rect[];
  readonly seatZones: readonly Rect[];
  /** The tower west wall split around the bridge door (stands in for the solid `wall-west` rect). */
  readonly towerWestWall: readonly Rect[];
}

/** Campus layout for a wing level (floors 0-2), joined to the tower floor's corridor; null elsewhere. */
export function campusLevelLayout(floor: number, tower: FloorLayout): CampusLevelLayout | null {
  if (!WING_LEVELS.includes(floor)) return null;
  const corridor = tower.aisles.find((a) => a.id === 'corridor');
  const start = corridor ? (corridor.a.x <= corridor.b.x ? corridor.a : corridor.b) : { x: WORK_DOOR_X, z: CORRIDOR_Z };
  const bridge: Aisle = { id: 'sky-bridge', a: start, b: { x: WING_EAST_X, z: CORRIDOR_Z } };
  const furniture = wingFurniture(floor);
  const t = WALL_HALF_T + 0.01;
  return {
    floor,
    aisles: [bridge, ...wingAisles(floor)],
    spots: AMENITY_SPOTS.filter((s) => s.floor === floor),
    footprints: [...wingWallRects(floor), ...furniture.footprints],
    seatZones: furniture.seatZones,
    towerWestWall: [span('wall-west', -HALF_WIDTH - t, -HALF_DEPTH - t, -HALF_WIDTH + t, BRIDGE_DOOR.z0), span('wall-west', -HALF_WIDTH - t, BRIDGE_DOOR.z1, -HALF_WIDTH + t, HALF_DEPTH + t)],
  };
}
