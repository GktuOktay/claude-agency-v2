// Breaks follow the office schedule; social areas for everyone; Ar-Ge is the star area (KARARLAR Rev 35 P3).
import { describe, it, expect } from 'vitest';
import { BREAK_QUEUE_MAX, createActivitySim, SOCIAL_MAX_AWAY, type ActivitySim, type ActivitySpec } from '../src/scene/activity';
import { LAB_FANS as CURIOUS_UNITS } from '../src/scene/breaks';
import { createAnchors } from '../src/scene/director';
import { AMENITY_SPOTS, floorY } from '../src/sim/layout';
import { createNavMovement, type NavMovement } from '../src/sim/navMovement';
import { breakPeriodAt, periodAt, type OfficePeriod } from '../src/sim/schedule';
import { towerLayouts } from './directorHelpers';
import { unitFloors } from './workflowHelpers';

const SEED = 20261113;
const never = (): boolean => false;
const ids = [...unitFloors().keys()];
const spotById = new Map(AMENITY_SPOTS.map((s) => [s.id, s]));

function specs(): ActivitySpec[] {
  const anchors = createAnchors(towerLayouts());
  return ids.map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
}

interface Start {
  unit: string;
  spot: string;
  t: number;
  period: OfficePeriod;
}

interface Run {
  nav: NavMovement;
  sim: ActivitySim;
  starts: Start[];
  /** Seconds spent per period, and robot-seconds idle at home per period. */
  seconds: Record<OfficePeriod, number>;
  idle: Record<OfficePeriod, number>;
  /** Most robots at the cafeteria / terrace at once during lunch. */
  lunchPeak: number;
  floorCoffee: Record<OfficePeriod, number>;
}

function run(seed: number, seconds: number): Run {
  const nav = createNavMovement({ units: unitFloors(), record: true });
  const clock = { t: 0 };
  const sim = createActivitySim(specs(), seed, {
    campus: {
      movement: nav,
      floors: unitFloors(),
      period: () => breakPeriodAt(clock.t),
      canRide: () => nav.elevator.queue().length < BREAK_QUEUE_MAX,
      exclude: new Set<string>(),
      maxAway: SOCIAL_MAX_AWAY,
    },
  });
  const zero = (): Record<OfficePeriod, number> => ({ work: 0, coffee: 0, lunch: 0, tea: 0, after: 0 });
  const out: Run = { nav, sim, starts: [], seconds: zero(), idle: zero(), lunchPeak: 0, floorCoffee: zero() };
  const on = new Map<string, string | null>();
  for (let i = 0; i < seconds * 10; i++) {
    sim.step(100);
    nav.step(0.1, never);
    clock.t += 0.1;
    // Break starts are classed by the period the break logic follows (robots leave BREAK_LEAD_S early);
    // the lunch crowd is measured in the office's own lunch slot.
    const p = breakPeriodAt(clock.t);
    out.seconds[p] += 0.1;
    let atLunch = 0;
    for (const id of ids) {
      const b = sim.onBreak(id);
      if (b && on.get(id) !== b.id) out.starts.push({ unit: id, spot: b.id, t: clock.t, period: p });
      on.set(id, b?.id ?? null);
      const v = sim.get(id);
      // Idle at home or walking (home from a desk or a break); not working at a desk, not at an amenity.
      if (v.kind === 'idle' || v.kind === 'walk') out.idle[p] += 0.1;
      if (b && v.kind === 'coffee' && (b.zone === 'yemekhane' || b.zone === 'terrace')) atLunch++;
    }
    for (const e of sim.drainEvents()) if (e.to === 'coffee' && !sim.onBreak(e.id)) out.floorCoffee[p]++;
    if (periodAt(clock.t) === 'lunch') out.lunchPeak = Math.max(out.lunchPeak, atLunch);
  }
  return out;
}

describe('breaks follow the office schedule', () => {
  const r = run(SEED, 1200);
  const rate = (p: OfficePeriod): number => r.starts.filter((s) => s.period === p).length / Math.max(r.seconds[p], 1e-9);

  it('coffee and tea slots: many robots take breaks; outside the slots breaks stay rare', () => {
    const slotStarts = r.starts.filter((s) => s.period === 'coffee' || s.period === 'tea');
    const slots = Math.round((r.seconds.coffee + r.seconds.tea) / 40); // 40 s per slot
    expect(slots).toBeGreaterThanOrEqual(5);
    expect(slotStarts.length / slots).toBeGreaterThanOrEqual(6);
    expect(rate('coffee')).toBeGreaterThan(4 * rate('work'));
    expect(rate('tea')).toBeGreaterThan(4 * rate('work'));
    const venues = new Set(slotStarts.map((s) => spotById.get(s.spot)!.zone));
    for (const z of ['gym', 'game-room', 'snack-bar']) expect(venues).toContain(z);
    // The floor coffee stations take part of the slot breaks too.
    expect(r.floorCoffee.coffee + r.floorCoffee.tea).toBeGreaterThan(0);
  });

  it('lunch: most go to the cafeteria (yemekhane) and the outdoor terrace', () => {
    const lunch = r.starts.filter((s) => s.period === 'lunch');
    expect(lunch.length).toBeGreaterThanOrEqual(10);
    const eat = lunch.filter((s) => ['yemekhane', 'terrace'].includes(spotById.get(s.spot)!.zone)).length;
    expect(eat / lunch.length).toBeGreaterThan(0.7);
    expect(lunch.some((s) => spotById.get(s.spot)!.zone === 'terrace')).toBe(true);
    expect(r.lunchPeak).toBeGreaterThanOrEqual(8);
    // The cafeteria is only for lunch.
    for (const s of r.starts) if (spotById.get(s.spot)!.zone === 'yemekhane') expect(s.period).toBe('lunch');
  });

  it('after hours: no campus break starts; most robots idle at home or walk home', () => {
    expect(r.starts.filter((s) => s.period === 'after').length).toBe(0);
    expect(r.idle.after / (r.seconds.after * ids.length)).toBeGreaterThan(0.75);
    expect(r.idle.after / (r.seconds.after * ids.length)).toBeGreaterThan(r.idle.work / (r.seconds.work * ids.length));
  });

  it('social areas are for everyone: the CEO and units on floors 3–5 reach the wing', () => {
    expect(r.starts.some((s) => s.unit === 'ceo')).toBe(true);
    const upper = new Set(r.starts.filter((s) => (unitFloors().get(s.unit) ?? 0) >= 3).map((s) => s.unit));
    expect(upper.size).toBeGreaterThanOrEqual(5);
    const riders = new Set(r.nav.legLog().filter((l) => l.kind === 'ride').map((l) => l.unit));
    for (const u of upper) expect(riders).toContain(u);
  });

  it('Ar-Ge is the star area: curious units visit it on breaks, anyone may at coffee/tea', () => {
    const lab = r.starts.filter((s) => spotById.get(s.spot)!.zone === 'rnd-lab');
    expect(lab.length).toBeGreaterThanOrEqual(8);
    expect(lab.filter((s) => CURIOUS_UNITS.has(s.unit)).length).toBeGreaterThanOrEqual(4);
    for (const s of lab) if (!CURIOUS_UNITS.has(s.unit)) expect(['coffee', 'tea']).toContain(s.period);
    for (const u of ['scout', 'product-manager', 'software-architect', 'react-engineer', 'dotnet-engineer', 'polyglot-engineer']) expect(CURIOUS_UNITS.has(u)).toBe(true);
    // Lab spots are read from AMENITY_SPOTS (zone rnd-lab), whatever their count.
    const labSpots = AMENITY_SPOTS.filter((s) => s.zone === 'rnd-lab').map((s) => s.id);
    for (const s of lab) expect(labSpots).toContain(s.spot);
  });

  it('the same seed gives the same breaks and the same elevator legs', () => {
    const a = run(SEED + 3, 400);
    const b = run(SEED + 3, 400);
    expect(JSON.stringify(a.starts)).toBe(JSON.stringify(b.starts));
    expect(JSON.stringify(a.nav.legLog())).toBe(JSON.stringify(b.nav.legLog()));
  });
});
