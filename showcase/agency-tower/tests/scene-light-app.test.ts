// AC-15 on the app's light path (QA r2B 5): sceneApp lights the scene from sceneLight(dayNight, office), where
// Otomatik follows office.lightPhase() on the runtime's simulation clock. m2.test.ts covers createDayNight's own
// 90 s cycle, which Otomatik no longer uses. Cycle length is not asserted here (CEO decision pending).
import { describe, expect, it } from 'vitest';
import { sceneLight } from '../src/app/sceneLight';
import { createSimRuntime, type SimRuntime } from '../src/app/simRuntime';
import { createDayNight, type DayNight } from '../src/scene/daynight';
import { createOfficeSchedule, OFFICE_DAY_S, type OfficeClock } from '../src/sim/schedule';
import { scenarioSet, unitFloors } from './workflowHelpers';

function app(): { rt: SimRuntime; dn: DayNight; office: OfficeClock; frame(): ReturnType<typeof sceneLight> } {
  const rt = createSimRuntime({ scenarios: scenarioSet(), units: unitFloors(), titles: ['A', 'B', 'C'], maxJobs: 3, isNarrow: () => false, reducedMotion: () => false, rideTo: () => undefined });
  const office = createOfficeSchedule(rt.clock);
  const dn = createDayNight();
  // sceneApp frame order: runtime.frame(ms), dayNight.step(frameDt), then sceneLight(dayNight, office).
  const frame = (): ReturnType<typeof sceneLight> => {
    rt.frame(100);
    dn.step(0.1);
    return sceneLight(dn, office);
  };
  return { rt, dn, office, frame };
}

describe('scene light on the app path (AC-15)', () => {
  it('Otomatik uses the office light phase and it moves while the clock runs', () => {
    const a = app();
    expect(a.dn.mode()).toBe('auto');
    const l0 = a.frame();
    expect(l0.phase).toBeCloseTo(a.office.lightPhase(), 12);
    for (let i = 0; i < 600; i++) a.frame();
    const l1 = a.frame();
    expect(l1.phase).not.toBeCloseTo(l0.phase!, 6);
    expect(l1.phase).toBeCloseTo(a.office.lightPhase(), 12);
  });

  for (const reason of ['org', 'user', 'hidden'] as const) {
    it(`"${reason}": a global pause freezes the light phase, night flag and brightness`, () => {
      const a = app();
      for (let i = 0; i < 300; i++) a.frame();
      if (reason === 'org') a.rt.setOrg(true);
      else if (reason === 'hidden') a.rt.setHidden(true);
      else a.rt.pauseButton.click();
      const held = a.frame();
      for (let i = 0; i < 600; i++) expect(a.frame()).toEqual(held);
      if (reason === 'org') a.rt.setOrg(false);
      else if (reason === 'hidden') a.rt.setHidden(false);
      else a.rt.pauseButton.click();
      for (let i = 0; i < 50; i++) a.frame();
      expect(a.frame().phase).not.toBeCloseTo(held.phase!, 6);
    });
  }

  for (const [mode, night] of [['day', false], ['night', true]] as const) {
    it(`${mode === 'day' ? 'Gündüz' : 'Gece'} holds through a whole office day: night = ${night}, constant brightness`, () => {
      const a = app();
      expect(a.dn.setMode(mode)).toBe(true);
      for (let i = 0; i < 20; i++) a.frame(); // the 0001 control's fade settles
      const held = a.frame();
      expect(held.isNight).toBe(night);
      expect(held.phase).toBeNull();
      for (let i = 0; i < Math.ceil(OFFICE_DAY_S * 10); i++) {
        const l = a.frame();
        expect(l.isNight).toBe(night);
        expect(l.brightness).toBeCloseTo(held.brightness, 9);
      }
    });
  }
});
