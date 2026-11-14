// QA round 2B reproduction: the floor-0 green dressing (sit-stand desks) must not overlap the lobby staff
// props (security desk, turnstile cabinets). flex-office.test.ts checks dressing vs the robot layout only;
// staff-scene.test.ts checks the staff props vs their own footprints only. Nothing compared the two.
import { describe, it, expect } from 'vitest';
import { dressingFootprints } from '../src/scene/flexOffice';
import { LOBBY_FLOOR, lobbyPropFootprints } from '../src/sim/layout';

interface R {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const overlaps = (a: R, b: R): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('QA r2B: lobby dressing vs security desk and turnstile', () => {
  it('no floor-0 dressing footprint overlaps a lobby staff prop footprint', () => {
    const hits: string[] = [];
    for (const d of dressingFootprints(LOBBY_FLOOR))
      for (const p of lobbyPropFootprints()) if (overlaps(d, p)) hits.push(`${d.name} [${d.x0.toFixed(2)}..${d.x1.toFixed(2)} x ${d.z0.toFixed(2)}..${d.z1.toFixed(2)}] / ${p.name} [${p.x0.toFixed(2)}..${p.x1.toFixed(2)} x ${p.z0.toFixed(2)}..${p.z1.toFixed(2)}]`);
    expect(hits).toEqual([]);
  });
});
