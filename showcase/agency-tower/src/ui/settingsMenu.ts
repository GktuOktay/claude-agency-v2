// Corner settings menu (KARARLAR Rev 31 UI pass, Rev 35 modular rework): an icon button opens a
// non-modal dialog, a side panel on desktop and a bottom sheet on phones, with one tab per section
// module (src/ui/settings/*). Only the floor panel stays on screen. Esc closes and returns focus to the
// button; a badge (shape + number) on the button shows the active job count while it is closed.
// Text nodes only (REQ-16).
import { tr } from '../i18n/tr';
import { el } from './dom';
import type { SettingsSection } from './settings/section';

export type { SettingsSection } from './settings/section';
export { createScenarioInfo, type ScenarioInfo } from './settings/scenario';
export { createShortcutToggle } from './settings/accessibility';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SettingsMenu {
  element: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(returnFocus?: boolean): void;
  /** Active job count for the badge on the closed menu's button (0 hides it). */
  setBadge(n: number): void;
}

export interface SettingsMenuOptions {
  sections: readonly SettingsSection[];
}

/** Sliders icon, built with createElementNS (no markup strings). Decorative: the button has a label. */
function slidersIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attrs: Record<string, string> = {
    viewBox: '0 0 24 24',
    width: '22',
    height: '22',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  const add = (tag: string, attrs: Record<string, string>): void => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
  };
  for (const [y, x] of [
    [6, 15],
    [12, 8],
    [18, 13],
  ] as const) {
    add('line', { x1: '4', y1: String(y), x2: '20', y2: String(y) });
    add('circle', { cx: String(x), cy: String(y), r: '2.4', class: 'knob' });
  }
  return svg;
}

export function createSettingsMenu(o: SettingsMenuOptions): SettingsMenu {
  const t = tr.settings;
  const wrap = el('div', { class: 'settings' });
  const button = el('button', {
    type: 'button',
    class: 'settings-button',
    'aria-label': t.title,
    'aria-expanded': 'false',
    'aria-controls': 'settings-panel',
    'aria-haspopup': 'dialog',
  });
  const badge = el('span', { class: 'settings-badge', 'aria-hidden': 'true' });
  badge.hidden = true;
  button.append(slidersIcon(), badge);
  const panel = el('div', { class: 'settings-panel', id: 'settings-panel', role: 'dialog', 'aria-labelledby': 'settings-title' });
  panel.hidden = true;
  const tablist = el('div', { class: 'settings-tabs', role: 'tablist', 'aria-label': t.sections });
  const panels = el('div', { class: 'settings-panels' });
  panel.append(el('h2', { class: 'settings-title', id: 'settings-title' }, t.title), tablist, panels);
  wrap.append(button, panel);

  const tabs = o.sections.map((sec) => {
    const tab = el(
      'button',
      { type: 'button', role: 'tab', class: 'settings-tab', id: `settings-tab-${sec.id}`, 'aria-controls': `settings-tabpanel-${sec.id}` },
      sec.title,
    );
    const tp = el('div', { role: 'tabpanel', class: 'settings-tabpanel', id: `settings-tabpanel-${sec.id}`, 'aria-labelledby': tab.id });
    tp.append(sec.element);
    tablist.append(tab);
    panels.append(tp);
    return { sec, tab, tp };
  });
  let current = 0;
  const select = (i: number, focus: boolean): void => {
    current = i;
    tabs.forEach(({ tab, tp }, j) => {
      const on = j === i;
      tab.setAttribute('aria-selected', String(on));
      tab.setAttribute('tabindex', on ? '0' : '-1');
      tp.hidden = !on;
    });
    tabs[i]?.sec.onShow?.();
    if (focus) tabs[i]?.tab.focus();
  };
  tabs.forEach(({ tab }, i) => {
    tab.addEventListener('click', () => select(i, false));
    tab.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
      if (to < 0) return;
      e.preventDefault();
      select(to, true);
    });
  });
  if (tabs.length) select(0, false);

  let open = false;
  let count = 0;
  const applyBadge = (): void => {
    badge.hidden = open || count === 0;
    badge.textContent = count > 0 ? String(count) : '';
    button.setAttribute('aria-label', count > 0 ? t.badge(count) : t.title);
  };
  const set = (on: boolean): void => {
    open = on;
    panel.hidden = !on;
    button.setAttribute('aria-expanded', String(on));
    applyBadge();
  };
  const menu: SettingsMenu = {
    element: wrap,
    button,
    panel,
    isOpen: () => open,
    open() {
      set(true);
      if (tabs.length) select(current, true);
    },
    close(returnFocus = true) {
      if (!open) return;
      set(false);
      if (returnFocus) button.focus();
    },
    setBadge(n) {
      if (n === count) return;
      count = n;
      applyBadge();
    },
  };
  button.addEventListener('click', () => (open ? menu.close() : menu.open()));
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation(); // the page shortcuts (Esc closes the card / org) do not see it
    menu.close();
  });
  document.addEventListener('pointerdown', (e) => {
    if (open && e.target instanceof Node && !wrap.contains(e.target)) menu.close(false);
  });
  return menu;
}
