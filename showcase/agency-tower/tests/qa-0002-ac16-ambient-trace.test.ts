// QA reproduction (spec 0002 AC-16): "With the media query emulated: the simulation trace (engine and
// ambient) is byte-identical to the trace without it (same seed)". The app applies reduced motion to the
// ambient sim through bindReducedMotion -> sim.setStatic(true) (src/app/motion.ts).
import { describe, it, expect } from 'vitest';
import { createActivitySim } from '../src/scene/activity';
import { bindReducedMotion } from '../src/app/motion';
import { buildTower } from '../src/scene/model';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

function ambientTrace(reduced: boolean): string {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  const model = buildTower(r.data);
  const sim = createActivitySim(
    model.robots.map((x) => ({ id: x.unit.id, home: x.homePoint, work: x.workPoint, coffee: x.coffeePoint })),
    20261113,
  );
  bindReducedMotion(
    { matches: reduced, addEventListener: () => undefined },
    { rig: { reducedMotion: false }, sim, dayNight: { setReducedMotion: () => undefined }, screens: [] },
  );
  const events: unknown[] = [];
  for (let i = 0; i < 1200; i++) {
    sim.step(100);
    events.push(...sim.drainEvents());
  }
  return JSON.stringify({ time: sim.time, events });
}

describe('QA 0002 AC-16: ambient trace under reduced motion', () => {
  it('the ambient simulation trace is byte-identical with and without the media query (same seed)', () => {
    expect(ambientTrace(true)).toBe(ambientTrace(false));
  });
});
