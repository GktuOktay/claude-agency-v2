// Spec 0002 T-6: director, directed states and their transitions (AC-4), sign / build / lamp /
// lane-0 evidence / evidence sheet (AC-7). Pure simulation, no three.js.
import { describe, expect, it } from 'vitest';
import { DIRECTED_STATES, isWaiting, type DirectedKind } from '../src/scene/activity';
import { MEETING_ROOM } from '../src/sim/layout';
import { createAnchors, LAMP_S, EVIDENCE_S, type RobotView } from '../src/scene/director';
import type { DirectedState } from '../src/sim/workflow';
import { harness, roundT } from './directorHelpers';
import { scenarioSet, unitFloors } from './workflowHelpers';

const unitIds = [...unitFloors().keys()];

const DIRECTED = new Set<string>(DIRECTED_STATES);

describe('directed states (§7.5)', () => {
  it('activity.ts lists every engine state plus room-wait; the waiting set is the §7.5 one', () => {
    const engine: DirectedState[] = ['step-walk', 'carry-walk', 'handover', 'wait', 'escort-wait', 'call-hold', 'call', 'call-wait', 'ride', 'seat-wait', 'seated', 'present', 'pair', 'build', 'review', 'test', 'stamp-raise', 'stamp-press', 'step-work', 'called'];
    const asKind: DirectedKind[] = engine; // compile-time: every engine state is a directed kind
    for (const s of asKind) expect(DIRECTED.has(s)).toBe(true);
    expect(DIRECTED.has('room-wait')).toBe(true);
    expect(DIRECTED_STATES.filter((s) => isWaiting(s)).sort()).toEqual(['call-hold', 'call-wait', 'escort-wait', 'room-wait', 'seat-wait', 'wait']);
  });
});

describe('director transitions (AC-4)', () => {
  it('every ambient → directed change is a reservation (or a recipient call) and every directed → ambient change walks home then idles', () => {
    const h = harness({ seed: 4 });
    let interrupts = 0;
    let returns = 0;
    let seen = 0;
    h.run(900, (x) => {
      const log = x.dir.transitions();
      for (; seen < log.length; seen++) {
        const tr = log[seen]!;
        const st = x.wf.unitState(tr.id);
        const fromD = DIRECTED.has(tr.from);
        const toD = DIRECTED.has(tr.to);
        if (!fromD && toD) {
          interrupts++;
          expect(['idle', 'work', 'coffee', 'walk'], `${tr.id} ${tr.from}→${tr.to}`).toContain(tr.from);
          expect(st?.state, `${tr.id} at ${tr.t}`).toBe(tr.to);
        } else if (fromD && !toD) {
          expect(['walk', 'idle'], `${tr.id} ${tr.from}→${tr.to}`).toContain(tr.to);
          expect(st).toBeNull();
        } else if (!fromD && !toD) {
          // the return path only: walk home ↔ stand (a called recipient waits at its desk), arrival idles
          expect([`walk>idle`, `idle>walk`]).toContain(`${tr.from}>${tr.to}`);
          if (tr.to === 'idle' && !x.ambient.isReserved(tr.id)) returns++;
        }
      }
    });
    expect(interrupts).toBeGreaterThan(50);
    expect(returns).toBeGreaterThan(20);
  });

  it('a released robot ends at its home point back in the ambient cycle with a fresh idle period', () => {
    const h = harness({ seed: 4 });
    const backAt = new Map<string, number>();
    h.run(600, (x) => {
      for (const tr of x.dir.transitions().slice(-20)) {
        if (tr.to === 'idle' && !x.ambient.isReserved(tr.id) && roundT(x.wf.time) === tr.t) backAt.set(tr.id, tr.t);
      }
    });
    expect(backAt.size).toBeGreaterThan(5);
    const anchors = createAnchors(h.layouts);
    for (const id of backAt.keys()) {
      if (h.wf.unitState(id) || h.ambient.isReserved(id)) continue;
      const a = h.ambient.get(id);
      expect(['idle', 'walk', 'work', 'coffee']).toContain(a.kind);
      const v = h.dir.view(id);
      expect(v.directed).toBe(false);
      expect(v.floor).toBe(anchors.home(id).floor);
    }
  });

  it('rendered directed robots follow the engine: at a build or pair end they sit at the step desk; pair builders share one desk', () => {
    const h = harness();
    const anchors = createAnchors(h.layouts);
    let checked = 0;
    let pairs = 0;
    // Positions from the step before the end (at the end the engine already sends the robots home).
    let before = new Map<string, RobotView>();
    h.run(500, (x) => {
      for (const e of x.last) {
        if (e.type !== 'step-end' || e.kind !== 'build') continue;
        const set = scenarioSet();
        const variant = x.wf.jobs().find((j) => j.n === e.job)?.variant;
        const s = set.scenarios.find((v) => v.id === variant)?.steps.find((y) => y.id === e.step);
        if (!s) continue;
        if (s.actors.length === 2) {
          pairs++;
          const [a, b] = [before.get(s.actors[0]!)!, before.get(s.actors[1]!)!];
          expect([a.state, b.state]).toEqual(['pair', 'pair']);
          const pair = anchors.pair(s.actors[1]!);
          const seat = anchors.desk(s.actors[1]!);
          expect(Math.hypot(b.x - seat.x, b.z - seat.z)).toBeLessThan(0.05);
          expect(Math.hypot(a.x - pair.x, a.z - pair.z)).toBeLessThan(0.05);
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1);
        } else {
          const v = before.get(s.actors[0]!)!;
          expect(v.state).toBe('build');
          const seat = anchors.desk(s.actors[0]!);
          expect(Math.hypot(v.x - seat.x, v.z - seat.z)).toBeLessThan(0.05);
          expect(v.pose).toBe('work');
        }
        checked++;
      }
      before = new Map(unitIds.map((u) => [u, x.dir.view(u)] as const));
    });
    expect(checked).toBeGreaterThan(1);
    expect(pairs).toBeGreaterThan(0);
  });
});

describe('sign, build, lamp and evidence (AC-7)', () => {
  it('the CEO passes stamp-raise then stamp-press, then hands back a stamped paper; l1/l2 at the signing desk, l3 in the meeting room', () => {
    const h = harness();
    const anchors = createAnchors(h.layouts);
    const places = new Map<number, string>();
    let signs = 0;
    let before = new Map<string, RobotView>();
    h.run(900, (x) => {
      for (const e of x.last) {
        if (e.type === 'sign') places.set(e.job, e.place ?? '');
        if (e.type !== 'step-end' || e.kind !== 'sign') continue;
        signs++;
        const ceo = x.dir.transitions().filter((t) => t.id === 'ceo').map((t) => t.to);
        const i = ceo.lastIndexOf('stamp-raise');
        expect(i).toBeGreaterThanOrEqual(0);
        expect(ceo.indexOf('stamp-press', i)).toBeGreaterThan(i);
        // The next carry (same batch) may already have turned the paper into the stamped copies it takes.
        const paper = x.dir.copies().find((c) => c.job === e.job && c.stamped && c.holder === 'business-analyst');
        expect(paper, `job ${e.job}`).toBeDefined();
        expect(x.dir.held('ceo').filter((c) => c.job === e.job)).toEqual([]);
        const v = before.get('ceo')!;
        expect(v.state).toBe('stamp-press');
        const lane = x.wf.jobs().find((j) => j.n === e.job)!.lane;
        // AC-7 / AC-14: lane 3 stamps at the meeting-room sign table, lanes 1-2 at the signing desk (0.05 u).
        const spot = lane === 3 ? anchors.signTable() : anchors.desk('ceo');
        expect(v.floor).toBe(spot.floor);
        expect(Math.hypot(v.x - spot.x, v.z - spot.z), `lane ${lane} job ${e.job}: ${v.x},${v.z}`).toBeLessThan(0.05);
        if (lane === 3) expect(v.floor).toBe(MEETING_ROOM.floor);
      }
      before = new Map([['ceo', x.dir.view('ceo')]]);
    });
    expect(signs).toBeGreaterThanOrEqual(3);
    const lanes = new Map(h.wf.jobs().map((j) => [j.n, j.lane]));
    for (const [job, place] of places) if (lanes.has(job)) expect(place).toBe(lanes.get(job) === 3 ? 'meeting-room' : 'signing-desk');
    expect([...places.values()]).toContain('meeting-room');
    expect([...places.values()]).toContain('signing-desk');
  });

  it('shows the stamp in the CEO hand exactly while stamping', () => {
    const h = harness();
    let stamping = 0;
    h.run(500, (x) => {
      const st = x.wf.unitState('ceo')?.state;
      const v = x.dir.view('ceo');
      expect(v.stamp).toBe(st === 'stamp-raise' || st === 'stamp-press');
      if (v.stamp) stamping++;
    });
    expect(stamping).toBeGreaterThan(0);
  });

  it('the build screen percentage is an integer, non-decreasing, 0 at step start and 100 at step end', () => {
    const h = harness();
    const open = new Map<string, number>();
    let builds = 0;
    h.run(500, (x) => {
      for (const e of x.last) {
        if (e.type !== 'step-start' && e.type !== 'step-end') continue;
        if (e.kind !== 'build') continue;
        const variant = x.wf.jobs().find((j) => j.n === e.job)?.variant;
        const st = scenarioSet().scenarios.find((v) => v.id === variant)?.steps.find((y) => y.id === e.step);
        if (!st) continue;
        const owner = st.place === 'pair-desk' ? st.actors[1]! : st.actors[0]!;
        // A build of another job may start at the same desk in the same simulation step.
        const restarted = e.type === 'step-end' && x.last.some((y) => y !== e && y.type === 'step-start' && y.kind === 'build' && x.last.indexOf(y) > x.last.indexOf(e) && (y.units ?? []).includes(owner));
        if (restarted) {
          open.delete(owner);
          builds++;
          continue;
        }
        const sc = x.dir.screen(owner);
        expect(sc.mode).toBe('progress');
        if (sc.mode !== 'progress') continue;
        if (e.type === 'step-start') {
          expect(sc.pct).toBe(0);
          open.set(owner, 0);
        } else {
          expect(sc.pct).toBe(100);
          open.delete(owner);
          builds++;
        }
      }
      for (const [owner, prev] of open) {
        const sc = x.dir.screen(owner);
        if (sc.mode !== 'progress') throw new Error(`${owner} screen left progress`);
        expect(Number.isInteger(sc.pct)).toBe(true);
        expect(sc.pct).toBeGreaterThanOrEqual(prev);
        open.set(owner, sc.pct);
      }
    });
    expect(builds).toBeGreaterThanOrEqual(2);
  });

  it('the QA lamp shows pass (✓) or fail (✗) for 6 s ± one step, then off', () => {
    const h = harness();
    const on: { start: number; state: string; end?: number }[] = [];
    let prev = 'off';
    // 560 s (was 500 s): walk-in elevator boarding (CEO film review) moves the first QA pass past 500 s; assertions unchanged.
    h.run(560, (x) => {
      const s = x.dir.lamp('qa-engineer');
      if (s !== prev) {
        if (s !== 'off') on.push({ start: x.wf.time, state: s });
        else on[on.length - 1]!.end = x.wf.time;
        for (const e of x.last) if (s !== 'off' && e.type === 'step-end') expect(e.kind).toBe('test');
        prev = s;
      }
    });
    expect(on.map((o) => o.state)).toContain('pass');
    expect(on.map((o) => o.state)).toContain('fail');
    for (const o of on.filter((p) => p.end !== undefined)) expect(Math.abs(o.end! - o.start - LAMP_S)).toBeLessThanOrEqual(0.1 + 1e-6);
  });

  it('lane 0: the test step shows ✓ and "Kanıt: test çıktısı" on the chief-of-staff screen for 6 s', () => {
    const h = harness({ scripted: false, autoStart: false });
    const n = h.wf.startJob('l0-direct');
    let start = NaN;
    let end = NaN;
    h.run(200, (x) => {
      const ev = x.dir.screen('chief-of-staff').mode === 'evidence';
      if (ev && Number.isNaN(start)) {
        start = x.wf.time;
        expect(x.last.some((e) => e.type === 'step-end' && e.job === n && e.step === 'evidence')).toBe(true);
      }
      if (!ev && !Number.isNaN(start) && Number.isNaN(end)) end = x.wf.time;
    });
    expect(Number.isNaN(start)).toBe(false);
    expect(Math.abs(end - start - EVIDENCE_S)).toBeLessThanOrEqual(0.1 + 1e-6);
    expect(h.dir.lamp('chief-of-staff')).toBe('off');
  });

  it('lanes 1-3: the last verifier creates the evidence sheet and hands it to chief-of-staff before done', () => {
    for (const variant of ['l1-quick', 'l2-base', 'l3-full']) {
      const h = harness({ scripted: false, autoStart: false, outcome: () => 'pass' });
      const n = h.wf.startJob(variant);
      const s = scenarioSet().scenarios.find((v) => v.id === variant)!;
      const cev = s.steps.find((x) => x.id === 'c-ev')!;
      let created = false;
      let handed = false;
      let doneStarted = false;
      h.run(900, (x) => {
        for (const e of x.last) {
          if (e.type === 'step-start' && e.step === 'c-ev' && e.job === n) {
            const sheet = x.dir.copies().filter((c) => c.job === n && c.kind === 'evidence');
            expect(sheet.length).toBe(1);
            expect(sheet[0]!.holder).toBe(cev.actors[0]);
            created = true;
          }
          if (e.type === 'handover' && e.prop === 'evidence' && e.job === n) {
            expect(e.to).toBe('chief-of-staff');
            expect(doneStarted).toBe(false);
            handed = true;
          }
          if (e.type === 'step-start' && e.step === 'done' && e.job === n) {
            doneStarted = true;
            expect(x.dir.held('chief-of-staff').some((c) => c.job === n && c.kind === 'evidence')).toBe(true);
          }
        }
      });
      expect([variant, created, handed, doneStarted]).toEqual([variant, true, true, true]);
    }
  });
});
