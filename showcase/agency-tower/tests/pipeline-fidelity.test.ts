// Pipeline fidelity (spec 0002 AC-5): each variant alone reproduces its §7.2 table in order and
// finishes within the bound; forced loops add at most 100 s with real movement (KARARLAR Rev 32;
// the l3-full forced test loop measures 92.3 s); the scripted opening follows §7.4.
import { describe, it, expect } from 'vitest';
import { makeWorkflow, run, runUntilDone } from './workflowHelpers';
import { VARIANT_TABLES } from '../src/data/variantTables';
import type { WfEvent } from '../src/sim/workflow';

const FORCED_LOOP_BOUND_S = 100;

interface Row { id: string; kind: string; actors: string; place: string; next: string; extra: string }
const parse = (r: string): Row => {
  const c = r.split('|').map((x) => x.trim());
  return { id: c[0]!, kind: c[1]!.split(' ')[0]!, actors: c[2]!, place: c[3]!, next: c[7]!, extra: c[8]! };
};

/** Expected order from the table alone: follow `next` from intake; a call lists its branches, then its join. */
function expectedOrder(rows: Row[]): string[] {
  const by = new Map(rows.map((r) => [r.id, r]));
  const out: string[] = [];
  let cur = by.get('intake');
  while (cur) {
    out.push(`${cur.id}|${cur.kind}|${cur.actors}|${cur.place}`);
    if (cur.kind === 'call') {
      const branches = cur.extra.replace(/^parallel /, '').split(';')[0]!.split(',').map((x) => x.trim());
      for (const b of branches) {
        const br = by.get(b)!;
        out.push(`${br.id}|${br.kind}|${br.actors}|${br.place}`);
      }
      cur = by.get(cur.next.replace(/^join /, ''));
    } else {
      cur = cur.next === 'null' ? undefined : by.get(cur.next);
    }
  }
  return out;
}

function actualOrder(t: readonly WfEvent[], escorts: Map<string, string>): string[] {
  return t
    .filter((e) => e.job === 1 && (e.type === 'call' || e.type === 'step-start'))
    .map((e) => {
      const actors = e.type === 'call' ? [e.units![0]!] : e.units!.filter((u) => u !== escorts.get(e.step!));
      return `${e.step}|${e.type === 'call' ? 'call' : e.kind}|${actors.join(', ')}|${e.place ?? '—'}`;
    });
}

function alone(variant: string, outcome: (n: number, step: string, run: number) => 'pass' | 'reject' = () => 'pass') {
  const wf = makeWorkflow({ scripted: false, maxJobs: 1, onlyVariant: variant, durations: 'max', outcome: (n, s, r) => outcome(n, s, r) });
  runUntilDone(wf, 1, 2000);
  const t = wf.trace();
  const start = t.find((e) => e.type === 'job-start' && e.job === 1)!.t;
  const end = t.find((e) => e.type === 'job-done' && e.job === 1)!.t;
  return { t, span: end - start };
}

describe('pipeline fidelity (AC-5)', () => {
  for (const table of VARIANT_TABLES) {
    it(`${table.id} alone produces its table in order and finishes within ${table.boundS} s`, () => {
      const rows = table.rows.map(parse);
      const escorts = new Map(table.rows.map((r) => r.split('|').map((x) => x.trim())).filter((c) => c[4]!.startsWith('escort ')).map((c) => [c[0]!, c[4]!.slice(7)]));
      const { t, span } = alone(table.id);
      expect(actualOrder(t, escorts)).toEqual(expectedOrder(rows));
      expect(span).toBeLessThanOrEqual(table.boundS);
    });

    const loopOwners = table.rows.map(parse).filter((r) => r.extra.includes('loop →'));
    for (const owner of loopOwners) {
      it(`${table.id}: one forced reject at ${owner.id} adds at most ${FORCED_LOOP_BOUND_S} s`, () => {
        const base = alone(table.id).span;
        const branches = owner.kind === 'call' ? owner.extra.replace(/^parallel /, '').split(';')[0]!.split(',').map((x) => x.trim()) : [owner.id];
        const looped = alone(table.id, (_n, step, r) => (step === branches[0] && r === 0 ? 'reject' : 'pass'));
        expect(looped.t.filter((e) => e.type === 'reject' && e.job === 1)).toHaveLength(1);
        expect(looped.span - base).toBeLessThanOrEqual(FORCED_LOOP_BOUND_S);
        expect(looped.span - base).toBeGreaterThan(0);
      });
    }
  }
});

describe('scripted opening (AC-5, §7.4)', () => {
  const scripted = (maxJobs: number) => {
    const wf = makeWorkflow({ maxJobs, seed: 77 });
    let outcomeDrawsBefore4 = -1;
    run(wf, 900, (w) => {
      if (!w.trace().some((e) => e.type === 'job-start' && e.job === 4)) outcomeDrawsBefore4 = w.draws().outcome;
    });
    return { t: wf.trace(), outcomeDrawsBefore4 };
  };
  const startOf = (t: readonly WfEvent[], n: number) => t.find((e) => e.type === 'job-start' && e.job === n)!;

  it('high: #1 l2-base at 2 s, #2 l3-full at 15 s, #3 l1-quick at 30 s (± one step)', () => {
    const { t } = scripted(3);
    for (const [n, v, at] of [[1, 'l2-base', 2], [2, 'l3-full', 15], [3, 'l1-quick', 30]] as const) {
      expect(startOf(t, n).variant).toBe(v);
      expect(Math.abs(startOf(t, n).t - at)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('low: #3 starts 4 s after the first slot frees (± one step)', () => {
    const { t } = scripted(2);
    const free = t.find((e) => e.type === 'slot-free')!.t;
    expect(startOf(t, 3).variant).toBe('l1-quick');
    expect(Math.abs(startOf(t, 3).t - (free + 4))).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  for (const maxJobs of [3, 2]) {
    it(`scripted outcomes are exact and draw nothing (maxJobs ${maxJobs})`, () => {
      const { t, outcomeDrawsBefore4 } = scripted(maxJobs);
      const rejects = (n: number) => t.filter((e) => e.type === 'reject' && e.job === n).map((e) => e.step);
      expect(rejects(1)).toEqual(['rev-sc']);
      expect(rejects(2)).toEqual(['test']);
      expect(rejects(3)).toEqual([]);
      const gateEnds = t.filter((e) => e.type === 'step-end' && e.job === 2 && ['g-sc', 'g-as', 'g-ab', 'gates'].includes(e.step!));
      expect(gateEnds.every((e) => e.outcome === 'pass')).toBe(true);
      expect(gateEnds).toHaveLength(4);
      expect(outcomeDrawsBefore4).toBe(0);
    });
  }
});
