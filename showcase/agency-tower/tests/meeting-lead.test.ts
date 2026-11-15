// Meeting lead placement (spec 0002 REQ-15, AC-14): the engine tells the movement which actor leads a
// meeting; with real movement the lead stands `present` at the whiteboard spot and the others sit.
import { describe, expect, it } from 'vitest';
import { createNavMovement } from '../src/sim/navMovement';
import { ROOM_FLOOR } from '../src/sim/workflow';
import { makeWorkflow, run, unitFloors } from './workflowHelpers';

describe('meeting lead (REQ-15, AC-14)', () => {
  it('nav movement: a meeting-room target marked lead resolves to the whiteboard spot, others to seats', () => {
    const m = createNavMovement({ units: unitFloors() });
    m.moveTo('business-analyst', { floor: ROOM_FLOOR, spot: 'meeting-room:lead' });
    m.moveTo('qa-engineer', { floor: ROOM_FLOOR, spot: 'meeting-room' });
    for (let i = 0; i < 1200 && !(m.isAt('business-analyst', { floor: ROOM_FLOOR, spot: 'meeting-room:lead' }) && m.isAt('qa-engineer', { floor: ROOM_FLOOR, spot: 'meeting-room' })); i++) m.step(0.1, () => false);
    expect(m.nodeOf('business-analyst')).toBe('mlead');
    expect(m.nodeOf('qa-engineer')).toMatch(/^mseat:/);
  });

  it('a non-lead never takes the whiteboard spot, even when it arrives first', () => {
    const m = createNavMovement({ units: unitFloors() });
    const ids = ['qa-engineer', 'react-engineer', 'spec-critic', 'appsec', 'architecture-board', 'product-manager'];
    for (const id of ids) m.moveTo(id, { floor: ROOM_FLOOR, spot: 'meeting-room' });
    for (let i = 0; i < 3000 && !ids.every((id) => m.isAt(id, { floor: ROOM_FLOOR, spot: 'meeting-room' })); i++) m.step(0.1, () => false);
    for (const id of ids) expect(m.nodeOf(id)).not.toBe('mlead');
  });

  it('engine + nav movement: in a running meeting the lead is `present` at the whiteboard, the others `seated`', () => {
    const movement = createNavMovement({ units: unitFloors() });
    const wf = makeWorkflow({ scripted: false, autoStart: false, movement });
    const n = wf.startJob('l2-base');
    let checked = false;
    run(wf, 600, () => {
      if (checked) return;
      const meet = wf.running().find((r) => r.job === n && r.kind === 'meeting');
      if (!meet) return;
      const states = meet.units.map((u) => wf.unitState(u)?.state);
      if (!states.includes('present') || states.some((s) => s !== 'present' && s !== 'seated')) return;
      const lead = meet.units.find((u) => wf.unitState(u)?.state === 'present')!;
      expect(lead).toBe('business-analyst');
      expect(movement.nodeOf(lead)).toBe('mlead');
      for (const u of meet.units.filter((x) => x !== lead)) expect(movement.nodeOf(u)).toMatch(/^mseat:/);
      checked = true;
    });
    expect(checked).toBe(true);
  });
});
