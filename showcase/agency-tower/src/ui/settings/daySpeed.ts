// "Gün hızı" and "Öğle arasına atla" controls (KARARLAR Rev 43 C3) for the "Ofis" tab. The speed is not stored:
// every visit starts at 1×. Text nodes only (REQ-16).
import { trLive } from '../../i18n/trLive';
import { DAY_SPEEDS, type DaySpeed } from '../../sim/dayControl';
import { el } from '../dom';

export interface DaySpeedOptions {
  current: DaySpeed;
  onSpeed(n: DaySpeed): void;
}

export function createDaySpeedControl(o: DaySpeedOptions): { element: HTMLElement } {
  const t = trLive.day;
  const fs = el('fieldset', { class: 'day-speed' });
  fs.append(el('legend', {}, t.speed));
  const group = el('div', { class: 'segmented' });
  const buttons = DAY_SPEEDS.map((n) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(n === o.current), 'aria-label': t.speedLabel(n) }, `${n}×`);
    b.addEventListener('click', () => {
      for (const [i, x] of buttons.entries()) x.setAttribute('aria-pressed', String(DAY_SPEEDS[i] === n));
      o.onSpeed(n);
    });
    return b;
  });
  group.append(...buttons);
  fs.append(group);
  return { element: fs };
}

export interface LunchOptions {
  /** Jumps the office clock; 'already' when it is lunch now. */
  onJump(): 'jumped' | 'already';
}

export function createLunchButton(o: LunchOptions): { element: HTMLElement } {
  const t = trLive.day;
  const wrap = el('div', { class: 'lunch-jump' });
  const b = el('button', { type: 'button' }, t.lunch);
  const status = el('p', { class: 'settings-note', role: 'status' });
  b.addEventListener('click', () => {
    status.textContent = o.onJump() === 'jumped' ? t.jumped : t.already;
  });
  wrap.append(b, status);
  return { element: wrap };
}
