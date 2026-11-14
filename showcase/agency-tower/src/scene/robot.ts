import { CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, type BufferGeometry, type Material } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Tier, Unit } from '../data/types';

export type MarkerKind = 'crown' | 'badge' | 'stripe' | 'none';

export interface TierStyle {
  scale: number;
  marker: MarkerKind;
  color: number | null; // null: use the floor accent
}

const GOLD = 0xe0b43c;
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

const mix = (a: number, b: number, t: number): number => {
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
}
export type MatFactory = (color: number, opts?: MatOptions) => Material;

// Shared geometry: one buffer per shape for all robots.
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

const geo = (k: string): BufferGeometry => {
  const g = GEO[k];
  if (!g) throw new Error(`unknown robot geometry ${k}`);
  return g;
};

export function createRobot(unit: Unit, accent: number, mat: MatFactory): RobotMesh {
  const style = tierStyle(unit.tier);
  const tierColor = style.color ?? accent;
  const shellMat = mat(0xf5f6f8, { roughness: 0.45 });
  const bodyMat = mat(mix(0xffffff, accent, 0.55), { roughness: 0.45 }); // department colour on the body
  const trimMat = mat(tierColor, { roughness: 0.35, metalness: style.color === null ? 0 : 0.35 });
  const limbMat = mat(0xc9ced6, { roughness: 0.5 });
  const visorMat = mat(mix(0x1a1d23, accent, 0.35), { roughness: 0.25 });
  const glowMat = mat(accent, { emissive: accent, emissiveIntensity: 1.4, roughness: 0.4 });
  const eyeMat = mat(0xbff3ff, { emissive: 0x7fe3ff, emissiveIntensity: 1.6 });

  const group = new Group();
  group.name = 'robot';
  group.scale.setScalar(style.scale);
  const inner = new Group();
  inner.scale.setScalar(ROBOT_BASE_SCALE);
  group.add(inner);

  const add = (parent: Group, key: string, m: Material, x: number, y: number, z: number, name = ''): Mesh => {
    const mesh = new Mesh(geo(key), m);
    mesh.position.set(x, y, z);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };

  // Body (bobs as a whole): capsule torso with a tier-coloured belt and a department-coloured chest light.
  const body = new Group();
  add(body, 'torso', bodyMat, 0, 0.24, 0).scale.set(1, 1, 0.88);
  add(body, 'band', trimMat, 0, 0.165, 0).scale.set(1, 1, 0.9);
  add(body, 'chest', glowMat, -0.025, 0.29, 0.1).scale.set(1.4, 1.3, 1);

  const head = new Group();
  head.position.y = 0.4;
  add(head, 'head', shellMat, 0, 0.1, 0);
  add(head, 'visor', visorMat, 0, 0.105, 0.11);
  for (const x of [-0.048, 0.048]) add(head, 'eye', eyeMat, x, 0.108, 0.125).scale.set(1, 1.15, 0.5);
  for (const x of [-0.142, 0.142]) add(head, 'ear', trimMat, x, 0.1, 0).rotation.z = Math.PI / 2;
  if (style.marker !== 'crown') {
    add(head, 'antenna', limbMat, 0, 0.225, 0);
    add(head, 'antennaTip', glowMat, 0, 0.268, 0);
  }
  body.add(head);

  const arm = (x: number): Group => {
    const pivot = new Group();
    pivot.position.set(x, 0.33, 0);
    add(pivot, 'arm', limbMat, 0, -0.08, 0);
    add(pivot, 'hand', shellMat, 0, -0.155, 0);
    return pivot;
  };
  const leg = (x: number): Group => {
    const pivot = new Group();
    pivot.position.set(x, 0.1, 0);
    add(pivot, 'leg', limbMat, 0, -0.045, 0);
    return pivot;
  };
  const armL = arm(-0.145);
  const armR = arm(0.145);
  const legL = leg(-0.055);
  const legR = leg(0.055);

  if (style.marker === 'crown') {
    const crown = new Group();
    crown.name = 'marker:crown';
    crown.position.y = 0.225;
    const gold = mat(GOLD, { roughness: 0.3, metalness: 0.6 });
    add(crown, 'crownRing', gold, 0, 0, 0);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      add(crown, 'crownSpike', gold, Math.sin(a) * 0.075, 0.045, Math.cos(a) * 0.075);
    }
    head.add(crown);
  } else if (style.marker === 'badge') {
    const b = add(body, 'badge', mat(0xffe8a3, { roughness: 0.3, metalness: 0.5 }), 0.05, 0.3, 0.1, 'marker:badge');
    b.rotation.x = Math.PI / 2;
  } else if (style.marker === 'stripe') {
    add(body, 'stripe', mat(0xffffff, { roughness: 0.3 }), -0.13, 0.36, 0, 'marker:stripe');
  }

  body.add(armL, armR); // arms ride with the body (bob, seated lift)
  // Invisible, generous pick collider: small diorama robots stay easy to click and tap.
  const hit = new Mesh(geo('hitbox'), mat(0xffffff));
  hit.name = 'hitbox';
  hit.visible = false;
  hit.position.y = 0.475;
  inner.add(body, legL, legR, hit);
  group.traverse((o) => {
    o.userData.unitId = unit.id;
  });
  return { group, parts: { body, head, armL, armR, legL, legR } };
}
