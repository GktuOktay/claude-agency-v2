// "Molaya çık" / "Molayı bitir" (KARARLAR Rev 44): one toggle in the "Ofis" tab and a small copy on screen, in the
// HUD rail under the floor panel (so it never covers the floor panel). Both read the same override, so their labels
// agree; `refresh()` follows a scheduled transition (the override ends there). Text nodes only (REQ-16).
import type { BreakOverride } from '../../sim/breakOverride';
import { el } from '../dom';

export const BREAK_TEXT = {
  start: 'Molaya çık',
  end: 'Molayı bitir',
  started: 'Herkes molaya çıkıyor',
  ended: 'Herkes masasına dönüyor',
  paused: 'Duraklatıldı: devam edince başlar',
} as const;

export interface BreakButtonOptions {
  override: BreakOverride;
  /** Global pause: the press is kept and carried out on resume. */
  paused?: () => boolean;
  /** After a press (e.g. refresh the office tab). */
  onChange?(): void;
}

export interface BreakButtons {
  /** For the "Ofis" tab: the button and a status line. */
  section: HTMLElement;
  /** Small on-screen button (≥ 44 px, HUD rail). */
  screen: HTMLButtonElement;
  refresh(): void;
}

export function createBreakButtons(o: BreakButtonOptions): BreakButtons {
  const section = el('div', { class: 'break-toggle' });
  const main = el('button', { type: 'button' });
  const status = el('p', { class: 'settings-note', role: 'status' });
  section.append(main, status);
  const screen = el('button', { type: 'button', class: 'break-screen' });
  let last = '';
  const refresh = (): void => {
    const label = o.override.onBreak() ? BREAK_TEXT.end : BREAK_TEXT.start;
    if (label === last) return;
    last = label;
    main.textContent = label;
    screen.textContent = label;
  };
  const press = (): void => {
    const m = o.override.toggle();
    status.textContent = o.paused?.() ? BREAK_TEXT.paused : m === 'break' ? BREAK_TEXT.started : BREAK_TEXT.ended;
    refresh();
    o.onChange?.();
  };
  main.addEventListener('click', press);
  screen.addEventListener('click', press);
  refresh();
  return { section, screen, refresh };
}
