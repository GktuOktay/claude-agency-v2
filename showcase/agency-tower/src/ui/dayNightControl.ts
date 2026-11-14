// Gündüz / Gece / Otomatik control (REQ-18, REQ-20). A group of toggle buttons; state shown by
// aria-pressed and a text marker, not by colour alone.
import type { DayNight, DayNightMode } from '../scene/daynight';
import { tr } from '../i18n/tr';
import { el } from './dom';

export interface DayNightControl {
  element: HTMLElement;
  refresh(): void;
}

export function createDayNightControl(dn: DayNight): DayNightControl {
  const group = el('div', { class: 'segmented', role: 'group', 'aria-label': tr.dayNight });
  const items: [DayNightMode, string][] = [
    ['day', tr.day],
    ['night', tr.night],
    ['auto', tr.auto],
  ];
  const buttons = items.map(([mode, label]) => {
    const b = el('button', { type: 'button', 'data-mode': mode }, label);
    b.addEventListener('click', () => {
      dn.setMode(mode);
      refresh();
    });
    group.append(b);
    return { mode, b };
  });
  const refresh = (): void => {
    for (const { mode, b } of buttons) {
      b.setAttribute('aria-pressed', String(dn.mode() === mode));
      if (mode === 'auto') {
        b.disabled = !dn.autoAvailable();
        if (b.disabled) b.title = tr.autoUnavailable;
        else b.removeAttribute('title');
      }
    }
  };
  refresh();
  return { element: group, refresh };
}
