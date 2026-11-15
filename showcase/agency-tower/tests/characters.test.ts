// Character upgrade (KARARLAR Revizyon 31): CEO is a human; robots carry a domain look and a tier outfit.
import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { buildTower, type TowerModel } from '../src/scene/model';
import { applyPose } from '../src/scene/pose';
import { tierStyle, type MatFactory } from '../src/scene/robot';
import { createHuman } from '../src/scene/human';
import { DOMAIN_ACCESSORIES, DOMAINS, domainOf, outfitFor, UNIT_DOMAINS } from '../src/scene/outfits';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { TIERS, type Unit } from '../src/data/types';
import type { ActivityKind } from '../src/scene/activity';

let cached: TowerModel | null = null;
function model(): TowerModel {
  if (cached) return cached;
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  cached = buildTower(r.data);
  return cached;
}

function names(root: Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => out.push(o.name));
  return out;
}

const mat: MatFactory = (color, opts = {}): Material =>
  new MeshStandardMaterial({ color, vertexColors: opts.vertexColors ?? false, emissive: opts.emissive ?? 0 });

const ceoUnit = (): Unit => {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  const u = r.data.units.find((x) => x.tier === 'ceo');
  if (!u) throw new Error('no ceo');
  return u;
};

describe('unit domains (outfits.ts)', () => {
  it('every roster unit, the chief of staff and the CEO has a domain', () => {
    const ids = [...roster.agents.map((a) => a.name), 'chief-of-staff', 'ceo'];
    for (const id of ids) expect(domainOf(id), id).not.toBeNull();
  });

  it('every unit in the loaded data has a domain, and the map names no unknown unit', () => {
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const known = new Set(r.data.units.map((u) => u.id));
    for (const u of r.data.units) expect(domainOf(u.id), u.id).not.toBeNull();
    for (const id of Object.keys(UNIT_DOMAINS)) expect(known.has(id), id).toBe(true);
  });

  it('every domain has at least one named accessory', () => {
    for (const d of DOMAINS) expect(DOMAIN_ACCESSORIES[d].length, d).toBeGreaterThan(0);
  });

  it('frontend is a design look and the backends an analytic look', () => {
    expect(domainOf('react-engineer')).toBe('design');
    expect(domainOf('dotnet-engineer')).toBe('analytic');
    expect(domainOf('polyglot-engineer')).toBe('analytic');
    expect(DOMAIN_ACCESSORIES.design).toEqual(expect.arrayContaining(['beret', 'palette-badge', 'stylus']));
    expect(DOMAIN_ACCESSORIES.analytic).toEqual(expect.arrayContaining(['glasses', 'scan-lines', 'terminal-badge']));
  });
});

describe('tier outfits (0001 tier rule: scale, marker and colour, never colour alone)', () => {
  it('every tier has a distinct outfit: suit, blazer + tie, vest + stripe, accent hoodie', () => {
    const kinds = TIERS.map((t) => outfitFor(t).kind);
    expect(kinds).toEqual(['suit', 'blazer', 'vest', 'hoodie']);
    expect(new Set(kinds).size).toBe(TIERS.length);
    expect(outfitFor('ceo').tie).toBe(true);
    expect(outfitFor('management').tie).toBe(true);
    expect(outfitFor('lead').shoulderStripe).toBe(true);
    expect(outfitFor('specialist').accentColoured).toBe(true);
  });

  it('the outfit adds shape, not only colour: every tier keeps its scale and its marker', () => {
    const m = model();
    for (const r of m.robots) {
      const style = tierStyle(r.unit.tier);
      expect(r.group.scale.x).toBeCloseTo(style.scale);
      expect(r.group.userData.outfit).toBe(outfitFor(r.unit.tier).kind);
      expect(r.group.userData.features as string[]).toEqual(expect.arrayContaining([...outfitFor(r.unit.tier).features]));
    }
  });
});

describe('characters in the tower', () => {
  it('the CEO is a human with a suit, a tie, hair and the crown marker', () => {
    const m = model();
    const ceo = m.robots.find((r) => r.unit.tier === 'ceo');
    expect(ceo).toBeDefined();
    expect(ceo!.group.name).toBe('human');
    expect(ceo!.group.userData.character).toBe('human');
    expect(ceo!.group.userData.outfit).toBe('suit');
    expect(ceo!.group.userData.features as string[]).toEqual(expect.arrayContaining(['suit', 'tie', 'hair']));
    expect(names(ceo!.group)).toContain('marker:crown');
    expect(names(ceo!.group)).not.toContain('antenna');
  });

  it('every other unit is a robot wearing its domain accessories', () => {
    const m = model();
    for (const r of m.robots) {
      if (r.unit.tier === 'ceo') continue;
      const domain = domainOf(r.unit.id);
      expect(r.group.name, r.unit.id).toBe('robot');
      expect(r.group.userData.domain, r.unit.id).toBe(domain);
      expect(r.group.userData.accessories, r.unit.id).toEqual(DOMAIN_ACCESSORIES[domain!]);
    }
  });

  it('domain accessories change the geometry: two domains on the same tier differ in vertex count', () => {
    const m = model();
    const verts = (id: string): number => {
      let n = 0;
      m.robots.find((r) => r.unit.id === id)!.group.traverse((o) => {
        if (o instanceof Mesh && o.visible) n += o.geometry.attributes.position?.count ?? 0;
      });
      return n;
    };
    expect(verts('react-engineer')).not.toBe(verts('appsec'));
    expect(verts('qa-engineer')).not.toBe(verts('tech-comms'));
  });

  it('every mesh of every character is pickable to its unit (userData.unitId) and has a hitbox', () => {
    const m = model();
    for (const r of m.robots) {
      r.group.traverse((o) => expect(o.userData.unitId).toBe(r.unit.id));
      expect(names(r.group)).toContain('hitbox');
    }
  });
});

describe('human poses (same rig as the robot)', () => {
  const kinds: ActivityKind[] = ['idle', 'walk', 'work', 'coffee', 'wave', 'raise'];

  it('supports idle, walk, typing, coffee, wave and raise', () => {
    const h = createHuman(ceoUnit(), 0xd8a84a, mat);
    for (const k of kinds) expect(() => applyPose(h.parts, k, 1.2, 0.3)).not.toThrow();
    applyPose(h.parts, 'walk', 1.2, 0);
    expect(h.parts.legL.rotation.x).toBeCloseTo(-h.parts.legR.rotation.x);
    expect(h.parts.legL.rotation.x).not.toBe(0);
    applyPose(h.parts, 'wave', 0, 0.3);
    expect(Math.abs(h.parts.armR.rotation.z)).toBeGreaterThan(1.5);
    applyPose(h.parts, 'work', 0, 1);
    expect(h.parts.armL.rotation.x).toBeLessThan(-0.8);
  });

  it('the limbs are separate pivots that carry visible geometry', () => {
    const h = createHuman(ceoUnit(), 0xd8a84a, mat);
    const { body, head, armL, armR, legL, legR } = h.parts;
    expect(new Set([body, head, armL, armR, legL, legR]).size).toBe(6);
    for (const p of [head, armL, armR, legL, legR]) expect(p.children.some((c) => c instanceof Mesh && c.visible)).toBe(true);
  });
});
