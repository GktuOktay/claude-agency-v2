// Shared harness for the Rev 39 occupancy tests: the app wiring at `high` (engine with nav + staff elevator,
// ambient with schedule breaks for everyone, director), stepped in 0.1 s steps like the live page.
import { maxJobsFor } from '../src/app/params';
import { appCampusOptions, createActivitySim, type ActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import { AMENITY_SPOTS, floorY, type AmenityZoneId } from '../src/sim/layout';
import type { NavMovement } from '../src/sim/navMovement';
import { breakPeriodAt, periodAt } from '../src/sim/schedule';
import { MASTER_SEED } from '../src/sim/workflow';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

export const ZONES: readonly AmenityZoneId[] = [...new Set(AMENITY_SPOTS.map((s) => s.zone))];

export interface DayStats {
  /** Work-period samples (0.1 s each). */
  workSamples: number;
  /** Per zone: work samples with at least one robot staying there. */
  occupied: Map<AmenityZoneId, number>;
  /** Work samples with at least two robots staying in the R&D lab. */
  lab2: number;
  /** Lunch samples and lunch samples with at least one robot in the cafeteria. */
  lunchSamples: number;
  lunchCafeteria: number;
  jobsDone: number;
  /** Diagnostics over work samples: robot-samples going to / staying at a zone, idle at home, queued calls. */
  going: number;
  staying: number;
  idleHome: number;
  queued: number;
}

export interface DayOptions {
  seconds: number;
  /** Ambient seed (the app uses 20261113). */
  seed?: number;
  /** false: the Rev 38 behaviour (no occupancy director). */
  occupancy?: boolean;
  /** Diagnostics: every 5 s "<t><period initial><robots in the lab>". */
  trace?: string[];
}

export function runOfficeDay(o: DayOptions): DayStats & { ambient: ActivitySim } {
  const layouts = towerLayouts();
  const anchors = createAnchors(layouts);
  const units = unitFloors();
  const wf = makeWorkflow({ maxJobs: maxJobsFor('high'), seed: MASTER_SEED, record: false });
  const nav = wf.movement as NavMovement;
  const specs = [...units.keys()].map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
  let t = 0;
  const ambient = createActivitySim(specs, o.seed ?? 20261113, {
    campus: appCampusOptions({ movement: nav, floors: units, period: () => breakPeriodAt(t), periodAhead: (s) => breakPeriodAt(t + s), queued: () => nav.elevator.queue().length, occupancy: o.occupancy ?? true }),
  });
  const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
  const stats: DayStats = { workSamples: 0, occupied: new Map(ZONES.map((z) => [z, 0])), lab2: 0, lunchSamples: 0, lunchCafeteria: 0, jobsDone: 0, going: 0, staying: 0, idleHome: 0, queued: 0 };
  const n = Math.round(o.seconds * 10);
  for (let i = 0; i < n; i++) {
    ambient.step(100);
    wf.step(0.1);
    t += 0.1;
    const ev = wf.drainEvents();
    stats.jobsDone += ev.filter((e) => e.type === 'job-done').length;
    dir.ingest(ev);
    dir.update(0.1, wf);
    const p = periodAt(t);
    const count = new Map<AmenityZoneId, number>();
    for (const id of units.keys()) {
      const s = ambient.onBreak(id);
      if (s && ambient.breakPhase(id) === 'stay' && !ambient.isReserved(id)) count.set(s.zone, (count.get(s.zone) ?? 0) + 1);
    }
    if (o.trace && i % 50 === 0) o.trace.push(`${Math.round(t)}${p[0]}${count.get('rnd-lab') ?? 0}`);
    if (p === 'work') {
      stats.workSamples++;
      stats.queued += nav.elevator.queue().length;
      for (const id of units.keys()) {
        const ph = ambient.breakPhase(id);
        if (ph === 'go') {
          stats.going++;
          if (nav.phase(id) !== 'walk') stats.queued += 100;
        }
        else if (ph === 'stay') stats.staying++;
        else if (!ph && !ambient.isReserved(id) && ambient.get(id).kind === 'idle') stats.idleHome++;
      }
      for (const [z, c] of count) if (c > 0) stats.occupied.set(z, (stats.occupied.get(z) ?? 0) + 1);
      if ((count.get('rnd-lab') ?? 0) >= 2) stats.lab2++;
    } else if (p === 'lunch') {
      stats.lunchSamples++;
      if ((count.get('yemekhane') ?? 0) > 0) stats.lunchCafeteria++;
    }
  }
  return { ...stats, ambient };
}

export const pct = (a: number, b: number): number => (b > 0 ? Math.round((1000 * a) / b) / 10 : 0);

export function describeDay(s: DayStats): string {
  const zones = ZONES.map((z) => `${z} ${pct(s.occupied.get(z) ?? 0, s.workSamples)}%`).join(', ');
  return `work ${s.workSamples / 10}s: ${zones}; rnd-lab>=2 ${pct(s.lab2, s.workSamples)}%; lunch cafeteria ${pct(s.lunchCafeteria, s.lunchSamples)}%; jobs ${s.jobsDone}; avg going ${(s.going / s.workSamples).toFixed(1)} staying ${(s.staying / s.workSamples).toFixed(1)} idleHome ${(s.idleHome / s.workSamples).toFixed(1)} queue ${(s.queued / s.workSamples).toFixed(2)}`;
}
