// Film overlay (`?film=1`, KARARLAR Rev 43): the Turkish lower-third caption with a small scene title, and the
// dialogue bubbles over the speakers. DOM only, shown only in film mode (html.is-film). The recorder captures only
// the WebGL canvas, so `window.__film` hands it the same caption and bubbles to draw itself.
import { el } from '../ui/dom';
import type { FilmCaption } from './director';
import type { FilmLabel } from './labels';

/** A bubble on screen: CSS pixels relative to the canvas (DOM) and canvas pixels (recorder). */
export interface FilmBubble {
  x: number;
  y: number;
  text: string;
  alpha: number;
}

export interface FilmOverlay {
  element: HTMLElement;
  /** `bubbles` and `labels` in CSS pixels relative to the canvas's top-left corner. */
  update(caption: FilmCaption | null, bubbles: readonly FilmBubble[], labels?: readonly FilmLabel[]): void;
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
  const labelEls: { e: HTMLElement; name: HTMLElement; role: HTMLElement }[] = [];
  return {
    element,
    update(c, bubbles, labels = []) {
      // Name tags first in the DOM so the bubbles paint over them.
      labels.forEach((l, i) => {
        let t = labelEls[i];
        if (!t) {
          const name = el('span', { class: 'film-label-name' });
          const role = el('span', { class: 'film-label-role' });
          const e = el('div', { class: 'film-label' });
          e.append(name, role);
          element.insertBefore(e, caption);
          t = { e, name, role };
          labelEls[i] = t;
        }
        t.e.hidden = false;
        if (t.name.textContent !== l.name) t.name.textContent = l.name;
        const role = l.role === l.name ? '' : l.role;
        if (t.role.textContent !== role) t.role.textContent = role;
        t.role.hidden = role === '';
        t.e.style.opacity = l.alpha.toFixed(3);
        t.e.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) translate(-50%, -100%)`;
      });
      for (let i = labels.length; i < labelEls.length; i++) labelEls[i]!.e.hidden = true;
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
  /** Canvas pixels; `y` = the bubble's bottom-centre anchor. */
  bubbles(): FilmBubble[];
  /** Rev 45 name tags in canvas pixels; `y` = the tag's bottom-centre anchor. */
  labels(): FilmLabel[];
  /** Rev 45: caption box, safe margins and type sizes in canvas pixels for the current canvas aspect. */
  layout(): FilmLayout;
  /** Rev 45 `?fixed=1`: advance `frames` × 1/30 s, render once; absent outside fixed-step mode. */
  step?: (frames?: number) => { done: boolean };
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

/** Name tag in CSS pixels → canvas pixels. */
export function labelToCanvasPixels(l: FilmLabel, cssWidth: number, cssHeight: number, pxWidth: number, pxHeight: number): FilmLabel {
  const sx = cssWidth > 0 ? pxWidth / cssWidth : 1;
  const sy = cssHeight > 0 ? pxHeight / cssHeight : 1;
  return { ...l, x: l.x * sx, y: l.y * sy };
}

export interface FilmRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Recorder layout for one canvas size (canvas pixels). */
export interface FilmLayout {
  width: number;
  height: number;
  portrait: boolean;
  /** Canvas pixels per CSS pixel (label / bubble anchors come from CSS layout). */
  pxPerCss: number;
  /** Margins nothing important should cross (platform UI on 9:16 players sits top and bottom). */
  safe: { top: number; right: number; bottom: number; left: number };
  /** The caption's box: centred, bottom edge on the bottom safe margin; at most `maxLines` lines of `fontPx`. */
  caption: FilmRect & { fontPx: number; titlePx: number; lineHeight: number; padding: number; maxLines: number };
  label: { fontPx: number; rolePx: number; height: number; gap: number };
  bubble: { fontPx: number; maxWidth: number };
}

/**
 * Caption and type geometry for a `width` × `height` canvas. Sizes scale with the short side (1080 px = 1×), so a
 * 3840×2160 and a 2160×3840 film use the same type size. Portrait: wider side margins in proportion, the caption
 * above the bottom 14 % (player controls) and up to the full safe width.
 */
export function filmLayout(width: number, height: number, pxPerCss = 1): FilmLayout {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const portrait = h > w;
  const s = Math.min(w, h) / 1080;
  const safe = portrait
    ? { top: Math.round(h * 0.1), right: Math.round(w * 0.06), bottom: Math.round(h * 0.14), left: Math.round(w * 0.06) }
    : { top: Math.round(h * 0.06), right: Math.round(w * 0.05), bottom: Math.round(h * 0.08), left: Math.round(w * 0.05) };
  const fontPx = Math.round((portrait ? 44 : 34) * s);
  const titlePx = Math.round(fontPx * 0.46);
  const lineHeight = Math.round(fontPx * 1.25);
  const padding = Math.round(18 * s);
  const maxLines = 2;
  const capW = Math.round(Math.min(w - safe.left - safe.right, portrait ? w : w * 0.62));
  const capH = padding * 2 + Math.round(titlePx * 1.4) + lineHeight * maxLines;
  return {
    width: w,
    height: h,
    portrait,
    pxPerCss,
    safe,
    caption: { x: Math.round((w - capW) / 2), y: h - safe.bottom - capH, w: capW, h: capH, fontPx, titlePx, lineHeight, padding, maxLines },
    label: { fontPx: Math.round(13 * pxPerCss), rolePx: Math.round(10 * pxPerCss), height: Math.round(22 * pxPerCss), gap: Math.round(4 * pxPerCss) },
    bubble: { fontPx: Math.round(15 * pxPerCss), maxWidth: Math.round(32 * 8 * pxPerCss) },
  };
}

/** CSS pixels relative to the canvas → canvas (drawing-buffer) pixels. */
export function toCanvasPixels(b: FilmBubble, cssWidth: number, cssHeight: number, pxWidth: number, pxHeight: number): FilmBubble {
  const sx = cssWidth > 0 ? pxWidth / cssWidth : 1;
  const sy = cssHeight > 0 ? pxHeight / cssHeight : 1;
  return { x: b.x * sx, y: b.y * sy, text: b.text, alpha: b.alpha };
}
