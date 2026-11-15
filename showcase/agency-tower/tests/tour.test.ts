// KARARLAR Rev 43 package A: "Tanıtım turu", a cinematic camera tour (overview orbit → lobby → engineering →
// Ar-Ge → meeting room → gym wing → roof garden → follow a robot → golden overview), its UI and the film hook.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { TOUR_PLACES, createTourPlayer, installTourHook, tourParams, tourPlan, tourTotal, type TourPose } from '../src/scene/tour';
import { createTourUi } from '../src/ui/tourUi';
import { createKeyHandler, type KeyState } from '../src/ui/keymap';
import { overviewPose } from '../src/scene/camera';

const css = readFileSync('src/ui/style.css', 'utf8');

const start = (): TourPose => ({ pos: new Vector3(40, 30, 40), target: new Vector3(0, 8, 0), fov: 32 });

/** Runs the player at 60 fps; follow segments get a fixed camera supplied by the caller. */
function run(reduced: boolean) {
  const p = createTourPlayer(tourPlan(), reduced);
  let cam = start();
  const frames: { pose: TourPose; name: string; golden: number; follow: boolean }[] = [];
  for (let i = 0; i < 60 * 90 && !p.done; i++) {
    const f = p.update(1 / 60, cam);
    if (f.pose) cam = { pos: f.pose.pos.clone(), target: f.pose.target.clone(), fov: f.pose.fov };
    frames.push({ pose: cam, name: f.segment.name, golden: f.golden, follow: f.segment.kind === 'follow' });
  }
  return { p, frames };
}

describe('tour plan (Rev 43)', () => {
  it('visits the places in order and lasts 60-75 s', () => {
    expect(tourPlan().map((s) => s.name)).toEqual([...TOUR_PLACES]);
    expect(TOUR_PLACES).toEqual(['overview', 'lobby', 'engineering', 'rnd', 'meeting', 'gym', 'roof', 'follow', 'finale']);
    expect(tourTotal(tourPlan())).toBeGreaterThanOrEqual(60);
    expect(tourTotal(tourPlan())).toBeLessThanOrEqual(75);
    const follow = tourPlan().find((s) => s.kind === 'follow');
    expect(follow?.duration).toBeGreaterThanOrEqual(5);
    expect(follow?.duration).toBeLessThanOrEqual(7);
  });

  it('each place names the floor view it shows (meeting room = floor 3)', () => {
    const byName = new Map(tourPlan().map((s) => [s.name, s.view]));
    expect(byName.get('lobby')).toEqual({ floor: 0 });
    expect(byName.get('engineering')).toEqual({ floor: 1 });
    expect(byName.get('meeting')).toEqual({ floor: 3 });
    expect(byName.get('rnd')).toEqual({ campus: 'wing-2' });
    expect(byName.get('gym')).toEqual({ campus: 'wing-1' });
    expect(byName.get('roof')).toEqual({ campus: 'roof' });
    expect(byName.get('overview')).toBeNull();
    expect(byName.get('finale')).toBeNull();
  });
});

describe('tour player (Rev 43)', () => {
  it('starts from the current camera, moves smoothly (no jumps) and ends on the overview', () => {
    const { p, frames } = run(false);
    expect(p.done).toBe(true);
    expect(frames[0]!.pose.pos.distanceTo(start().pos)).toBeLessThan(1);
    let maxStep = 0;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i]!.follow || frames[i - 1]!.follow) continue;
      maxStep = Math.max(maxStep, frames[i]!.pose.pos.distanceTo(frames[i - 1]!.pose.pos));
    }
    expect(maxStep).toBeLessThan(2); // per frame at 60 fps: an eased glide, never a cut
    const last = frames[frames.length - 1]!.pose;
    expect(last.pos.distanceTo(overviewPose().pos)).toBeLessThan(1e-6);
    expect(frames.length / 60).toBeGreaterThanOrEqual(60);
    expect(frames.length / 60).toBeLessThanOrEqual(75.1);
  });

  it('the follow segment hands the camera to the app (no pose) for its duration', () => {
    const { frames } = run(false);
    const f = frames.filter((x) => x.follow);
    expect(f.length / 60).toBeGreaterThan(5);
  });

  it('golden light ramps in during the finale only', () => {
    const { frames } = run(false);
    expect(frames.filter((f) => f.name !== 'finale').every((f) => f.golden === 0)).toBe(true);
    const fin = frames.filter((f) => f.name === 'finale');
    expect(fin[fin.length - 1]!.golden).toBe(1);
  });

  it('reduced motion: cuts between held shots instead of glides', () => {
    const { frames } = run(true);
    let moves = 0;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i]!.follow || frames[i - 1]!.follow) continue;
      const d = frames[i]!.pose.pos.distanceTo(frames[i - 1]!.pose.pos);
      if (d > 1e-9) moves++;
    }
    expect(moves).toBeLessThan(25); // a handful of cuts, not a frame-by-frame glide
    expect(frames[frames.length - 1]!.pose.pos.distanceTo(overviewPose().pos)).toBeLessThan(1e-6);
  });

  it('stop() ends the tour at once', () => {
    const p = createTourPlayer(tourPlan(), false);
    p.update(1 / 60, start());
    p.stop();
    expect(p.done).toBe(true);
  });
});

describe('tour UI (Rev 43)', () => {
  it('"Tanıtım turu" in settings starts the tour; during it only "Turu bitir" shows and ends it', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const ui = createTourUi({ onStart, onEnd, film: false });
    document.body.append(ui.startButton, ui.exitButton);
    expect(ui.startButton.textContent).toBe('Tanıtım turu');
    expect(ui.exitButton.hidden).toBe(true);
    ui.startButton.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    ui.show();
    expect(document.documentElement.classList.contains('is-tour')).toBe(true);
    expect(ui.exitButton.hidden).toBe(false);
    expect(ui.exitButton.textContent).toBe('Turu bitir');
    ui.exitButton.click();
    expect(onEnd).toHaveBeenCalledTimes(1);
    ui.hide();
    expect(document.documentElement.classList.contains('is-tour')).toBe(false);
    expect(ui.exitButton.hidden).toBe(true);
  });

  it('film mode hides every control, the exit button too', () => {
    const ui = createTourUi({ onStart: () => undefined, onEnd: () => undefined, film: true });
    ui.show();
    expect(document.documentElement.classList.contains('is-film')).toBe(true);
    expect(ui.exitButton.hidden).toBe(true);
    ui.hide();
  });

  it('the stylesheet hides the HUD during the tour but keeps the canvas and the exit button; 44 px exit', () => {
    expect(css).toMatch(/html\.is-tour #app > :not\(\.tower-canvas\):not\(\.tour-exit\)/);
    expect(css).toMatch(/html\.is-film #app > :not\(\.tower-canvas\)/);
    expect(css).toMatch(/\.tour-exit \{[^}]*min-height: var\(--touch\)[^}]*min-width: var\(--touch\)/);
  });
});

describe('T and Esc for the tour (Rev 43)', () => {
  function setup(camera: KeyState['camera']) {
    const state: KeyState = { busy: false, cardOpen: true, mode: 'floor', camera };
    const log: string[] = [];
    const h = createKeyHandler({
      getState: () => state,
      goFloor: (n) => log.push(`floor${n}`),
      toggleOrg: () => log.push('org'),
      exitOrg: () => log.push('exitOrg'),
      closeCard: () => log.push('closeCard'),
      exitCamera: () => log.push('exitCamera'),
      startTour: () => log.push('tour'),
      orgEnabled: true,
    });
    const key = (k: string) => h.handle({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target: null });
    return { log, key };
  }
  it('T closes the card and starts the tour', () => {
    const s = setup(null);
    s.key('t');
    expect(s.log).toEqual(['closeCard', 'tour']);
  });
  it('during the tour only Esc works (it ends the tour)', () => {
    const s = setup('tour');
    s.key('3');
    s.key('T');
    s.key('Escape');
    expect(s.log).toEqual(['exitCamera']);
  });
});

describe('film / tour hook (Rev 43)', () => {
  it('parses ?tour=1 and ?film=1 strictly', () => {
    expect(tourParams('')).toEqual({ hook: false, film: false });
    expect(tourParams('?tour=1')).toEqual({ hook: true, film: false });
    expect(tourParams('?film=1')).toEqual({ hook: true, film: true });
    expect(tourParams('?film=yes&tour=0')).toEqual({ hook: false, film: false });
  });
  it('exposes window.__tour only when the URL asks for it', () => {
    const api = { start: vi.fn(), onEnd: vi.fn() };
    const off: { __tour?: unknown } = {};
    installTourHook(off, api, tourParams(''));
    expect('__tour' in off).toBe(false);
    const on: { __tour?: unknown } = {};
    installTourHook(on, api, tourParams('?tour=1'));
    expect(on.__tour).toBe(api);
  });
});
