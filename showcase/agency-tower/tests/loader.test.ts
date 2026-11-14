import { describe, it, expect } from 'vitest';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

const FLOORS = [0, 1, 2, 3, 4, 5].map((id) => ({ id, nameTr: `Kat ${id}` }));
const SHA = 'a'.repeat(64);

type Obj = Record<string, unknown>;
function valid(): { roster: Obj; overlay: Obj } {
  return {
    roster: {
      schemaVersion: 1,
      sourceSha256: SHA,
      agents: [{ name: 'worker', description: 'Does work.', tools: ['Read'], model: 'sonnet' }],
    },
    overlay: {
      schemaVersion: 1,
      floors: FLOORS,
      units: [
        { id: 'ceo', floor: 5, tier: 'ceo', reportsTo: null, independent: false, roleTr: 'Patron', phrasesTr: ['Merhaba', 'Hadi'], manual: { description: 'Boss', tools: [], model: null } },
        { id: 'worker', floor: 1, tier: 'specialist', reportsTo: 'ceo', independent: false, roleTr: 'İşçi', phrasesTr: ['Çalışıyorum', 'Kahve?'] },
      ],
    },
  };
}
const units = (d: { overlay: Obj }) => d.overlay.units as Obj[];

describe('loader (AC-4)', () => {
  it('accepts valid data and merges card fields', () => {
    const d = valid();
    const r = loadData(d.roster, d.overlay);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.units.map((u) => u.id)).toEqual(['ceo', 'worker']);
    const w = r.data.units.find((u) => u.id === 'worker');
    expect(w).toMatchObject({ name: 'worker', description: 'Does work.', tools: ['Read'], model: 'sonnet', floor: 1, tier: 'specialist', reportsTo: 'ceo' });
    const c = r.data.units.find((u) => u.id === 'ceo');
    expect(c).toMatchObject({ description: 'Boss', tools: [], model: null });
  });

  it('accepts the committed JSON files', () => {
    const r = loadData(roster, hierarchy);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.units).toHaveLength(20);
  });

  const cases: [string, (d: ReturnType<typeof valid>) => void][] = [
    ['roster agent with no overlay entry', (d) => (d.roster.agents as Obj[]).push({ name: 'extra', description: 'x', tools: [], model: null })],
    ['non-manual overlay unit with no roster agent', (d) => units(d).push({ id: 'ghost', floor: 1, tier: 'specialist', reportsTo: 'ceo', independent: false, roleTr: 'r', phrasesTr: ['a', 'b'] })],
    ['duplicate id', (d) => units(d).push({ ...(units(d)[1] as Obj) })],
    ['id not matching the pattern', (d) => ((units(d)[1] as Obj).id = 'Bad_Id')],
    ['id __proto__', (d) => { (units(d)[1] as Obj).id = '__proto__'; (d.roster.agents as Obj[])[0]!.name = '__proto__'; }],
    ['unknown reportsTo', (d) => ((units(d)[1] as Obj).reportsTo = 'nobody')],
    ['reporting cycle', (d) => {
      units(d).push({ id: 'a', floor: 1, tier: 'specialist', reportsTo: 'b', independent: false, roleTr: 'r', phrasesTr: ['a', 'b'] });
      units(d).push({ id: 'b', floor: 1, tier: 'specialist', reportsTo: 'a', independent: false, roleTr: 'r', phrasesTr: ['a', 'b'] });
      (d.roster.agents as Obj[]).push({ name: 'a', description: 'x', tools: [], model: null }, { name: 'b', description: 'x', tools: [], model: null });
    }],
    ['floor above 5', (d) => ((units(d)[1] as Obj).floor = 6)],
    ['floor below 0', (d) => ((units(d)[1] as Obj).floor = -1)],
    ['fractional floor', (d) => ((units(d)[1] as Obj).floor = 1.5)],
    ['no ceo-tier unit', (d) => ((units(d)[0] as Obj).tier = 'management')],
    ['two ceo-tier units', (d) => ((units(d)[1] as Obj).tier = 'ceo')],
    ['empty list', (d) => { d.overlay.units = []; d.roster.agents = []; }],
    ['non-null reportsTo missing for non-ceo', (d) => ((units(d)[1] as Obj).reportsTo = null)],
    ['unknown tier', (d) => ((units(d)[1] as Obj).tier = 'boss')],
    ['wrong schemaVersion', (d) => (d.overlay.schemaVersion = 2)],
    ['bad sourceSha256', (d) => (d.roster.sourceSha256 = 'xyz')],
    ['five floors', (d) => (d.overlay.floors = FLOORS.slice(1))],
    ['phrase longer than 48 chars', (d) => ((units(d)[1] as Obj).phrasesTr = ['x'.repeat(49), 'ok'])],
    ['one phrase only', (d) => ((units(d)[1] as Obj).phrasesTr = ['ok'])],
    ['empty roleTr', (d) => ((units(d)[1] as Obj).roleTr = '')],
    ['description over 600 chars', (d) => ((d.roster.agents as Obj[])[0]!.description = 'x'.repeat(601))],
    ['manual on a non-manual unit', (d) => ((units(d)[1] as Obj).manual = { description: 'x', tools: [], model: null })],
    ['not an object', (d) => { d.roster = null as unknown as Obj; }],
  ];
  for (const [label, mutate] of cases) {
    it(`rejects: ${label}`, () => {
      const d = valid();
      mutate(d);
      expect(loadData(d.roster, d.overlay).ok).toBe(false);
    });
  }

  it('rejects non-object inputs without throwing', () => {
    expect(loadData(undefined, 42).ok).toBe(false);
    expect(loadData('x', [])).toEqual({ ok: false, error: expect.any(String) });
  });
});
