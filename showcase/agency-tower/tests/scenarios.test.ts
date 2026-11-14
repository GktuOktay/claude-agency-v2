import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadScenarios, indexScenario, renderRow, type Scenario } from '../src/data/scenarios';
import { VARIANT_TABLES } from '../src/data/variantTables';
import { boot, type BootDeps } from '../src/app/bootstrap';
import scenarios from '../src/data/scenarios.json';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import jobTitles from '../src/data/jobTitles.json';
import { appRoot } from './helpers';
import { unitFloors } from './workflowHelpers';

type Obj = Record<string, unknown>;
const UNITS = unitFloors();

const clone = (): Obj => JSON.parse(JSON.stringify(scenarios)) as Obj;
const scn = (d: Obj, id: string): Obj => (d.scenarios as Obj[]).find((s) => s.id === id)!;
const steps = (d: Obj, id: string): Obj[] => scn(d, id).steps as Obj[];
const step = (d: Obj, id: string, stepId: string): Obj => steps(d, id).find((s) => s.id === stepId)!;

function rejects(mutate: (d: Obj) => void, rule: RegExp): void {
  const d = clone();
  mutate(d);
  const r = loadScenarios(d, UNITS);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(rule);
}

const cases: [string, (d: Obj) => void, RegExp][] = [
  ['unknown unit id', (d) => ((step(d, 'l2-base', 'build').actors as string[])[0] = 'ghost-engineer'), /^P-9: .*unknown unit/],
  ['labelTr of 41 code points', (d) => (step(d, 'l2-base', 'build').labelTr = 'ç'.repeat(41)), /^schema: .*labelTr/],
  ['`to` on work', (d) => (step(d, 'l2-base', 'rework').to = ['qa-engineer']), /^matrix: .*forbids to/],
  ['`durationS` on carry', (d) => (step(d, 'l2-base', 'c-qa').durationS = [1, 2]), /^matrix: .*forbids durationS/],
  ['carry without `to`', (d) => delete step(d, 'l2-base', 'c-qa').to, /^matrix: .*requires to/],
  ['a lane without a scenario', (d) => (d.scenarios = (d.scenarios as Obj[]).filter((s) => s.lane !== 0)), /^lanes: lane 0/],
  ['a variant missing', (d) => (d.scenarios = (d.scenarios as Obj[]).filter((s) => s.id !== 'l2-input')), /^P-9: variant l2-input missing/],
  ['a row differing from its table', (d) => (step(d, 'l2-base', 'build').durationS = [8, 15]), /^P-9: l2-base: row build differs/],
  ['a step reachable by neither next nor loop', (d) => steps(d, 'l2-base').push({ id: 'orphan', kind: 'work', labelTr: 'Yetim', actors: ['business-analyst'], place: 'desk', durationS: [1, 2], next: 'done' }), /^P-1: .*orphan is unreachable/],
  ['no done', (d) => {
    const s = steps(d, 'l0-direct');
    s.splice(s.findIndex((x) => x.id === 'done'), 1);
    (s.find((x) => x.id === 'evidence') as Obj).next = 'fix';
  }, /^P-1: /],
  ['a next cycle', (d) => (step(d, 'l2-base', 'c-ia').next = 'build'), /^P-1: .*next cycle/],
  ['a loop.to that is neither a carry-back nor a re-entering rework step', (d) => ((step(d, 'l2-base', 'test').loop as Obj).to = 'c-ev'), /^loop: .*test\.loop\.to c-ev/],
  ['a carry-back by someone other than the rejecting actor', (d) => ((step(d, 'l2-base', 'rev-sc').loop as Obj).to = 'back-qa'), /^loop: /],
  ['maxLoops 3', (d) => ((step(d, 'l2-base', 'test').loop as Obj).maxLoops = 3), /^schema: .*maxLoops/],
  ['rejectP 0.7', (d) => (step(d, 'l2-base', 'test').rejectP = 0.7), /^schema: .*rejectP/],
  ['loop on a review inside a call branch', (d) => (step(d, 'l2-input', 'g-sc').loop = { to: 'rework', maxLoops: 1 }), /^branch: .*loop on g-sc inside a call branch/],
  ['a branch whose chain does not end at the join', (d) => (step(d, 'l2-input', 'g-as').next = 'done'), /^branch: .*g-as of gates does not end at join/],
  ['two branches sharing an actor', (d) => ((step(d, 'l2-input', 'g-as').actors as string[])[0] = 'spec-critic'), /^branch: .*share actor spec-critic/],
  ['an escort that is also an actor', (d) => (step(d, 'l2-base', 'rev-sc').escort = 'spec-critic'), /^matrix: .*escort spec-critic is also an actor/],
  ['a meeting with more than 6 actors (lead included)', (d) => (step(d, 'l2-base', 'meet').actors = ['business-analyst', 'react-engineer', 'qa-engineer', 'scout', 'marketing', 'tech-comms', 'devops-sre']), /^matrix: .*meeting takes 2-6 actors/],
  ['a lane-1 scenario containing spec-critic', (d) => {
    const s = steps(d, 'l1-quick');
    (s.find((x) => x.id === 'spec') as Obj).next = 'rev';
    s.push({ id: 'rev', kind: 'review', labelTr: 'İnceleme', actors: ['spec-critic'], place: 'desk', durationS: [4, 8], next: 'c-sign' });
  }, /^P-6: .*no spec-critic/],
  ['a build not preceded by a sign on some path', (d) => {
    (step(d, 'l2-base', 'rev-sc').loop as Obj).to = 'pre';
    scn(d, 'l2-base').steps = steps(d, 'l2-base').filter((x) => x.id !== 'back-sc' && x.id !== 'rework');
    steps(d, 'l2-base').push({ id: 'pre', kind: 'build', labelTr: 'Erken derleme', actors: ['react-engineer'], place: 'desk', durationS: [5, 8], next: 'c-sc' });
  }, /^P-3: .*build pre reachable without sign/],
  ['a review sharing an actor with the build it verifies', (d) => (step(d, 'l2-base', 'rev-ia').actors = ['react-engineer']), /^P-4: .*rev-ia shares an actor with build build/],
  ['a test sharing an actor with the pair build it verifies', (d) => {
    step(d, 'l3-full', 'test').actors = ['dotnet-engineer'];
    step(d, 'l3-full', 'back-qa').actors = ['dotnet-engineer'];
    step(d, 'l3-full', 'c-as').actors = ['dotnet-engineer'];
  }, /^P-4: .*test shares an actor with build build/],
  ['a spec review sharing an actor with the meeting lead', (d) => {
    step(d, 'l2-base', 'meet').next = 'self';
    steps(d, 'l2-base').push({ id: 'self', kind: 'review', labelTr: 'Kendi incelemesi', actors: ['business-analyst'], place: 'desk', durationS: [4, 8], next: 'c-sc' });
  }, /^P-4: .*review self shares an actor with the spec's work or meeting lead/],
  ['a spec review by the spec author (work step)', (d) => {
    const s = steps(d, 'l1-quick');
    (s.find((x) => x.id === 'spec') as Obj).next = 'self';
    s.push({ id: 'self', kind: 'review', labelTr: 'Kendi incelemesi', actors: ['business-analyst'], place: 'desk', durationS: [4, 8], next: 'c-sign' });
  }, /^P-4: .*self shares an actor with the spec's work/],
  ['a lane-3 gate set other than exactly the three gates', (d) => ((step(d, 'l3-full', 'g-ab').actors as string[])[0] = 'scout'), /^P-8: .*branches exactly spec-critic, appsec, architecture-board/],
  ['a lane-3 verify chain in the wrong order', (d) => {
    step(d, 'l3-full', 'c-as').to = ['internal-auditor'];
    step(d, 'l3-full', 'rev-as').actors = ['internal-auditor'];
    step(d, 'l3-full', 'c-ia').actors = ['internal-auditor'];
    step(d, 'l3-full', 'c-ia').to = ['appsec'];
    step(d, 'l3-full', 'rev-ia').actors = ['appsec'];
    step(d, 'l3-full', 'c-qo').actors = ['appsec'];
  }, /^P-8: .*verify chain/],
  ['a lane-3 verify chain without a carry between reviews', (d) => {
    step(d, 'l3-full', 'rev-as').next = 'rev-ia';
    steps(d, 'l3-full').splice(steps(d, 'l3-full').findIndex((x) => x.id === 'c-ia'), 1);
  }, /^P-8: .*verify chain/],
  ['a lane-2 scenario with quality-office', (d) => (step(d, 'l2-base', 'rev-ia').actors = ['quality-office']), /^P-7: .*no quality-office/],
  ['a lane-2 scenario with delivery-manager as a carrier', (d) => (step(d, 'l2-base', 'c-eng').actors = ['delivery-manager']), /^P-7: .*no delivery-manager/],
  ['a lane-0 scenario with a sign step', (d) => {
    (step(d, 'l0-direct', 'intake') as Obj).next = 'sgn';
    steps(d, 'l0-direct').push({ id: 'sgn', kind: 'sign', labelTr: 'İmza', actors: ['ceo', 'chief-of-staff'], place: 'signing-desk', durationS: [2, 3], next: 'fix' });
  }, /^P-2: .*no sign/],
  ['a lane-0 test step with another label', (d) => (step(d, 'l0-direct', 'evidence').labelTr = 'Test'), /^P-2: .*Kanıt: test çıktısı/],
  ['a lane 1-3 done not preceded by an evidence carry to chief-of-staff', (d) => (step(d, 'l2-base', 'c-ev').prop = 'build-tablet'), /^P-3: .*evidence carry/],
  ['a lane 1-3 done preceded by a review instead of the carry', (d) => {
    step(d, 'l1-quick', 'test').next = 'done';
    steps(d, 'l1-quick').splice(steps(d, 'l1-quick').findIndex((x) => x.id === 'c-ev'), 1);
  }, /^P-3: .*evidence carry/],
];

describe('scenarios.json (AC-2)', () => {
  it('the committed file validates', () => {
    const r = loadScenarios(scenarios, UNITS);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.laneWeights).toEqual([15, 35, 30, 20]);
    expect(r.data.scenarios.map((s) => s.id)).toEqual(['l0-direct', 'l1-quick', 'l2-base', 'l2-input', 'l2-dependency', 'l3-full']);
  });

  it('equals the §7.2 tables row by row', () => {
    const r = loadScenarios(scenarios, UNITS);
    if (!r.ok) throw new Error(r.error);
    for (const t of VARIANT_TABLES) {
      const s = r.data.scenarios.find((x) => x.id === t.id) as Scenario;
      const ix = indexScenario(s);
      const got = new Map(s.steps.map((st) => [st.id, renderRow(ix, st)]));
      expect(got.size).toBe(t.rows.length);
      for (const row of t.rows) {
        const id = row.split('|')[0]!.trim();
        expect(got.get(id), `${t.id}/${id}`).toBe(row.split('|').map((c) => c.trim()).join(' | '));
      }
      expect(s.lane).toBe(t.lane);
      expect(s.weight).toBe(t.weight);
    }
  });

  it('is at most 40 kB', () => {
    expect(readFileSync(join(appRoot, 'src/data/scenarios.json')).length).toBeLessThanOrEqual(40_000);
  });

  for (const [name, mutate, rule] of cases) {
    it(`rejects ${name}`, () => rejects(mutate, rule));
  }

  it('rejects a fixture with a 6-non-lead meeting (7 actors) but accepts 2-6 actors', () => {
    rejects((d) => (step(d, 'l2-base', 'meet').actors = ['business-analyst', 'react-engineer', 'qa-engineer', 'scout', 'marketing', 'tech-comms', 'talent-capacity']), /meeting takes 2-6/);
  });

  it('every committed label is 1-40 code points and every unit exists', () => {
    for (const s of (clone().scenarios as Obj[]).flatMap((x) => x.steps as Obj[])) {
      expect([...(s.labelTr as string)].length).toBeGreaterThan(0);
      expect([...(s.labelTr as string)].length).toBeLessThanOrEqual(40);
      for (const a of s.actors as string[]) expect(UNITS.has(a)).toBe(true);
    }
  });
});

describe('invalid scenario data yields the data-error state (AC-2, REQ-2)', () => {
  function deps(scen: unknown): { deps: BootDeps; root: HTMLElement } {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    return {
      root,
      deps: { root, loadRaw: () => Promise.resolve({ roster, overlay: hierarchy, scenarios: scen, jobTitles }), hasWebGL2: () => true, startScene: () => undefined },
    };
  }

  it('boots to the scene with the committed scenarios', async () => {
    const { deps: d } = deps(scenarios);
    expect(await boot(d)).toBe('scene');
  });

  for (const [name, mutate] of cases.slice(0, 6)) {
    it(`shows "Kadro verisi okunamadı." for: ${name}`, async () => {
      const bad = clone();
      mutate(bad);
      const { deps: d, root } = deps(bad);
      expect(await boot(d)).toBe('data-error');
      expect(root.textContent).toBe('Kadro verisi okunamadı.');
    });
  }

  it('checks scenarios before WebGL2 (fallback never shown for bad data)', async () => {
    const bad = clone();
    bad.schemaVersion = 2;
    const { deps: d } = deps(bad);
    d.hasWebGL2 = () => false;
    expect(await boot(d)).toBe('data-error');
  });
});
