// Exposure and tone (art direction after Rev 38): under ACES the light palette reads rich, not chalky. The day
// exposure stays at or just under 1 so light materials sit below the ACES shoulder, and the key light carries
// more of the modelling than the flat fill. Subtle: night and the tuned M1 intensities stay where they were.
import { describe, it, expect } from 'vitest';
import { lightingFor } from '../src/scene/daynight';
import { tierConfig } from '../src/app/quality';
import { ACESFilmicToneMapping } from 'three';

describe('exposure and tone', () => {
  it('the high tier keeps ACES and its environment reflections', () => {
    const high = tierConfig('high', 2);
    expect(high.toneMapping).toBe(ACESFilmicToneMapping);
    expect(high.environment).toBe(true);
  });

  it('day exposure sits at or just under 1 (materials below the ACES shoulder, not washed out)', () => {
    const day = lightingFor(1, 0).exposure;
    expect(day).toBeGreaterThanOrEqual(0.95);
    expect(day).toBeLessThanOrEqual(1.02);
  });

  it('the night keeps its lift so the lit windows read', () => {
    expect(lightingFor(0, 1).exposure).toBeGreaterThanOrEqual(1.15);
  });

  it('by day the key light outweighs the flat fill (sun / (hemisphere + ambient) >= 1.4)', () => {
    const day = lightingFor(1, 0);
    expect(day.sun / (day.hemi + day.ambient)).toBeGreaterThanOrEqual(1.4);
  });

  it('the change is subtle: exposure moves smoothly with brightness', () => {
    for (let i = 0; i < 100; i++) expect(Math.abs(lightingFor((i + 1) / 100, 0).exposure - lightingFor(i / 100, 0).exposure)).toBeLessThanOrEqual(0.01);
  });
});
