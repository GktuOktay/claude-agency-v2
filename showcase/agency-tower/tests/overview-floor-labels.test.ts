// Overview floor labels (live preview: PENTHOUSE, YÖNETİM ... LOBİ stacked over the facade, bubbles on top):
// one column beside the tower, floor order top to bottom, never overlapping; a bubble never covers one.
import { describe, it, expect } from 'vitest';
import { bubbleCovers, bubbleSize, floorLabelColumn, type FloorColumnItem, type ScreenRect } from '../src/scene/labels';

const overlap = (a: ScreenRect, b: ScreenRect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Six floors whose centres crowd within 40 px (the stacked preview case), top floor first. */
const crowded = (east: number, west: number): FloorColumnItem[] =>
  Array.from({ length: 6 }, (_, k) => ({ east: east - k, west: west + k, y: 300 + k * 8, w: 80 + 10 * (k % 3), h: 21 }));

describe('overview floor label column', () => {
  it('no two floor labels overlap and the floor order reads top to bottom', () => {
    const rects = floorLabelColumn(crowded(500, 380), 1280);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i]!, rects[j]!), `${i} / ${j}`).toBe(false);
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.y0).toBeGreaterThan(rects[i - 1]!.y0);
  });

  it('sits right of the tower when it fits, clear of the facade', () => {
    const rects = floorLabelColumn(crowded(500, 380), 1280);
    for (const r of rects) expect(r.x0).toBeGreaterThanOrEqual(500 + 12);
  });

  it('moves left of the tower when the right side has no room, and stays inside the viewport', () => {
    const rects = floorLabelColumn(crowded(700, 300), 748);
    for (const r of rects) {
      expect(r.x1).toBeLessThanOrEqual(300 - 12);
      expect(r.x0).toBeGreaterThanOrEqual(8);
    }
    const tight = floorLabelColumn(crowded(330, 40), 375);
    for (const r of tight) {
      expect(r.x0).toBeGreaterThanOrEqual(8);
      expect(r.x1).toBeLessThanOrEqual(375 - 8);
    }
  });

  it('a label keeps its own floor height when there is room', () => {
    const spread = Array.from({ length: 6 }, (_, k) => ({ east: 500, west: 380, y: 100 + k * 60, w: 90, h: 21 }));
    floorLabelColumn(spread, 1280).forEach((r, k) => expect((r.y0 + r.y1) / 2).toBeCloseTo(100 + k * 60, 6));
  });
});

describe('bubbles never cover a floor label', () => {
  const labels = floorLabelColumn(crowded(500, 380), 1280);
  it('detects a bubble over a label, and one clear of it', () => {
    const r = labels[1]!;
    const size = bubbleSize('Spec hazır, imza bekliyor');
    expect(bubbleCovers((r.x0 + r.x1) / 2, r.y1 + 5, size, labels)).toBe(true);
    expect(bubbleCovers(100, 100, size, labels)).toBe(false);
  });

  it('sizes long bubbles over several lines at the 28ch cap', () => {
    const one = bubbleSize('Kısa');
    const long = bubbleSize('Bu çok uzun bir konuşma balonu metni ve birkaç satıra sarılması gerekiyor elbette');
    expect(long.w).toBeGreaterThan(one.w);
    expect(long.h).toBeGreaterThan(one.h);
    expect(long.w).toBeLessThanOrEqual(28 * 6.4 + 16);
  });
});
