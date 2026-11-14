// Spec 0002 AC-11 (REQ-12): card "Şu an" line and job line.
import { describe, it, expect } from 'vitest';
import { CARD_STATES, cardLines, jobLine, nowLine, templateOf, type CardState } from '../src/ui/nowLine';
import { createCard } from '../src/ui/card';
import { boot } from '../src/app/bootstrap';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import scenarios from '../src/data/scenarios.json';
import jobTitles from '../src/data/jobTitles.json';
import type { Unit } from '../src/data/types';
import { PROPS } from '../src/data/scenarios';
import { scenarioSet } from './workflowHelpers';

// §7.6, transcribed row by row.
const SPEC_76: Record<string, string> = {
  idle: 'Boşta',
  walk: 'Yürüyor',
  work: 'Masasında çalışıyor',
  coffee: 'Kahve molasında',
  'step-walk': 'Yolda: <adım etiketi>',
  'carry-walk': 'Taşıyor: <eşya adı> → <unit id>',
  handover: 'Teslim ediyor: <eşya adı>',
  wait: 'Bekliyor: <unit id>',
  'escort-wait': 'Bekliyor: <unit id> (inceleme)',
  'call-hold': 'Bekliyor: paralel inceleme',
  'room-wait': 'Bekliyor: toplantı odası',
  call: 'Asansörü çağırıyor',
  'call-wait': 'Bekliyor: asansör',
  ride: 'Asansörde → kat <n>',
  'seat-wait': 'Bekliyor: toplantı katılımcıları',
  seated: 'Toplantıda',
  present: 'Tahtada sunuyor',
  pair: 'Eşli çalışıyor: <unit id>',
  build: 'Derliyor: %<p>',
  'step-work': '<adım etiketi>',
  review: '<adım etiketi>',
  test: '<adım etiketi>',
  'stamp-raise': 'İmzalıyor',
  'stamp-press': 'İmzalıyor',
  called: 'Çağrıldı: <adım etiketi>',
};
// §7.5 state list (ambient + directed); wave and raise never appear (the state before selection is shown).
const SPEC_75 = [
  'idle', 'walk', 'work', 'coffee', 'step-walk', 'carry-walk', 'handover', 'wait', 'escort-wait', 'call-hold', 'room-wait',
  'call', 'call-wait', 'ride', 'seat-wait', 'seated', 'present', 'pair', 'build', 'review', 'test', 'stamp-raise',
  'stamp-press', 'step-work', 'called',
];

const unitIds = hierarchy.units.map((u) => u.id);
const labels = scenarioSet().scenarios.flatMap((s) => s.steps.map((st) => st.labelTr));
const cp = (s: string): number => [...s].length;

describe('card "Şu an" map (AC-11)', () => {
  it('maps every §7.5 state to exactly one §7.6 template', () => {
    expect([...CARD_STATES].sort()).toEqual([...SPEC_75].sort());
    expect(new Set(CARD_STATES).size).toBe(CARD_STATES.length);
    for (const s of SPEC_75) expect(templateOf(s as CardState)).toBe(SPEC_76[s]);
  });

  it('fills templates; filled lines stay within 60 code points for every label, prop and unit id', () => {
    expect(nowLine({ state: 'step-walk', label: 'Spec yazılıyor' })).toBe('Yolda: Spec yazılıyor');
    expect(nowLine({ state: 'carry-walk', prop: 'spec-stamped', other: 'react-engineer' })).toBe('Taşıyor: onaylı spec → react-engineer');
    expect(nowLine({ state: 'handover', prop: 'envelope' })).toBe('Teslim ediyor: iş zarfı');
    expect(nowLine({ state: 'wait', other: 'qa-engineer' })).toBe('Bekliyor: qa-engineer');
    expect(nowLine({ state: 'escort-wait', other: 'spec-critic' })).toBe('Bekliyor: spec-critic (inceleme)');
    expect(nowLine({ state: 'ride', floor: 4 })).toBe('Asansörde → kat 4');
    expect(nowLine({ state: 'build', progress: 42 })).toBe('Derliyor: %42');
    expect(nowLine({ state: 'pair', other: 'dotnet-engineer' })).toBe('Eşli çalışıyor: dotnet-engineer');
    expect(nowLine({ state: 'called', label: 'Kod inceleme' })).toBe('Çağrıldı: Kod inceleme');
    expect(nowLine({ state: 'review', label: 'Spec inceleme' })).toBe('Spec inceleme');
    expect(nowLine({ state: 'stamp-press' })).toBe('İmzalıyor');
    const longLabel = labels.reduce((a, b) => (cp(b) > cp(a) ? b : a));
    const longId = unitIds.reduce((a, b) => (b.length > a.length ? b : a));
    for (const state of CARD_STATES) {
      for (const prop of PROPS) {
        const line = nowLine({ state, label: longLabel, prop, other: longId, floor: 5, progress: 100 });
        expect(cp(line)).toBeLessThanOrEqual(60);
        expect(line).not.toMatch(/<[^>]+>/); // no placeholder left
      }
    }
  });

  it('attaches no Turkish suffix to a unit id', () => {
    for (const state of CARD_STATES) {
      const tpl = templateOf(state);
      let at = tpl.indexOf('<unit id>');
      while (at >= 0) {
        const after = tpl.slice(at + '<unit id>'.length);
        expect(after === '' || after.startsWith(' ')).toBe(true);
        at = tpl.indexOf('<unit id>', at + 1);
      }
    }
  });

  it('derives the line from the engine state, else from the ambient state; job line format', () => {
    expect(jobLine(7, 'Fatura ekranı', 2)).toBe('İş #7 · Fatura ekranı · Hat 2');
    expect(cardLines(null, 'coffee', null)).toEqual({ now: 'Kahve molasında' });
    expect(cardLines({ state: 'step-work', job: 3, step: 'spec', label: 'Spec yazılıyor' }, 'idle', { n: 3, title: 'Kayıt formu', lane: 1 })).toEqual({
      now: 'Spec yazılıyor',
      job: 'İş #3 · Kayıt formu · Hat 1',
    });
    expect(cardLines({ state: 'ride', job: 1, step: 'c', label: 'x' }, 'idle', { n: 1, title: 'T', lane: 3 }, 4).now).toBe('Asansörde → kat 4');
  });
});

const unit: Unit = {
  id: 'qa-engineer', name: 'QA', floor: 2, tier: 'specialist', reportsTo: null, independent: false,
  roleTr: 'Rol', phrasesTr: ['a', 'b'], description: 'd', tools: [], model: null,
};

describe('card DOM lines (AC-11)', () => {
  it('shows the "Şu an" line and the job line as text', () => {
    const parent = document.createElement('div');
    document.body.replaceChildren(parent);
    const card = createCard(parent, { resolveName: (id) => id });
    card.open(unit, null, { now: 'Bekliyor: <b>x</b>', job: 'İş #2 · Başlık · Hat 2' });
    const dialog = parent.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Şu an');
    expect(dialog.textContent).toContain('Bekliyor: <b>x</b>');
    expect(dialog.querySelector('b')).toBeNull();
    expect(dialog.textContent).toContain('İş #2 · Başlık · Hat 2');
  });

  it('without lines (fallback) neither line exists', () => {
    const parent = document.createElement('div');
    document.body.replaceChildren(parent);
    const card = createCard(parent, { resolveName: (id) => id });
    card.open(unit, null);
    expect(parent.textContent).not.toContain('Şu an');
    expect(parent.textContent).not.toContain('İş #');
  });

  it('with WebGL2 absent the fallback card has neither line and no strip exists', async () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const state = await boot({
      root,
      loadRaw: () => Promise.resolve({ roster, overlay: hierarchy, scenarios, jobTitles }),
      hasWebGL2: () => false,
      startScene: () => undefined,
    });
    expect(state).toBe('fallback');
    const first = root.querySelector<HTMLButtonElement>('.unit-list button');
    first?.click();
    expect(root.querySelector('[role="dialog"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Şu an');
    expect(root.textContent).not.toContain('Aktif işler — simülasyon');
  });
});
