// Film overlay (`?film=1`, KARARLAR Rev 43): the Turkish lower-third caption with a small scene title, and the
// dialogue bubbles over the speakers. DOM only, shown only in film mode (html.is-film). The recorder captures only
// the WebGL canvas, so `window.__film` hands it the same caption and bubbles to draw itself.
import { el } from '../ui/dom';
import type { FilmCaption } from './director';

/** A bubble on screen: CSS pixels relative to the canvas (DOM) and canvas pixels (recorder). */
export interface FilmBubble {
  x: number;
  y: number;
  text: string;
  alpha: number;
}

export interface FilmOverlay {
  element: HTMLElement;
  /** `bubbles` in CSS pixels relative to the canvas's top-left corner. */
  update(caption: FilmCaption | null, bubbles: readonly FilmBubble[]): void;
}

export function createFilmOverlay(): FilmOverlay {
  const title = el('p', { class: 'film-caption-title' });
  const text = el('p', { class: 'film-caption-text' });
  const caption = el('div', { class: 'film-caption' });
  caption.append(title, text);
  caption.hidden = true;
  const element = el('div', { class: 'film-overlay', 'aria-hidden': 'true' });
  element.append(caption);
  const bubbleEls: HTMLElement[] = [];
  return {
    element,
    update(c, bubbles) {
      const on = c !== null && c.alpha > 0;
      if (caption.hidden === on) caption.hidden = !on;
      if (c && on) {
        if (title.textContent !== c.title) title.textContent = c.title;
        if (text.textContent !== c.text) text.textContent = c.text;
        caption.style.opacity = c.alpha.toFixed(3);
      }
      bubbles.forEach((b, i) => {
        let e = bubbleEls[i];
        if (!e) {
          e = el('div', { class: 'bubble film-bubble' });
          element.append(e);
          bubbleEls[i] = e;
        }
        e.hidden = false;
        if (e.textContent !== b.text) e.textContent = b.text;
        e.style.opacity = b.alpha.toFixed(3);
        e.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px) translate(-50%, -100%)`;
      });
      for (let i = bubbles.length; i < bubbleEls.length; i++) bubbleEls[i]!.hidden = true;
    },
  };
}

export interface FilmHookApi {
  caption(): FilmCaption | null;
  bubbles(): FilmBubble[];
}

declare global {
  interface Window {
    /** Film recorder hook (Rev 43), present only with `?film=1`. */
    __film?: unknown;
  }
}

/** Sets `__film` on `win` only in film mode. */
export function installFilmHook(win: { __film?: unknown }, api: FilmHookApi, params: { film: boolean }): void {
  if (params.film) win.__film = api;
}

/** CSS pixels relative to the canvas → canvas (drawing-buffer) pixels. */
export function toCanvasPixels(b: FilmBubble, cssWidth: number, cssHeight: number, pxWidth: number, pxHeight: number): FilmBubble {
  const sx = cssWidth > 0 ? pxWidth / cssWidth : 1;
  const sy = cssHeight > 0 ? pxHeight / cssHeight : 1;
  return { x: b.x * sx, y: b.y * sy, text: b.text, alpha: b.alpha };
}
