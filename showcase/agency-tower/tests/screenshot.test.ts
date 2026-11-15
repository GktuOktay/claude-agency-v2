// KARARLAR Rev 43 C4: "Ekran görüntüsü" saves a PNG locally (data URL through an anchor download); no request.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScreenshotButton, screenshotName } from '../src/ui/screenshot';

afterEach(() => vi.restoreAllMocks());

describe('Ekran görüntüsü', () => {
  it('names the file by the local date and time', () => {
    expect(screenshotName(new Date(2026, 10, 15, 9, 5, 7))).toBe('ajans-kulesi-20261115-090507.png');
  });

  it('a click captures, downloads a data:image/png through an anchor, and makes no request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    const capture = vi.fn(() => 'data:image/png;base64,AAAA');
    const s = createScreenshotButton({ capture, now: () => new Date(2026, 10, 15, 9, 5, 7) });
    document.body.append(s.element);
    const b = s.element.querySelector('button')!;
    expect(b.textContent).toBe('Ekran görüntüsü al');
    b.click();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe('ajans-kulesi-20261115-090507.png');
    expect(clicked[0]!.href).toBe('data:image/png;base64,AAAA');
    expect(clicked[0]!.isConnected).toBe(false); // the anchor is removed again
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(s.element.querySelector('[role="status"]')?.textContent).toBe('Kaydedildi: ajans-kulesi-20261115-090507.png');
    s.element.remove();
    vi.unstubAllGlobals();
  });

  it('a failed capture (not a PNG, or a throw) shows a plain Turkish message and downloads nothing', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    for (const capture of [() => 'data:,', () => { throw new Error('gl lost'); }]) {
      const s = createScreenshotButton({ capture });
      s.element.querySelector('button')!.click();
      expect(s.element.querySelector('[role="status"]')?.textContent).toBe('Ekran görüntüsü alınamadı. Tekrar deneyin.');
    }
    expect(click).not.toHaveBeenCalled();
  });
});
