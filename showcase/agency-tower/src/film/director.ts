// Story director of the promo film (`?film=1`, KARARLAR Rev 43). Pure: no three.js, no DOM, no timers. It starts the
// film job, walks the 18 scenes of script.ts on the film job's workflow events (scenes 3–17) or on time (1, 2, 12,
// 13, 18), picks the camera shot, the day speed and the office clock, and runs the captions and dialogue lines.
// Time is real (wall) seconds; the engine runs at the speed this director asks for.
import type { Scenario, Step } from '../data/scenarios';
import { DEFAULT_START, OFFICE_DAY_S, dayOffsetOf } from '../sim/schedule';
import type { Outcome, ScriptOutcomes, WfEvent } from '../sim/workflow';
import {
  CAPTION_FADE_S,
  DIRECTOR_SCENES,
  FILM_SPEED,
  FILM_LINES,
  FILM_OUTCOMES,
  FILM_SCENES,
  FILM_VARIANT,
  KEY_STEPS,
  LINE_S,
  MAX_BUBBLES,
  PLACE_STEPS,
  type FilmLine,
  type FilmScene,
  type FilmShot,
  type SceneTrigger,
} from './script';

/** The part of the workflow engine the director reads. */
export interface FilmWorkflow {
  startJob(variant: string, outcomes?: ScriptOutcomes): number;
  stepProgress(n: number, step: string): number | null;
  running(): { job: number; step: string; kind: string }[];
}

export interface FilmCaption {
  title: string;
  text: string;
  alpha: number;
}

export interface FilmLineView {
  line: FilmLine;
  alpha: number;
}

export interface FilmFrame {
  scene: FilmScene;
  /** Seconds into the scene. */
  local: number;
  sceneEntered: boolean;
  shot: FilmShot;
  /** The shot differs from last frame's (the app cuts / eases to it). */
  shotChanged: boolean;
  /** Engine speed multiplier (FILM_SPEED values; 1 before the start and after the end). */
  speed: number;
  done: boolean;
}

export interface FilmDirector {
  readonly started: boolean;
  readonly done: boolean;
  /** Seconds since start (wall). */
  readonly elapsed: number;
  start(): void;
  update(dt: number, events: readonly WfEvent[]): FilmFrame;
  caption(): FilmCaption | null;
  lines(): FilmLineView[];
  /** Simulation-like seconds for the office schedule (createOfficeTime's clock) so the office reads the scene's hour. */
  officeClock(): number;
  /** Scene numbers entered so far, with the wall second each started (tests, recorder). */
  timeline(): readonly { scene: number; at: number }[];
  /** Lines shown so far (tests). */
  played(): readonly FilmLine[];
}

/** Shot hold before a focus change may cut again (seconds), so quick hand-overs do not flicker. */
const SHOT_HOLD_S = 1.2;
const LINE_IN_S = 0.2;
const LINE_OUT_S = 0.3;

const officeSeconds = (hhmm: string): number => (((dayOffsetOf(hhmm) - dayOffsetOf(DEFAULT_START)) % OFFICE_DAY_S) + OFFICE_DAY_S) % OFFICE_DAY_S;
/** Office clock value at `f` (0..1) between two "HH:MM" readings (forward, wrapping the day). */
function officeBetween(a: string, b: string, f: number): number {
  const sa = officeSeconds(a);
  const span = (((officeSeconds(b) - sa) % OFFICE_DAY_S) + OFFICE_DAY_S) % OFFICE_DAY_S;
  return sa + span * Math.min(1, Math.max(0, f));
}

const shotKey = (s: FilmShot): string => (s.kind === 'place' ? `place:${s.place}` : `follow:${s.unit}`);

export function createFilmDirector(o: { workflow: FilmWorkflow; scenario: Scenario; outcomes?: Readonly<Record<string, readonly Outcome[]>> }): FilmDirector {
  const wf = o.workflow;
  const byId = new Map<string, Step>(o.scenario.steps.map((s) => [s.id, s]));
  const branches = new Set(o.scenario.steps.flatMap((s) => s.parallel ?? []));
  const outcomes = o.outcomes ?? FILM_OUTCOMES;

  let job = -1;
  let started = false;
  let done = false;
  let elapsed = 0;
  let idx = 0;
  let local = 0;
  let leaving = -1; // seconds into the caption fade-out before the cut; -1 = not leaving
  let entered = true;
  const seen = new Map<string, number>(); // `${type}:${step}` → count
  const active = new Set<string>(); // steps whose timed part has run
  let focus: Step | null = null;
  let shot: FilmShot = { kind: 'place', place: 'overview' };
  let lastShotKey = '';
  let shotAge = 0;
  const timeline: { scene: number; at: number }[] = [];
  const queue: { line: FilmLine; at: number }[] = [];
  const showing: { line: FilmLine; since: number }[] = [];
  const played: FilmLine[] = [];

  const scene = (): FilmScene => FILM_SCENES[idx]!;

  const schedule = (line: FilmLine, at: number): void => {
    queue.push({ line, at });
    queue.sort((a, b) => a.at - b.at);
  };

  function enterScene(i: number): void {
    idx = i;
    local = 0;
    leaving = -1;
    entered = true;
    timeline.push({ scene: scene().n, at: elapsed });
    for (const l of FILM_LINES) if (l.cue.kind === 'scene' && l.cue.scene === scene().n) schedule(l, elapsed + l.cue.at);
  }

  const triggered = (t: SceneTrigger | null): boolean => {
    if (!t) return true;
    if (t.kind === 'after') return local + 1e-9 >= t.seconds;
    if (t.kind === 'active') return active.has(t.step);
    return (seen.get(`${t.type}:${t.step}`) ?? 0) > 0;
  };

  function ingest(events: readonly WfEvent[]): void {
    for (const e of events) {
      if (e.job !== job || e.step === undefined) continue;
      const key = `${e.type}:${e.step}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (e.type === 'step-end') active.add(e.step);
      for (const l of FILM_LINES) {
        const c = l.cue;
        if (c.kind === 'event' && c.type === e.type && c.step === e.step && (c.n ?? 1) === n) schedule(l, elapsed + c.at);
      }
      if ((e.type === 'step-start' && !branches.has(e.step)) || e.type === 'call') focus = byId.get(e.step) ?? focus;
    }
  }

  function focusShot(): FilmShot {
    const s = focus;
    if (!s) return shot;
    const placeOf = PLACE_STEPS[s.id];
    if (placeOf) return { kind: 'place', place: placeOf };
    if (s.kind === 'sign') return active.has(s.id) || (wf.stepProgress(job, s.id) ?? 0) > 0 ? { kind: 'place', place: 'meeting' } : { kind: 'follow', unit: s.actors[0]! };
    if (s.id === 'comms') return { kind: 'follow', unit: 'marketing' };
    if (s.kind === 'call') return { kind: 'follow', unit: (s.parallel ?? []).map((b) => byId.get(b)?.actors[0]).find(Boolean) ?? s.actors[0]! };
    return { kind: 'follow', unit: s.actors[0]! };
  }

  function speedNow(): number {
    const n = scene().n;
    if (n <= 2) return FILM_SPEED.walk;
    // The R&D and break inserts run while the engineers build (4×, so the build is done when they end).
    if (n === 12 || n === 13) return FILM_SPEED.work;
    if (n === 18) return FILM_SPEED.key;
    let best: number = FILM_SPEED.walk;
    for (const r of wf.running()) {
      if (r.job !== job || r.kind === 'carry') continue;
      if ((wf.stepProgress(job, r.step) ?? 0) <= 0) continue;
      if (KEY_STEPS.has(r.step)) return FILM_SPEED.key;
      best = FILM_SPEED.work;
    }
    return best;
  }

  function stepLines(dt: number): void {
    for (let i = showing.length - 1; i >= 0; i--) if (elapsed - showing[i]!.since >= LINE_S) showing.splice(i, 1);
    while (queue.length && queue[0]!.at <= elapsed && showing.length < MAX_BUBBLES) {
      const { line } = queue.shift()!;
      showing.push({ line, since: elapsed });
      played.push(line);
    }
    void dt;
  }

  return {
    get started() {
      return started;
    },
    get done() {
      return done;
    },
    get elapsed() {
      return elapsed;
    },
    start() {
      if (started) return;
      started = true;
      job = wf.startJob(FILM_VARIANT, outcomes);
      enterScene(0);
    },
    update(dt, events) {
      const d = Math.max(0, dt);
      if (!started) return { scene: scene(), local: 0, sceneEntered: false, shot, shotChanged: false, speed: 1, done };
      ingest(events);
      for (const r of wf.running()) if (r.job === job && (wf.stepProgress(job, r.step) ?? 0) > 0) active.add(r.step);
      if (!done) {
        elapsed += d;
        local += d;
        shotAge += d;
        const next = FILM_SCENES[idx + 1];
        const ready = local + 1e-9 >= scene().minS && (next ? triggered(next.enter) : true);
        if (ready && leaving < 0) leaving = 0;
        else if (leaving >= 0) leaving += d;
        if (leaving >= CAPTION_FADE_S) {
          if (next) enterScene(idx + 1);
          else done = true;
        }
      }
      stepLines(d);
      const sc = scene();
      let want: FilmShot = shot;
      if (DIRECTOR_SCENES.has(sc.n) && sc.shots) {
        for (const [t, s] of sc.shots) if (local + 1e-9 >= t) want = s;
      } else {
        want = focusShot();
      }
      const key = shotKey(want);
      const sceneEntered = entered;
      entered = false;
      let changed = false;
      if (key !== lastShotKey && (sceneEntered || shotAge >= SHOT_HOLD_S || lastShotKey === '')) {
        shot = want;
        lastShotKey = key;
        shotAge = 0;
        changed = true;
      }
      return { scene: sc, local, sceneEntered, shot, shotChanged: changed, speed: done ? 1 : speedNow(), done };
    },
    caption() {
      if (!started) return null;
      const sc = scene();
      const fadeIn = Math.min(1, local / CAPTION_FADE_S);
      const fadeOut = leaving >= 0 ? Math.max(0, 1 - leaving / CAPTION_FADE_S) : 1;
      return { title: sc.title, text: sc.text, alpha: done ? 0 : Math.min(fadeIn, fadeOut) };
    },
    lines() {
      return showing.map(({ line, since }) => {
        const t = elapsed - since;
        return { line, alpha: Math.max(0, Math.min(1, t / LINE_IN_S, (LINE_S - t) / LINE_OUT_S)) };
      });
    },
    officeClock() {
      const sc = scene();
      return officeBetween(sc.office[0], sc.office[1], started ? local / sc.nominalS : 0);
    },
    timeline: () => timeline,
    played: () => played,
  };
}
