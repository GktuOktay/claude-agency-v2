// Spec 0002 AC-6 (REQ-6): hand-off simulation through the engine and the T-6 director.
import { describe, expect, it } from 'vitest';
import { isWaiting } from '../src/scene/activity';
import { createAnchors } from '../src/scene/director';
import { HANDOVER_S, WAIT_ALLOWANCE_S } from '../src/sim/workflow';
import { harness } from './directorHelpers';
import { scenarioSet, unitFloors } from './workflowHelpers';

const units = [...unitFloors().keys()];
const SET = scenarioSet();
const stepOf = (variant: string, id: string) => SET.scenarios.find((s) => s.id === variant)!.steps.find((s) => s.id === id)!;

describe('copies and stop order (AC-6)', () => {
  it('a carry to n recipients creates n copies held by the carrier and visits the recipients in `to` order', () => {
    const h = harness({ scripted: false, autoStart: false, outcome: () => 'pass' });
    const n = h.wf.startJob('l2-input');
    const csc = stepOf('l2-input', 'c-sc');
    let started = false;
    const order: string[] = [];
    h.run(600, (x) => {
      for (const e of x.last) {
        if (e.job !== n || e.step !== 'c-sc') continue;
        if (e.type === 'step-start') {
          started = true;
          const mine = x.dir.copies().filter((c) => c.job === n && c.step === 'c-sc');
          expect(mine.length).toBe(csc.to!.length);
          expect(mine.every((c) => c.holder === csc.actors[0] && c.kind === 'spec-paper')).toBe(true);
          expect(mine.map((c) => c.copy)).toEqual(csc.to!.map((_, i) => i));
        }
        if ((e.type === 'handover' || e.type === 'tray-drop') && order.length < csc.to!.length) order.push(e.to!);
      }
    });
    expect(started).toBe(true);
    expect(csc.to!.length).toBe(2);
    expect(order).toEqual(csc.to);
  });

  it('each copy has at most one holder at any step (holder xor tray); a copy changes floor only while its holder rides', () => {
    const h = harness({ seed: 4 });
    const floors = new Map<string, number | null>();
    let floorChanges = 0;
    h.run(600, (x) => {
      const holders = new Map<string, number>();
      for (const u of units) for (const c of x.dir.held(u)) holders.set(c.key, (holders.get(c.key) ?? 0) + 1);
      for (const c of x.dir.copies()) {
        expect(holders.get(c.key) ?? 0).toBeLessThanOrEqual(1);
        expect(c.holder !== null && c.tray !== null).toBe(false);
        const f = x.dir.copyFloor(c);
        const was = floors.get(c.key);
        if (was !== undefined && was !== null && f !== was) {
          floorChanges++;
          expect(c.holder, `${c.key} moved floor without a holder`).not.toBeNull();
          expect(x.wf.movement.phase(c.holder!), `${c.key} ${c.kind} ${was}→${f} at ${x.wf.time.toFixed(1)} by ${c.holder} ${x.last.map((e) => `${e.type}:${e.step}:${e.to ?? ''}`).join(',')}`).toBe('ride');
        }
        floors.set(c.key, f);
      }
    });
    expect(floorChanges).toBeGreaterThan(3);
  });
});

describe('hand-over at the desk, call and tray (AC-6)', () => {
  it('each hand-over is a 1.2 s `handover` with the carrier at the recipient desk (or, escort exception, where both stand)', () => {
    const h = harness();
    const anchors = createAnchors(h.layouts);
    const since = new Map<string, number>();
    let checked = 0;
    let inPlace = 0;
    h.run(500, (x) => {
      for (const u of units) {
        const st = x.wf.unitState(u);
        if (st?.state === 'handover' && st.prop && st.other) {
          if (!since.has(u)) since.set(u, x.wf.time);
          const v = x.dir.view(u);
          const rs = x.wf.unitState(st.other);
          if (rs?.state === 'escort-wait') {
            inPlace++;
            // The carrier hands over where it stands; the escort is at (or on its way to) the carrier's hand-over spot.
            const spot = { floor: anchors.desk(u).floor, spot: `handover:${u}` };
            expect(x.wf.movement.isAt(st.other, spot) || x.wf.movement.phase(st.other) !== 'still').toBe(true);
            expect(v.directed).toBe(true);
          } else {
            expect(x.wf.movement.isAt(u, { floor: anchors.desk(st.other).floor, spot: `handover:${st.other}` })).toBe(true);
            expect(x.wf.movement.isAt(st.other, { floor: anchors.desk(st.other).floor, spot: `desk:${st.other}` })).toBe(true);
          }
        } else if (since.has(u)) {
          const d = x.wf.time - since.get(u)!;
          expect(Math.abs(d - HANDOVER_S)).toBeLessThanOrEqual(0.1 + 1e-6);
          since.delete(u);
          checked++;
        }
      }
    });
    expect(checked).toBeGreaterThan(5);
    expect(inPlace).toBeGreaterThan(0); // job #1 back-sc: spec-critic hands the paper to its escort
  });

  it('a free recipient away from its desk is interrupted and walks there', () => {
    const h = harness({ seed: 4 });
    let calls = 0;
    h.run(400, (x) => {
      for (const e of x.last) {
        if (e.type !== 'wait-start') continue;
        const st = x.wf.unitState(e.to!);
        if (st === null) continue; // busy elsewhere: no call
        if (st.state === 'step-walk') {
          calls++;
          expect(x.dir.view(e.to!).directed).toBe(true);
        }
      }
    });
    expect(calls).toBeGreaterThan(0);
  });

  it('a recipient not at its desk and free within 8 s gets the copy in its tray, taken when its next step in the job starts', () => {
    let releaseAt = Infinity;
    let now = 0;
    const h = harness({ scripted: false, autoStart: false, outcome: () => 'pass', isSelected: (u) => u === 'business-analyst' && now < releaseAt });
    const n = h.wf.startJob('l1-quick');
    let waitAt = NaN;
    let dropped = false;
    let taken = false;
    h.run(400, (x) => {
      now = x.wf.time + 0.1;
      for (const e of x.last) {
        if (e.job !== n) continue;
        expect(e.type === 'handover' && e.step === 'c-ba').toBe(false);
        if (e.type === 'wait-start' && e.step === 'c-ba') waitAt = e.t;
        if (e.type === 'tray-drop' && e.step === 'c-ba') {
          expect(e.t - waitAt).toBeCloseTo(WAIT_ALLOWANCE_S, 5);
          expect([e.to, e.prop]).toEqual(['business-analyst', 'envelope']);
          // In the tray, unless the BA's next step started in the same simulation step and took it.
          const c = x.dir.copies().find((y) => y.job === n && y.kind === 'envelope');
          const tookNow = x.last.some((y) => y.type === 'tray-take' && y.to === 'business-analyst');
          expect(tookNow ? c?.holder : c?.tray).toBe('business-analyst');
          dropped = true;
          releaseAt = e.t + 2;
        }
        if (e.type === 'tray-take' && e.to === 'business-analyst') {
          expect(e.step).toBe('spec');
          expect(x.dir.held('business-analyst').some((c) => c.job === n && c.kind === 'envelope')).toBe(true);
          taken = true;
        }
      }
    });
    expect([dropped, taken]).toEqual([true, true]);
  });
});

describe('pair build, escort reservation and waiting marker (AC-6)', () => {
  it('the lane-3 build runs with both engineers at one desk in `pair`', () => {
    const h = harness({ scripted: false, autoStart: false, outcome: () => 'pass' });
    const n = h.wf.startJob('l3-full');
    const build = stepOf('l3-full', 'build');
    const anchors = createAnchors(h.layouts);
    let samples = 0;
    h.run(900, (x) => {
      const a = x.wf.unitState(build.actors[0]!);
      const b = x.wf.unitState(build.actors[1]!);
      if (a?.job === n && a.state === 'pair') {
        expect(b?.state).toBe('pair');
        expect(a.other).toBe(build.actors[1]);
        const seat = anchors.desk(build.actors[1]!);
        for (const u of build.actors) {
          const v = x.dir.view(u);
          expect(v.floor).toBe(seat.floor);
          expect(Math.hypot(v.x - seat.x, v.z - seat.z)).toBeLessThan(1.6);
        }
        samples++;
      }
    });
    expect(samples).toBeGreaterThan(10);
  });

  it('after a forced reject the escort is not grantable until the carry-back ends; after a pass it is free when the review ends', () => {
    const h = harness();
    let rejectEnd = NaN;
    let backEnd = NaN;
    let passEnd = NaN;
    h.run(900, (x) => {
      for (const e of x.last) {
        if (e.job !== 1) {
          if (e.type === 'step-start' && e.units?.includes('business-analyst') && !Number.isNaN(rejectEnd) && Number.isNaN(backEnd)) throw new Error('escort granted to another job');
          continue;
        }
        if (e.type === 'step-end' && e.step === 'rev-sc') {
          if (e.outcome === 'reject') rejectEnd = e.t;
          else passEnd = e.t;
        }
        if ((e.type === 'handover' || e.type === 'tray-drop') && e.step === 'back-sc') backEnd = e.t;
      }
      if (!Number.isNaN(rejectEnd) && Number.isNaN(backEnd)) expect(x.wf.extended().some(([u]) => u === 'business-analyst')).toBe(true);
      if (!Number.isNaN(passEnd) && x.wf.time === passEnd) expect(x.wf.extended().some(([u]) => u === 'business-analyst')).toBe(false);
    });
    expect([Number.isNaN(rejectEnd), Number.isNaN(backEnd), Number.isNaN(passEnd)]).toEqual([false, false, false]);
    expect(x0(backEnd)).toBeGreaterThan(x0(rejectEnd));
  });

  it('the hourglass marker is visible exactly while a robot is in a waiting state', () => {
    const h = harness({ seed: 4 });
    let shown = 0;
    h.run(600, (x) => {
      for (const u of units) {
        const st = x.wf.unitState(u);
        const v = x.dir.view(u);
        expect(v.marker === 'hourglass', `${u} ${st?.state}`).toBe(st !== null && isWaiting(st.state));
        if (v.marker === 'hourglass') shown++;
      }
    });
    expect(shown).toBeGreaterThan(50);
  });
});

const x0 = (t: number): number => t;
