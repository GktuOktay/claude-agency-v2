// Software-company interior (KARARLAR Rev 35): where the wall displays, the lobby brand wall and the welcome
// screen stand (floor-local x/z), and the tile layout of the shared decor texture atlas. Pure numbers, no
// three.js. Floor-standing pieces publish a footprint through `softwareDecorFootprints`, which
// src/scene/flexOffice.ts folds into `dressingFootprints`, so the existing clearance and coverage tests hold
// them to the same rules as the green dressing. src/sim/layout.ts is never changed.
import { LOBBY_FLOOR, PENTHOUSE, type Rect } from '../sim/layout';

export type DecorName = 'ci-board' | 'wall-display' | 'status-board' | 'release-calendar' | 'kanban' | 'acoustic-panels' | 'brand-wall' | 'welcome-screen';

export type TileName =
  | 'terminal'
  | 'tests'
  | 'vuln'
  | 'qa'
  | 'burndown'
  | 'kpi'
  | 'roadmap'
  | 'diagram'
  | 'spec'
  | 'reception'
  | 'award-a'
  | 'award-b'
  | 'award-c'
  | 'pipeline'
  | 'status'
  | 'calendar'
  | 'welcome'
  | 'sign'
  | 'kanban-head';

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Decor atlas: one static canvas shared by every floor (drawn once, uploaded once). */
export const ATLAS_SIZE = 1024;
export const ATLAS_TILES: Readonly<Record<TileName, Tile>> = {
  terminal: { x: 0, y: 0, w: 256, h: 160 },
  tests: { x: 256, y: 0, w: 256, h: 160 },
  vuln: { x: 512, y: 0, w: 256, h: 160 },
  qa: { x: 768, y: 0, w: 256, h: 160 },
  burndown: { x: 0, y: 160, w: 256, h: 160 },
  kpi: { x: 256, y: 160, w: 256, h: 160 },
  roadmap: { x: 512, y: 160, w: 256, h: 160 },
  diagram: { x: 768, y: 160, w: 256, h: 160 },
  spec: { x: 0, y: 320, w: 256, h: 160 },
  reception: { x: 256, y: 320, w: 256, h: 160 },
  'award-a': { x: 512, y: 320, w: 128, h: 160 },
  'award-b': { x: 640, y: 320, w: 128, h: 160 },
  'award-c': { x: 768, y: 320, w: 128, h: 160 },
  pipeline: { x: 0, y: 480, w: 512, h: 192 },
  status: { x: 512, y: 480, w: 512, h: 192 },
  calendar: { x: 0, y: 672, w: 512, h: 224 },
  welcome: { x: 512, y: 672, w: 512, h: 224 },
  sign: { x: 0, y: 896, w: 512, h: 128 },
  'kanban-head': { x: 512, y: 896, w: 512, h: 48 },
};

export interface DecorSpot {
  readonly name: DecorName;
  /** Centre (floor-local). */
  readonly x: number;
  readonly z: number;
  /** Footprint relative to the centre: [x0, x1, z0, z1]; every vertex of the piece lies inside it. */
  readonly box: readonly [number, number, number, number];
  /** Atlas tile shown on the piece (wall displays). */
  readonly tile?: TileName;
}

/** Inner face of the north wall plus a hair: wall-mounted pieces span z NORTH_FACE .. NORTH_FACE + 0.05. */
const NORTH = -5.425;
const WALL = [-0.025, 0.025] as const;
const onWall = (hw: number): readonly [number, number, number, number] => [-hw, hw, WALL[0], WALL[1]];

/** Wall display in the work room's north-east bay (between the east shelf and the coffee wall). */
const BAY_TILE: Readonly<Record<number, TileName>> = { 0: 'roadmap', 1: 'tests', 2: 'status', 3: 'diagram', 4: 'calendar' };

/** Placement of the software-company decor on `floor`. */
export function softwareDecorSpots(floor: number): DecorSpot[] {
  const out: DecorSpot[] = [];
  // CI/CD pipeline board on the north wall of the coffee station, every floor.
  out.push({ name: 'ci-board', x: 4.325, z: NORTH, box: onWall(0.825), tile: 'pipeline' });
  if (floor !== PENTHOUSE) {
    const tile = BAY_TILE[floor] ?? 'roadmap';
    const name: DecorName = floor === 2 ? 'status-board' : floor === 4 ? 'release-calendar' : 'wall-display';
    out.push({ name, x: 2.75, z: NORTH, box: onWall(0.43), tile });
    // Glass kanban on the corridor face of the work-room partition; felt acoustic panels between the moss wall and the east shelf.
    out.push({ name: 'kanban', x: 0.75, z: -1.525, box: onWall(0.75), tile: 'kanban-head' });
    out.push({ name: 'acoustic-panels', x: 0.2, z: NORTH, box: onWall(0.68) });
  }
  if (floor === LOBBY_FLOOR) {
    // Oak-slat brand wall behind the reception desk (sign and award plaques on it) and a welcome kiosk at the entrance.
    out.push({ name: 'brand-wall', x: -4.6, z: 1.2, box: [-1.35, 1.35, -0.1, 0.1], tile: 'sign' });
    out.push({ name: 'welcome-screen', x: -2.6, z: 4.7, box: [-0.5, 0.5, -0.15, 0.15], tile: 'welcome' });
  }
  return out;
}

/** Footprints of the software decor on `floor` (floor-local), one per piece, named after the piece. */
export function softwareDecorFootprints(floor: number): Rect[] {
  return softwareDecorSpots(floor).map((s) => ({ name: s.name, x0: s.x + s.box[0], x1: s.x + s.box[1], z0: s.z + s.box[2], z1: s.z + s.box[3] }));
}

/** Desk tiles per screen domain: [second monitor, laptop]. */
export const DESK_TILES = {
  engineering: ['terminal', 'tests'],
  quality: ['qa', 'vuln'],
  product: ['diagram', 'spec'],
  management: ['burndown', 'kpi'],
} as const satisfies Record<string, readonly [TileName, TileName]>;
