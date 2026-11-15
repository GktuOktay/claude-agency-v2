// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flattenOnPage } from '../src/ui/screenshot';

describe('flattenOnPage (opaque PNG, Rev 43 C4 fix)', () => {
  it('paints the page gradient under the frame, then draws the frame', () => {
    const calls: string[] = [];
    const ctx = {
      createRadialGradient: () => ({ addColorStop: (o: number) => calls.push(`stop ${o}`) }),
      fillRect: () => calls.push('fill'),
      drawImage: () => calls.push('draw'),
      fillStyle: '',
    };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const src = document.createElement('canvas');
    src.width = 320;
    src.height = 180;
    const out = flattenOnPage(src);
    expect(out).not.toBe(src);
    expect([out.width, out.height]).toEqual([320, 180]);
    expect(calls).toEqual(['stop 0', 'stop 0.62', 'stop 1', 'fill', 'draw']);
    spy.mockRestore();
  });

  it('falls back to the raw canvas when 2D is unavailable', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const src = document.createElement('canvas');
    expect(flattenOnPage(src)).toBe(src);
    spy.mockRestore();
  });
});
