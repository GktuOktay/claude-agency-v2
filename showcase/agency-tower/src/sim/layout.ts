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
