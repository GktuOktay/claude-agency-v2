// Spec 0002 AC-10 (REQ-11), UI parts of AC-15 (REQ-16..18): job strip, floor rule, pause texts, toggle.
import { describe, it, expect, beforeEach } from 'vitest';
import { createSimRuntime, type SimRuntime } from '../src/app/simRuntime';
import { rideToFloor } from '../src/app/stripActivation';
import { boot } from '../src/app/bootstrap';
import { CameraRig } from '../src/scene/camera';
import { createTimedMovement, type Movement } from '../src/sim/movement';
import type { WorkflowOptions } from '../src/sim/workflow';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import scenarios from '../src/data/scenarios.json';
import jobTitles from '../src/data/jobTitles.json';
import { makeWorkflow, run, scenarioSet, unitFloors } from './workflowHelpers';

const TITLES = ['<b>Kayıt</b> formu', 'Fatura ekranı', 'Rapor sayfası', 'Arama kutusu', 'Profil ayarları'];

function makeRuntime(over: { narrow?: boolean; workflow?: Partial<WorkflowOptions>; rides?: number[] } = {}): SimRuntime {
  const rides = over.rides ?? [];
  const rt = createSimRuntime({
    scenarios: scenarioSet(),
    units: unitFloors(),
    titles: TITLES,
    maxJobs: 3,
    isNarrow: () => over.narrow ?? false,
    reducedMotion: () => false,
    rideTo: (f) => rides.push(f),
    workflow: over.workflow,
  });
  document.body.replaceChildren(rt.strip.element, rt.pauseButton);
  return rt;
}
/** Feeds frames of 100 ms. */
const frames = (rt: SimRuntime, seconds: number, each?: () => boolean | void): void => {
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    rt.frame(100);
    if (each?.() === true) return;
  }
};
const entries = (rt: SimRuntime): HTMLElement[] => [...rt.strip.element.querySelectorAll<HTMLElement>('[data-job]')];
const entry = (rt: SimRuntime, n: number): HTMLElement | null => rt.strip.element.querySelector<HTMLElement>(`[data-job="${n}"]`);
const visible = (e: HTMLElement): boolean => !e.hidden && !e.closest('[hidden]');

function overridable(): { movement: Movement; over: Map<string, number> } {
  const inner = createTimedMovement(unitFloors());
  const over = new Map<string, number>();
  const movement: Movement = { ...inner, floorOf: (u) => over.get(u) ?? inner.floorOf(u) };
  return { movement, over };
}

beforeEach(() => document.body.replaceChildren());

describe('job strip DOM (AC-10)', () => {
  it('shows the heading and the empty text when no job is active', () => {
    const rt = makeRuntime();
    rt.frame(100);
    const h = rt.strip.element.querySelector('h2')!;
    expect(h.textContent).toBe('Aktif işler — simülasyon');
    expect(h.getAttribute('tabindex')).toBe('-1');
    expect(rt.strip.element.textContent).toContain('Şu an aktif iş yok — yeni iş bekleniyor');
    expect(rt.strip.element.getAttribute('aria-live')).toBeNull();
  });

  it('entry lines "#n · Hat k · <title>" and the running step label, set as text', () => {
    const rt = makeRuntime();
    frames(rt, 3);
    const e = entry(rt, 1)!;
    expect(e).not.toBeNull();
    const job = rt.workflow.jobs()[0]!;
    const btn = e.querySelector('button.job-entry')!;
    expect(btn.textContent).toContain('#1 · Hat 2 · <b>Kayıt</b> formu');
    expect(btn.textContent).toContain(job.label);
    expect(e.querySelector('b')).toBeNull();
    expect(rt.strip.element.textContent).not.toContain('Şu an aktif iş yok');
  });

  it('shows the call label while parallel branches run', () => {
    const rt = makeRuntime({ workflow: { scripted: false, autoStart: false } });
    const n = rt.workflow.startJob('l3-full');
    const callIds = new Set(scenarioSet().scenarios.find((s) => s.id === 'l3-full')!.steps.filter((s) => s.kind === 'call').map((s) => s.id));
    let found = false;
    frames(rt, 600, () => {
      const call = rt.workflow.running().find((r) => r.job === n && r.kind === 'call');
      if (call && callIds.has(call.step)) {
        const label = scenarioSet().scenarios.find((s) => s.id === 'l3-full')!.steps.find((s) => s.id === call.step)!.labelTr;
        expect(entry(rt, n)!.querySelector('.job-step')!.textContent).toBe(label);
        found = true;
        return true;
      }
    });
    expect(found).toBe(true);
  });

  it('"↺ m" equals the job total loops after a rejection', () => {
    const rt = makeRuntime();
    frames(rt, 400, () => (rt.workflow.jobs().find((j) => j.n === 1)?.loops ?? 0) >= 1);
    expect(rt.workflow.jobs().find((j) => j.n === 1)!.loops).toBe(1);
    expect(entry(rt, 1)!.querySelector('.job-loops')!.textContent).toBe('↺ 1');
  });

  it('"Tamamlandı" is static for 4 s of simulation time, frozen while paused, then removed; focus goes to the header', () => {
    const rt = makeRuntime({ workflow: { scripted: false, autoStart: false } });
    const n = rt.workflow.startJob('l0-direct');
    rt.frame(100);
    entry(rt, n)!.querySelector<HTMLButtonElement>('button.job-entry')!.focus();
    frames(rt, 300, () => rt.workflow.jobs().some((j) => j.n === n && j.done));
    const e = entry(rt, n)!;
    expect(e.textContent).toContain('Tamamlandı · kanıt: taze test çıktısı');
    expect(e.querySelector('button')).toBeNull(); // static text, not activatable
    expect(document.activeElement).toBe(rt.strip.element.querySelector('h2'));
    rt.pauseButton.click(); // user pause
    frames(rt, 10);
    expect(entry(rt, n)!.textContent).toContain('Duraklatıldı');
    expect(entry(rt, n)!.textContent).toContain('Tamamlandı');
    rt.pauseButton.click();
    frames(rt, 3.5);
    expect(entry(rt, n)).not.toBeNull();
    frames(rt, 0.6);
    expect(entry(rt, n)).toBeNull();
    expect(rt.strip.element.textContent).toContain('Şu an aktif iş yok');
  });

  it('moves focus to the header when a focused entry is removed', () => {
    const rt = makeRuntime({ workflow: { scripted: false, autoStart: false } });
    const n = rt.workflow.startJob('l0-direct');
    rt.frame(100);
    frames(rt, 300, () => rt.workflow.jobs().some((j) => j.n === n && j.done));
    const steps = entry(rt, n)!; // done entry: give it focus via the header path, then remove
    expect(steps).not.toBeNull();
    const m = rt.workflow.startJob('l0-direct');
    rt.frame(100);
    entry(rt, m)!.querySelector<HTMLButtonElement>('.job-steps-toggle')!.focus();
    frames(rt, 300, () => entry(rt, m)?.querySelector('.job-steps-toggle') == null);
    expect(document.activeElement).toBe(rt.strip.element.querySelector('h2'));
  });

  it('"Adımlar" toggles aria-expanded and lists every step with symbol and word', () => {
    const rt = makeRuntime();
    frames(rt, 60);
    const e = entry(rt, 1)!;
    const t = e.querySelector<HTMLButtonElement>('.job-steps-toggle')!;
    expect(t.textContent).toBe('Adımlar');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    const list = e.querySelector<HTMLElement>('.job-steps')!;
    expect(list.hidden).toBe(true);
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(entry(rt, 1)!.querySelector<HTMLElement>('.job-steps')!.hidden).toBe(false);
    const view = rt.workflow.jobs().find((j) => j.n === 1)!;
    const items = [...list.querySelectorAll('li')].map((li) => li.textContent);
    expect(items.length).toBe(view.steps.length);
    const words: Record<string, string> = { done: '✓ bitti', now: '▶ şimdi', next: '○ sırada', returned: '↺ geri döndü' };
    view.steps.forEach((s, i) => expect(items[i]).toBe(`${words[s.mark]} · ${s.label}`));
    expect(items.some((x) => x?.startsWith('✓ bitti'))).toBe(true);
    expect(items.some((x) => x?.startsWith('○ sırada'))).toBe(true);
    frames(rt, 1);
    expect(entry(rt, 1)!.querySelector('.job-steps-toggle')!.getAttribute('aria-expanded')).toBe('true'); // kept across frames
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands every step list by default under reduced motion', () => {
    const rt = createSimRuntime({
      scenarios: scenarioSet(), units: unitFloors(), titles: TITLES, maxJobs: 3,
      isNarrow: () => false, reducedMotion: () => true, rideTo: () => undefined,
    });
    for (let i = 0; i < 30; i++) rt.frame(100);
    expect(rt.strip.element.querySelector('.job-steps-toggle')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('below 768 px shows only the newest entry plus "+n diğer", which reveals the rest', () => {
    const rt = makeRuntime({ narrow: true });
    frames(rt, 35);
    const all = entries(rt);
    expect(all.length).toBe(3);
    const shown = all.filter(visible);
    expect(shown.map((e) => e.dataset.job)).toEqual(['3']);
    const more = [...rt.strip.element.querySelectorAll('button')].find((b) => b.textContent === '+2 diğer')!;
    expect(more).toBeDefined();
    expect(more.getAttribute('aria-expanded')).toBe('false');
    more.click();
    expect(entries(rt).filter(visible).length).toBe(3);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const wide = makeRuntime({ narrow: false });
    frames(wide, 35);
    expect(entries(wide).filter(visible).length).toBe(3);
    expect([...wide.strip.element.querySelectorAll('button')].some((b) => b.textContent?.endsWith('diğer'))).toBe(false);
  });

  it('activating an entry rides to the engine §7.6b floor', () => {
    const rides: number[] = [];
    const rt = makeRuntime({ rides });
    frames(rt, 3);
    const want = rt.workflow.stripFloor(1);
    entry(rt, 1)!.querySelector<HTMLButtonElement>('button.job-entry')!.click();
    expect(rides).toEqual([want]);
  });
});

describe('§7.6b floor rule fixtures (AC-10)', () => {
  it('parallel actors on floors 2 and 3 → 2', () => {
    const { movement, over } = overridable();
    const wf = makeWorkflow({ scripted: false, autoStart: false, movement });
    const n = wf.startJob('l3-full');
    let checked = false;
    run(wf, 900, () => {
      if (checked) return;
      const own = wf.running().filter((r) => r.job === n && r.kind !== 'call');
      if (own.length >= 2 && wf.running().some((r) => r.job === n && r.kind === 'call')) {
        const step = scenarioSet().scenarios.find((s) => s.id === 'l3-full')!.steps;
        const actors = own.flatMap((r) => step.find((s) => s.id === r.step)!.actors);
        actors.forEach((a, i) => over.set(a, i === 0 ? 3 : 2));
        const caller = wf.running().find((r) => r.job === n && r.kind === 'call')!.units;
        for (const c of caller) over.set(c, 3);
        expect(wf.stripFloor(n)).toBe(2);
        over.clear();
        checked = true;
      }
    });
    expect(checked).toBe(true);
  });

  it('a rider counts on its destination floor', () => {
    const wf = makeWorkflow({ scripted: false, autoStart: false });
    const n = wf.startJob('l2-base');
    let checked = false;
    run(wf, 300, () => {
      if (checked) return;
      const own = wf.running().filter((r) => r.job === n);
      const units = own.flatMap((r) => r.units);
      if (units.length === 1 && wf.movement.phase(units[0]!) === 'ride') {
        const snap = wf.movement.snapshot() as { id: string; floor: number; legs: { kind: string; floor: number }[] }[];
        const me = snap.find((s) => s.id === units[0])!;
        expect(me.legs[0]!.floor).not.toBe(me.floor);
        expect(wf.stripFloor(n)).toBe(me.legs[0]!.floor);
        checked = true;
      }
    });
    expect(checked).toBe(true);
  });

  it('no running step: the first actor of the earliest waiting step decides (floor 1)', () => {
    const { movement, over } = overridable();
    const wf = makeWorkflow({ scripted: false, autoStart: false, movement });
    wf.startJob('l2-base');
    const b = wf.startJob('l2-base');
    run(wf, 0.3);
    expect(wf.running().some((r) => r.job === b)).toBe(false);
    over.set('ceo', 1); // first actor of job b's waiting intake
    expect(wf.stripFloor(b)).toBe(1);
  });
});

describe('strip activation order (AC-10)', () => {
  it('closes an open card first, leaves org mode first, and the last request wins mid-ride', () => {
    const calls: string[] = [];
    const rig = new CameraRig();
    const deps = {
      cardOpen: () => true,
      closeCard: () => calls.push('close-card'),
      orgOn: () => true,
      leaveOrg: () => calls.push('leave-org'),
      goFloor: (f: number) => {
        calls.push(`floor-${f}`);
        rig.goToFloor(f);
      },
    };
    rideToFloor(deps, 2);
    expect(calls).toEqual(['close-card', 'leave-org', 'floor-2']);
    rig.update(0.2);
    expect(rig.busy).toBe(true);
    rideToFloor({ ...deps, cardOpen: () => false, orgOn: () => false }, 4);
    for (let i = 0; i < 200; i++) rig.update(0.05);
    expect(rig.mode).toBe('floor');
    expect(rig.floor).toBe(4);
  });
});

describe('pause texts and "Hareketi durdur" (AC-15 UI)', () => {
  it('global pause: every entry reads "Duraklatıldı" and the clock does not advance', () => {
    const rt = makeRuntime();
    frames(rt, 35);
    rt.setOrg(true);
    const t = rt.clock.time;
    frames(rt, 5);
    expect(rt.clock.time).toBe(t);
    for (const e of entries(rt)) expect(e.querySelector('.job-pause')!.textContent).toBe('Duraklatıldı');
    rt.setOrg(false);
    rt.setHidden(true);
    frames(rt, 1);
    expect(rt.clock.time).toBe(t);
    rt.setHidden(false);
    rt.frame(100);
    expect(rt.clock.time).toBeGreaterThan(t);
    for (const e of entries(rt)) expect(e.querySelector('.job-pause')).toBeNull();
  });

  it('selection: that job reads "Duraklatıldı · seçili robot", another job does not', () => {
    const rt = makeRuntime();
    frames(rt, 35);
    const r = rt.workflow.running().find((x) => x.job === 2 && x.units.length > 0)!;
    rt.select(r.units[0]!);
    rt.frame(100);
    expect(entry(rt, 2)!.querySelector('.job-pause')!.textContent).toBe('Duraklatıldı · seçili robot');
    const others = rt.workflow.jobs().filter((j) => j.n !== 2 && !j.pausedBySelection);
    for (const j of others) expect(entry(rt, j.n)!.querySelector('.job-pause')).toBeNull();
    rt.release(r.units[0]!);
    rt.frame(100);
    expect(entry(rt, 2)!.querySelector('.job-pause')).toBeNull();
  });

  it('the toggle sets aria-pressed, switches its text, pauses; org + toggle: turning one off keeps paused; no camera move', () => {
    const rt = makeRuntime();
    const rig = new CameraRig();
    const before = { mode: rig.mode, floor: rig.floor, pos: rig.position.clone(), busy: rig.busy };
    const b = rt.pauseButton;
    expect(b.textContent).toBe('Hareketi durdur');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    b.click();
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.textContent).toBe('Sürdür');
    expect(rt.clock.paused).toBe(true);
    rt.setOrg(true);
    b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(rt.clock.paused).toBe(true);
    rt.setOrg(false);
    expect(rt.clock.paused).toBe(false);
    rig.update(0.5);
    expect({ mode: rig.mode, floor: rig.floor, pos: rig.position.clone(), busy: rig.busy }).toEqual(before);
  });
});

describe('strip absent outside the scene (AC-10)', () => {
  it('no strip element in the data-error state (invalid job titles)', async () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const state = await boot({
      root,
      loadRaw: () => Promise.resolve({ roster, overlay: hierarchy, scenarios, jobTitles: { schemaVersion: 1, titlesTr: ['tek'] } }),
      hasWebGL2: () => true,
      startScene: () => undefined,
    });
    expect(state).toBe('data-error');
    expect(root.querySelector('.job-strip')).toBeNull();
    expect(root.textContent).not.toContain('Aktif işler');
  });

  it('the scene context carries the validated titles', async () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    let titles: readonly string[] = [];
    await boot({
      root,
      loadRaw: () => Promise.resolve({ roster, overlay: hierarchy, scenarios, jobTitles }),
      hasWebGL2: () => true,
      startScene: (ctx) => (titles = ctx.titles),
    });
    expect(titles).toEqual(jobTitles.titlesTr);
  });
});
