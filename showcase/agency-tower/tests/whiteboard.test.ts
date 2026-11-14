// Spec 0002 AC-14 (REQ-15) whiteboard and l3 CEO call-down; AC-16 (REQ-19) whole sections under
// reduced motion. Engine + nav movement (the default), 0.1 s steps.
import { describe, expect, it } from 'vitest';
import { tr } from '../src/i18n/tr';
import { createWhiteboard, drawBoard, type BoardCtx, type BoardState } from '../src/scene/whiteboard';
import { createNavMovement } from '../src/sim/navMovement';
import { ROOM_FLOOR, SIGNING_FLOOR, type Workflow } from '../src/sim/workflow';
import { makeWorkflow, scenarioSet, unitFloors } from './workflowHelpers';

const SET = scenarioSet();
const stepOf = (variant: string, id: string) => SET.scenarios.find((s) => s.id === variant)!.steps.find((s) => s.id === id)!;

interface Sample {
  t: number;
  meeting: number | null; // meeting progress f, when the job's meeting runs
  normal: BoardState;
  reduced: BoardState;
  events: string[];
}

function simulate(variant: string, seconds: number, each?: (wf: Workflow) => void): { n: number; samples: Sample[]; wf: Workflow } {
  const wf = makeWorkflow({ scripted: false, autoStart: false, outcome: () => 'pass', movement: createNavMovement({ units: unitFloors() }) });
  const board = createWhiteboard(SET);
  const n = wf.startJob(variant);
  const samples: Sample[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    wf.step(0.1);
    const events = wf.drainEvents();
    board.ingest(events);
    const meet = wf.running().find((r) => r.job === n && r.kind === 'meeting');
    samples.push({
      t: wf.time,
      meeting: meet ? wf.stepProgress(n, meet.step) : null,
      normal: board.state(wf, false),
      reduced: board.state(wf, true),
      events: events.filter((e) => e.job === n).map((e) => `${e.type}:${e.step ?? ''}`),
    });
    each?.(wf);
    if (events.some((e) => e.type === 'job-done' && e.job === n)) break;
  }
  return { n, samples, wf };
}

const shown = (s: BoardState): number => Math.ceil(s.filled - 1e-9);

describe('whiteboard fill during a meeting (AC-14)', () => {
  for (const variant of ['l2-base', 'l3-full']) {
    it(`${variant}: after elapsed fraction f the board shows ⌊f·N⌋ ± 1 of N sections, all N at step end`, () => {
      const N = stepOf(variant, 'meet').sections!;
      const { samples } = simulate(variant, 900);
      let during = 0;
      let ended = false;
      for (const s of samples) {
        if (s.meeting !== null) {
          during++;
          expect(s.normal.sections).toBe(N);
          expect(Math.abs(shown(s.normal) - Math.floor(s.meeting * N))).toBeLessThanOrEqual(1);
          expect(s.normal.filled).toBeLessThanOrEqual(N);
        }
        if (s.events.includes('step-end:meet') && !s.events.includes('room-release:meet')) {
          expect(s.normal.filled).toBe(N);
          ended = true;
        }
        if (s.events.includes('step-end:meet') && s.events.includes('room-release:meet')) ended = true;
      }
      expect(during).toBeGreaterThan(100);
      expect(ended).toBe(true);
      // The board fills progressively: it passes through every count from 0 to N.
      const counts = new Set(samples.filter((s) => s.meeting !== null).map((s) => shown(s.normal)));
      for (let k = 0; k < N; k++) expect(counts.has(k)).toBe(true);
    });
  }

  it('l2 variants erase the board when the meeting ends (room released)', () => {
    for (const variant of ['l2-base', 'l2-input', 'l2-dependency']) {
      const { samples } = simulate(variant, 600);
      const end = samples.findIndex((s) => s.events.includes('step-end:meet'));
      expect(end, variant).toBeGreaterThan(0);
      expect(samples[end]!.events).toContain('room-release:meet');
      expect(shown(samples[end - 1]!.normal)).toBeGreaterThanOrEqual(stepOf(variant, 'meet').sections! - 1);
      for (const s of samples.slice(end)) expect([s.normal.job, s.normal.filled]).toEqual([null, 0]);
    }
  });

  it('l3: the board stays filled from the meeting end until the sign step ends, then it is erased', () => {
    const N = stepOf('l3-full', 'meet').sections!;
    const { n, samples } = simulate('l3-full', 900);
    const end = samples.findIndex((s) => s.events.includes('step-end:meet'));
    const sign = samples.findIndex((s) => s.events.includes('step-end:sign'));
    expect(end).toBeGreaterThan(0);
    expect(sign).toBeGreaterThan(end);
    for (const s of samples.slice(end, sign)) expect([s.normal.job, s.normal.filled]).toEqual([n, N]);
    for (const s of samples.slice(sign)) expect([s.normal.job, s.normal.filled]).toEqual([null, 0]);
  });
});

describe('whiteboard under reduced motion (AC-16)', () => {
  it('section counts change in whole sections only, and match the normal board within one section', () => {
    const { samples } = simulate('l3-full', 900);
    let changes = 0;
    let prev = 0;
    let fractional = 0;
    for (const s of samples) {
      expect(Number.isInteger(s.reduced.filled)).toBe(true);
      expect(s.reduced.job).toBe(s.normal.job);
      expect(Math.abs(s.reduced.filled - s.normal.filled)).toBeLessThan(1);
      if (!Number.isInteger(s.normal.filled)) fractional++;
      if (s.reduced.filled !== prev) changes++;
      prev = s.reduced.filled;
    }
    expect(fractional).toBeGreaterThan(0); // the normal board fills line by line inside a section
    expect(changes).toBeGreaterThanOrEqual(stepOf('l3-full', 'meet').sections!);
  });
});

describe('whiteboard strings (AC-14, R-6)', () => {
  function recorder(): { ctx: BoardCtx; texts: string[] } {
    const texts: string[] = [];
    const noop = (): void => undefined;
    const ctx: BoardCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textBaseline: 'alphabetic',
      lineCap: 'butt',
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      quadraticCurveTo: noop,
      stroke: noop,
      fillText: (t: string) => {
        texts.push(t);
      },
    };
    return { ctx, texts };
  }

  it('every drawn string comes from the built-in heading list, one heading per shown section', () => {
    for (const sections of [3, 6, 8]) {
      for (const filled of [0, 1, 2.5, sections]) {
        const { ctx, texts } = recorder();
        drawBoard(ctx, 1024, 512, { job: 1, step: 'meet', sections, filled });
        for (const t of texts) expect(tr.whiteboard).toContain(t);
        expect(texts.length).toBe(Math.ceil(filled));
      }
    }
    const { ctx, texts } = recorder();
    drawBoard(ctx, 512, 256, { job: null, step: null, sections: 0, filled: 0 });
    expect(texts).toEqual([]);
  });
});

describe('l3 CEO call-down with nav movement (AC-14)', () => {
  it('the CEO rides 5→3, stamps at the meeting table while on floor 3, and rides back to 5', () => {
    const ceoFloors: number[] = [];
    const ceoRides: number[] = [];
    let signedOn: number | null = null;
    let atTable = false;
    const sign = stepOf('l3-full', 'sign');
    expect(sign.place).toBe('meeting-room');
    expect(sign.actors[0]).toBe('ceo');
    const { wf } = simulate('l3-full', 900, (w) => {
      const f = w.movement.floorOf('ceo');
      if (ceoFloors[ceoFloors.length - 1] !== f) ceoFloors.push(f);
      if (w.movement.phase('ceo') === 'ride' && ceoRides[ceoRides.length - 1] !== f) ceoRides.push(f);
      const st = w.unitState('ceo');
      if (st?.step === 'sign' && (st.state === 'stamp-raise' || st.state === 'stamp-press')) {
        atTable = w.movement.isAt('ceo', { floor: ROOM_FLOOR, spot: 'meeting-room' });
        signedOn = w.movement.floorOf('ceo');
      }
    });
    const ev = wf.trace().filter((e) => e.type === 'sign');
    expect(ev.map((e) => e.place)).toEqual(['meeting-room']);
    expect(signedOn).toBe(ROOM_FLOOR);
    expect(atTable).toBe(true);
    // Floor history: home 5, ride down to 3, back to 5.
    expect(ceoFloors[0]).toBe(SIGNING_FLOOR);
    expect(ceoRides).toEqual([ROOM_FLOOR, SIGNING_FLOOR]);
    expect(ceoFloors.slice(0, 3)).toEqual([SIGNING_FLOOR, ROOM_FLOOR, SIGNING_FLOOR]);
    expect(wf.movement.isAt('ceo', { floor: SIGNING_FLOOR, spot: 'home:ceo' })).toBe(true);
  });
});
