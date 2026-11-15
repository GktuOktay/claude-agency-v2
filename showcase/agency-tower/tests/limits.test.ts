// Spec 0002 AC-17 (REQ-20, §7.7): per-tier limits never exceeded, and the max-load window at `high`.
// Engine with the default nav movement (as in the app), fixed master seed, 0.1 s steps.
import { describe, expect, it } from 'vitest';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { loadData } from '../src/data/loader';
import { maxJobsFor } from '../src/app/params';
import { createBubbleScheduler, MAX_BUBBLES } from '../src/scene/activity';
import { createRng } from '../src/scene/rng';
import { whiteboardTextureSize } from '../src/sim/layout';
import { isNavMovement } from '../src/sim/navMovement';
import { createWorkflow, MASTER_SEED, type Workflow } from '../src/sim/workflow';
import { scenarioSet, unitFloors } from './workflowHelpers';

/** §7.7 table. */
const LIMITS = {
  high: { jobs: 3, bubbles: 4, board: { width: 1024, height: 512 } },
  low: { jobs: 2, bubbles: 4, board: { width: 512, height: 256 } },
} as const;

const engine = (tier: 'high' | 'low'): Workflow =>
  createWorkflow({ scenarios: scenarioSet(), units: unitFloors(), maxJobs: maxJobsFor(tier), seed: MASTER_SEED });

describe('AC-17: §7.7 limits per quality tier are never exceeded', () => {
  for (const tier of ['high', 'low'] as const) {
    it(`${tier}: 1200 s of engine time never runs more than ${LIMITS[tier].jobs} jobs; the slot limit is reached`, () => {
      const wf = engine(tier);
      expect(isNavMovement(wf.movement)).toBe(true);
      let peak = 0;
      for (let i = 0; i < 12000; i++) {
        wf.step(0.1);
        wf.drainEvents();
        const active = wf.jobs().filter((j) => !j.done).length;
        expect(active).toBeLessThanOrEqual(LIMITS[tier].jobs);
        peak = Math.max(peak, active);
      }
      expect(peak).toBe(LIMITS[tier].jobs);
    }, 120000);

    it(`${tier}: ambient bubbles never exceed ${LIMITS[tier].bubbles}; whiteboard texture is at most ${LIMITS[tier].board.width}×${LIMITS[tier].board.height}`, () => {
      const r = loadData(roster, hierarchy);
      if (!r.ok) throw new Error('data');
      const bubbles = createBubbleScheduler(r.data.units.map((u) => ({ id: u.id, phrases: u.phrasesTr })), createRng(20261113 + 1));
      let peak = 0;
      for (let i = 0; i < 12000; i++) {
        const n = bubbles.step(0.1).length;
        expect(n).toBeLessThanOrEqual(LIMITS[tier].bubbles);
        peak = Math.max(peak, n);
      }
      expect(MAX_BUBBLES).toBeLessThanOrEqual(LIMITS[tier].bubbles);
      expect(peak).toBe(LIMITS[tier].bubbles);
      expect(whiteboardTextureSize(tier)).toEqual(LIMITS[tier].board);
    });
  }
});

/**
 * Max-load window (§7.7): all three scripted jobs (#1..#3) run and the l3 job's meeting step is running
 * (engine `running()`: from its step start, gathering included, to its step end).
 * Measured with MASTER_SEED at `high` (Node 22, 2026-11-14): 115.8 s – 146.3 s (30.5 s);
 * seated part (stepProgress > 0): 127.2 s – 146.3 s (19.1 s). Recorded in the README for QA.
 */
describe('AC-17: max-load window at high', () => {
  it('starts before 120 s and lasts at least 15 s (fixed seed)', () => {
    const wf = engine('high');
    let start: number | null = null;
    let end: number | null = null;
    let seated: number | null = null;
    for (let i = 0; i < 3000 && end === null; i++) {
      wf.step(0.1);
      wf.drainEvents();
      const active = wf.jobs().filter((j) => !j.done);
      const scripted = [1, 2, 3].every((n) => active.some((j) => j.n === n));
      const l3 = active.find((j) => j.lane === 3);
      const meet = l3 ? wf.running().find((x) => x.job === l3.n && x.kind === 'meeting') : undefined;
      const inWindow = scripted && meet !== undefined;
      if (inWindow && start === null) start = wf.time;
      if (inWindow && seated === null && (wf.stepProgress(l3!.n, meet!.step) ?? 0) > 0) seated = wf.time;
      if (!inWindow && start !== null) end = wf.time;
    }
    const report = `window ${start?.toFixed(1)} s – ${end?.toFixed(1)} s, seated from ${seated?.toFixed(1)} s`;
    expect(start, report).not.toBeNull();
    expect(end, report).not.toBeNull();
    expect(start!, report).toBeLessThan(120);
    expect(end! - start!, report).toBeGreaterThanOrEqual(15);
    expect(end! - seated!, report).toBeGreaterThanOrEqual(15);
  }, 120000);
});
