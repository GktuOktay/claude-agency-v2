import type { Floor } from '../data/types';
import { tr } from '../i18n/tr';
import { accentCss } from './accents';
import type { CampusItem, CampusKey } from './campusNav';
import { el } from './dom';

export type PanelValue = number | 'all' | CampusKey;

export interface FloorPanel {
  element: HTMLElement;
  setCurrent(v: PanelValue): void;
}

export interface CampusGroup {
  items: readonly CampusItem[];
  onSelect(key: CampusKey): void;
}

export function createFloorPanel(floors: readonly Floor[], onSelect: (v: number | 'all') => void, campus?: CampusGroup): FloorPanel {
  const nav = el('nav', { class: 'floor-panel', 'aria-label': tr.floorPanel });
  const buttons = new Map<string, HTMLButtonElement>();

  // With the campus group the panel has two labelled groups ("Kule", "Kampüs"); without, a flat list.
  const group = (id: string, label: string): HTMLElement => {
    const g = el('div', { class: 'panel-group', role: 'group', 'aria-labelledby': id });
    g.append(el('p', { class: 'panel-group-label', id }, label));
    nav.append(g);
    return g;
  };
  const towerHost = campus ? group('floor-panel-tower', tr.panelGroups.tower) : nav;

  const make = (host: HTMLElement, key: string, num: string, label: string, onClick: () => void, accent?: number): void => {
    const b = el('button', { type: 'button', 'data-floor': key });
    const dot = el('span', { class: 'dot', 'aria-hidden': 'true' });
    if (accent !== undefined) b.style.setProperty('--floor-accent', accentCss(accent));
    // On phones the strip shows the number only; the name stays in the accessible name (visually hidden).
    // Campus: the short phone label is decorative (it is part of the full name, which stays the accessible name).
    const numAttrs: Record<string, string> = accent === undefined && key !== 'all' ? { class: 'num', 'aria-hidden': 'true' } : { class: 'num' };
    b.append(el('span', { class: 'marker', 'aria-hidden': 'true' }), dot, el('span', numAttrs, num), el('span', { class: 'name' }, label));
    b.addEventListener('click', onClick);
    buttons.set(key, b);
    host.append(b);
  };

  for (const f of [...floors].sort((a, b) => b.id - a.id)) make(towerHost, String(f.id), String(f.id), ` · ${f.nameTr}`, () => onSelect(f.id), f.id);
  make(towerHost, 'all', '', tr.allTower, () => onSelect('all'));

  if (campus) {
    const host = group('floor-panel-campus', tr.panelGroups.campus);
    host.classList.add('is-campus');
    for (const c of campus.items) make(host, c.key, c.short, c.label, () => campus.onSelect(c.key));
  }

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
