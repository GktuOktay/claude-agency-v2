// KARARLAR Rev 44: "Molaya çık" sends everyone (robots and the CEO) to the social areas now, "Molayı bitir" sends
// everyone back to their desks now; the override ends at the next scheduled transition and respects the pause.
import { describe, it, expect } from 'vitest';
import { maxJobsFor } from '../src/app/params';
import { appCampusOptions, createActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import { createBreakOverride, MANUAL_BREAK_PERIOD } from '../src/sim/breakOverride';
import { floorY } from '../src/sim/layout';
import type { NavMovement } from '../src/sim/navMovement';
import type { OfficePeriod } from '../src/sim/schedule';
import { MASTER_SEED } from '../src/sim/workflow';
import { BREAK_TEXT, createBreakButtons } from '../src/ui/settings/breakButton';
import { towerLayouts } from './directorHelpers';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

describe('break override (schedule layer)', () => {
  it('break / work override the period until the schedule moves on', () => {
    let base: OfficePeriod = 'work';
    const o = createBreakOverride(() => base);
    expect(o.period()).toBe('work');
    expect(o.onBreak()).toBe(false);
    o.startBreak();
    expect(o.period()).toBe(MANUAL_BREAK_PERIOD);
    expect(o.mode()).toBe('break');
    expect(o.onBreak()).toBe(true);
    base = 'tea'; // next scheduled transition: the schedule takes over
    expect(o.mode()).toBeNull();
    expect(o.period()).toBe('tea');
    o.endBreak();
    expect(o.period()).toBe('work');
    expect(o.onBreak()).toBe(false);
    base = 'work';
    expect(o.mode()).toBeNull();
    expect(o.period()).toBe('work');
  });

  it('toggle ends a scheduled break and starts one in work hours', () => {
    let base: OfficePeriod = 'lunch';
    const o = createBreakOverride(() => base);
    expect(o.toggle()).toBe('work');
    expect(o.period()).toBe('work');
    expect(o.toggle()).toBe('break');
    expect(o.onBreak()).toBe(true);
    base = 'work';
    expect(o.onBreak()).toBe(false);
  });
});

describe('break buttons (Ofis tab and on screen)', () => {
  it('both buttons share one label; a press toggles it and reports in Turkish', () => {
    let base: OfficePeriod = 'work';
    let paused = false;
    const o = createBreakOverride(() => base);
    const b = createBreakButtons({ override: o, paused: () => paused });
    document.body.append(b.section, b.screen);
    const main = b.section.querySelector('button')!;
    expect(main.textContent).toBe(BREAK_TEXT.start);
    expect(b.screen.textContent).toBe('Molaya çık');
    expect(b.screen.type).toBe('button');
    expect(b.screen.classList.contains('break-screen')).toBe(true);
    b.screen.click();
    expect(main.textContent).toBe('Molayı bitir');
    expect(b.screen.textContent).toBe('Molayı bitir');
    expect(b.section.querySelector('[role="status"]')!.textContent).toBe(BREAK_TEXT.started);
    paused = true;
    main.click();
    expect(b.screen.textContent).toBe('Molaya çık');
    expect(b.section.querySelector('[role="status"]')!.textContent).toBe(BREAK_TEXT.paused);
    paused = false;
    main.click();
    base = 'coffee'; // the schedule moved on: the override ends, the coffee slot is a break
    b.refresh();
    expect(b.screen.textContent).toBe('Molayı bitir');
    b.section.remove();
    b.screen.remove();
  });
});

/** App wiring (engine + nav + staff elevator, ambient with campus breaks and the director) on a fixed base period. */
function office(base: () => OfficePeriod) {
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
  const override = createBreakOverride(base);
  let paused = false;
  const ambient = createActivitySim(specs, 20261113, {
    campus: appCampusOptions({ movement: nav, floors: units, period: () => override.period(), periodAhead: () => override.period(), queued: () => nav.elevator.queue().length, paused: () => paused, override: () => override.mode() }),
  });
  const dir = createDirector({ scenarios: scenarioSet(), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
  const ids = [...units.keys()];
  return {
    override,
    ids,
    ambient,
    setPaused: (p: boolean) => (paused = p),
    run(seconds: number) {
      for (let i = 0; i < Math.round(seconds * 10); i++) {
        ambient.step(100);
        if (!paused) wf.step(0.1);
        dir.ingest(wf.drainEvents());
        dir.update(0.1, wf);
      }
    },
    /** Free robots out (going to or at a social area). */
    away: () => ids.filter((id) => !ambient.isReserved(id) && (ambient.breakPhase(id) === 'go' || ambient.breakPhase(id) === 'stay')),
    free: () => ids.filter((id) => !ambient.isReserved(id)),
  };
}

describe('Molaya çık / Molayı bitir in the office (Rev 44)', () => {
  it('Molaya çık sends everyone free (the CEO too) to the social areas; Molayı bitir brings everyone back', () => {
    const o = office(() => 'work');
    o.run(30);
    o.override.startBreak();
    const free = o.free();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      o.run(10);
      for (const id of o.away()) seen.add(id);
    }
    // Everyone free at the press leaves (the elevator gate spaces the trips): all but a few within 120 s.
    expect(seen.size).toBeGreaterThanOrEqual(free.length - 3);
    expect(seen.has('ceo') || o.ambient.isReserved('ceo')).toBe(true);
    o.override.endBreak();
    o.run(0.1);
    expect(o.away()).toEqual([]); // every break turns back at once
    o.run(120);
    for (const id of o.ids) if (!o.ambient.isReserved(id)) expect(o.ambient.breakPhase(id), id).toBeNull();
    // The director stays off while "Molayı bitir" holds: nobody starts a new session.
    expect(o.away()).toEqual([]);
  }, 60000);

  it('respects the pause: a press while paused is carried out on resume', () => {
    const o = office(() => 'work');
    o.run(30);
    o.override.startBreak();
    o.run(90);
    const out = o.away();
    expect(out.length).toBeGreaterThan(3);
    o.setPaused(true);
    o.override.endBreak();
    o.run(5);
    expect(o.away()).toEqual(out); // frozen: nobody turns back while paused
    o.setPaused(false);
    o.run(0.1);
    expect(o.away()).toEqual([]);
  }, 60000);
});
