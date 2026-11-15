// Campus breaks (KARARLAR rev 31): the real Movement routes into the amenity wing over the sky-bridge on
// wing levels 0-2 and through the staff elevator from other floors; tower routes are unchanged.
import { describe, it, expect } from 'vitest';
import { AMENITY_SPOTS, HALF_WIDTH, WING_EAST_X } from '../src/sim/layout';
import { createNavMovement, type NavMovement } from '../src/sim/navMovement';
import { unitFloors } from './workflowHelpers';

const STEP = 0.1;
const never = (): boolean => false;
const make = (): NavMovement => createNavMovement({ units: unitFloors(), record: true });
const spot = (id: string) => {
  const s = AMENITY_SPOTS.find((a) => a.id === id);
  if (!s) throw new Error(id);
  return s;
};

function walkTo(m: NavMovement, unit: string, floor: number, id: string, maxS = 200): { t: number; minX: number; floors: Set<number> } {
  m.moveTo(unit, { floor, spot: id });
  let t = 0;
  let minX = Infinity;
  const floors = new Set<number>();
  while (!m.isAt(unit, { floor, spot: id })) {
    if (t > maxS) throw new Error(`timeout ${unit} → ${id}`);
    m.step(STEP, never);
    t += STEP;
    const p = m.position(unit);
    minX = Math.min(minX, p.x);
    floors.add(p.floor);
  }
  return { t, minX, floors };
}

describe('nav movement into the campus wing', () => {
  it('a robot on a wing level walks over its sky-bridge to an amenity spot (no ride)', () => {
    const m = make();
    const s = spot('amenity:treadmill:0');
    const r = walkTo(m, 'react-engineer', s.floor, s.id); // floor 1 = gym level
    expect(r.minX).toBeLessThan(WING_EAST_X);
    expect(r.floors).toEqual(new Set([1]));
    expect(m.legLog().filter((l) => l.unit === 'react-engineer' && l.kind === 'ride')).toHaveLength(0);
    const p = m.position('react-engineer');
    expect(p.x).toBeCloseTo(s.x, 6);
    expect(p.z).toBeCloseTo(s.z, 6);
  });

  it('a robot from another floor rides the staff elevator, then crosses the bridge', () => {
    const m = make();
    const s = spot('amenity:lab-bench:0'); // floor 2
    const r = walkTo(m, 'scout', s.floor, s.id); // scout lives on floor 3
    const rides = m.legLog().filter((l) => l.unit === 'scout' && l.kind === 'ride');
    expect(rides).toHaveLength(1);
    expect(rides[0]!.floor).toBe(3);
    expect(r.minX).toBeLessThan(-HALF_WIDTH);
    expect(m.floorOf('scout')).toBe(2);
  });

  it('a robot in the wing is re-pathed back to its desk (interrupt) and gets there', () => {
    const m = make();
    const s = spot('amenity:pod:0');
    walkTo(m, 'scout', s.floor, s.id);
    const r = walkTo(m, 'scout', 3, 'desk:scout');
    expect(r.floors.has(3)).toBe(true);
    expect(m.isAt('scout', { floor: 3, spot: 'desk:scout' })).toBe(true);
  });

  it('every amenity spot is reachable from the home of a robot on that level', () => {
    const homes: Record<number, string> = { 0: 'marketing', 1: 'dotnet-engineer', 2: 'appsec' };
    for (const s of AMENITY_SPOTS) {
      const m = make();
      const u = homes[s.floor]!;
      walkTo(m, u, s.floor, s.id, 120);
      expect(m.nodeOf(u)).toBe(s.id);
    }
  });
});
