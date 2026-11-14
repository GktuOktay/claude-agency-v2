import type { Unit } from '../data/types';
import { TIERS } from '../data/types';
import { tr } from '../i18n/tr';
import { el } from './dom';

export function sortUnits(units: readonly Unit[]): Unit[] {
  return [...units].sort(
    (a, b) =>
      b.floor - a.floor ||
      TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

export interface UnitListHandle {
  element: HTMLElement;
  buttonFor(id: string): HTMLButtonElement | undefined;
}

export function createUnitList(
  units: readonly Unit[],
  onSelect: (unit: Unit, opener: HTMLButtonElement) => void,
  opts: { visible: boolean } = { visible: true },
): UnitListHandle {
  const nav = el('nav', { 'aria-label': tr.unitList, class: opts.visible ? 'unit-list' : 'unit-list sr-only' });
  const ul = el('ul');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const u of sortUnits(units)) {
    const li = el('li');
    const b = el('button', { type: 'button' }, `${u.name} · ${u.roleTr}`);
    b.addEventListener('click', () => onSelect(u, b));
    buttons.set(u.id, b);
    li.append(b);
    ul.append(li);
  }
  nav.append(ul);
  return { element: nav, buttonFor: (id) => buttons.get(id) };
}
