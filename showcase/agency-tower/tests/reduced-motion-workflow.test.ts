// Spec 0002 AC-16 (REQ-19; 0001 REQ-20 as amended in 0002 §3.0): reduced motion changes rendering only.
// App-like stack: sim runtime (clock, engine with the default nav movement, strip), the ambient cycle with
// campus breaks on the engine's nav movement (as in sceneApp), the director and the whiteboard, 0.1 s frames.
import { describe, expect, it } from 'vitest';
import { bindReducedMotion } from '../src/app/motion';
import { framePose } from '../src/app/frameUpdate';
import { createSimRuntime, type SimRuntime } from '../src/app/simRuntime';
import { createActivitySim, type ActivitySim, type SimEvent } from '../src/scene/activity';
import { createAnchors, createDirector, type Director } from '../src/scene/director';
import { createWhiteboard, type BoardState } from '../src/scene/whiteboard';
import { floorY } from '../src/sim/layout';
import { isNavMovement, type NavMovement } from '../src/sim/navMovement';
import type { WfEvent } from '../src/sim/workflow';
import { towerLayouts } from './directorHelpers';
import { scenarioSet, unitFloors } from './workflowHelpers';

const SEED = 20261113;
const TITLES = ['Kayıt formu', 'Fatura ekranı', 'Rapor sayfası', 'Arama kutusu', 'Profil ayarları'];
const units = unitFloors();
const ids = [...units.keys()];

interface Stack {
  rt: SimRuntime;
  nav: NavMovement;
  sim: ActivitySim;
  dir: Director;
  board: ReturnType<typeof createWhiteboard>;
  wfEvents: WfEvent[];
  ambEvents: SimEvent[];
  /** Media query state; `set` fires the live change. */
  mq: { matches: boolean; set(on: boolean): void };
  frame(): SimEvent[];
}

function stack(reducedAtStart: boolean): Stack {
  const layouts = towerLayouts();
  const anchors = createAnchors(layouts);
  const specs = ids.map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  const mq = {
    matches: reducedAtStart,
    set(on: boolean) {
      mq.matches = on;
      for (const l of listeners) l({ matches: on });
    },
  };
  const board = createWhiteboard(scenarioSet());
  const wfEvents: WfEvent[] = [];
  let dir: Director | null = null;
  let navRef: NavMovement | null = null;
  const rt = createSimRuntime({
    scenarios: scenarioSet(),
    units,
    titles: TITLES,
    maxJobs: 3,
    isNarrow: () => false,
    reducedMotion: () => mq.matches,
    rideTo: () => undefined,
    onStep: (dt, events) => {
      wfEvents.push(...events);
      dir?.ingest(events);
      board.ingest(events);
      dir?.update(dt, rt.workflow);
    },
  });
  const mv = rt.workflow.movement;
  if (!isNavMovement(mv)) throw new Error('nav movement expected (the default)');
  navRef = mv;
  const nav = navRef;
  const sim = createActivitySim(specs, SEED, {
    campus: { movement: nav, floors: units, paused: () => rt.clock.paused, canRide: () => nav.elevator.queue().length === 0, maxAway: 0 },
  });
  dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient: sim, position: (u) => nav.renderPosition(u, mq.matches), still: () => mq.matches });
  bindReducedMotion(
    { get matches() { return mq.matches; }, addEventListener: (_t, cb) => listeners.push(cb) },
    { rig: { reducedMotion: false }, sim, dayNight: { setReducedMotion: () => undefined }, screens: [] },
  );
  const ambEvents: SimEvent[] = [];
  const s: Stack = {
    rt, nav, sim, dir, board, wfEvents, ambEvents, mq,
    frame() {
      sim.step(100);
      rt.frame(100);
      const ev = sim.drainEvents();
      ambEvents.push(...ev);
      return ev;
    },
  };
  return s;
}

const trace = (s: Stack): string =>
  JSON.stringify({ wf: s.wfEvents, wfTrace: s.rt.workflow.trace(), amb: s.ambEvents, t: s.sim.time, wt: s.rt.workflow.time, nav: s.nav.snapshot(), legs: s.nav.legLog() });

describe('AC-16: the simulation trace is identical with and without reduced motion', () => {
  it('engine plus ambient (with campus breaks), same seed, 620 s: byte-identical, on from load and on live change', () => {
    const normal = stack(false);
    const reduced = stack(true);
    const live = stack(false);
    // 620 s: the first job finishes at about 574 s with the real nav movement.
    for (let i = 0; i < 6200; i++) {
      if (i === 2000) live.mq.set(true);
      if (i === 4500) live.mq.set(false);
      normal.frame();
      reduced.frame();
      live.frame();
    }
    expect(normal.wfEvents.some((e) => e.type === 'job-done')).toBe(true);
    expect(normal.ambEvents.length).toBeGreaterThan(50);
    expect(trace(reduced)).toBe(trace(normal));
    expect(trace(live)).toBe(trace(normal));
  });
});

describe('AC-16: rendering under reduced motion', () => {
  it('rendered positions change only when a movement leg (nav or ambient walk) ends or a robot changes hands; never a walk or wave pose', () => {
    const s = stack(true);
    const pos = new Map<string, { x: number; y: number; z: number }>();
    const legs = new Map<string, number>();
    const reserved = new Map<string, boolean>();
    s.sim.select('scout');
    let cuts = 0;
    let rides = 0;
    for (let i = 0; i < 3000; i++) {
      const ev = s.frame();
      const ended = new Set(ev.filter((e) => e.from === 'walk').map((e) => e.id));
      for (const u of ids) {
        const v = s.dir.view(u);
        const p = { x: v.x, y: v.y, z: v.z };
        const leg = s.nav.legIndex(u);
        const res = s.sim.isReserved(u);
        const prev = pos.get(u);
        if (prev) {
          const moved = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) > 1e-9;
          if (moved) {
            cuts++;
            const legChanged = legs.get(u) !== leg;
            const handOff = reserved.get(u) !== res;
            expect({ u, t: s.sim.time, cut: legChanged || ended.has(u) || handOff }).toEqual({ u, t: s.sim.time, cut: true });
          }
        }
        if (s.nav.phase(u) === 'ride') rides++;
        pos.set(u, p);
        legs.set(u, leg);
        reserved.set(u, res);
        const amb = s.sim.get(u);
        expect(amb.kind).not.toBe('walk');
        expect(amb.kind).not.toBe('wave');
        // A directed step-walk keeps the 'walk' pose name, drawn at phase 0: the neutral standing limbs (pose.ts).
        const fp = framePose(false, amb.pose ?? v.pose, v.walkPhase, i / 10, true, u.length);
        expect(fp.kind).not.toBe('wave');
        expect(fp.walkPhase).toBe(0);
        expect(fp.timeSec).toBe(0);
      }
    }
    expect(cuts).toBeGreaterThan(20);
    expect(rides).toBeGreaterThan(0);
    expect(s.sim.get('scout').kind).toBe('raise');
  });

  it('a rider is rendered at the origin landing until its ride ends, then at the destination landing', () => {
    const s = stack(true);
    let checked = 0;
    const rideY = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      s.frame();
      for (const u of ids) {
        const ph = s.nav.phase(u);
        const p = s.nav.renderPosition(u, true);
        if (ph === 'ride') {
          const y0 = rideY.get(u) ?? p.y;
          rideY.set(u, y0);
          expect(p.y).toBe(y0);
          checked++;
        } else if (rideY.has(u)) {
          expect(p.y).not.toBe(rideY.get(u)); // cut to the destination landing when the ride ends
          rideY.delete(u);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('live change: a robot mid-leg is rendered at that leg start until the leg ends, without reload', () => {
    const s = stack(false);
    let u: string | null = null;
    for (let i = 0; i < 6000 && !u; i++) {
      s.frame();
      u = ids.find((id) => s.nav.phase(id) === 'walk' && Math.hypot(s.nav.position(id).x - s.nav.renderPosition(id, true).x, s.nav.position(id).z - s.nav.renderPosition(id, true).z) > 0.5) ?? null;
    }
    expect(u).not.toBeNull();
    const w = u!;
    const leg = s.nav.legIndex(w);
    const start = s.nav.renderPosition(w, true);
    s.mq.set(true);
    let held = 0;
    // As in the app: the frame steps, then the robot is drawn from the director's view.
    for (let i = 0; i < 600; i++) {
      s.frame();
      if (s.nav.legIndex(w) !== leg) break;
      const v = s.dir.view(w);
      expect(v.x).toBeCloseTo(start.x, 6);
      expect(v.z).toBeCloseTo(start.z, 6);
      held++;
    }
    expect(held).toBeGreaterThan(0);
    expect(s.nav.legIndex(w)).not.toBe(leg);
  });

  it('whiteboard sections change in whole sections; progress values (screen bar and card) are multiples of 10; step lists expanded', () => {
    const s = stack(true);
    const pcts = new Set<number>();
    let cards = 0;
    let prev: BoardState | null = null;
    for (let i = 0; i < 6200; i++) {
      s.frame();
      const b = s.board.state(s.rt.workflow, true);
      expect(Number.isInteger(b.filled)).toBe(true);
      if (prev) expect(Number.isInteger(b.filled - prev.filled)).toBe(true);
      prev = b;
      for (const u of s.dir.screenUnits) {
        const sv = s.dir.screen(u);
        if (sv.mode === 'progress') {
          expect(sv.pct % 10).toBe(0);
          pcts.add(sv.pct);
        }
      }
      for (const u of ids) {
        const st = s.rt.workflow.unitState(u);
        if (st?.state !== 'build' || st.progress === undefined) continue; // "Derliyor: %<p>"
        const m = /%(\d+)/.exec(s.rt.cardLinesFor(u, 'idle').now);
        expect(m).not.toBeNull();
        expect(Number(m![1]) % 10).toBe(0);
        cards++;
      }
    }
    expect(pcts.size).toBeGreaterThan(1);
    expect(cards).toBeGreaterThan(0);
    const toggles = [...s.rt.strip.element.querySelectorAll('.job-steps-toggle')];
    expect(toggles.length).toBeGreaterThan(0);
    for (const t of toggles) expect(t.getAttribute('aria-expanded')).toBe('true');
  });
});
