import { describe, it, expect } from 'vitest';
import { loadJobTitles, createTitleSequence, SCRIPTED_TITLES } from '../src/data/jobTitles';
import { createRng } from '../src/scene/rng';

// Fixtures only: the real src/data/jobTitles.json is owned by tech-comms (spec 0002 T-3).
const titles = (n: number): string[] => Array.from({ length: n }, (_, i) => `Kurgusal iş ${i + 1}`);
const doc = (t: unknown): unknown => ({ schemaVersion: 1, titlesTr: t });

describe('jobTitles validator (AC-3, REQ-3)', () => {
  it('accepts 12 and 40 valid titles', () => {
    expect(loadJobTitles(doc(titles(12))).ok).toBe(true);
    expect(loadJobTitles(doc(titles(40))).ok).toBe(true);
  });

  it('accepts a 36-code-point title with ç ğ ı İ ö ş ü', () => {
    const t = 'Çağrı İşöşü güncellemesi ve ığdır çü'; // 36 code points
    expect([...t].length).toBe(36);
    const r = loadJobTitles(doc([t, ...titles(11)]));
    expect(r).toEqual({ ok: true, data: [t, ...titles(11)] });
  });

  const bad: [string, unknown][] = [
    ['11 titles', doc(titles(11))],
    ['41 titles', doc(titles(41))],
    ['an empty title', doc(['', ...titles(11)])],
    ['a 37-code-point title', doc(['ç'.repeat(37), ...titles(11)])],
    ['a duplicate', doc([...titles(11), 'Kurgusal iş 1'])],
    ['a control character', doc(['Satır\u0007sonu', ...titles(11)])],
    ['a newline', doc(['Satır\nsonu', ...titles(11)])],
    ['a "<"', doc(['<b>kalın', ...titles(11)])],
    ['a ">"', doc(['kalın>', ...titles(11)])],
    ['a non-string title', doc([42, ...titles(11)])],
    ['a wrong schemaVersion', { schemaVersion: 2, titlesTr: titles(12) }],
    ['an unknown field', { schemaVersion: 1, titlesTr: titles(12), extra: true }],
    ['not an object', null],
  ];
  for (const [name, raw] of bad) {
    it(`rejects ${name}`, () => {
      expect(loadJobTitles(raw).ok).toBe(false);
    });
  }
});

describe('title order (AC-3, §7.3)', () => {
  it('scripted jobs take titles 1-3 in file order', () => {
    const list = titles(12);
    const seq = createTitleSequence(list, createRng(7));
    expect(SCRIPTED_TITLES).toBe(3);
    expect([seq.next(), seq.next(), seq.next()]).toEqual(list.slice(0, 3));
  });

  it('never repeats a title twice in a row over 200 jobs, for many seeds and list sizes', () => {
    for (const n of [12, 13, 20, 40]) {
      for (let seed = 1; seed <= 50; seed++) {
        const seq = createTitleSequence(titles(n), createRng(seed));
        let last = '';
        for (let i = 0; i < 200; i++) {
          const t = seq.next();
          expect(t, `n=${n} seed=${seed} job=${i + 1}`).not.toBe(last);
          last = t;
        }
      }
    }
  });

  it('after the scripted three, each shuffled round uses every title exactly once', () => {
    const list = titles(12);
    const seq = createTitleSequence(list, createRng(99));
    for (let i = 0; i < 3; i++) seq.next();
    for (let round = 0; round < 5; round++) {
      const got = Array.from({ length: list.length }, () => seq.next());
      expect([...got].sort()).toEqual([...list].sort());
    }
  });

  it('is deterministic for a seed and differs for another seed', () => {
    const run = (seed: number) => {
      const seq = createTitleSequence(titles(20), createRng(seed));
      return Array.from({ length: 60 }, () => seq.next());
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it('draws nothing for the scripted titles', () => {
    let draws = 0;
    const rng = createRng(3);
    const seq = createTitleSequence(titles(12), () => {
      draws++;
      return rng();
    });
    seq.next();
    seq.next();
    seq.next();
    expect(draws).toBe(0);
    seq.next();
    expect(draws).toBeGreaterThan(0);
  });
});
