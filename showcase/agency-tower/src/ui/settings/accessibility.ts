// "Erişilebilirlik & kısayollar" section (Rev 35): the shortcut toggle (REQ-14) and the key list.
import { tr } from '../../i18n/tr';
import { el } from '../dom';
import type { KeyHandler } from '../keymap';
import { sectionBody, type SettingsSection } from './section';

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

export interface AccessibilityOptions {
  keys: KeyHandler;
}

export function createAccessibilitySection(o: AccessibilityOptions): SettingsSection {
  const t = tr.settings;
  const body = sectionBody('access');
  const controls = el('div', { class: 'settings-controls' });
  controls.append(createShortcutToggle(o.keys));
  const dl = el('dl', { class: 'key-list', 'aria-label': t.keyList });
  for (const [key, what] of t.keys) {
    const dt = el('dt');
    dt.append(el('kbd', {}, key));
    dl.append(dt, el('dd', {}, what));
  }
  body.append(controls, dl);
  return { id: 'access', title: t.access, element: body };
}
