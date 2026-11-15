// Grant order R-3 and the deadlock fixture (spec 0002 AC-4, §6 R-3).
import { describe, it, expect } from 'vitest';
import { makeWorkflow } from './workflowHelpers';
import type { Workflow } from '../src/sim/workflow';

function stepUntil(wf: Workflow, pred: () => boolean, maxS = 1500): void {
  for (let i = 0; i < maxS * 10 && !pred(); i++) wf.step(0.1);
  expect(pred()).toBe(true);
}

describe('R-3 deadlock fixture (AC-4)', () => {
  it('A (l3) holds the room and its sign needs the BA; B\'s meeting waited longer: B reserves nothing, A signs, releases, then B meets', () => {
    const wf = makeWorkflow({ scripted: false, autoStart: false, maxJobs: 3, durations: 'max', outcome: () => 'pass' });
    const a = wf.startJob('l3-full');
    const has = (type: string, job: number, step?: string) => wf.trace().some((e) => e.type === type && e.job === job && (step === undefined || e.step === step));
    stepUntil(wf, () => has('step-start', a, 'meet'));
    const b = wf.startJob('l2-base');
    stepUntil(wf, () => has('step-start', b, 'meet'));

    const t = wf.trace();
    const at = (type: string, job: number, step?: string) => t.find((e) => e.type === type && e.job === job && (step === undefined || e.step === step))!.t;
    const rounds = wf.rounds();
    const bMeet = rounds.flatMap((r) => r.candidates.filter((c) => c.job === b && c.step === 'meet').map((c) => ({ ...c, t: r.t })));
    const aSign = rounds.flatMap((r) => r.candidates.filter((c) => c.job === a && c.step === 'sign').map((c) => ({ ...c, t: r.t })));

    // Preconditions of the fixture: A holds the room; B's meeting needs room and BA and has waited longer.
    expect(at('room-hold', a)).toBeLessThan(bMeet[0]!.t);
    expect(bMeet[0]!.needs).toContain('business-analyst');
    expect(aSign[0]!.needs).toContain('business-analyst');
    expect(bMeet[0]!.since).toBeLessThan(aSign[0]!.since);

    // While A holds the room, B's meeting is place-blocked and reserves nothing.
    const release = at('room-release', a);
    for (const c of bMeet.filter((x) => x.t < release)) {
      expect(c.placeBlocked).toBe(true);
      expect(c.granted).toBe(false);
    }
    // A's sign is granted the BA in a round where B's (older) meeting is waiting too.
    const grantRound = rounds.find((r) => r.candidates.some((c) => c.job === a && c.step === 'sign' && c.granted))!;
    expect(grantRound.candidates.some((c) => c.job === b && c.step === 'meet' && c.placeBlocked)).toBe(true);
    // Order: A's sign starts, A releases the room (after sign), then B's meeting starts.
    expect(at('step-start', a, 'sign')).toBeLessThan(release);
    expect(at('step-end', a, 'sign')).toBeLessThanOrEqual(release);
    expect(release).toBeLessThanOrEqual(at('step-start', b, 'meet'));
    expect(at('room-hold', b)).toBe(at('step-start', b, 'meet'));
  });

  it('R-3(1): a place-blocked older step reserves nothing, so a younger open step gets the unit both need', () => {
    // X (l1) signs at the signing desk; B's intake (CEO + CoS, signing desk) waits place-blocked from before
    // C's (l0) `done` step (CoS) becomes a candidate. CoS is free: C's done is granted in that round. A blocked
    // step that claimed its units (the QA r2A mutation) would keep CoS from C. The room-holder fixture above
    // misses that mutation: there the holder's priority grants the younger step first anyway.
    const wf = makeWorkflow({ scripted: false, autoStart: false, maxJobs: 3, durations: 'max', outcome: () => 'pass' });
    const has = (type: string, job: number, step?: string) => wf.trace().some((e) => e.type === type && e.job === job && (step === undefined || e.step === step));
    const x = wf.startJob('l1-quick');
    const c = wf.startJob('l0-direct');
    stepUntil(wf, () => has('step-start', x, 'sign'));
    const b = wf.startJob('l2-base');
    stepUntil(wf, () => has('step-start', b, 'intake'));

    const rounds = wf.rounds().filter(
      (r) => r.candidates.some((k) => k.job === b && k.step === 'intake' && k.placeBlocked) && r.candidates.some((k) => k.job === c && !k.placeBlocked && k.needs.includes('chief-of-staff')),
    );
    expect(rounds.length).toBeGreaterThan(0);
    for (const r of rounds) {
      const bIntake = r.candidates.find((k) => k.job === b && k.step === 'intake')!;
      const cStep = r.candidates.find((k) => k.job === c && !k.placeBlocked && k.needs.includes('chief-of-staff'))!;
      // Preconditions: B waited longer, both need CoS, CoS is free and no other open step needs it.
      expect(bIntake.since).toBeLessThan(cStep.since);
      expect(bIntake.needs).toContain('chief-of-staff');
      expect(r.busy).not.toContain('chief-of-staff');
      expect(r.candidates.filter((k) => !k.placeBlocked && k.needs.includes('chief-of-staff'))).toHaveLength(1);
      expect(cStep.granted).toBe(true);
      expect(bIntake.granted).toBe(false);
    }
  });

  it('a held room blocks another job\'s room step (room-wait shown on the job)', () => {
    const wf = makeWorkflow({ scripted: false, autoStart: false, durations: 'max', outcome: () => 'pass' });
    const a = wf.startJob('l3-full');
    const has = (type: string, job: number, step?: string) => wf.trace().some((e) => e.type === type && e.job === job && (step === undefined || e.step === step));
    stepUntil(wf, () => has('step-start', a, 'meet'));
    const b = wf.startJob('l2-base');
    let sawRoomWait = false;
    stepUntil(wf, () => {
      if (wf.roomHolder() === a && wf.jobs().find((j) => j.n === b)?.waitingFor === 'room') sawRoomWait = true;
      return has('step-start', b, 'meet');
    });
    expect(sawRoomWait).toBe(true);
    const t = wf.trace();
    const aHold = t.find((e) => e.type === 'room-hold' && e.job === a)!.t;
    const aRel = t.find((e) => e.type === 'room-release' && e.job === a)!.t;
    // No other job's room step starts between A's hold and release.
    expect(t.filter((e) => e.type === 'step-start' && e.job !== a && e.place === 'meeting-room' && e.t > aHold && e.t < aRel)).toEqual([]);
  });

  it('l2 holds the room for the meeting only; l3 from the meeting through the sign', () => {
    for (const [variant, from, to] of [['l2-base', 'meet', 'meet'], ['l3-full', 'meet', 'sign']] as const) {
      const wf = makeWorkflow({ scripted: false, autoStart: false, durations: 'max', outcome: () => 'pass' });
      const n = wf.startJob(variant);
      stepUntil(wf, () => wf.trace().some((e) => e.type === 'job-done' && e.job === n));
      const t = wf.trace();
      expect(t.filter((e) => e.type === 'room-hold').map((e) => e.step)).toEqual([from]);
      expect(t.filter((e) => e.type === 'room-release').map((e) => e.step)).toEqual([to]);
      expect(t.find((e) => e.type === 'room-release')!.t).toBe(t.find((e) => e.type === 'step-end' && e.step === to)!.t);
    }
  });
});
