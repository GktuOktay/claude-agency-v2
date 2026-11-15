// Spec 0002 AC-12 (walk legs, separation, yields), AC-13 (floor changes only in `ride`, call → call-wait
// at a landing waiting spot, riders ≤ 3, rider y = cabin y, doors open, waits ≤ 20 s), REQ-17 (frozen
// units), REQ-19 (reduced-motion leg ends): the real Movement behind the workflow port.
import { describe, it, expect } from 'vitest';
import { FLOOR_COUNT, ROBOT_SEPARATION, floorLayout, separationExempt, type FloorLayout } from '../src/sim/layout';
import { buildFloorGraph, distanceToGraph, route } from '../src/sim/nav';
import { WALK_SPEED, MAX_YIELD_S, createNavMovement, layoutsFromUnits, type NavMovement } from '../src/sim/navMovement';
import { riderLegS } from '../src/sim/elevator';
import { sortUnits } from '../src/ui/unitList';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { makeWorkflow, run, unitFloors } from './workflowHelpers';
import { createTimedMovement } from '../src/sim/movement';

const STEP = 0.1;
const never = (): boolean => false;
const make = (record = true): NavMovement => createNavMovement({ units: unitFloors(), record });
const stepUntil = (m: NavMovement, ok: () => boolean, maxS = 120, frozen: (u: string) => boolean = never): number => {
  let t = 0;
  while (!ok()) {
    if (t > maxS) throw new Error('timeout');
    m.step(STEP, frozen);
    t += STEP;
  }
  return t;
};

function sceneLayouts(): FloorLayout[] {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  const units = sortUnits(r.data.units);
  return Array.from({ length: FLOOR_COUNT }, (_, f) => floorLayout(f, units.filter((u) => u.floor === f).map((u) => ({ id: u.id, ceo: u.tier === 'ceo' }))));
}

describe('layouts', () => {
  it('the default layouts from the unit map equal the scene layouts (same desks)', () => {
    const a = layoutsFromUnits(unitFloors());
    const b = sceneLayouts();
    for (let f = 0; f < FLOOR_COUNT; f++) expect(a[f]!.desks.map((d) => [d.owner, d.x])).toEqual(b[f]!.desks.map((d) => [d.owner, d.x]));
  });
});

describe('same-floor walk (REQ-13, §7.5b)', () => {
  it('walks the route offset path at 1.2 u/s; the leg lasts length ÷ 1.2 (± one step) and stays on the graph', () => {
    const m = make();
    const g = buildFloorGraph(m.layout(2));
    m.moveTo('qa-engineer', { floor: 2, spot: 'desk:qa-engineer' });
    expect(m.phase('qa-engineer')).toBe('walk');
    expect(m.isAt('qa-engineer', { floor: 2, spot: 'desk:qa-engineer' })).toBe(false);
    stepUntil(m, () => {
      if (m.phase('qa-engineer') === 'walk') expect(distanceToGraph(g, m.position('qa-engineer'))).toBeLessThanOrEqual(0.3 + 1e-9);
      return m.isAt('qa-engineer', { floor: 2, spot: 'desk:qa-engineer' });
    });
    const leg = m.legLog().find((l) => l.unit === 'qa-engineer')!;
    const r = route(g, 'home:qa-engineer', 'seat:qa-engineer')!;
    expect(leg.length).toBeCloseTo(r.length, 6);
    expect(WALK_SPEED).toBe(1.2);
    expect(Math.abs(leg.end - leg.start - (leg.length / WALK_SPEED + leg.yields))).toBeLessThanOrEqual(STEP + 1e-6);
  });

  it('pair-desk: the second engineer takes the pair spot; signing desk: CEO at its seat, visitor at a signing spot', () => {
    const m = make();
    m.moveTo('dotnet-engineer', { floor: 1, spot: 'desk:react-engineer' });
    m.moveTo('react-engineer', { floor: 1, spot: 'desk:react-engineer' });
    stepUntil(m, () => m.isAt('dotnet-engineer', { floor: 1, spot: 'desk:react-engineer' }) && m.isAt('react-engineer', { floor: 1, spot: 'desk:react-engineer' }));
    expect(m.nodeOf('react-engineer')).toBe('seat:react-engineer');
    expect(m.nodeOf('dotnet-engineer')).toBe('pair:react-engineer');
    m.moveTo('ceo', { floor: 5, spot: 'signing-desk' });
    m.moveTo('chief-of-staff', { floor: 5, spot: 'signing-desk' });
    stepUntil(m, () => m.isAt('ceo', { floor: 5, spot: 'signing-desk' }) && m.isAt('chief-of-staff', { floor: 5, spot: 'signing-desk' }));
    expect(m.nodeOf('ceo')).toBe('seat:ceo');
    expect(m.nodeOf('chief-of-staff')).toMatch(/^signing:/);
  });

  it('a frozen walker holds; released, it walks on', () => {
    const m = make();
    m.moveTo('qa-engineer', { floor: 2, spot: 'desk:qa-engineer' });
    m.step(STEP, never);
    const p = m.position('qa-engineer');
    for (let i = 0; i < 20; i++) m.step(STEP, (u) => u === 'qa-engineer');
    expect(m.position('qa-engineer')).toEqual(p);
    stepUntil(m, () => m.isAt('qa-engineer', { floor: 2, spot: 'desk:qa-engineer' }));
  });
});

describe('floor change (REQ-14, AC-13)', () => {
  it('walk → call → call-wait at a landing waiting spot → ride → walk; floor changes only in ride', () => {
    const m = make();
    const seen: string[] = [];
    let floor = m.floorOf('qa-engineer');
    m.moveTo('qa-engineer', { floor: 3, spot: 'meeting-room' });
    stepUntil(m, () => {
      const ph = m.phase('qa-engineer');
      if (seen[seen.length - 1] !== ph) seen.push(ph);
      if (ph === 'call' || ph === 'call-wait') expect(m.nodeOf('qa-engineer')).toMatch(/^wait:/);
      if (ph === 'ride') {
        expect(Math.abs(m.position('qa-engineer').y - m.elevator.cabinY())).toBeLessThanOrEqual(0.05);
        expect(m.floorOf('qa-engineer')).toBe(3);
      }
      const p = m.position('qa-engineer');
      if (ph !== 'ride' && m.floorOf('qa-engineer') !== floor) {
        expect(seen[seen.length - 2]).toBe('ride');
        floor = m.floorOf('qa-engineer');
      }
      expect(p.floor).toBe(ph === 'ride' ? p.floor : m.floorOf('qa-engineer'));
      return m.isAt('qa-engineer', { floor: 3, spot: 'meeting-room' });
    });
    expect(seen).toEqual(['walk', 'call', 'call-wait', 'ride', 'walk', 'still']);
    expect(m.nodeOf('qa-engineer')).toMatch(/^mseat:/);
  });

  // CEO film review: the rider steps out once the exit doors are fully open (riderLegS), not after they have closed.
  it('the ride leg follows the §7.5b formula (cabin-arrival wait + doors + travel + exit doors fully open)', () => {
    const m = make();
    m.moveTo('marketing', { floor: 4, spot: 'home:chief-of-staff' });
    stepUntil(m, () => m.isAt('marketing', { floor: 4, spot: 'home:chief-of-staff' }));
    const ride = m.legLog().find((l) => l.unit === 'marketing' && l.kind === 'ride')!;
    expect(Math.abs(ride.end - ride.start - (ride.waited! + riderLegS(4)))).toBeLessThanOrEqual(2 * STEP + 1e-6);
  });

  it('a frozen caller in call-wait does not board; on release its call goes to the end of the queue', () => {
    const m = make();
    m.moveTo('marketing', { floor: 5, spot: 'home:ceo' });
    m.moveTo('tech-comms', { floor: 2, spot: 'home:qa-engineer' });
    stepUntil(m, () => m.phase('marketing') === 'call-wait');
    let frozen = true;
    const fz = (u: string): boolean => frozen && u === 'marketing';
    for (let i = 0; i < 100; i++) {
      m.step(STEP, fz);
      expect(m.phase('marketing')).toBe('call-wait');
    }
    expect(m.elevator.status('marketing')).toBe('held');
    frozen = false;
    m.step(STEP, fz);
    const q = m.elevator.queue().map((c) => c.unit);
    expect(q[q.length - 1]).toBe('marketing');
    stepUntil(m, () => m.isAt('marketing', { floor: 5, spot: 'home:ceo' }));
  });

  it('a frozen rider keeps riding (the cabin runs on)', () => {
    const m = make();
    m.moveTo('marketing', { floor: 5, spot: 'home:ceo' });
    stepUntil(m, () => m.phase('marketing') === 'ride');
    stepUntil(m, () => m.phase('marketing') !== 'ride', 10, (u) => u === 'marketing');
    expect(m.floorOf('marketing')).toBe(5);
  });
});

describe('reduced motion (REQ-19)', () => {
  it('the rendered position is the current leg start until the leg ends, then the leg end', () => {
    const m = make();
    m.moveTo('marketing', { floor: 2, spot: 'home:qa-engineer' });
    const start = m.position('marketing');
    let lastLeg = m.legIndex('marketing');
    let legStart = start;
    stepUntil(m, () => {
      const idx = m.legIndex('marketing');
      if (idx !== lastLeg) {
        legStart = m.renderPosition('marketing', true);
        lastLeg = idx;
      }
      expect(m.renderPosition('marketing', true)).toEqual(legStart);
      if (m.phase('marketing') === 'ride' || m.phase('marketing') === 'call-wait') expect(m.renderPosition('marketing', true).floor).toBe(0);
      return m.isAt('marketing', { floor: 2, spot: 'home:qa-engineer' });
    });
    expect(m.renderPosition('marketing', true)).toEqual(m.position('marketing'));
  });
});

describe('dt 0 (global pause)', () => {
  it('stepping with dt 0 changes nothing', () => {
    const m = make(false);
    m.moveTo('marketing', { floor: 3, spot: 'meeting-room' });
    for (let i = 0; i < 37; i++) m.step(STEP, never);
    const s = JSON.stringify(m.snapshot());
    for (let i = 0; i < 20; i++) m.step(0, never);
    expect(JSON.stringify(m.snapshot())).toBe(s);
  });
});

describe('workflow on the real movement (AC-12, AC-13)', () => {
  it('the workflow accepts the nav movement through the Movement port; the timed stand-in stays injectable', () => {
    const nav = make();
    expect(makeWorkflow({ movement: nav }).movement).toBe(nav);
    const timed = createTimedMovement(unitFloors());
    expect(makeWorkflow({ movement: timed }).movement).toBe(timed);
  });

  it('600 s at high: on the graph, separated, yields ≤ 6 s, walk legs = length ÷ 1.2 + yields', () => {
    const wf = makeWorkflow({ seed: 0x2002, movement: make() });
    const m = wf.movement as NavMovement;
    const graphs = Array.from({ length: FLOOR_COUNT }, (_, f) => buildFloorGraph(m.layout(f)));
    const units = [...unitFloors().keys()];
    let worstGraph = 0;
    const violations: string[] = [];
    run(wf, 600, () => {
      const pos = units.map((u) => ({ u, p: m.position(u), ph: m.phase(u) }));
      for (const a of pos) if (a.ph === 'walk') worstGraph = Math.max(worstGraph, distanceToGraph(graphs[a.p.floor]!, a.p));
      for (let i = 0; i < pos.length; i++)
        for (let j = i + 1; j < pos.length; j++) {
          const a = pos[i]!;
          const b = pos[j]!;
          if (a.ph === 'ride' || b.ph === 'ride' || a.p.floor !== b.p.floor) continue;
          if (a.ph !== 'walk' && b.ph !== 'walk') continue;
          const d = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z);
          if (d < ROBOT_SEPARATION - 1e-9 && !separationExempt(m.layout(a.p.floor), a.p, b.p)) violations.push(`${wf.time.toFixed(1)} ${a.u}/${b.u} ${d.toFixed(3)} ${a.ph}@${m.nodeOf(a.u)} ${b.ph}@${m.nodeOf(b.u)} ${a.p.x.toFixed(2)},${a.p.z.toFixed(2)} ${b.p.x.toFixed(2)},${b.p.z.toFixed(2)}`);
        }
    });
    expect(worstGraph).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(violations).toEqual([]);
    const walks = m.legLog().filter((l) => l.kind === 'walk');
    expect(walks.length).toBeGreaterThan(50);
    for (const l of walks) {
      expect(l.maxYield).toBeLessThanOrEqual(MAX_YIELD_S + 1e-9);
      expect(Math.abs(l.end - l.start - (l.length / WALK_SPEED + l.yields))).toBeLessThanOrEqual(STEP + 1e-6);
    }
  });

  it('1200 s at high: floor changes only in ride, riders ≤ 3, doors open at boarding and exit, no call waits over 20 s', () => {
    const wf = makeWorkflow({ seed: 0x2002, movement: make() });
    const m = wf.movement as NavMovement;
    const units = [...unitFloors().keys()];
    const last = new Map(units.map((u) => [u, { floor: m.floorOf(u), ph: m.phase(u) }]));
    let rides = 0;
    run(wf, 1200, () => {
      expect(m.elevator.state().riders.length).toBeLessThanOrEqual(3);
      for (const u of units) {
        const now = { floor: m.position(u).floor, ph: m.phase(u) };
        const before = last.get(u)!;
        if (now.ph !== 'ride' && before.ph !== 'ride') expect(now.floor).toBe(before.floor);
        if (now.ph === 'ride') expect(Math.abs(m.position(u).y - m.elevator.cabinY())).toBeLessThanOrEqual(0.05);
        if (now.ph === 'ride' && before.ph !== 'ride') {
          rides++;
          expect(before.ph).toBe('call-wait');
        }
        last.set(u, now);
      }
    });
    expect(rides).toBeGreaterThan(10);
    const log = m.elevator.log();
    for (const e of log) if (e.type === 'board' || e.type === 'exit') expect(e.doors).toBe(1);
    const waits = log.filter((e) => e.type === 'ride-start').map((e) => e.waited!);
    expect(Math.max(...waits)).toBeLessThanOrEqual(20);
  });
});
