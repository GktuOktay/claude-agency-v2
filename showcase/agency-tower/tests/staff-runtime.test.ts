// Staff wiring: stepped each frame, frozen by every global pause reason, speech shares the bubble cap.
import { describe, it, expect } from 'vitest';
import { createStaffRuntime } from '../src/app/staffRuntime';
import { createStaff } from '../src/scene/staff';
import { buildTower } from '../src/scene/model';
import { pickRobot } from '../src/scene/picking';
import { createSimClock, type GlobalReason } from '../src/sim/clock';
import { MAX_BUBBLES } from '../src/scene/activity';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { Ray, Vector3 } from 'three';
import type { SpeechEvent } from '../src/sim/staffSim';

function fake() {
  let steps = 0;
  const ls = new Set<(e: SpeechEvent) => void>();
  return {
    staff: {
      step: () => void steps++,
      onSpeech: (l: (e: SpeechEvent) => void) => (ls.add(l), () => void ls.delete(l)),
    },
    steps: () => steps,
    say: (i: number) => ls.forEach((l) => l({ type: 'speech', staffId: 'staff:tea', floor: 0, text: `t${i}`, time: 0 })),
  };
}

describe('staff runtime', () => {
  it('steps staff every frame while running', () => {
    const f = fake();
    const rt = createStaffRuntime({ staff: f.staff, clock: createSimClock() });
    rt.frame(0.016);
    rt.frame(0.016);
    expect(f.steps()).toBe(2);
  });

  for (const reason of ['org', 'user', 'hidden'] as GlobalReason[]) {
    it(`does not step staff while paused by ${reason}, resumes after`, () => {
      const f = fake();
      const clock = createSimClock();
      const rt = createStaffRuntime({ staff: f.staff, clock });
      clock.setReason(reason, true);
      rt.frame(0.016);
      expect(f.steps()).toBe(0);
      clock.setReason(reason, false);
      rt.frame(0.016);
      expect(f.steps()).toBe(1);
    });
  }

  it('turns speech into bubbles and expires them', () => {
    const f = fake();
    const rt = createStaffRuntime({ staff: f.staff, clock: createSimClock() });
    f.say(1);
    expect(rt.bubbles(0).map((b) => b.text)).toEqual(['t1']);
    rt.frame(5);
    expect(rt.bubbles(0)).toEqual([]);
  });

  it('counts staff bubbles toward the shared cap', () => {
    const f = fake();
    const rt = createStaffRuntime({ staff: f.staff, clock: createSimClock() });
    rt.bubbles(MAX_BUBBLES - 1);
    f.say(1);
    f.say(2); // over the cap: dropped
    expect(rt.bubbles(MAX_BUBBLES - 1)).toHaveLength(1);
    expect(rt.bubbles(MAX_BUBBLES)).toHaveLength(0);
    expect(rt.bubbles(MAX_BUBBLES - 1).length + (MAX_BUBBLES - 1)).toBeLessThanOrEqual(MAX_BUBBLES);
  });

  it('real staff stay non-pickable', () => {
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const model = buildTower(r.data);
    const staff = createStaff({ layouts: model.layouts, seed: 1 });
    model.root.add(staff.group);
    model.root.updateMatrixWorld(true);
    for (const s of staff.snapshot()) {
      const p = staff.headPosition(s.id);
      if (!p) continue;
      expect(pickRobot(model, new Ray(p.clone().add(new Vector3(0, 5, 0)), new Vector3(0, -1, 0)))).toBeNull();
    }
  });
});
