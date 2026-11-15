// City atmosphere (art direction after Rev 38): the city near the campus shows its real colours and contrast;
// only the far edge fades gently into the page background.
import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { CITY_HAZE, cityHazeAt, createCity } from '../src/scene/city';
import { cityPlan } from '../src/sim/citySim';
import { CAMPUS_BOUNDS } from '../src/sim/layout';

const materialsOf = (root: Object3D): Material[] => {
  const out: Material[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(...(Array.isArray(o.material) ? o.material : [o.material]));
  });
  return out;
};

const uniform = (m: Material | undefined, key: string): unknown => {
  const u: unknown = m?.userData.cityHaze;
  if (!u || typeof u !== 'object' || !(key in u)) throw new Error(`haze uniform ${key}`);
  const v: unknown = (u as Record<string, { value: unknown }>)[key]?.value;
  return v;
};

describe('city atmosphere', () => {
  const plan = cityPlan(CAMPUS_BOUNDS, 7);
  /** Distance from the campus footprint to the outer edge of the city (the ring plus the city reach). */
  const edge = Math.min(plan.campus.x0 - plan.extent.x0, plan.extent.x1 - plan.campus.x1, plan.campus.z0 - plan.extent.z0, plan.extent.z1 - plan.campus.z1);

  it('the boulevard, the first building rows, the hotel and the park plaza keep their real colours (haze <= 0.1)', () => {
    for (let d = 0; d <= 40; d += 1) expect(cityHazeAt(d), `distance ${d}`).toBeLessThanOrEqual(0.1);
    // Only slightly lower in contrast than the campus: a touch of air, never none.
    expect(cityHazeAt(0)).toBeGreaterThan(0);
  });

  it('only the far edge fades gently into the background, and never fully', () => {
    expect(edge).toBeGreaterThan(40);
    expect(cityHazeAt(edge), 'far edge').toBeGreaterThanOrEqual(0.5);
    for (let d = 0; d < 120; d += 0.5) {
      expect(cityHazeAt(d + 0.5)).toBeGreaterThanOrEqual(cityHazeAt(d));
      expect(cityHazeAt(d)).toBeLessThanOrEqual(0.92);
    }
  });

  it('the shader uniforms carry the same fade the pure function describes', () => {
    const city = createCity({ seed: 7 });
    const mats = materialsOf(city.group).filter((m) => m.userData.cityHaze);
    expect(mats.length).toBeGreaterThan(0);
    const m = mats[0];
    expect(uniform(m, 'uHazeRange')).toEqual([CITY_HAZE.near, CITY_HAZE.far]);
    expect(uniform(m, 'uShade')).toBe(CITY_HAZE.shade);
    expect(uniform(m, 'uHazeMax')).toBe(CITY_HAZE.max);
  });
});
