// Corner settings menu (KARARLAR Rev 31 UI pass): an icon button opens a non-modal popover with the
// former toolbar controls (Gündüz/Gece/Otomatik, Organizasyon şeması, Hareketi durdur, Kısayollar) and
// a read-only "Senaryo" section. Esc closes and returns focus to the button. Text nodes only (REQ-16).
import { tr } from '../i18n/tr';
import { el } from './dom';
import type { KeyHandler } from './keymap';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SettingsMenu {
  element: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(returnFocus?: boolean): void;
}

export interface SettingsMenuOptions {
  controls: readonly HTMLElement[];
  scenario: HTMLElement;
}

export interface ScenarioInfo {
  seed: number;
  laneWeights: readonly number[];
  quality: 'low' | 'high';
  maxJobs: { low: number; high: number };
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
  const wrap = el('div', { class: 'settings' });
  const button = el('button', {
    type: 'button',
    class: 'settings-button',
    'aria-label': tr.settings.title,
    'aria-expanded': 'false',
    'aria-controls': 'settings-panel',
    'aria-haspopup': 'dialog',
  });
  button.append(slidersIcon());
  const panel = el('div', { class: 'settings-panel', id: 'settings-panel', role: 'dialog', 'aria-labelledby': 'settings-title' });
  panel.hidden = true;
  const controls = el('div', { class: 'settings-controls', role: 'group', 'aria-label': tr.settings.view });
  controls.append(...o.controls);
  panel.append(el('h2', { class: 'settings-title', id: 'settings-title' }, tr.settings.title), controls, o.scenario);
  wrap.append(button, panel);

  let open = false;
  const set = (on: boolean): void => {
    open = on;
    panel.hidden = !on;
    button.setAttribute('aria-expanded', String(on));
  };
  const menu: SettingsMenu = {
    element: wrap,
    button,
    panel,
    isOpen: () => open,
    open() {
      set(true);
      panel.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    },
    close(returnFocus = true) {
      if (!open) return;
      set(false);
      if (returnFocus) button.focus();
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

/** Read-only scenario facts from the loaded data (labelled as a simulation). */
export function createScenarioInfo(s: ScenarioInfo): HTMLElement {
  const t = tr.settings;
  const section = el('section', { class: 'settings-scenario', 'aria-labelledby': 'settings-scenario-title' });
  section.append(el('h3', { id: 'settings-scenario-title' }, t.scenario), el('p', { class: 'settings-note' }, t.readOnly));
  const dl = el('dl');
  const list = (items: readonly string[]): HTMLElement => {
    const ul = el('ul');
    ul.append(...items.map((x) => el('li', {}, x)));
    return ul;
  };
  const row = (term: string, value: HTMLElement): void => {
    const dd = el('dd');
    dd.append(value);
    dl.append(el('dt', {}, term), dd);
  };
  row(t.seed, el('span', { class: 'settings-seed' }, String(s.seed)));
  row(t.laneWeights, list(s.laneWeights.map((w, i) => `${tr.strip.lane} ${i} · %${w}`)));
  const tiers = (['low', 'high'] as const).map((q) => `${t.tiers[q]}: ${t.maxJobs(s.maxJobs[q])}${q === s.quality ? ` ${t.current}` : ''}`);
  row(t.limit, list(tiers));
  section.append(dl);
  return section;
}

/** "Kısayollar: açık / kapalı" toggle (REQ-14), aria-pressed plus text. */
export function createShortcutToggle(keys: KeyHandler): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'shortcut-toggle', 'aria-pressed': String(keys.isEnabled()) }, keys.isEnabled() ? tr.shortcutsOn : tr.shortcutsOff);
  b.addEventListener('click', () => {
    const on = !keys.isEnabled();
    keys.setEnabled(on);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? tr.shortcutsOn : tr.shortcutsOff;
  });
  return b;
}
