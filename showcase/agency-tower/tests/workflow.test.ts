// Workflow engine (spec 0002 AC-4, AC-8, AC-9). Fixed seeds, 0.1 s simulation steps.
import { describe, it, expect } from 'vitest';
import { makeWorkflow, run, runUntilDone, scenarioSet, unitFloors } from './workflowHelpers';
import { createTimedMovement } from '../src/sim/movement';
import { createRng } from '../src/scene/rng';
import { streamSeed, type WfEvent, type Workflow, type DirectedState } from '../src/sim/workflow';
import { indexScenario } from '../src/data/scenarios';

const SET = scenarioSet();
const stepOf = (variant: string, id: string) => SET.scenarios.find((s) => s.id === variant)!.steps.find((s) => s.id === id)!;
const variantOf = (trace: readonly WfEvent[], n: number): string => trace.find((e) => e.type === 'job-start' && e.job === n)!.variant!;

function instrumented(seed: number, now: () => number) {
  const base = createRng(streamSeed(seed, 'engine'));
  const log: number[] = [];
  const rng = () => {
    log.push(now());
    return base();
  };
  return { rng, log };
}

describe('engine trace (AC-4)', () => {
  it('600 s twice gives byte-identical traces; another seed differs', () => {
    const trace = (seed: number) => {
      const wf = makeWorkflow({ seed });
      run(wf, 600);
      return JSON.stringify(wf.trace());
    };
    const a = trace(11);
    expect(trace(11)).toBe(a);
    expect(trace(12)).not.toBe(a);
  });

  for (const [quality, maxJobs] of [['high', 3], ['low', 2]] as const) {
    it(`never exceeds ${maxJobs} concurrent jobs at ${quality}; unscripted jobs start 4-10 s after a slot frees`, () => {
      const wf = makeWorkflow({ maxJobs, seed: 5 });
      let peak = 0;
      run(wf, 1200, (w) => {
        const active = w.jobs().filter((j) => !j.done).length;
        peak = Math.max(peak, active);
        expect(active).toBeLessThanOrEqual(maxJobs);
      });
      expect(peak).toBe(maxJobs);
      const t = wf.trace();
      const frees = t.filter((e) => e.type === 'slot-free').map((e) => e.t);
      const starts = t.filter((e) => e.type === 'job-start').map((e) => ({ n: e.job, t: e.t }));
      // Slot k (in free order) is refilled by the k-th job started after the scripted ones.
      const scriptedOnSlot = maxJobs < 3 ? 1 : 0; // job #3 on `low` waits for the first free slot
      const later = starts.filter((s) => s.n > 3 - scriptedOnSlot);
      expect(later.length).toBeGreaterThan(3);
      later.forEach((s, k) => {
        const delay = s.t - frees[k]!;
        if (maxJobs < 3 && s.n === 3) expect(delay).toBeCloseTo(4, 5);
        else {
          expect(delay).toBeGreaterThanOrEqual(4 - 1e-6);
          expect(delay).toBeLessThanOrEqual(10 + 1e-6);
        }
      });
    });
  }

  it('no unit is actor, escort or caller of two running steps; extended escorts hold no other step', () => {
    const wf = makeWorkflow({ seed: 21 });
    run(wf, 1200, (w) => {
      const seen = new Map<string, string>();
      for (const r of w.running()) {
        for (const u of r.units) {
          expect(seen.has(u), `${u} in ${seen.get(u)} and ${r.job}/${r.step} at ${w.time}`).toBe(false);
          seen.set(u, `${r.job}/${r.step}`);
        }
      }
      for (const [u] of w.extended()) expect(seen.has(u)).toBe(false);
    });
  });

  it('every step acquires all its actors, escort and place in one step, none before all are free; grants follow R-3', () => {
    // Engine logic on the timed stand-in (Rev 32): its pace gives the counted grant rounds.
    const wf = makeWorkflow({ seed: 21, movement: createTimedMovement(unitFloors()) });
    run(wf, 1200);
    const trace = wf.trace();
    let grants = 0;
    for (const round of wf.rounds()) {
      const busy = new Set(round.busy);
      // Candidates are listed in R-3 order: non-blocked first, holders first, then oldest waiting.
      const open = round.candidates.filter((c) => !c.placeBlocked);
      for (let i = 1; i < open.length; i++) {
        const a = open[i - 1]!;
        const b = open[i]!;
        const ordered = (a.holder && !b.holder) || (a.holder === b.holder && (a.since < b.since || (a.since === b.since && a.job <= b.job)));
        expect(ordered, `R-3 order at ${round.t}`).toBe(true);
      }
      // Oracle: re-derive the grants from the busy set.
      const claimed = new Set<string>();
      let roomJob: number | undefined;
      let signingTaken = false;
      for (const c of open) {
        const unitsOk = c.needs.every((u) => !busy.has(u) && !claimed.has(u));
        const placeOk = !(c.room && roomJob !== undefined && roomJob !== c.job) && !(c.signing && signingTaken);
        const expectGrant = unitsOk && placeOk;
        expect(c.granted, `${c.job}/${c.step} at ${round.t}`).toBe(expectGrant);
        if (c.granted) {
          grants++;
          c.needs.forEach((u) => busy.add(u));
          if (c.room) roomJob = c.job;
          if (c.signing) signingTaken = true;
          // All needs appear in this round's start event (one simulation step).
          const ev = trace.find((e) => (e.type === 'step-start' || e.type === 'call') && e.t === round.t && e.job === c.job && e.step === c.step)!;
          expect(ev, `start event for ${c.job}/${c.step}`).toBeDefined();
          expect([...ev.units!].sort()).toEqual([...c.needs].sort());
        } else {
          c.needs.forEach((u) => claimed.add(u));
        }
      }
      for (const c of round.candidates.filter((x) => x.placeBlocked)) expect(c.granted).toBe(false);
    }
    expect(grants).toBeGreaterThan(100);
    // Non-vacuous: the run contains place-blocked candidates and unit contention.
    expect(wf.rounds().some((r) => r.candidates.some((c) => c.placeBlocked))).toBe(true);
    expect(wf.rounds().some((r) => r.candidates.some((c) => !c.placeBlocked && !c.granted))).toBe(true);
  });

  it('in a 1200 s run at high every started job finishes (liveness)', () => {
    const wf = makeWorkflow({ seed: 33 });
    run(wf, 1200);
    const started = wf.trace().filter((e) => e.type === 'job-start').map((e) => e.job);
    // Keep the office running (jobs keep arriving) until every job started in the first 1200 s is done.
    for (let i = 0; i < 9000 && !started.every((n) => wf.trace().some((e) => e.type === 'job-done' && e.job === n)); i++) wf.step(0.1);
    for (const n of started) expect(wf.trace().some((e) => e.type === 'job-done' && e.job === n), `job #${n}`).toBe(true);
    expect(started.length).toBeGreaterThan(5);
  });

  it('counts draws by purpose: one outcome draw per unscripted, non-forced review/test episode; none per frame', () => {
    let wf: Workflow | undefined;
    const { rng, log } = instrumented(9, () => wf?.time ?? 0);
    wf = makeWorkflow({ rng });
    run(wf, 1200);
    const trace = wf.trace();
    const d = wf.draws();
    expect(log.length).toBe(d.outcome + d.lane + d.variant + d['start-delay'] + d.duration);

    // Expected outcome draws, re-derived from the trace.
    let expected = 0;
    const loopsSoFar = new Map<string, number>();
    for (const e of trace) {
      if (e.type === 'reject') loopsSoFar.set(`${e.job}/${e.step}`, (loopsSoFar.get(`${e.job}/${e.step}`) ?? 0) + 1);
      if (e.type !== 'step-start' || e.job <= 3) continue;
      const variant = variantOf(trace, e.job);
      const s = stepOf(variant, e.step!);
      if (!(s.rejectP && s.rejectP > 0)) continue;
      const ix = indexScenario(SET.scenarios.find((x) => x.id === variant)!);
      const owner = ix.branchOf.get(s.id) ?? s;
      const forced = (loopsSoFar.get(`${e.job}/${owner.id}`) ?? 0) >= (owner.loop?.maxLoops ?? 0);
      if (!forced) expected++;
    }
    expect(d.outcome).toBe(expected);
    expect(d.outcome).toBeGreaterThan(5);
    const unscripted = trace.filter((e) => e.type === 'job-start' && e.job > 3).length;
    expect(d.lane).toBe(unscripted);
    expect(d.variant).toBe(unscripted);
    expect(d['start-delay']).toBe(trace.filter((e) => e.type === 'slot-free').length);
    // No draw of any purpose per frame: every draw happens at an event time.
    const eventTimes = new Set(trace.map((e) => e.t));
    for (const t of log) expect(eventTimes.has(Math.round(t * 1000) / 1000), `draw at ${t}`).toBe(true);
    expect(log.length).toBeLessThan(12000 / 10);
  });

  it('ambient ↔ directed changes are §7.5 transitions (reservation, recipient call, release)', () => {
    const wf = makeWorkflow({ seed: 4 });
    const units = [...new Set(SET.scenarios.flatMap((s) => s.steps.flatMap((x) => [...x.actors, ...(x.to ?? [])])))];
    const prev = new Map<string, { state: DirectedState; job: number; step: string } | null>(units.map((u) => [u, null]));
    const firstStates = new Set<DirectedState>(['step-walk', 'carry-walk', 'called', 'escort-wait', 'call-hold', 'handover', 'wait', 'call', 'call-wait', 'ride', 'step-work', 'seated', 'seat-wait', 'present', 'review', 'test', 'build', 'pair', 'stamp-raise', 'stamp-press']);
    let changes = 0;
    run(wf, 900, (w) => {
      const now = Math.round(w.time * 1000) / 1000;
      const evs = w.trace().filter((e) => e.t === now);
      for (const u of units) {
        const s = w.unitState(u);
        const p = prev.get(u)!;
        if (!p && s) {
          changes++;
          expect(firstStates.has(s.state)).toBe(true);
          const reservedNow = evs.some((e) => (e.type === 'step-start' || e.type === 'call') && e.units?.includes(u));
          const calledRecipient = s.state === 'step-walk' && w.trace().some((e) => e.type === 'wait-start' && e.to === u && e.job === s.job);
          expect(reservedNow || calledRecipient, `${u} → ${s.state} at ${now}`).toBe(true);
        }
        if (p && !s) {
          const released = evs.some((e) => (e.type === 'step-end' && e.job === p.job) || ((e.type === 'handover' || e.type === 'tray-drop') && e.to === u) || e.type === 'wait-end');
          expect(released, `${u} leaves ${p.state} at ${now}`).toBe(true);
        }
        prev.set(u, s ? { state: s.state, job: s.job, step: s.step } : null);
      }
    });
    expect(changes).toBeGreaterThan(50);
  });
});

describe('rejection loops (AC-8)', () => {
  it('job #1 has exactly one spec-critic rejection and job #2 exactly one QA red; loop rows run in order', () => {
    const wf = makeWorkflow({ seed: 1 });
    run(wf, 800);
    const t = wf.trace();
    const rejects = (n: number) => t.filter((e) => e.type === 'reject' && e.job === n).map((e) => e.step);
    expect(rejects(1)).toEqual(['rev-sc']);
    expect(rejects(2)).toEqual(['test']);
    expect(rejects(3)).toEqual([]);
    const after = (n: number, step: string) => {
      const i = t.findIndex((e) => e.type === 'reject' && e.job === n && e.step === step);
      return t.slice(i).filter((e) => e.type === 'step-start' && e.job === n).map((e) => e.step).slice(0, 4);
    };
    expect(after(1, 'rev-sc')).toEqual(['back-sc', 'rework', 'c-sc', 'rev-sc']);
    expect(after(2, 'test')).toEqual(['back-qa', 'rebuild', 'c-qa', 'test']);
    for (const n of [1, 2, 3]) expect(t.some((e) => e.type === 'job-done' && e.job === n)).toBe(true);
  });

  it('the strip total counts every loop of the job ("↺ 1", then "↺ 2")', () => {
    const wf = makeWorkflow({ scripted: false, maxJobs: 1, onlyVariant: 'l2-base', outcome: (_n, step, runIdx) => (runIdx === 0 && (step === 'rev-sc' || step === 'test') ? 'reject' : 'pass') });
    const seen: number[] = [];
    runUntilDone(wf, 1, 900, (w) => {
      const j = w.jobs().find((x) => x.n === 1);
      if (j && seen[seen.length - 1] !== j.loops) seen.push(j.loops);
    });
    expect(seen).toEqual([0, 1, 2]);
  });

  for (const variant of ['l1-quick', 'l2-base', 'l2-input', 'l3-full']) {
    it(`${variant} with rejectP forced to 1 rejects exactly maxLoops times per step or call, then passes without a draw`, () => {
      let wf: Workflow | undefined;
      const { rng, log } = instrumented(3, () => wf?.time ?? 0);
      wf = makeWorkflow({ rng, scripted: false, maxJobs: 1, onlyVariant: variant, forceRejectP: 1, durations: 'max' });
      expect(runUntilDone(wf, 1)).toBeGreaterThan(0);
      const t = wf.trace().filter((e) => e.job === 1);
      expect(t.some((e) => e.type === 'job-done')).toBe(true);
      const scn = SET.scenarios.find((s) => s.id === variant)!;
      let expectedDraws = 0;
      for (const s of scn.steps.filter((x) => x.loop)) {
        const rej = t.filter((e) => e.type === 'reject' && e.step === s.id).length;
        expect(rej, `${variant}/${s.id}`).toBe(s.loop!.maxLoops);
        const branches = s.kind === 'call' ? (s.parallel ?? []).filter((b) => (scn.steps.find((x) => x.id === b)!.rejectP ?? 0) > 0).length : 1;
        expectedDraws += s.loop!.maxLoops * branches;
      }
      // Only outcome draws remain with max durations and the variant fixed (lane, variant, start-delay are 1 each).
      const d = wf.draws();
      expect(d.outcome).toBe(expectedDraws);
      expect(log.length).toBe(d.outcome + d.lane + d.variant + d['start-delay']);
    });
  }
});

describe('calls with join and reject (AC-9)', () => {
  function callRun(variant: string, outcome?: (n: number, step: string, run: number) => 'pass' | 'reject' | undefined) {
    const wf = makeWorkflow({ scripted: false, maxJobs: 1, onlyVariant: variant, durations: 'max', outcome: outcome ?? (() => 'pass') });
    const states: { t: number; caller: string | undefined; branch: (string | undefined)[] }[] = [];
    const scn = SET.scenarios.find((s) => s.id === variant)!;
    const call = scn.steps.find((s) => s.kind === 'call')!;
    const branchActors = (call.parallel ?? []).map((b) => scn.steps.find((s) => s.id === b)!.actors[0]!);
    runUntilDone(wf, 1, 900, (w) => {
      const running = w.running().some((r) => r.step === call.id);
      if (running) states.push({ t: w.time, caller: w.unitState(call.actors[0]!)?.state, branch: branchActors.map((a) => w.unitState(a)?.state) });
    });
    return { wf, t: wf.trace().filter((e) => e.job === 1), call, branchActors, states };
  }

  for (const variant of ['l2-input', 'l2-dependency', 'l3-full']) {
    it(`${variant}: branches reserved and started in one step with call markers; caller holds; join after the last branch`, () => {
      const { wf, t, call, branchActors, states } = callRun(variant);
      const callEv = t.find((e) => e.type === 'call')!;
      expect([...callEv.units!].sort()).toEqual([call.actors[0]!, ...branchActors].sort());
      const starts = t.filter((e) => e.type === 'step-start' && (call.parallel ?? []).includes(e.step!));
      expect(starts.map((e) => e.t)).toEqual(branchActors.map(() => callEv.t));
      // All branch robots show the call marker in the start step.
      expect(states[0]!.branch).toEqual(branchActors.map(() => 'called'));
      for (const s of states) expect(['call-hold', 'handover']).toContain(s.caller);
      const lastBranchEnd = Math.max(...t.filter((e) => e.type === 'step-end' && (call.parallel ?? []).includes(e.step!)).map((e) => e.t));
      const joinStart = t.find((e) => e.type === 'step-start' && e.step === call.join)!;
      expect(joinStart.t).toBeGreaterThanOrEqual(lastBranchEnd);
      const r = wf.rounds().find((x) => x.candidates.some((c) => c.step === call.id && c.granted))!;
      for (const u of [call.actors[0]!, ...branchActors]) expect(r.busy).not.toContain(u);
    });

    it(`${variant}: one branch forced to reject counts exactly one loop, continues at loop.to and reruns all branches`, () => {
      const scn = SET.scenarios.find((s) => s.id === variant)!;
      const call = scn.steps.find((s) => s.kind === 'call')!;
      const victim = call.parallel![call.parallel!.length - 1]!;
      const { t } = callRun(variant, (_n, step, runIdx) => (step === victim && runIdx === 0 ? 'reject' : 'pass'));
      expect(t.filter((e) => e.type === 'reject').map((e) => e.step)).toEqual([call.id]);
      const i = t.findIndex((e) => e.type === 'reject');
      expect(t.slice(i).find((e) => e.type === 'step-start')!.step).toBe(call.loop!.to);
      for (const b of call.parallel!) expect(t.filter((e) => e.type === 'step-start' && e.step === b)).toHaveLength(2);
      expect(t.filter((e) => e.type === 'call')).toHaveLength(2);
    });
  }

  it('l3: the three gates take three meeting-room seats and each gets its own copy by hand-over after being seated', () => {
    const { wf, t } = callRun('l3-full');
    const gates = ['g-sc', 'g-as', 'g-ab'];
    expect(t.filter((e) => e.type === 'step-start' && gates.includes(e.step!)).map((e) => e.place)).toEqual(['meeting-room', 'meeting-room', 'meeting-room']);
    const copies = t.find((e) => e.type === 'copies')!;
    expect(copies.copy).toBe(3);
    const hands = t.filter((e) => e.type === 'handover' && gates.includes(e.step!));
    expect(hands.map((e) => e.from)).toEqual(['business-analyst', 'business-analyst', 'business-analyst']);
    expect(new Set(hands.map((e) => e.to))).toEqual(new Set(['spec-critic', 'appsec', 'architecture-board']));
    expect(new Set(hands.map((e) => e.copy))).toEqual(new Set([0, 1, 2]));
    expect(wf.roomHolder()).toBeNull();
  });

  it('l3: a gate review clock starts only after its hand-over (seated first)', () => {
    const wf = makeWorkflow({ scripted: false, maxJobs: 1, onlyVariant: 'l3-full', durations: 'max', outcome: () => 'pass' });
    const handedAt = new Map<string, number>();
    const reviewingAt = new Map<string, number>();
    runUntilDone(wf, 1, 900, (w) => {
      for (const e of w.drainEvents()) if (e.type === 'handover' && e.step?.startsWith('g-')) handedAt.set(e.to!, w.time);
      for (const u of ['spec-critic', 'appsec', 'architecture-board']) {
        const s = w.unitState(u);
        if (s?.state === 'review' && !reviewingAt.has(u)) reviewingAt.set(u, w.time);
      }
    });
    for (const u of ['spec-critic', 'appsec', 'architecture-board']) expect(reviewingAt.get(u)!).toBeGreaterThanOrEqual(handedAt.get(u)! - 1e-9);
  });
});
