import { describe, it, expect } from 'vitest';
import { framePose, shouldStepSim } from '../src/app/frameUpdate';

describe('org freeze (AC-14)', () => {
  it('does not step the sim in org mode, steps otherwise', () => {
    let steps = 0;
    const sim = { step: () => void steps++ };
    for (const org of [true, true, false]) if (shouldStepSim(org)) sim.step();
    expect(steps).toBe(1);
  });
  it('forces a static idle pose in org mode', () => {
    expect(framePose(true, 'walk', 3.2, 10, false, 5)).toEqual({ kind: 'idle', walkPhase: 0, timeSec: 0 });
  });
  it('keeps the live pose outside org mode', () => {
    expect(framePose(false, 'walk', 3.2, 10, false, 5)).toEqual({ kind: 'walk', walkPhase: 3.2, timeSec: 15 });
    expect(framePose(false, 'walk', 3.2, 10, true, 5)).toEqual({ kind: 'walk', walkPhase: 0, timeSec: 0 });
  });
});
