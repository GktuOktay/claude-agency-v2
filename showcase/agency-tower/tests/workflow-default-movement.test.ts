// Production default movement (spec 0002 REQ-13, REQ-14; KARARLAR Rev 32): without an injected
// Movement the engine walks robots on the nav graph and rides them in the staff elevator.
import { describe, expect, it } from 'vitest';
import { makeWorkflow, run } from './workflowHelpers';

describe('workflow default movement (Rev 32)', () => {
  it('uses nav movement with the staff elevator when no movement is injected', () => {
    const wf = makeWorkflow();
    const m = wf.movement;
    expect('elevator' in m).toBe(true);
    expect('position' in m).toBe(true);
    run(wf, 2);
    const snap = m.snapshot();
    // The timed stand-in snapshots an array of { id, floor, spot, legT, legs }; nav movement does not.
    expect(Array.isArray(snap) && snap.some((s: unknown) => typeof s === 'object' && s !== null && 'legT' in s)).toBe(false);
  });
});
