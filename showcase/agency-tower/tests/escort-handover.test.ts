// Spec 0002 REQ-6 / R-11 escort exception (T-8 engine fix): the carry-back hand-over to a review's
// escort happens where both stand: both co-located, the carrier staying put until it is done.
import { describe, expect, it } from 'vitest';
import { createAnchors } from '../src/scene/director';
import { HANDOVER_S, WAIT_ALLOWANCE_S } from '../src/sim/workflow';
import { harness } from './directorHelpers';

const SC = 'spec-critic';
const BA = 'business-analyst';

describe('escort exception hand-over (REQ-6, R-11)', () => {
  for (const seed of [undefined, 4, 5]) {
    it(`back-sc hands over only with carrier and escort co-located, carrier still at the review desk (seed ${seed ?? 'default'})`, () => {
      const h = harness(seed === undefined ? {} : { seed });
      const anchors = createAnchors(h.layouts);
      const deskSC = { floor: anchors.desk(SC).floor, spot: `desk:${SC}` };
      const spotSC = { floor: anchors.desk(SC).floor, spot: `handover:${SC}` };
      let handing = 0;
      h.run(600, (x) => {
        const st = x.wf.unitState(SC);
        if (st?.state === 'handover' && st.step === 'back-sc') {
          handing++;
          expect(x.wf.movement.floorOf(BA)).toBe(x.wf.movement.floorOf(SC));
          expect(x.wf.movement.isAt(SC, deskSC)).toBe(true);
          expect(x.wf.movement.isAt(BA, spotSC)).toBe(true);
        }
      });
      expect(handing).toBeGreaterThan(0);
    });
  }

  it('the carrier does not walk home between the rejecting review and the carry-back hand-over', () => {
    const h = harness();
    let open = false;
    let samples = 0;
    let closed = false;
    h.run(600, (x) => {
      for (const e of x.last) {
        if (e.job !== 1) continue;
        if (e.type === 'step-end' && e.step === 'rev-sc' && e.outcome === 'reject') open = true;
        if ((e.type === 'handover' || e.type === 'tray-drop') && e.step === 'back-sc') {
          open = false;
          closed = true;
        }
      }
      if (open) {
        samples++;
        expect(x.wf.movement.phase(SC), `t=${x.wf.time.toFixed(1)}`).toBe('still');
      }
    });
    expect(closed).toBe(true);
    expect(samples).toBeGreaterThanOrEqual(Math.round(HANDOVER_S / 0.1) - 1);
  });

  it('a busy escort (selected) gets the copy in its tray 8 s after the carrier is in place', () => {
    let selectBA = false;
    const h = harness({ isSelected: (u) => selectBA && u === BA });
    let waitAt = NaN;
    let dropAt = NaN;
    h.run(600, (x) => {
      for (const e of x.last) {
        if (e.job !== 1) continue;
        if (e.type === 'step-end' && e.step === 'rev-sc' && e.outcome === 'reject') selectBA = true;
        if (e.type === 'wait-start' && e.step === 'back-sc') waitAt = e.t;
        if (e.type === 'handover' && e.step === 'back-sc') throw new Error('handed over to a selected escort');
        if (e.type === 'tray-drop' && e.step === 'back-sc') {
          dropAt = e.t;
          selectBA = false;
        }
      }
    });
    expect(Number.isNaN(waitAt)).toBe(false);
    expect(dropAt - waitAt).toBeCloseTo(WAIT_ALLOWANCE_S, 5);
  });
});
