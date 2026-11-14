// Tower exterior (KARARLAR rev 37): a refined curtain-wall dress over the diorama shell. Champagne-bronze
// vertical fins on the wall module, dark spandrel bands at every slab edge, a crown with a lit reveal on
// the top floor, and on the ground floor a stone plinth and a double-height glazed entrance with a
// cantilevered canopy. Original design, procedural geometry only.
//
// Every floor gets one `facade` group in its own floor group, built from that floor's own materials,
// which join the floor's wall list: the facade ghosts and fades exactly like the walls it dresses
// (0001 REQ-8: overview 0.25, focused floor see-through, other floors hidden in floor view, org 0.1),
// never casts or receives shadows and never takes a raycast (picking stays robots only).
//
// Ruling: the west face is dressed flush (at most 0.09 u proud of the wall line, FACADE_WEST_LIMIT) — the
// campus share test counts every named mesh with a vertex west of x = -8.1 and only three of its 60 slots
// were free; the west face sits behind the visitor shaft, the sky-bridges and the wing and faces away from
// every preset camera — if wrong, deeper west fins once the campus share has room (one constant).
// Ruling: no glass on the upper band of office floors — the open band is how the diorama shows each floor
// from the overview; 25 % glass would veil every floor — if wrong, one glass mesh per floor (~100 vertices).
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FloorMaterials } from './model';
import { BRIDGE_DOOR, FLOOR_COUNT, FLOOR_HEIGHT, HALF_DEPTH, HALF_WIDTH, SHAFT_Z, STAFF_SHAFT, TURNSTILE } from '../sim/layout';

export interface FacadeFloor {
  readonly id: number;
  readonly group: Group;
  readonly materials: FloorMaterials;
}

export interface Facade {
  /** One `facade` group per floor (index = floor id). */
  readonly groups: Group[];
  /** Night-lit materials (crown reveal, canopy downlights): emissive 0 by day. */
  readonly glows: MeshStandardMaterial[];
}

/** Lowest x any facade vertex reaches (the west face stays flush, see the ruling above). */
export const FACADE_WEST_LIMIT = -HALF_WIDTH - 0.09;

const SPAN = FLOOR_HEIGHT; // floor to floor
/** Spandrel band around each slab edge (floor-local y). */
const BAND = { y0: -0.2, y1: 0.22, z0: HALF_DEPTH + 0.15, z1: HALF_DEPTH + 0.25, x0: HALF_WIDTH + 0.15, x1: HALF_WIDTH + 0.25 } as const;
/** Fins: slim, deep, continuous from floor to floor. */
const FIN = { t: 0.04, out0: 0.05, out1: 0.3, top: SPAN + BAND.y0 } as const;
const PLINTH = { h: 0.32, out0: 0.15, out1: 0.45 } as const;
/** Ground-floor head band (the lobby crown line), joining the floor-1 spandrel. */
const LOBBY_BAND = { y0: 2.62, y1: SPAN + BAND.y0 } as const;
const CROWN = { y0: SPAN + BAND.y0, y1: 3.3, coping: 0.06 } as const;

/** Double-height glazed entrance on the south face, in front of the lobby turnstile. */
export const ENTRANCE = {
  x: TURNSTILE.x,
  halfW: 1.7,
  /** Head of the portal (world y): two storeys high. */
  top: 5.5,
  /** Portal frame depth (z, outside the wall). */
  z0: HALF_DEPTH + 0.3,
  z1: HALF_DEPTH + 0.6,
  doorTop: 2.42,
  canopy: { x0: TURNSTILE.x - 2.7, x1: TURNSTILE.x + 2.7, y: 4.0, t: 0.18, depth: 2.57 },
} as const;

/** Door gaps the facade keeps open (z ranges on the east and west faces). */
const EAST_GAP = { z0: STAFF_SHAFT.doorGap.z0 - 0.1, z1: STAFF_SHAFT.doorGap.z1 + 0.1 } as const;
const WEST_GAP = { z0: SHAFT_Z - 0.85, z1: BRIDGE_DOOR.z1 + 0.15 } as const;

const COLORS = {
  fin: 0xa8957a, // champagne bronze
  spandrel: 0x5b5f66, // warm graphite
  stone: 0xd8d1c4, // honed limestone
  glass: 0xcfe4ec,
  canopy: 0xebe6de,
  light: 0xfff1d6,
  lightEmissive: 0xffcf8a,
} as const;

type Parts = BufferGeometry[];

function box(parts: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  const g = new BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parts.push(g);
}

/** A run along z from z0 to z1 split around `gap`. */
function zRun(parts: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, gap: { z0: number; z1: number }): void {
  box(parts, x0, x1, y0, y1, z0, gap.z0);
  box(parts, x0, x1, y0, y1, gap.z1, z1);
}

function material(name: string, color: number, opts: { metalness?: number; roughness?: number } = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, metalness: opts.metalness ?? 0, roughness: opts.roughness ?? 0.6 });
  m.name = name;
  return m;
}

function glowMaterial(name: string, night: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: COLORS.light, emissive: COLORS.lightEmissive, emissiveIntensity: 0, roughness: 0.5 });
  m.name = name;
  m.userData.glow = { day: 0, night };
  return m;
}

function mesh(parts: Parts, mat: Material, name: string): Mesh {
  const geo = mergeGeometries(parts) ?? new BoxGeometry(0.01, 0.01, 0.01);
  for (const p of parts) p.dispose();
  const m = new Mesh(geo, mat);
  m.name = name;
  m.userData.shadow = 'none';
  m.castShadow = false;
  m.receiveShadow = false;
  m.raycast = () => undefined; // never pickable (REQ-8)
  return m;
}

const moduleOffsets = (len: number, step: number): number[] => {
  const n = Math.max(1, Math.round(len / step));
  return Array.from({ length: n - 1 }, (_, i) => -len / 2 + ((i + 1) * len) / n);
};
const outside = (v: number, gap: { z0: number; z1: number }): boolean => v < gap.z0 || v > gap.z1;

/** Fins on all four faces plus the corner posts; returns the fin count. */
function fins(parts: Parts, floor: number, y0: number): number {
  const y1 = FIN.top;
  const ht = FIN.t / 2;
  let n = 0;
  const entrance = { z0: ENTRANCE.x - ENTRANCE.halfW - 0.1, z1: ENTRANCE.x + ENTRANCE.halfW + 0.1 };
  for (const x of moduleOffsets(HALF_WIDTH * 2, 1.3)) {
    for (const side of [1, -1]) {
      if (floor === 0 && side === 1 && !outside(x, entrance)) continue; // the portal stands here
      const za = side * (HALF_DEPTH + FIN.out0);
      const zb = side * (HALF_DEPTH + FIN.out1);
      box(parts, x - ht, x + ht, y0, y1, Math.min(za, zb), Math.max(za, zb));
      n++;
    }
  }
  for (const z of moduleOffsets(HALF_DEPTH * 2, 1.3)) {
    if (outside(z, EAST_GAP)) {
      box(parts, HALF_WIDTH + FIN.out0, HALF_WIDTH + FIN.out1, y0, y1, z - ht, z + ht);
      n++;
    }
    if (outside(z, WEST_GAP)) {
      box(parts, FACADE_WEST_LIMIT, -HALF_WIDTH - 0.04, y0, y1, z - ht, z + ht);
      n++;
    }
  }
  // Corner posts.
  for (const side of [1, -1]) {
    const za = side * (HALF_DEPTH + FIN.out0);
    const zb = side * (HALF_DEPTH + FIN.out1);
    box(parts, HALF_WIDTH + FIN.out0, HALF_WIDTH + FIN.out1, y0, y1, Math.min(za, zb), Math.max(za, zb));
    box(parts, FACADE_WEST_LIMIT, FACADE_WEST_LIMIT + 0.25, y0, y1, Math.min(za, zb), Math.max(za, zb));
    n += 2;
  }
  return n;
}

/** A band around the slab edge (south, north, east split at the staff door, west flush and split at the bridges). */
function band(parts: Parts, y0: number, y1: number, proud = 0): void {
  const z0 = BAND.z0;
  const z1 = BAND.z1 + proud;
  const x1 = BAND.x1 + proud;
  for (const side of [1, -1]) {
    const a = side * z0;
    const b = side * z1;
    box(parts, FACADE_WEST_LIMIT, x1, y0, y1, Math.min(a, b), Math.max(a, b));
  }
  zRun(parts, BAND.x0, x1, y0, y1, -z0, z0, EAST_GAP);
  zRun(parts, FACADE_WEST_LIMIT, -HALF_WIDTH - 0.04, y0, y1, -z0, z0, WEST_GAP);
}

function buildFloorFacade(floor: FacadeFloor, glows: MeshStandardMaterial[]): Group {
  const g = new Group();
  g.name = 'facade';
  const walls = floor.materials.walls;
  const fin = material('facade-fin', COLORS.fin, { metalness: 0.55, roughness: 0.35 });
  const spandrel = material('facade-spandrel', COLORS.spandrel, { metalness: 0.35, roughness: 0.3 });
  walls.push(fin, spandrel);
  const finParts: Parts = [];
  const bandParts: Parts = [];
  const isGround = floor.id === 0;
  const isTop = floor.id === FLOOR_COUNT - 1;

  g.userData.fins = fins(finParts, floor.id, isGround ? PLINTH.h : BAND.y0);
  if (isGround) band(bandParts, LOBBY_BAND.y0, LOBBY_BAND.y1);
  else band(bandParts, BAND.y0, BAND.y1);

  if (isTop) {
    // Crown: a deeper parapet band, a bronze coping and a lit reveal just under it.
    band(bandParts, CROWN.y0, CROWN.y1, 0.07);
    for (const side of [1, -1]) {
      const a = side * (HALF_DEPTH + 0.1);
      const b = side * (BAND.z1 + 0.11);
      box(finParts, FACADE_WEST_LIMIT, BAND.x1 + 0.11, CROWN.y1, CROWN.y1 + CROWN.coping, Math.min(a, b), Math.max(a, b));
    }
    box(finParts, HALF_WIDTH + 0.1, BAND.x1 + 0.11, CROWN.y1, CROWN.y1 + CROWN.coping, -HALF_DEPTH - 0.1, HALF_DEPTH + 0.1);
    const reveal = glowMaterial('facade-crown-reveal', 1.4);
    walls.push(reveal);
    glows.push(reveal);
    const rv: Parts = [];
    const ry0 = CROWN.y0 - 0.06;
    for (const side of [1, -1]) {
      const a = side * (BAND.z0 + 0.05);
      const b = side * (BAND.z0 + 0.09);
      box(rv, FACADE_WEST_LIMIT, BAND.x0 + 0.09, ry0, CROWN.y0, Math.min(a, b), Math.max(a, b));
    }
    zRun(rv, BAND.x0 + 0.05, BAND.x0 + 0.09, ry0, CROWN.y0, -BAND.z0 - 0.05, BAND.z0 + 0.05, EAST_GAP);
    g.add(mesh(rv, reveal, 'facade-crown-reveal'));
  }

  if (isGround) {
    const e = ENTRANCE;
    const ex0 = e.x - e.halfW;
    const ex1 = e.x + e.halfW;
    // Stone plinth with entrance steps.
    const stone = material('facade-plinth', COLORS.stone, { roughness: 0.6 });
    walls.push(stone);
    const pl: Parts = [];
    const pz0 = HALF_DEPTH + PLINTH.out0;
    const pz1 = HALF_DEPTH + PLINTH.out1;
    const px1 = HALF_WIDTH + PLINTH.out1;
    box(pl, FACADE_WEST_LIMIT, ex0, 0, PLINTH.h, pz0, pz1);
    box(pl, ex1, px1, 0, PLINTH.h, pz0, pz1);
    box(pl, FACADE_WEST_LIMIT, px1, 0, PLINTH.h, -pz1, -pz0);
    zRun(pl, HALF_WIDTH + PLINTH.out0, px1, 0, PLINTH.h, -pz0, pz0, EAST_GAP);
    box(pl, ex0, ex1, 0, 0.07, pz0, HALF_DEPTH + 1.05);
    box(pl, ex0, ex1, 0.07, 0.14, pz0, HALF_DEPTH + 0.75);
    g.add(mesh(pl, stone, 'facade-plinth'));

    // Portal frame (bronze, with the fins): jambs, head, door transom and mullions.
    const t = 0.15;
    box(finParts, ex0, ex0 + t, 0.14, e.top, e.z0, e.z1);
    box(finParts, ex1 - t, ex1, 0.14, e.top, e.z0, e.z1);
    box(finParts, ex0, ex1, e.top - 0.16, e.top, e.z0, e.z1);
    const gz = (e.z0 + e.z1) / 2;
    box(finParts, ex0 + t, ex1 - t, e.doorTop - 0.06, e.doorTop, gz - 0.04, gz + 0.04);
    box(finParts, e.x - 0.03, e.x + 0.03, 0.14, e.doorTop, gz - 0.04, gz + 0.04);
    for (const x of [e.x - e.halfW / 2, e.x + e.halfW / 2]) box(finParts, x - 0.025, x + 0.025, e.doorTop, e.top - 0.16, gz - 0.03, gz + 0.03);

    const glass = material('facade-entrance-glass', COLORS.glass, { metalness: 0.1, roughness: 0.05 });
    walls.push(glass);
    const gp: Parts = [];
    box(gp, ex0 + t, ex1 - t, 0.14, e.top - 0.16, gz - 0.006, gz + 0.006);
    g.add(mesh(gp, glass, 'facade-entrance-glass'));

    // Cantilevered canopy from the portal, with a bronze fascia and soffit downlights.
    const c = e.canopy;
    const canopy = material('facade-canopy', COLORS.canopy, { metalness: 0.2, roughness: 0.4 });
    walls.push(canopy);
    const cp: Parts = [];
    box(cp, c.x0, c.x1, c.y, c.y + c.t, e.z1, e.z1 + c.depth);
    g.add(mesh(cp, canopy, 'facade-canopy'));
    box(finParts, c.x0, c.x1, c.y - 0.05, c.y + c.t + 0.04, e.z1 + c.depth - 0.06, e.z1 + c.depth);
    for (const x of [c.x0, c.x1 - 0.06]) box(finParts, x, x + 0.06, c.y - 0.05, c.y + c.t + 0.04, e.z1, e.z1 + c.depth);
    const lights = glowMaterial('facade-canopy-light', 1.8);
    walls.push(lights);
    glows.push(lights);
    const lp: Parts = [];
    for (let i = 0; i < 4; i++) {
      for (const dz of [0.7, 1.8]) {
        const d = new CylinderGeometry(0.08, 0.08, 0.015, 10);
        d.deleteAttribute('uv');
        d.translate(c.x0 + 0.9 + i * ((c.x1 - c.x0 - 1.8) / 3), c.y - 0.008, e.z1 + dz);
        lp.push(d);
      }
    }
    g.add(mesh(lp, lights, 'facade-canopy-lights'));
  }

  g.add(mesh(finParts, fin, 'facade-fins'));
  g.add(mesh(bandParts, spandrel, 'facade-spandrel'));
  return g;
}

/** Dresses every given tower floor with its facade group (added to the floor group). */
export function buildFacade(floors: readonly FacadeFloor[]): Facade {
  const glows: MeshStandardMaterial[] = [];
  const groups = floors.map((f) => {
    const g = buildFloorFacade(f, glows);
    f.group.add(g);
    return g;
  });
  return { groups, glows };
}
