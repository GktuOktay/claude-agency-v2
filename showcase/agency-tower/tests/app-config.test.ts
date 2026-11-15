import { describe, it, expect, vi } from 'vitest';
import { parseParams, resolveQuality, qualitySettings } from '../src/app/params';
import { createLoop, createFpsMeter } from '../src/app/loop';

describe('quality tiers and URL params (AC-12, AC-13)', () => {
  it('low: no shadows, DPR 1; high: shadows, DPR min(device, 1.5)', () => {
    expect(qualitySettings('low', 3)).toEqual({ quality: 'low', shadows: false, pixelRatio: 1 });
    expect(qualitySettings('high', 3)).toEqual({ quality: 'high', shadows: true, pixelRatio: 1.5 });
    expect(qualitySettings('high', 1)).toMatchObject({ pixelRatio: 1 });
  });

  it('coarse pointer starts on low, others on high; ?quality overrides', () => {
    const none = parseParams('');
    expect(resolveQuality(none, true)).toBe('low');
    expect(resolveQuality(none, false)).toBe('high');
    expect(resolveQuality(parseParams('?quality=high'), true)).toBe('high');
    expect(resolveQuality(parseParams('?quality=low'), false)).toBe('low');
  });

  it('ignores invalid values', () => {
    expect(parseParams('?quality=<script>').quality).toBeNull();
    expect(parseParams('?quality=HIGH').quality).toBeNull();
    expect(parseParams('?debug=2').debug).toBe(false);
    expect(parseParams('?debug=1').debug).toBe(true);
    expect(parseParams('?debug=1&debug=2&other=x')).toEqual({ quality: null, debug: true });
  });
});

describe('render loop (AC-12)', () => {
  function setup(hidden: boolean) {
    const doc = new EventTarget() as EventTarget & { hidden: boolean };
    doc.hidden = hidden;
    const callbacks = new Map<number, (t: number) => void>();
    let next = 1;
    const raf = vi.fn((cb: (t: number) => void) => {
      const id = next++;
      callbacks.set(id, cb);
      return id;
    });
    const caf = vi.fn((id: number) => void callbacks.delete(id));
    const tick = vi.fn();
    const loop = createLoop({ raf, caf, doc, tick });
    const runFrame = () => {
      const [id, cb] = [...callbacks.entries()][0] ?? [];
      if (id !== undefined && cb) {
        callbacks.delete(id);
        cb(16);
      }
    };
    return { doc, raf, caf, tick, loop, runFrame, callbacks };
  }

  it('does not run while document.hidden', () => {
    const s = setup(true);
    s.loop.start();
    expect(s.raf).not.toHaveBeenCalled();
    expect(s.loop.running()).toBe(false);
  });

  it('ticks while visible, pauses on hide, resumes on show', () => {
    const s = setup(false);
    s.loop.start();
    s.runFrame();
    expect(s.tick).toHaveBeenCalledTimes(1);
    s.doc.hidden = true;
    s.doc.dispatchEvent(new Event('visibilitychange'));
    expect(s.callbacks.size).toBe(0);
    s.runFrame();
    expect(s.tick).toHaveBeenCalledTimes(1);
    s.doc.hidden = false;
    s.doc.dispatchEvent(new Event('visibilitychange'));
    expect(s.callbacks.size).toBe(1);
    s.runFrame();
    expect(s.tick).toHaveBeenCalledTimes(2);
  });

  it('fps meter reports frames per second over a 500 ms window', () => {
    const m = createFpsMeter();
    let fps = 0;
    for (let t = 0; t <= 1000; t += 20) fps = m.frame(t);
    expect(fps).toBeCloseTo(50, 0);
  });
});
