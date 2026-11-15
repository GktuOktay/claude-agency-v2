// Promo film (KARARLAR Rev 43, screenplay "Bir işin yolculuğu"): the film-flagship scenario, the story director's
// timeline on the real engine (nav movement + staff elevator), captions, dialogue lines and the random pool.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import roster from '../src/data/roster.generated.json';
import scenariosRaw from '../src/data/scenarios.json';
import { loadStandaloneScenario, type Scenario } from '../src/data/scenarios';
import { FILM_SCENARIO_RAW, loadFilmScenario, withFilm } from '../src/film/filmData';
import { createFilmDirector, type FilmDirector } from '../src/film/director';
import { DIRECTOR_SCENES, FILM_LINES, FILM_PLACES, FILM_SCENES, FILM_SPEED, FILM_VARIANT, LINE_S, MAX_BUBBLES } from '../src/film/script';
import { createFilmOverlay, installFilmHook, toCanvasPixels } from '../src/film/overlay';
import { filmShotPlan } from '../src/film/shots';
import { createWorkflow, type WfEvent, type Workflow } from '../src/sim/workflow';
import { createOfficeSchedule, periodAt } from '../src/sim/schedule';
import { createStepPacer } from '../src/sim/dayControl';
import { appRoot } from './helpers';
import { scenarioSet, unitFloors } from './workflowHelpers';

const UNITS = unitFloors();
const film = (): Scenario => {
  const s = loadFilmScenario(UNITS);
  if (!s) throw new Error('film scenario invalid');
  return s;
};

const actorsOf = (s: Scenario): Set<string> => new Set(s.steps.flatMap((st) => [...st.actors, ...(st.escort ? [st.escort] : [])]));

interface Run {
  wf: Workflow;
  dir: FilmDirector;
  maxBubbles: number;
  speeds: Set<number>;
  captionNull: boolean;
  /** Office periods seen per scene. */
  periods: Map<number, Set<string>>;
  /** Wall seconds each dialogue line was on screen. */
  lineShown: Map<string, number>;
}

/** Plays the film like the app does: 30 fps wall frames, `speed` engine sub-steps per frame (simRuntime.frame paces 1.5×). */
function playFilm(maxWallS = 400): Run {
  const wf = createWorkflow({ scenarios: withFilm(scenarioSet(), film()), units: UNITS, scripted: false, autoStart: false, record: true });
  const dir = createFilmDirector({ workflow: wf, scenario: film() });
  const captionNull = dir.caption() === null;
  dir.start();
  const dt = 1 / 30;
  let speed = 1;
  let maxBubbles = 0;
  const speeds = new Set<number>();
  const periods = new Map<number, Set<string>>();
  const lineShown = new Map<string, number>();
  const pace = createStepPacer();
  for (let i = 0; i < maxWallS * 30 && !dir.done; i++) {
    const events: WfEvent[] = [];
    const steps = Math.max(1, pace(speed));
    for (let k = 0; k < steps; k++) {
      wf.step(dt);
      events.push(...wf.drainEvents());
    }
    const f = dir.update(dt, events);
    speed = f.speed;
    speeds.add(speed);
    maxBubbles = Math.max(maxBubbles, dir.lines().length);
    for (const v of dir.lines()) lineShown.set(v.line.text, (lineShown.get(v.line.text) ?? 0) + dt);
    const ps = periods.get(f.scene.n) ?? new Set<string>();
    ps.add(periodAt(dir.officeClock()));
    periods.set(f.scene.n, ps);
  }
  return { wf, dir, maxBubbles, speeds, captionNull, periods, lineShown };
}

describe('film-flagship scenario', () => {
  it('validates with the pool rules (schema, matrix, P-1..P-8) and is lane 3', () => {
    const r = loadStandaloneScenario(FILM_SCENARIO_RAW, UNITS);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.id).toBe(FILM_VARIANT);
    expect(r.data.lane).toBe(3);
  });

  it('every one of the 20 actors (ceo, chief-of-staff and the 18 roster units) acts in at least one step', () => {
    const want = ['ceo', 'chief-of-staff', ...roster.agents.map((a) => a.name)];
    expect(want).toHaveLength(20);
    const got = actorsOf(film());
    for (const u of want) expect(got.has(u), u).toBe(true);
  });

  it('has the screenplay beats: one spec-critic loop, the CEO stamp, 4 parallel engineers, QA red→green, the gates and final CEO acceptance', () => {
    const s = film();
    const by = new Map(s.steps.map((x) => [x.id, x]));
    expect(by.get('gates')?.loop).toEqual({ to: 'rework', maxLoops: 1 });
    expect(by.get('sign')?.actors[0]).toBe('ceo');
    const code = by.get('code')!;
    expect(new Set((code.parallel ?? []).flatMap((b) => by.get(b)!.actors))).toEqual(new Set(['dotnet-engineer', 'react-engineer', 'polyglot-engineer', 'devops-sre']));
    expect(by.get('test')?.loop?.to).toBe('fix');
    for (const u of ['appsec', 'internal-auditor', 'quality-office']) expect(s.steps.some((x) => x.kind === 'review' && x.actors[0] === u)).toBe(true);
    for (const u of ['marketing', 'tech-comms', 'talent-capacity']) expect(s.steps.some((x) => x.actors.includes(u))).toBe(true);
    expect(by.get('accept')?.actors).toEqual(['ceo']);
  });

  it('stays out of the random pool: scenarios.json does not contain it and the pool set is unchanged', () => {
    expect(JSON.stringify(scenariosRaw)).not.toContain(FILM_VARIANT);
    expect(scenarioSet().scenarios.map((s) => s.id)).toEqual(['l0-direct', 'l1-quick', 'l2-base', 'l2-input', 'l2-dependency', 'l3-full']);
    const set = withFilm(scenarioSet(), film());
    expect(set.scenarios.map((s) => s.id)).toContain(FILM_VARIANT);
    expect(scenarioSet().scenarios).toHaveLength(6); // withFilm copies, never mutates the pool
  });
});

describe('film story director', () => {
  const r = playFilm();

  // CEO film review "daha hızlı bir çekim istiyorum": 203 s -> 110–140 s.
  it('ends (the tour onEnd fires on this) within 110–140 s of wall time', () => {
    expect(r.dir.done).toBe(true);
    console.info(`film length ${r.dir.elapsed.toFixed(1)} s`);
    expect(r.dir.elapsed).toBeGreaterThanOrEqual(110);
    expect(r.dir.elapsed).toBeLessThanOrEqual(140);
  });

  it('holds the director shots (scenes 1, 2, 12, 13, 18) at most 6 s each', () => {
    const tl = r.dir.timeline();
    for (let i = 0; i < tl.length; i++) {
      const n = tl[i]!.scene;
      if (!DIRECTOR_SCENES.has(n)) continue;
      const end = tl[i + 1]?.at ?? r.dir.elapsed;
      expect(end - tl[i]!.at, `scene ${n}`).toBeLessThanOrEqual(6 + 0.6);
      expect(FILM_SCENES.find((s) => s.n === n)!.minS, `scene ${n}`).toBeLessThanOrEqual(6);
    }
  });

  it('keeps every caption and every dialogue line on screen at least 1.8 s', () => {
    const tl = r.dir.timeline();
    for (let i = 0; i < tl.length; i++) {
      const end = tl[i + 1]?.at ?? r.dir.elapsed;
      expect(end - tl[i]!.at, `caption ${tl[i]!.scene}`).toBeGreaterThanOrEqual(1.8);
    }
    for (const l of FILM_LINES) expect(r.lineShown.get(l.text) ?? 0, l.text).toBeGreaterThanOrEqual(1.8);
  });

  it('plays the 18 scenes in order, each at least its minimum', () => {
    const tl = r.dir.timeline();
    expect(tl.map((t) => t.scene)).toEqual(FILM_SCENES.map((s) => s.n));
    for (let i = 0; i < tl.length - 1; i++) expect(tl[i + 1]!.at - tl[i]!.at + 1e-6).toBeGreaterThanOrEqual(FILM_SCENES[i]!.minS);
  });

  it('cuts scenes 3–17 on the film job’s step events: scene 14 starts after the builds, 12–13 while they run', () => {
    const tl = new Map(r.dir.timeline().map((t) => [t.scene, t.at]));
    const trace = r.wf.trace();
    const buildEnd = Math.max(...trace.filter((e) => e.type === 'step-end' && (e.step === 'b-api' || e.step === 'b-ops')).map((e) => e.t));
    const buildStart = Math.min(...trace.filter((e) => e.type === 'step-start' && e.step === 'b-api').map((e) => e.t));
    expect(buildStart).toBeGreaterThan(0);
    expect(tl.get(14)!).toBeGreaterThan(tl.get(13)!);
    expect(tl.get(12)!).toBeGreaterThan(tl.get(11)!);
    expect(trace.some((e) => e.type === 'job-start' && e.variant === FILM_VARIANT)).toBe(true);
    // the film job is the only job: no random job started
    expect(trace.filter((e) => e.type === 'job-start')).toHaveLength(1);
    expect(buildEnd).toBeGreaterThan(buildStart);
  });

  it('runs the scripted loops: the critic sends the spec back once, QA goes red once, then green', () => {
    const t = r.wf.trace();
    expect(t.filter((e) => e.type === 'reject' && e.step === 'gates')).toHaveLength(1);
    expect(t.filter((e) => e.type === 'step-end' && e.step === 'test').map((e) => e.outcome)).toEqual(['reject', 'pass']);
    expect(t.some((e) => e.type === 'sign')).toBe(true);
  });

  it('runs 8× on walks, 4× on desk work and 1.5× at key moments', () => {
    expect(FILM_SPEED).toEqual({ walk: 8, work: 4, key: 1.5 });
    expect(r.speeds.has(8)).toBe(true);
    expect(r.speeds.has(4)).toBe(true);
    expect(r.speeds.has(1.5)).toBe(true);
  });

  it('schedules and shows every dialogue row of the screenplay, never more than 2 bubbles at once', () => {
    const shown = new Set(r.dir.played());
    for (const l of FILM_LINES) expect(shown.has(l), `${l.scene} ${l.who}: ${l.text}`).toBe(true);
    expect(r.maxBubbles).toBeLessThanOrEqual(MAX_BUBBLES);
    expect(LINE_S).toBeLessThanOrEqual(2.5);
  });

  it('every dialogue row matches the screenplay table (scene, speaker → listener, line)', () => {
    const md = readFileSync(join(appRoot, '../../docs/film/tanitim-senaryosu.md'), 'utf8');
    const table = md.slice(md.indexOf('## Diyaloglar'));
    const rows = table.split('\n').filter((l) => /^\| \d+ \|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
    expect(rows).toHaveLength(FILM_LINES.length);
    rows.forEach((row, i) => {
      const l = FILM_LINES[i]!;
      expect(Number(row[1])).toBe(l.scene);
      expect(row[2]).toBe(l.who);
      expect(row[3]).toBe(`"${l.text}"`);
    });
  });

  it('captions are the screenplay table text, fade in and out, and are null before the film starts', () => {
    expect(r.captionNull).toBe(true);
    const md = readFileSync(join(appRoot, '../../docs/film/tanitim-senaryosu.md'), 'utf8');
    for (const s of FILM_SCENES) expect(md).toContain(`| ${s.n} | ${s.title} |`);
    for (const s of FILM_SCENES) expect(md).toContain(`"${s.text}"`);
    const wf = createWorkflow({ scenarios: withFilm(scenarioSet(), film()), units: UNITS, scripted: false, autoStart: false });
    const d = createFilmDirector({ workflow: wf, scenario: film() });
    d.start();
    d.update(0.1, []);
    const a = d.caption()!;
    expect(a.title).toBe('Açılış');
    expect(a.alpha).toBeGreaterThan(0);
    expect(a.alpha).toBeLessThan(1);
    d.update(1, []);
    expect(d.caption()!.alpha).toBe(1);
  });

  it('drives the office clock: the film opens at 08:30, scene 13 is lunch and no other scene is a break', () => {
    const wf = createWorkflow({ scenarios: withFilm(scenarioSet(), film()), units: UNITS, scripted: false, autoStart: false });
    const d = createFilmDirector({ workflow: wf, scenario: film() });
    const office = createOfficeSchedule({ get time() { return d.officeClock(); } });
    expect(office.now()).toMatchObject({ hh: 8, mm: 30 });
    expect([...(r.periods.get(13) ?? [])]).toEqual(['lunch']);
    for (const [n, ps] of r.periods) if (n !== 13) for (const p of ps) expect(['work', 'after'], `scene ${n}`).toContain(p);
  });
});

describe('film overlay and recorder hook', () => {
  it('shows the lower-third caption (title + text) with its alpha and the bubbles at their positions', () => {
    const o = createFilmOverlay();
    o.update({ title: 'Açılış', text: 'Sabah 08:30. Şirket uyanıyor.', alpha: 0.5 }, [{ x: 100, y: 50, text: 'Günaydın efendim!', alpha: 1 }]);
    const cap = o.element.querySelector('.film-caption') as HTMLElement;
    expect(cap.hidden).toBe(false);
    expect(o.element.querySelector('.film-caption-title')?.textContent).toBe('Açılış');
    expect(o.element.querySelector('.film-caption-text')?.textContent).toBe('Sabah 08:30. Şirket uyanıyor.');
    expect(Number(cap.style.opacity)).toBe(0.5);
    const b = o.element.querySelector('.film-bubble') as HTMLElement;
    expect(b.textContent).toBe('Günaydın efendim!');
    expect(b.style.transform).toMatch(/^translate\(100(\.0)?px, 50(\.0)?px\)/);
    o.update(null, []);
    expect(cap.hidden).toBe(true);
    expect(b.hidden).toBe(true);
  });

  it('installs window.__film only in film mode; bubbles map to canvas pixels', () => {
    const api = { caption: () => null, bubbles: () => [] };
    const off: { __film?: unknown } = {};
    installFilmHook(off, api, { film: false });
    expect(off.__film).toBeUndefined();
    const on: { __film?: unknown } = {};
    installFilmHook(on, api, { film: true });
    expect(on.__film).toBe(api);
    expect(toCanvasPixels({ x: 10, y: 20, text: 'a', alpha: 1 }, 960, 540, 1920, 1080)).toEqual({ x: 20, y: 40, text: 'a', alpha: 1 });
  });

  it('film mode keeps the overlay visible while every other control is hidden', () => {
    const css = readFileSync(join(appRoot, 'src/ui/style.css'), 'utf8');
    expect(css).toMatch(/html\.is-film #app > :not\(\.tower-canvas\):not\(\.film-overlay\)/);
    expect(css).toMatch(/html\.is-film \.film-overlay \{ display: block; \}/);
  });

  it('every film place has a tour shot; the finale ends on the golden overview', () => {
    for (const p of FILM_PLACES) expect(filmShotPlan(p).length, p).toBeGreaterThan(0);
    expect(filmShotPlan('finale').map((s) => s.name)).toEqual(['roof', 'finale']);
  });
});
