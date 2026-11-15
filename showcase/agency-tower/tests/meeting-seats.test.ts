// Meeting-room seat predicate (spec 0002 AC-14, QA r2A gap): a room step needing more seats than are free is not
// granted, and the meeting lead stands at the whiteboard and takes no seat. The committed scenarios never exceed
// the ROOM_SEATS seats (the loader caps a meeting at 6 actors), so both mutations escaped: "seat check removed"
// and "lead counted as a seat". These fixtures widen l2-base's meeting past the loader on purpose (engine-only).
import { describe, expect, it } from 'vitest';
import type { ScenarioSet } from '../src/data/scenarios';
import { createTimedMovement } from '../src/sim/movement';
import { ROOM_SEATS, type Workflow } from '../src/sim/workflow';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

const EXTRA = ['product-manager', 'software-architect', 'scout', 'marketing', 'tech-comms'];

/** l2-base with its meeting widened to `actors` (business-analyst leads). */
function widened(actors: number): ScenarioSet {
  const set = scenarioSet();
  const base = set.scenarios.find((s) => s.id === 'l2-base')!;
  const meet = base.steps.find((s) => s.id === 'meet')!;
  const all = [...meet.actors, ...EXTRA].slice(0, actors);
  expect(all).toHaveLength(actors);
  expect(all[0]).toBe('business-analyst');
  const scen = { ...base, steps: base.steps.map((s) => (s.id === 'meet' ? { ...s, actors: all } : s)) };
  return { ...set, scenarios: [scen] };
}

function run(actors: number): { wf: Workflow; job: number } {
  const wf = makeWorkflow({
    scenarios: widened(actors),
    scripted: false,
    autoStart: false,
    durations: 'max',
    outcome: () => 'pass',
    movement: createTimedMovement(unitFloors()),
  });
  const job = wf.startJob('l2-base');
  for (let i = 0; i < 3000 && !wf.trace().some((e) => e.type === 'step-start' && e.job === job && e.step === 'meet'); i++) wf.step(0.1);
  return { wf, job };
}

const meetStarted = (wf: Workflow, job: number): boolean => wf.trace().some((e) => e.type === 'step-start' && e.job === job && e.step === 'meet');

describe('meeting-room seats (AC-14)', () => {
  it(`the lead takes no seat: a lead + ${ROOM_SEATS} seated meeting fills the room exactly and is granted`, () => {
    const { wf, job } = run(ROOM_SEATS + 1);
    expect(meetStarted(wf, job)).toBe(true);
  });

  it(`a meeting needing ${ROOM_SEATS + 1} seats is never granted: place-blocked, the job waits for the room`, () => {
    const { wf, job } = run(ROOM_SEATS + 2);
    expect(meetStarted(wf, job)).toBe(false);
    const cands = wf.rounds().flatMap((r) => r.candidates.filter((c) => c.job === job && c.step === 'meet'));
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      expect(c.placeBlocked).toBe(true);
      expect(c.granted).toBe(false);
    }
    expect(wf.jobs().find((j) => j.n === job)?.waitingFor).toBe('room');
  });
});
