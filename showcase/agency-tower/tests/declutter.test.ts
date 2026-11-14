// Screen-space label de-cluttering (KARARLAR Rev 38 polish): zone / floor labels keep their place, robot name
// pills nudge up or fade when they collide, speech bubbles sit above the pill. Throttled, preallocated.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUBBLE_ABOVE_PILL, BUBBLE_NO_PILL, DECLUTTER_EVERY, bubbleLift, createDeclutter, declutterDue } from '../src/scene/declutter';

const H = 22; // pill height

describe('label de-clutter', () => {
  it('a pill on a zone label moves above it; the zone label never moves', () => {
    const d = createDeclutter(8, 8);
    d.begin();
    d.addFixed(100, 200, 120, 21); // "MİMARİ KURUL" floor label: box x 40..160, y 179..200
    const p = d.addPill(110, 205, 80, H, false); // pill box y 183..205: overlaps
    d.solve();
    expect(d.fade(p)).toBe(false);
    const top = 205 - d.lift(p);
    expect(top).toBeLessThanOrEqual(179 - 2); // pill bottom above the label top, with the gap
  });

  it('a pill clear of everything keeps its anchor', () => {
    const d = createDeclutter(8, 8);
    d.begin();
    d.addFixed(100, 200, 120, 21);
    const p = d.addPill(400, 205, 80, H, false);
    d.solve();
    expect(d.lift(p)).toBe(0);
    expect(d.fade(p)).toBe(false);
  });

  it('close pills stack: the one nearest the viewer (lowest) keeps its anchor', () => {
    const d = createDeclutter(8, 8);
    d.begin();
    const a = d.addPill(100, 300, 80, H, false);
    const b = d.addPill(110, 310, 80, H, false);
    d.solve();
    expect(d.lift(b)).toBe(0);
    expect(310 - d.lift(b) - H - 2).toBeGreaterThanOrEqual(300 - d.lift(a));
    expect(d.fade(a)).toBe(false);
  });

  it('a crowded pill that would climb too far fades instead; a highlighted pill never fades', () => {
    const d = createDeclutter(16, 8);
    d.begin();
    for (let i = 0; i < 5; i++) d.addFixed(100, 300 - i * 24, 200, 21); // a tall wall of labels
    const p = d.addPill(100, 300, 80, H, false);
    const q = d.addPill(100, 300, 80, H, true);
    d.solve();
    expect(d.fade(p)).toBe(true);
    expect(d.lift(p)).toBe(0); // a faded pill stays on its robot
    expect(d.fade(q)).toBe(false);
  });

  it('a highlighted pill wins over a plain pill at the same spot', () => {
    const d = createDeclutter(8, 8);
    d.begin();
    const plain = d.addPill(100, 300, 80, H, false);
    const hot = d.addPill(100, 300, 80, H, true);
    d.solve();
    expect(d.lift(hot)).toBe(0);
    expect(d.lift(plain)).toBeGreaterThan(0);
  });

  it('reuses its buffers across passes (no per-pass allocation) and ignores items beyond capacity', () => {
    const d = createDeclutter(2, 1);
    const bufs = d.buffers();
    for (let pass = 0; pass < 3; pass++) {
      d.begin();
      d.addFixed(0, 0, 10, 10);
      expect(d.addFixed(50, 0, 10, 10)).toBe(-1);
      d.addPill(0, 100, 10, H, false);
      d.addPill(0, 100, 10, H, false);
      expect(d.addPill(0, 100, 10, H, false)).toBe(-1);
      d.solve();
      const now = d.buffers();
      for (let i = 0; i < bufs.length; i++) expect(now[i]).toBe(bufs[i]);
    }
  });

  it('runs at most every few frames', () => {
    expect(DECLUTTER_EVERY).toBeGreaterThanOrEqual(3);
    const due = Array.from({ length: 12 }, (_, f) => declutterDue(f));
    expect(due.filter(Boolean)).toHaveLength(Math.ceil(12 / DECLUTTER_EVERY));
    expect(due[0]).toBe(true);
  });

  it('bubbles sit above the (nudged) pill, or just above the head without one', () => {
    expect(bubbleLift(true, 0)).toBe(BUBBLE_ABOVE_PILL);
    expect(bubbleLift(true, 24)).toBe(24 + BUBBLE_ABOVE_PILL);
    expect(bubbleLift(false, 24)).toBe(BUBBLE_NO_PILL);
    expect(BUBBLE_ABOVE_PILL).toBeGreaterThanOrEqual(H + 4);
  });

  it('fading animates only when motion is allowed', () => {
    const css = readFileSync('src/ui/style.css', 'utf8');
    expect(css).toMatch(/\.robot-label\.is-faded\s*\{[^}]*opacity:\s*0\.\d+/);
    const at = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(at).toBeGreaterThan(0);
    let i = css.indexOf('{', at) + 1;
    for (let depth = 1; depth > 0; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    const block = css.slice(at, i);
    expect(block).toMatch(/\.robot-label\s*\{[^}]*transition:\s*opacity/);
    const outside = css.slice(0, at) + css.slice(at + block.length);
    expect(outside).not.toMatch(/\.robot-label[^{]*\{[^}]*transition/);
  });
});
