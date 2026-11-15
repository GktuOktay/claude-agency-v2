import { CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, type BufferGeometry, type Material } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Tier, Unit } from '../data/types';
import { addAccessories, DOMAIN_ACCESSORIES, domainOf, outfitFor, Sculptor, SHAPES, type Anchors, type Slot } from './outfits';

export type MarkerKind = 'crown' | 'badge' | 'stripe' | 'none';

export interface TierStyle {
  scale: number;
  marker: MarkerKind;
  color: number | null; // null: use the floor accent
}

export const GOLD = 0xe0b43c;
const SILVER = 0xc3c9d2;

export function tierStyle(tier: Tier): TierStyle {
  switch (tier) {
    case 'ceo':
      return { scale: 1.35, marker: 'crown', color: GOLD };
    case 'management':
      return { scale: 1.2, marker: 'badge', color: GOLD };
    case 'lead':
      return { scale: 1.1, marker: 'stripe', color: SILVER };
    case 'specialist':
      return { scale: 1.0, marker: 'none', color: null };
  }
}

/** Robots read clearly at floor-view scale: modelled parts are enlarged by this factor inside the tier scale. */
export const ROBOT_BASE_SCALE = 1.4;
/** Standing height (feet to antenna tip) of a tier-scale-1 robot, in world units. */
export const ROBOT_HEIGHT = 0.69 * ROBOT_BASE_SCALE;

export const mix = (a: number, b: number, t: number): number => {
  const ch = (c: number, s: number): number => (c >> s) & 0xff;
  const m = (s: number): number => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
};

export interface RobotParts {
  body: Group;
  head: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
}

export interface RobotMesh {
  group: Group;
  parts: RobotParts;
}

export interface MatOptions {
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  /** Multiply by the geometry `color` attribute (baked, merged character parts). */
  vertexColors?: boolean;
}
export type MatFactory = (color: number, opts?: MatOptions) => Material;

// Shared geometry: one source buffer per shape; the sculptor clones and bakes them per pivot.
const GEO: Record<string, BufferGeometry> = {
  torso: new CapsuleGeometry(0.115, 0.08, 6, 16),
  band: new CylinderGeometry(0.119, 0.112, 0.07, 20),
  chest: new RoundedBoxGeometry(0.08, 0.05, 0.02, 2, 0.008),
  head: new RoundedBoxGeometry(0.27, 0.2, 0.23, 4, 0.07),
  visor: new RoundedBoxGeometry(0.21, 0.1, 0.03, 3, 0.02),
  eye: new SphereGeometry(0.021, 10, 8),
  ear: new CylinderGeometry(0.035, 0.035, 0.03, 14),
  antenna: new CylinderGeometry(0.008, 0.008, 0.06, 6),
  antennaTip: new SphereGeometry(0.022, 10, 8),
  arm: new CapsuleGeometry(0.03, 0.1, 4, 8),
  hand: new SphereGeometry(0.034, 10, 8),
  leg: new CapsuleGeometry(0.035, 0.04, 4, 8),
  badge: new CylinderGeometry(0.035, 0.035, 0.015, 16),
  stripe: new RoundedBoxGeometry(0.08, 0.03, 0.13, 2, 0.012),
  crownRing: new CylinderGeometry(0.085, 0.075, 0.055, 7, 1, true),
  crownSpike: new ConeGeometry(0.022, 0.05, 6),
  hitbox: new CylinderGeometry(0.28, 0.28, 0.95, 8),
};

export const geo = (k: string): BufferGeometry => {
  const g = GEO[k];
  if (!g) throw new Error(`unknown robot geometry ${k}`);
  return g;
};

/** Gold crown (CEO marker) baked into one mesh, in a group named `marker:crown`. */
export function crownMarker(mat: MatFactory, y: number): Group {
  const s = new Sculptor();
  s.add('crown', 'base', geo('crownRing'), GOLD, [0, 0, 0], [1, 1, 1]);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    s.add('crown', 'base', geo('crownSpike'), GOLD, [Math.sin(a) * 0.075, 0.045, Math.cos(a) * 0.075], [1, 1, 1]);
  }
  const crown = new Group();
  crown.name = 'marker:crown';
  crown.position.y = y;
  const gold = mat(0xffffff, { roughness: 0.3, metalness: 0.6, vertexColors: true });
  crown.add(...s.bake('crown', () => gold, 'crown'));
  return crown;
}

/** Invisible, generous pick collider: small diorama characters stay easy to click and tap. */
export function hitbox(mat: MatFactory): Mesh {
  const hit = new Mesh(geo('hitbox'), mat(0xffffff));
  hit.name = 'hitbox';
  hit.visible = false;
  hit.position.y = 0.475;
  return hit;
}

const ONE = [1, 1, 1] as const;

export function createRobot(unit: Unit, accent: number, mat: MatFactory): RobotMesh {
  const style = tierStyle(unit.tier);
  const outfit = outfitFor(unit.tier);
  const domain = domainOf(unit.id);
  const tierColor = style.color ?? accent;
  const shell = 0xf5f6f8;
  const limb = 0xc9ced6;
  const visor = mix(0x1a1d23, accent, 0.35);

  const baseMat = mat(0xffffff, { roughness: 0.45, vertexColors: true });
  const glowMat = mat(accent, { emissive: accent, emissiveIntensity: 1.4, roughness: 0.4 });
  const eyeMat = mat(0xbff3ff, { emissive: 0x7fe3ff, emissiveIntensity: 1.6 });
  const slotMat = (slot: Slot): Material => (slot === 'glow' ? glowMat : slot === 'eye' ? eyeMat : baseMat);

  const group = new Group();
  group.name = 'robot';
  group.scale.setScalar(style.scale);
  const inner = new Group();
  inner.scale.setScalar(ROBOT_BASE_SCALE);
  group.add(inner);

  const s = new Sculptor();
  const add = (pivot: string, slot: Slot, key: string, color: number, pos: readonly [number, number, number], scale: readonly [number, number, number] = ONE, rot: readonly [number, number, number] = [0, 0, 0]): void =>
    s.add(pivot, slot, geo(key), color, pos, scale, rot);

  // Clothing by tier: the garment colour and its shapes (hood, vest buttons, lapels and tie).
  const garment =
    outfit.kind === 'hoodie' ? mix(accent, 0xffffff, 0.12) : outfit.kind === 'vest' ? mix(0x3a4252, accent, 0.3) : mix(0x283041, accent, 0.18);
  const sleeve = outfit.kind === 'blazer' ? garment : limb;

  // Body (bobs as a whole): capsule torso, tier-coloured belt, department-coloured chest light.
  add('body', 'base', 'torso', garment, [0, 0.24, 0], [1, 1, 0.88]);
  add('body', 'base', 'band', tierColor, [0, 0.165, 0], [1, 1, 0.9]);
  add('body', 'glow', 'chest', accent, [-0.055, 0.3, 0.096], [0.7, 0.7, 1]);
  if (outfit.kind === 'hoodie') {
    const shade = mix(garment, 0x000000, 0.18);
    s.add('body', 'base', SHAPES.ring, garment, [0, 0.355, -0.005], [0.088, 0.088, 0.088], [Math.PI / 2, 0, 0]); // hood collar
    s.add('body', 'base', SHAPES.sphere, garment, [0, 0.36, -0.085], [0.09, 0.06, 0.045]); // hood
    s.add('body', 'base', SHAPES.box, shade, [0, 0.225, 0.1], [0.1, 0.04, 0.012]); // front pocket
    for (const x of [-0.022, 0.022]) s.add('body', 'base', SHAPES.cylLo, 0xffffff, [x, 0.31, 0.098], [0.004, 0.05, 0.004]); // drawstrings
  } else if (outfit.kind === 'vest') {
    s.add('body', 'base', SHAPES.prism, 0xffffff, [0, 0.325, 0.088], [0.05, 0.07, 0.016], [0, Math.PI, 0]); // shirt V
    for (const y of [0.27, 0.235, 0.2]) s.add('body', 'base', SHAPES.sphereLo, tierColor, [0, y, 0.103], [0.009, 0.009, 0.006]); // buttons
  } else {
    const lapel = mix(garment, 0x000000, 0.3);
    s.add('body', 'base', SHAPES.prism, 0xffffff, [0, 0.32, 0.088], [0.058, 0.1, 0.016], [0, Math.PI, 0]); // shirt V
    s.add('body', 'base', SHAPES.box, 0x9e2b35, [0, 0.278, 0.103], [0.022, 0.085, 0.008]); // tie
    s.add('body', 'base', SHAPES.box, 0x9e2b35, [0, 0.326, 0.098], [0.026, 0.018, 0.01]); // knot
    for (const x of [-1, 1]) s.add('body', 'base', SHAPES.box, lapel, [x * 0.036, 0.31, 0.098], [0.018, 0.085, 0.008], [0, 0, -x * 0.4]); // lapels
  }

  // Head: shell, visor and ears baked together; eyes and the antenna tip glow.
  add('head', 'base', 'head', shell, [0, 0.1, 0]);
  add('head', 'base', 'visor', visor, [0, 0.105, 0.11]);
  for (const x of [-0.048, 0.048]) add('head', 'eye', 'eye', 0, [x, 0.108, 0.125], [1, 1.15, 0.5]);
  for (const x of [-0.142, 0.142]) add('head', 'base', 'ear', tierColor, [x, 0.1, 0], ONE, [0, 0, Math.PI / 2]);

  // Arms and legs.
  for (const side of ['armL', 'armR'] as const) {
    add(side, 'base', 'arm', sleeve, [0, -0.08, 0]);
    add(side, 'base', 'hand', shell, [0, -0.155, 0]);
  }
  for (const side of ['legL', 'legR'] as const) add(side, 'base', 'leg', limb, [0, -0.045, 0]);

  // Domain look (KARARLAR Revizyon 31).
  const anchors: Anchors = { head: 'head', body: 'body', handL: 'armL', headTop: 0.2, faceZ: 0.125, eyeY: 0.108, chest: [0.05, 0.29, 0.1], hand: [-0.03, -0.165, 0.045] };
  const before = s.partCount;
  const look = domain ? addAccessories(s, domain, anchors, accent) : { hidesAntenna: false };
  const accessoryParts = s.partCount - before;
  if (style.marker !== 'crown' && !look.hidesAntenna) {
    add('head', 'base', 'antenna', limb, [0, 0.225, 0]);
    add('head', 'glow', 'antennaTip', accent, [0, 0.268, 0]);
  }

  const body = new Group();
  body.add(...s.bake('body', slotMat, `outfit:${outfit.kind}`));
  const head = new Group();
  head.position.y = 0.4;
  head.add(...s.bake('head', slotMat, domain ? `domain:${domain}` : ''));
  body.add(head);

  const pivot = (key: string, x: number, y: number): Group => {
    const g = new Group();
    g.position.set(x, y, 0);
    g.add(...s.bake(key, slotMat));
    return g;
  };
  const armL = pivot('armL', -0.145, 0.33);
  const armR = pivot('armR', 0.145, 0.33);
  const legL = pivot('legL', -0.055, 0.1);
  const legR = pivot('legR', 0.055, 0.1);

  if (style.marker === 'crown') {
    head.add(crownMarker(mat, 0.225));
  } else if (style.marker === 'badge') {
    const b = new Mesh(geo('badge'), mat(0xffe8a3, { roughness: 0.3, metalness: 0.5 }));
    b.name = 'marker:badge';
    b.position.set(0.05, 0.3, 0.1);
    b.rotation.x = Math.PI / 2;
    body.add(b);
  } else if (style.marker === 'stripe') {
    const st = new Mesh(geo('stripe'), mat(0xffffff, { roughness: 0.3 }));
    st.name = 'marker:stripe';
    st.position.set(-0.13, 0.36, 0);
    body.add(st);
  }

  body.add(armL, armR); // arms ride with the body (bob, seated lift)
  inner.add(body, legL, legR, hitbox(mat));
  group.userData.character = 'robot';
  group.userData.domain = domain;
  group.userData.outfit = outfit.kind;
  group.userData.features = [...outfit.features];
  group.userData.accessories = domain ? [...DOMAIN_ACCESSORIES[domain]] : [];
  group.userData.accessoryParts = accessoryParts;
  group.traverse((o) => {
    o.userData.unitId = unit.id;
  });
  return { group, parts: { body, head, armL, armR, legL, legR } };
}
