import { describe, it, expect } from 'vitest';
import { lightingFor } from '../src/scene/daynight';

const rgb = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const warmth = (n: number): number => {
  const [r, , b] = rgb(n);
  return r - b;
};

describe('lighting realism (Rev 35)', () => {
  it('the day sun is warm, and warmer still near sunrise/sunset', () => {
    expect(warmth(lightingFor(1, 0).sunColor)).toBeGreaterThanOrEqual(0x28);
    expect(warmth(lightingFor(0.35, 0).sunColor)).toBeGreaterThan(warmth(lightingFor(1, 0).sunColor));
  });

  it('the night key light is cool moonlight', () => {
    const [r, , b] = rgb(lightingFor(0, 1).sunColor);
    expect(b).toBeGreaterThan(r);
  });

  it('sky/ground balance: the hemisphere sky is cooler than the ground by day and blue at night', () => {
    const day = lightingFor(1, 0);
    expect(warmth(day.hemiSky)).toBeLessThan(warmth(day.hemiGround));
    const [r, , b] = rgb(lightingFor(0, 1).hemiSky);
    expect(b).toBeGreaterThan(r);
  });

  it('sun colour changes smoothly with brightness (no visible jump)', () => {
    for (let i = 0; i < 100; i++) {
      const a = rgb(lightingFor(i / 100, 0).sunColor);
      const c = rgb(lightingFor((i + 1) / 100, 0).sunColor);
      for (let k = 0; k < 3; k++) expect(Math.abs((a[k] ?? 0) - (c[k] ?? 0))).toBeLessThanOrEqual(12);
    }
  });

  it('environment reflections are subtle and dimmer at night', () => {
    const day = lightingFor(1, 0).env;
    const night = lightingFor(0, 1).env;
    expect(day).toBeGreaterThan(0);
    expect(day).toBeLessThanOrEqual(0.5);
    expect(night).toBeLessThan(day);
  });

  it('day intensities stay close to the tuned M1 values (subtle change)', () => {
    const day = lightingFor(1, 0);
    expect(day.sun).toBeGreaterThan(2.1);
    expect(day.sun).toBeLessThan(2.5);
    expect(day.hemi).toBeCloseTo(1.15, 1);
    expect(day.ambient).toBeCloseTo(0.6, 1);
  });
});
