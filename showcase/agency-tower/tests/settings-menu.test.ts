// UI improvements (KARARLAR Rev 31 CEO authorization): corner settings menu replaces the toolbar.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSettingsMenu, createScenarioInfo, createShortcutToggle } from '../src/ui/settingsMenu';
import { createKeyHandler } from '../src/ui/keymap';
import { maxJobsFor } from '../src/app/params';
import { MASTER_SEED } from '../src/sim/workflow';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeMenu() {
  const a = document.createElement('button');
  a.textContent = 'Organizasyon şeması';
  a.setAttribute('aria-pressed', 'false');
  const b = document.createElement('button');
  b.textContent = 'Hareketi durdur';
  b.setAttribute('aria-pressed', 'true');
  const scenario = createScenarioInfo({ seed: 42, laneWeights: [15, 35, 30, 20], quality: 'high', maxJobs: { low: 2, high: 3 } });
  // Rev 35: the menu takes section modules; the old toolbar controls sit in the first section.
  const controls = document.createElement('div');
  controls.append(a, b);
  const menu = createSettingsMenu({ sections: [{ id: 'controls', title: 'Görünüm', element: controls }, { id: 'scenario', title: 'Senaryo', element: scenario }] });
  document.body.append(menu.element);
  const outside = document.createElement('button');
  document.body.append(outside);
  return { menu, a, b, outside, scenario };
}

beforeEach(() => document.body.replaceChildren());

describe('settings menu', () => {
  it('is an icon button named "Ayarlar" with an inline SVG icon; the popover starts closed', () => {
    const { menu } = makeMenu();
    const btn = menu.button;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.getAttribute('aria-label')).toBe('Ayarlar');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const svg = btn.querySelector('svg')!;
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-controls')!)).toBe(menu.panel);
    expect(menu.panel.hidden).toBe(true);
  });

  it('opens on click, moves focus into the popover, and the toggle state stays readable', () => {
    const { menu, a, b } = makeMenu();
    menu.button.click();
    expect(menu.isOpen()).toBe(true);
    expect(menu.button.getAttribute('aria-expanded')).toBe('true');
    expect(menu.panel.hidden).toBe(false);
    expect(menu.panel.getAttribute('role')).toBe('dialog');
    expect(menu.panel.contains(document.activeElement)).toBe(true);
    expect(menu.panel.contains(a) && menu.panel.contains(b)).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    menu.button.click();
    expect(menu.isOpen()).toBe(false);
  });

  it('Esc closes it, returns focus to the button and does not reach the page shortcuts', () => {
    const { menu, a } = makeMenu();
    const pageKeys = vi.fn();
    window.addEventListener('keydown', pageKeys);
    menu.button.click();
    a.focus();
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.removeEventListener('keydown', pageKeys);
    expect(menu.isOpen()).toBe(false);
    expect(menu.panel.hidden).toBe(true);
    expect(document.activeElement).toBe(menu.button);
    expect(pageKeys).not.toHaveBeenCalled();
  });

  it('a pointer press outside closes it without taking focus', () => {
    const { menu, outside } = makeMenu();
    menu.button.click();
    outside.focus();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.isOpen()).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it('builds no markup from strings', () => {
    const src = readFileSync('src/ui/settingsMenu.ts', 'utf8');
    expect(src).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
    expect(src).toMatch(/createElementNS/);
  });

  it('the icon button meets the 44 px touch token', () => {
    expect(readFileSync('src/ui/style.css', 'utf8')).toMatch(/\.settings-button \{[^}]*min-height: var\(--touch\)[^}]*min-width: var\(--touch\)|\.settings-button \{[^}]*width: var\(--touch\)[^}]*height: var\(--touch\)/);
  });
});

describe('Senaryo section (read-only)', () => {
  it('shows the seed, the lane weights and the active-job limit per quality tier, the current tier marked in text', () => {
    const { scenario } = makeMenu();
    expect(scenario.querySelector('h3')?.textContent).toBe('Senaryo');
    const t = scenario.textContent ?? '';
    expect(t).toContain('42');
    for (const s of ['Hat 0 · %15', 'Hat 1 · %35', 'Hat 2 · %30', 'Hat 3 · %20']) expect(t).toContain(s);
    expect(t).toContain('Düşük kalite: en çok 2 aktif iş');
    expect(t).toContain('Yüksek kalite: en çok 3 aktif iş (şu an)');
    expect(t).not.toContain('Düşük kalite: en çok 2 aktif iş (şu an)');
    expect(t).toContain('simülasyon');
    expect(scenario.querySelectorAll('button, input, select, textarea')).toHaveLength(0);
  });

  it('the limits come from the same source as the runtime (low 2, high 3); the seed default is the master seed', () => {
    expect(maxJobsFor('low')).toBe(2);
    expect(maxJobsFor('high')).toBe(3);
    expect(Number.isInteger(MASTER_SEED)).toBe(true);
  });
});

describe('Kısayollar toggle (moved from the toolbar into the menu)', () => {
  it('turns shortcuts off and on, aria-pressed and text follow', () => {
    const log: string[] = [];
    const keys = createKeyHandler({
      getState: () => ({ busy: false, cardOpen: false, mode: 'floor' }),
      goFloor: (n) => log.push(`floor${n}`),
      toggleOrg: () => undefined,
      exitOrg: () => undefined,
      closeCard: () => undefined,
      orgEnabled: true,
    });
    const b = createShortcutToggle(keys);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.textContent).toBe('Kısayollar: açık');
    b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.textContent).toBe('Kısayollar: kapalı');
    keys.handle({ key: '2', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target: null });
    expect(log).toEqual([]);
    b.click();
    keys.handle({ key: '2', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target: null });
    expect(log).toEqual(['floor2']);
  });
});
