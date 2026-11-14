// Stylized low-poly human (the CEO, KARARLAR Revizyon 31): same rounded diorama look and the same rig as the
// robots (RobotParts pivots), so applyPose, picking and the tier rule (scale 1.35, crown, gold) carry over.
import { Group, type Material } from 'three';
import type { Unit } from '../data/types';
import { addAccessories, DOMAIN_ACCESSORIES, domainOf, outfitFor, Sculptor, SHAPES, type Anchors, type Vec3 } from './outfits';
import { createRobot, crownMarker, geo, hitbox, mix, ROBOT_BASE_SCALE, tierStyle, type MatFactory, type RobotMesh } from './robot';

const SKIN = 0xf1c7a5;
const SKIN_SHADE = 0xe3b08c;
const HAIR = 0x3a2a1f;
const SHOE = 0x1d1f24;
const TIE = 0x9e2b35;

export function createHuman(unit: Unit, accent: number, mat: MatFactory): RobotMesh {
  const style = tierStyle(unit.tier);
  const outfit = outfitFor(unit.tier);
  const domain = domainOf(unit.id);
  const suit = mix(0x2f3440, accent, 0.08);
  const lapel = mix(suit, 0x000000, 0.3);
  const baseMat: Material = mat(0xffffff, { roughness: 0.55, vertexColors: true });

  const group = new Group();
  group.name = 'human';
  group.scale.setScalar(style.scale);
  const inner = new Group();
  inner.scale.setScalar(ROBOT_BASE_SCALE);
  group.add(inner);

  const s = new Sculptor();
  const B = (shape: Parameters<Sculptor['add']>[2], color: number, pos: Vec3, scale: Vec3, rot: Vec3 = [0, 0, 0]): void =>
    s.add('body', 'base', shape, color, pos, scale, rot);
  const H = (shape: Parameters<Sculptor['add']>[2], color: number, pos: Vec3, scale: Vec3, rot: Vec3 = [0, 0, 0]): void =>
    s.add('head', 'base', shape, color, pos, scale, rot);

  // Suit: jacket torso, shirt V, tie and knot, lapels, buttons; a neck above the collar.
  s.add('body', 'base', geo('torso'), suit, [0, 0.24, 0], [0.9, 1, 0.8]);
  B(SHAPES.prism, 0xffffff, [0, 0.33, 0.082], [0.05, 0.1, 0.016], [0, Math.PI, 0]);
  B(SHAPES.box, TIE, [0, 0.285, 0.095], [0.02, 0.09, 0.008]);
  B(SHAPES.box, TIE, [0, 0.336, 0.088], [0.024, 0.017, 0.01]);
  for (const x of [-1, 1]) B(SHAPES.box, lapel, [x * 0.033, 0.315, 0.09], [0.017, 0.09, 0.008], [0, 0, -x * 0.4]);
  for (const y of [0.2, 0.165]) B(SHAPES.sphereLo, 0x15171c, [0, y, 0.093], [0.008, 0.008, 0.005]);
  B(SHAPES.cylLo, SKIN, [0, 0.4, 0], [0.034, 0.04, 0.034]);

  // Head: face, hair (cap tilted back plus back of the head and a side part), ears, eyes, brows, nose, smile.
  H(SHAPES.sphere, SKIN, [0, 0.115, 0], [0.1, 0.11, 0.095]);
  H(SHAPES.hemi, HAIR, [0, 0.128, -0.004], [0.106, 0.1, 0.101], [-0.35, 0, 0]);
  H(SHAPES.sphere, HAIR, [0, 0.105, -0.022], [0.103, 0.1, 0.085]);
  H(SHAPES.sphereLo, HAIR, [0.035, 0.2, 0.05], [0.06, 0.03, 0.05]);
  for (const x of [-1, 1]) {
    H(SHAPES.sphereLo, SKIN_SHADE, [x * 0.1, 0.11, 0], [0.018, 0.026, 0.018]);
    H(SHAPES.sphereLo, 0x2a2522, [x * 0.035, 0.12, 0.088], [0.012, 0.015, 0.008]);
    H(SHAPES.box, HAIR, [x * 0.035, 0.143, 0.09], [0.026, 0.006, 0.006]);
  }
  H(SHAPES.sphereLo, SKIN_SHADE, [0, 0.1, 0.097], [0.013, 0.016, 0.012]);
  H(SHAPES.box, 0x9c5a4a, [0, 0.075, 0.09], [0.03, 0.005, 0.004]);

  // Arms: suit sleeves, white cuffs, hands. Legs: trousers and shoes.
  for (const side of ['armL', 'armR'] as const) {
    s.add(side, 'base', geo('arm'), suit, [0, -0.075, 0], [1.05, 1, 1.05]);
    s.add(side, 'base', SHAPES.cylLo, 0xffffff, [0, -0.135, 0], [0.031, 0.015, 0.031]);
    s.add(side, 'base', SHAPES.sphere, SKIN, [0, -0.16, 0], [0.03, 0.03, 0.03]);
  }
  for (const side of ['legL', 'legR'] as const) {
    s.add(side, 'base', geo('leg'), suit, [0, -0.035, 0], [1.1, 1.15, 1.1]);
    s.add(side, 'base', SHAPES.box, SHOE, [0, -0.087, 0.015], [0.06, 0.03, 0.09]);
  }

  const anchors: Anchors = { head: 'head', body: 'body', handL: 'armL', headTop: 0.225, faceZ: 0.095, eyeY: 0.12, chest: [0.05, 0.29, 0.093], hand: [-0.03, -0.17, 0.04] };
  if (domain) addAccessories(s, domain, anchors, accent);

  const only = (): Material => baseMat;
  const body = new Group();
  body.add(...s.bake('body', only, `outfit:${outfit.kind}`));
  const head = new Group();
  head.position.y = 0.4;
  head.add(...s.bake('head', only, 'hair'));
  body.add(head);
  const pivot = (key: string, x: number, y: number): Group => {
    const g = new Group();
    g.position.set(x, y, 0);
    g.add(...s.bake(key, only));
    return g;
  };
  const armL = pivot('armL', -0.135, 0.33);
  const armR = pivot('armR', 0.135, 0.33);
  const legL = pivot('legL', -0.052, 0.1);
  const legR = pivot('legR', 0.052, 0.1);
  head.add(crownMarker(mat, 0.215)); // tier marker: shape and scale, not only gold

  body.add(armL, armR);
  inner.add(body, legL, legR, hitbox(mat));
  group.userData.character = 'human';
  group.userData.domain = domain;
  group.userData.outfit = outfit.kind;
  group.userData.features = [...outfit.features];
  group.userData.accessories = domain ? [...DOMAIN_ACCESSORIES[domain]] : [];
  group.traverse((o) => {
    o.userData.unitId = unit.id;
  });
  return { group, parts: { body, head, armL, armR, legL, legR } };
}

/** The CEO is a human; every other unit is a robot. */
export function createCharacter(unit: Unit, accent: number, mat: MatFactory): RobotMesh {
  return unit.tier === 'ceo' ? createHuman(unit, accent, mat) : createRobot(unit, accent, mat);
}
