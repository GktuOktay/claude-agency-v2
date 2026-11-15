// "Ekran görüntüsü al" (KARARLAR Rev 43 C4): the app renders a frame and reads the canvas as a PNG data URL in the
// same task (no preserveDrawingBuffer needed); the file is saved through a temporary anchor with `download`.
// Local only: a data: URL, no request (0001 REQ-16). Text nodes only.
import { trLive } from '../i18n/trLive';
import { el } from './dom';

const pad = (n: number): string => String(n).padStart(2, '0');

export function screenshotName(d: Date): string {
  const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `ajans-kulesi-${day}-${time}.png`;
}

/**
 * The WebGL canvas is transparent (the sky is the page's CSS gradient), so a raw read leaves see-through corners.
 * This paints the same radial gradient (page colours from the body's CSS variables) under the frame.
 */
export function flattenOnPage(src: HTMLCanvasElement, doc: Document = document): HTMLCanvasElement {
  const out = doc.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext('2d');
  if (!g) return src;
  const css = doc.defaultView?.getComputedStyle(doc.body);
  const v = (name: string, fb: string): string => css?.getPropertyValue(name).trim() || fb;
  const w = out.width;
  const h = out.height;
  const grad = g.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, Math.hypot(w, h) * 0.6);
  grad.addColorStop(0, v('--bg-1', '#fbfaf7'));
  grad.addColorStop(0.62, v('--bg-2', '#f1efe9'));
  grad.addColorStop(1, v('--bg-3', '#e6e3dc'));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0);
  return out;
}

export interface ScreenshotOptions {
  /** Renders and returns the canvas as a PNG data URL. */
  capture(): string;
  now?: () => Date;
}

export function createScreenshotButton(o: ScreenshotOptions): { element: HTMLElement } {
  const t = trLive.shot;
  const wrap = el('div', { class: 'screenshot' });
  const b = el('button', { type: 'button' }, t.button);
  const status = el('p', { class: 'settings-note', role: 'status' });
  b.addEventListener('click', () => {
    let url = '';
    try {
      url = o.capture();
    } catch {
      url = ''; // lost context or a blocked read: reported below
    }
    if (!url.startsWith('data:image/png')) {
      status.textContent = t.failed;
      return;
    }
    const name = screenshotName((o.now ?? (() => new Date()))());
    const a = el('a', { href: url, download: name, class: 'visually-hidden' });
    document.body.append(a);
    a.click();
    a.remove();
    status.textContent = t.saved(name);
  });
  wrap.append(b, status);
  return { element: wrap };
}
