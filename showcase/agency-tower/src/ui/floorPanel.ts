import type { Floor } from '../data/types';
import { tr } from '../i18n/tr';
import { accentCss } from './accents';
import { el } from './dom';

export interface FloorPanel {
  element: HTMLElement;
  setCurrent(v: number | 'all'): void;
}

export function createFloorPanel(floors: readonly Floor[], onSelect: (v: number | 'all') => void): FloorPanel {
  const nav = el('nav', { class: 'floor-panel', 'aria-label': tr.floorPanel });
  const buttons = new Map<string, HTMLButtonElement>();

  const make = (key: string, num: string, label: string, value: number | 'all'): void => {
    const b = el('button', { type: 'button', 'data-floor': key });
    const dot = el('span', { class: 'dot', 'aria-hidden': 'true' });
    if (typeof value === 'number') b.style.setProperty('--floor-accent', accentCss(value));
    // On phones the strip shows the number only; the name stays in the accessible name (visually hidden).
    b.append(el('span', { class: 'marker', 'aria-hidden': 'true' }), dot, el('span', { class: 'num' }, num), el('span', { class: 'name' }, label));
    b.addEventListener('click', () => onSelect(value));
    buttons.set(key, b);
    nav.append(b);
  };

  for (const f of [...floors].sort((a, b) => b.id - a.id)) make(String(f.id), String(f.id), ` · ${f.nameTr}`, f.id);
  make('all', '', tr.allTower, 'all');

  return {
    element: nav,
    setCurrent(v) {
      for (const [key, b] of buttons) {
        const on = key === String(v);
        if (on) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
        const marker = b.querySelector('.marker');
        if (marker) marker.textContent = on ? tr.currentMarker : '';
      }
    },
  };
}
