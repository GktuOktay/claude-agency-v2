// Software-company interior (KARARLAR Rev 35): premium desk setups with domain screens, wall displays
// (CI/CD pipeline board, glass kanban, on-call board, release calendar), the floor-1 server room, the
// fictional AJANS signage on the crown and in the lobby, the lobby welcome screen and award plaques, and
// premium details (oak slats, brushed metal, felt acoustic panels). Decoration only: nothing here moves a
// desk, seat, spot, aisle or zone. Placement and footprints: src/scene/softwareLayout.ts.
// Every display shows a tile of one static, shared atlas (src/scene/textures.ts), so the displays of a
// floor merge into one draw call and the atlas uploads once.
import { Group, PlaneGeometry, type BufferGeometry, type Material, type Mesh, type Object3D, type Texture } from 'three';
import { FLOOR_HEIGHT, FLOOR_TOP, HALF_DEPTH, LOBBY_FLOOR, PENTHOUSE, PROP_AT } from '../sim/layout';
import { KANBAN_CARDS, screenDomain } from './codeLines';
import { DRESSING_PREFIX, bakeStatic } from './flexOffice';
import { Kit, PALETTE } from './furniture';
import type { Screen } from './screen';
import { ATLAS_SIZE, ATLAS_TILES, DESK_TILES, softwareDecorSpots, type DecorSpot, type TileName } from './softwareLayout';
import { decorAtlas, domainScreenTexture } from './textures';

/** Name prefix of decor groups that carry no footprint (overhead, floor-flush, mounted on a prop, outside). */
export const DECOR_PREFIX = 'decor:';

const CEILING = FLOOR_HEIGHT - FLOOR_TOP - 0.02;
const DESK_TOP = 0.365;
const WARM_LIGHT = [0xfff1d6, 0xffcf8a, 0.15, 3.5] as const;
const RACK_LIGHT = [0x7fe3ff, 0x7fe3ff, 0.9, 2.4] as const;
const AISLE_LIGHT = [0xd8f2ff, 0x7fd4ff, 0.3, 2.0] as const;

/** Canvas textures exist (the app passes them); tests and canvas-less browsers fall back to flat colours. */
const canvasReady = (k: Kit): boolean => k.textures.wood !== null || k.textures.blob !== null;
const atlasOf = (k: Kit): Texture | null => (canvasReady(k) ? decorAtlas() : null);
const metal = (k: Kit): Material => k.m(0xc9ced4, { metalness: 0.6, roughness: 0.35 });
/** Desk hardware reuses the chair-stem material, so desk setups add no draw call. */
const deskMetal = (k: Kit): Material => k.m(PALETTE.graphite, { metalness: 0.4, roughness: 0.4 });
const frost = (k: Kit): Material => k.tint(0xf4f7f8, 0.5);

const geoCache = new Map<string, BufferGeometry>();
/** Plane of width `w` showing atlas tile `tile` (height from the tile aspect unless given). */
function tilePlane(tile: TileName, w: number, h?: number): BufferGeometry {
  const t = ATLAS_TILES[tile];
  const hh = h ?? (w * t.h) / t.w;
  const key = `${tile}:${w}:${hh}`;
  let geo = geoCache.get(key);
  if (!geo) {
    geo = new PlaneGeometry(w, hh);
    const uv = geo.attributes.uv;
    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uv.setXY(i, (t.x + u * t.w) / ATLAS_SIZE, 1 - (t.y + (1 - v) * t.h) / ATLAS_SIZE);
      }
    }
    geoCache.set(key, geo);
  }
  return geo;
}

/** Display face (atlas tile) facing +z with its centre at (x, y, z). */
function display(k: Kit, g: Group, tile: TileName, w: number, x: number, y: number, z: number): Mesh {
  return k.place(g, tilePlane(tile, w), k.panel(atlasOf(k)), x, y, z, 'none');
}
const tileH = (tile: TileName, w: number): number => (w * ATLAS_TILES[tile].h) / ATLAS_TILES[tile].w;

function sub(parent: Group, name: string, x = 0, y = 0, z = 0, yaw = 0): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------- wall pieces (origin at the piece centre)

/** Framed wall screen: brushed-metal frame (back at the wall) and the tile face; bottom edge at y. */
function wallScreen(k: Kit, g: Group, tile: TileName, w: number, y: number): void {
  const h = tileH(tile, w - 0.06);
  k.box(g, w, h + 0.06, 0.03, 0, metal(k), 0, y, -0.01, 'none');
  k.box(g, w - 0.03, h + 0.03, 0.006, 0, k.m(PALETTE.charcoal, { roughness: 0.4 }), 0, y + 0.015, 0.005, 'none');
  display(k, g, tile, w - 0.06, 0, y + 0.03 + h / 2, 0.012);
}

function kanban(k: Kit, g: Group, accent: number): void {
  const w = 1.48;
  const y0 = 0.22;
  const h = 0.62;
  k.box(g, w, h, 0.01, 0, frost(k), 0, y0, -0.015, 'none');
  for (const y of [y0 - 0.02, y0 + h]) k.box(g, w + 0.02, 0.02, 0.02, 0, metal(k), 0, y, -0.012, 'none');
  const head = tileH('kanban-head', w - 0.04);
  display(k, g, 'kanban-head', w - 0.04, 0, y0 + h - 0.02 - head / 2, 0.0);
  const colW = (w - 0.04) / KANBAN_CARDS.length;
  const colors = [PALETTE.books[2], PALETTE.books[1], PALETTE.books[4], PALETTE.books[3]];
  KANBAN_CARDS.forEach((n, c) => {
    const cx = -w / 2 + 0.02 + colW * (c + 0.5);
    for (let i = 0; i < n; i++) {
      const col = (i === 0 && c === 1 ? accent : colors[c]) ?? PALETTE.white;
      k.box(g, colW - 0.08, 0.085, 0.006, 0, k.m(col, { roughness: 0.8 }), cx + ((i % 2) - 0.5) * 0.02, y0 + h - 0.06 - head - 0.105 * (i + 1), -0.006, 'none');
    }
  });
}

function acousticPanels(k: Kit, g: Group, accent: number): void {
  const colors = [PALETTE.fabric, PALETTE.fabricBlue, accent, PALETTE.fabricBlue, PALETTE.fabric, PALETTE.fabric];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const col = colors[r * 3 + c] ?? PALETTE.fabric;
      k.box(g, 0.42, 0.3, 0.035, 0, k.m(col, { roughness: 1 }), -0.45 + c * 0.45, 0.4 + r * 0.34, -0.0075, 'none');
    }
  }
}

function brandWall(k: Kit, g: Group): void {
  const w = 2.7;
  const h = 1.6; // taller than the 1.2 walls: the lobby's double-height feature wall
  k.box(g, w, 0.06, 0.2, 0, k.m(PALETTE.marble, { roughness: 0.25 }), 0, 0, 0, 'object');
  k.box(g, w, 0.015, 0.05, 0, k.m(PALETTE.brass), 0, h, -0.045, 'none');
  // Art wall: an abstract triptych in walnut frames above the plaques.
  [PALETTE.books[0], PALETTE.books[1], PALETTE.books[2]].forEach((c, i) => {
    const x = 0.6 + i * 0.25;
    k.box(g, 0.22, 0.36, 0.015, 0, k.m(PALETTE.walnut), x, 0.98, 0.0, 'none');
    k.box(g, 0.18, 0.32 - i * 0.06, 0.006, 0, k.m(c ?? PALETTE.white, { roughness: 0.9 }), x, 1.0 + i * 0.03, 0.012, 'none');
  });
  k.box(g, w, h - 0.06, 0.04, 0, k.m(PALETTE.charcoal, { roughness: 0.6 }), 0, 0.06, -0.06, 'object');
  // Vertical oak slats over the dark backer.
  const slat = k.m(PALETTE.oak, { roughness: 0.6 });
  for (let i = 0; i < 18; i++) k.box(g, 0.07, h - 0.08, 0.03, 0, slat, -w / 2 + 0.075 + i * 0.15, 0.07, -0.025, 'object');
  k.box(g, w - 0.1, 0.02, 0.02, 0, k.glow(...WARM_LIGHT), 0, h - 0.03, 0.0, 'none');
  // Sign: brushed-metal plate with the AJANS tile.
  const sw = 1.3;
  const sh = tileH('sign', sw - 0.06);
  k.box(g, sw, sh + 0.06, 0.02, 0, metal(k), -0.35, 0.5, 0.0, 'none');
  display(k, g, 'sign', sw - 0.06, -0.35, 0.53 + sh / 2, 0.021);
  // Award plaques on oak backings.
  const awards = sub(g, 'awards');
  (['award-a', 'award-b', 'award-c'] as const).forEach((tile, i) => {
    const x = 0.6 + i * 0.25;
    const ph = tileH(tile, 0.18);
    k.box(awards, 0.2, ph + 0.02, 0.015, 0, k.m(PALETTE.oakDark, { roughness: 0.6 }), x, 0.55, 0.0, 'none');
    display(k, awards, tile, 0.18, x, 0.56 + ph / 2, 0.016);
  });
}

function welcomeScreen(k: Kit, g: Group): void {
  k.box(g, 0.5, 0.02, 0.26, 0, metal(k), 0, 0, 0, 'object');
  k.box(g, 0.06, 0.52, 0.04, 0, metal(k), 0, 0.02, -0.04, 'object');
  const w = 0.92;
  const h = tileH('welcome', w);
  k.box(g, w + 0.04, h + 0.04, 0.03, 0, k.m(PALETTE.charcoal, { roughness: 0.4 }), 0, 0.5, -0.015, 'object');
  display(k, g, 'welcome', w, 0, 0.52 + h / 2, 0.002);
}

function buildSpot(k: Kit, s: DecorSpot, accent: number): Group {
  const g = new Group();
  g.name = `${DRESSING_PREFIX}${s.name}`;
  g.position.set(s.x, 0, s.z);
  const tile = s.tile ?? 'roadmap';
  switch (s.name) {
    case 'ci-board':
      wallScreen(k, g, tile, 1.65, 0.5);
      break;
    case 'wall-display':
    case 'status-board':
    case 'release-calendar':
      wallScreen(k, g, tile, 0.86, tile === 'calendar' || tile === 'status' ? 0.62 : 0.5);
      break;
    case 'kanban':
      kanban(k, g, accent);
      break;
    case 'acoustic-panels':
      acousticPanels(k, g, accent);
      break;
    case 'brand-wall':
      brandWall(k, g);
      break;
    case 'welcome-screen':
      welcomeScreen(k, g);
      break;
  }
  return g;
}

// ---------------------------------------------------------------- pieces without a footprint

/** Floor 1 server room around the rack prop: glowing rack doors, an overhead cable tray, a cold aisle. */
function serverRoom(k: Kit, parent: Group, accent: number): void {
  const g = sub(parent, `${DECOR_PREFIX}server-room`, PROP_AT.x, 0, PROP_AT.z);
  const rackXs = [-1, -0.25, 0.5];
  const glowG = sub(g, 'rack-glow');
  const led = k.glow(...RACK_LIGHT);
  for (const x of rackXs) {
    k.box(glowG, 0.54, 1.04, 0.008, 0, k.tint(0xbcd9e6, 0.38), x, 0.06, 0.309, 'none');
    for (const dx of [-0.235, 0.235]) k.box(glowG, 0.012, 0.98, 0.008, 0, led, x + dx, 0.09, 0.316, 'none');
    for (let r = 0; r < 4; r++) k.box(glowG, 0.05, 0.012, 0.006, 0, r % 2 ? led : k.m(accent, { emissive: accent, emissiveIntensity: 1.3 }), x - 0.15, 0.27 + r * 0.22, 0.318, 'none');
    k.box(glowG, 0.5, 0.015, 0.01, 0, led, x, 1.13, 0.3, 'none');
  }
  // Cable tray above the racks, hung from the ceiling, with drops into each rack.
  const tray = sub(g, 'cable-tray');
  const len = 2.5;
  const cx = -0.25;
  const y = 1.34;
  k.box(tray, len, 0.01, 0.22, 0, metal(k), cx, y, 0, 'none');
  for (const z of [-0.11, 0.11]) k.box(tray, len, 0.045, 0.01, 0, metal(k), cx, y, z, 'none');
  [PALETTE.fabricBlue, accent, PALETTE.charcoal].forEach((c, i) => k.box(tray, len - 0.06, 0.018, 0.03, 0, k.m(c, { roughness: 0.8 }), cx, y + 0.01, -0.06 + i * 0.05, 'none'));
  for (const x of [cx - 1.0, cx, cx + 1.0]) for (const z of [-0.11, 0.11]) k.cyl(tray, 0.006, 0.006, CEILING - y - 0.05, k.m(PALETTE.graphite), x, y + 0.05, z, 4, 'none');
  for (const x of rackXs) k.box(tray, 0.05, y - 1.15, 0.04, 0, k.m(PALETTE.charcoal, { roughness: 0.8 }), x + 0.15, 1.15, -0.05, 'none');
  // Cold aisle: perforated pale tiles and blue edge lights in front of the racks (floor-flush).
  const aisle = sub(g, 'cold-aisle');
  const tileMat = k.m(PALETTE.glass, { roughness: 0.5 });
  for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) k.box(aisle, 0.29, 0.006, 0.27, 0, tileMat, -1.2 + i * 0.31, 0.003, 0.5 + j * 0.29, 'surface');
  for (const z of [0.34, 0.95]) k.box(aisle, 2.17, 0.008, 0.02, 0, k.glow(...AISLE_LIGHT), -0.27, 0.003, z, 'none');
}

/** Lobby: an oak slat ceiling raft over the reception (half open, so the desk stays visible from above). */
function slatCeiling(k: Kit, parent: Group): void {
  const g = sub(parent, `${DECOR_PREFIX}slat-ceiling`, PROP_AT.x, 0, PROP_AT.z);
  const y = CEILING - 0.22;
  const slat = k.m(PALETTE.oak, { roughness: 0.6 });
  for (let i = 0; i < 10; i++) k.box(g, 3.0, 0.04, 0.07, 0, slat, 0, y, -0.85 + i * 0.19, 'none');
  for (const x of [-1.2, 1.2]) {
    k.box(g, 0.04, 0.03, 1.85, 0, k.m(PALETTE.charcoal), x, y + 0.04, 0, 'none');
    k.cyl(g, 0.005, 0.005, CEILING - y - 0.07, k.m(PALETTE.graphite), x, y + 0.07, 0, 4, 'none');
  }
}

/** Tower crown: the AJANS sign on two posts behind the penthouse's north glass, facing the city (+z). */
function crownSign(k: Kit, parent: Group): void {
  const z = -HALF_DEPTH - 0.13;
  const g = sub(parent, `${DECOR_PREFIX}crown-sign`, 0, 0, z);
  for (const x of [-1.1, 1.1]) k.box(g, 0.05, 0.4, 0.05, 0, metal(k), x, 1.05, -0.01, 'none');
  const w = 2.5;
  const h = tileH('sign', w - 0.08);
  k.box(g, w, h + 0.08, 0.04, 0, metal(k), 0, 1.4, -0.01, 'none');
  display(k, g, 'sign', w - 0.08, 0, 1.44 + h / 2, 0.012);
  k.box(g, w, 0.02, 0.03, 0, k.glow(...WARM_LIGHT), 0, 1.48 + h, 0.0, 'none');
}

/** Designer pendants (brass cap, opal globe) on long cords; globes hang at `y`, above head and screen height. */
function pendants(k: Kit, parent: Group, xs: readonly number[], z: number, y: number): void {
  const g = sub(parent, `${DECOR_PREFIX}pendants`);
  for (const x of xs) {
    k.cyl(g, 0.003, 0.003, CEILING - y, k.m(PALETTE.charcoal), x, y, z, 4, 'none');
    k.cyl(g, 0.035, 0.02, 0.04, k.m(PALETTE.brass), x, y + 0.06, z, 10, 'none');
    k.ball(g, 0.085, k.glow(0xfff6ea, 0xffd9a0, 0.4, 3.2), x, y, z, true).userData.shadow = 'none';
  }
}

/** Rev 37 executive finishes mounted on existing props (inside their footprints): stone reception, walnut boardroom table. */
function propFinish(k: Kit, parent: Group, floor: number): void {
  const g = sub(parent, `${DECOR_PREFIX}prop-finish`, PROP_AT.x, 0, PROP_AT.z);
  const marble = k.m(PALETTE.marble, { roughness: 0.25 });
  if (floor === LOBBY_FLOOR) {
    k.box(g, 2.44, 0.48, 0.02, 0, marble, 0, 0.01, 0.29, 'object');
    k.box(g, 2.54, 0.025, 0.68, 0, marble, 0, 0.54, 0, 'object');
    k.box(g, 2.44, 0.012, 0.012, 0, k.m(PALETTE.brass), 0, 0.06, 0.306, 'none');
    pendants(k, parent, [-5.3, -4.5, -3.7], PROP_AT.z + 0.1, 1.75);
  } else if (floor === 4) {
    k.box(g, 2.36, 0.012, 1.06, 0, k.m(PALETTE.walnut, { roughness: 0.45 }), 0, 0.3825, 0, 'object');
    pendants(k, parent, [-5.2, -4.5, -3.8], PROP_AT.z, 1.6);
  }
}

/** Builds the software-company decor of one floor: a group at the floor surface. */
export function buildSoftwareDecor(k: Kit, floor: number, accent: number): Group {
  const root = new Group();
  root.name = `${DECOR_PREFIX}software`;
  root.position.y = FLOOR_TOP;
  for (const s of softwareDecorSpots(floor)) root.add(buildSpot(k, s, accent));
  if (floor === 1) serverRoom(k, root, accent);
  if (floor === LOBBY_FLOOR) slatCeiling(k, root);
  propFinish(k, root, floor);
  if (floor === PENTHOUSE) pendants(k, root, [0.9, 1.9], -4.75, 1.7);
  bakeStatic(k, root, DECOR_PREFIX);
  // The crown sign stays its own group (outside the storey; floor-wide mergeStatic still folds its parts).
  if (floor === PENTHOUSE) crownSign(k, root);
  return root;
}

// ---------------------------------------------------------------- desk setups

export type DeskSetup = 'dual' | 'ultrawide' | 'laptop' | 'executive';

/** Second monitor on a brushed-metal stand (tile face), base at y, facing +z turned by `yaw`. */
function sideMonitor(k: Kit, parent: Group, tile: TileName, x: number, z: number, yaw: number): void {
  const g = sub(parent, 'side-monitor', x, DESK_TOP, z, yaw);
  k.box(g, 0.14, 0.01, 0.09, 0, deskMetal(k), 0, 0, 0);
  k.cyl(g, 0.014, 0.014, 0.1, deskMetal(k), 0, 0.01, -0.02, 8);
  const w = 0.36;
  const h = tileH(tile, w);
  k.box(g, w + 0.02, h + 0.02, 0.022, 0, k.m(PALETTE.charcoal, { roughness: 0.4 }), 0, 0.08, -0.02, 'object');
  display(k, g, tile, w, 0, 0.09 + h / 2, -0.008);
}

/** Laptop on a brushed-metal riser, lid leaning back with a tile face. */
function laptopOnStand(k: Kit, parent: Group, tile: TileName, x: number, z: number, yaw: number): void {
  const g = sub(parent, 'laptop-stand', x, DESK_TOP, z, yaw);
  k.box(g, 0.22, 0.06, 0.15, 0, deskMetal(k), 0, 0, 0);
  k.box(g, 0.27, 0.012, 0.18, 0, k.m(PALETTE.graphite), 0, 0.06, 0.01);
  const lid = sub(g, 'laptop-lid', 0, 0.072, -0.08);
  lid.rotation.x = -0.2;
  k.box(lid, 0.27, 0.18, 0.008, 0, k.m(PALETTE.charcoal, { roughness: 0.4 }), 0, 0, 0);
  display(k, lid, tile, 0.25, 0, 0.09, 0.0045);
}

/** Desk setup for the robot desk at index `i` on a floor (alternating so a floor mixes setups). */
export function deskSetupKind(i: number, signing: boolean): DeskSetup {
  if (signing) return 'executive';
  if (i % 2 === 1) return 'dual';
  return i % 4 === 0 ? 'ultrawide' : 'laptop';
}

const hasScreen = (o: Object3D): boolean => o.getObjectByName('screen') !== undefined;

/**
 * Dresses the robot desks of one floor (desk groups in unit order, matching `screens`): the floor domain on
 * each screen (pooled domain image swapped into the screen's own texture, so Screen.bind and overlays keep
 * working), dual monitors, ultrawides or a laptop on a stand. The main monitor stays the bound screen.
 */
export function dressDesks(k: Kit, floor: number, floorGroup: Group, screens: readonly Screen[]): void {
  const domain = screenDomain(floor);
  const [secondTile, laptopTile] = DESK_TILES[domain];
  const desks = floorGroup.children.filter((c): c is Group => c instanceof Group && (c.name === 'desk' || c.name === 'signing-desk'));
  desks.forEach((desk, i) => {
    const screen = screens[i];
    if (!screen) return;
    screen.setDomain(domain);
    const tex = screen.texture;
    if (tex && domain !== 'engineering' && canvasReady(k)) {
      const pooled = domainScreenTexture(domain);
      if (pooled) {
        tex.source = pooled.source;
        tex.needsUpdate = true;
      }
    }
    const mon = desk.children.find(hasScreen);
    const kind = deskSetupKind(i, desk.name === 'signing-desk');
    const setup = sub(desk, `desk-setup:${kind}`);
    switch (kind) {
      case 'ultrawide':
        if (mon) mon.scale.x = 1.5;
        screen.setWide(true);
        break;
      case 'dual':
        if (mon) mon.position.x = -0.22;
        sideMonitor(k, setup, secondTile, 0.3, -0.12, -0.3);
        break;
      case 'laptop':
        laptopOnStand(k, setup, laptopTile, 0.42, -0.04, -0.35);
        break;
      case 'executive':
        screen.setWide(true);
        k.box(setup, 2.0, 0.012, 0.01, 0, k.m(PALETTE.brass), 0, 0.33, 0.42, 'none'); // brass edge on the walnut top
        sideMonitor(k, setup, secondTile, 0.62, -0.1, -0.35);
        laptopOnStand(k, setup, laptopTile, -0.5, -0.02, 0.35);
        break;
    }
  });
}
