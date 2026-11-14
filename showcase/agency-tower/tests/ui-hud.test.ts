// UI improvements (KARARLAR Rev 31 CEO authorization): job strip collapse + layout rail.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createJobStrip, STRIP_COLLAPSED_KEY, type StripEntry } from '../src/ui/jobStrip';
import { mountHud } from '../src/ui/hudLayout';

const opts = { onActivate: () => undefined, isNarrow: () => false, expandByDefault: () => false };
const entry = (n: number): StripEntry => ({ n, lane: 1, title: `İş ${n}`, label: 'Adım', loops: 0, done: false, pause: null, steps: [] });
const toggleOf = (s: HTMLElement): HTMLButtonElement => s.querySelector<HTMLButtonElement>('button.job-collapse')!;
const css = (): string => readFileSync('src/ui/style.css', 'utf8');

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});
afterEach(() => vi.restoreAllMocks());

describe('job strip collapse', () => {
  it('starts expanded with a "Küçült" toggle; collapsing hides the list and shows a pill with the job count', () => {
    const s = createJobStrip(opts);
    document.body.append(s.element);
    s.update([entry(1), entry(2)]);
    const t = toggleOf(s.element);
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(t.textContent).toBe('Küçült');
    expect(s.element.querySelector('h2')!.textContent).toBe('Aktif işler — simülasyon');
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(t.textContent).toBe('Göster · 2 iş');
    expect(s.element.classList.contains('is-collapsed')).toBe(true);
    const body = document.getElementById(t.getAttribute('aria-controls')!)!;
    expect(body.hidden).toBe(true);
    expect(body.contains(s.element.querySelector('[data-job="1"]'))).toBe(true);
    s.update([entry(1), entry(2), entry(3)]);
    expect(t.textContent).toBe('Göster · 3 iş');
    t.click();
    expect(body.hidden).toBe(false);
    expect(t.textContent).toBe('Küçült');
  });

  it('remembers the collapsed state in localStorage', () => {
    const a = createJobStrip(opts);
    toggleOf(a.element).click();
    expect(localStorage.getItem(STRIP_COLLAPSED_KEY)).toBe('1');
    const b = createJobStrip(opts);
    expect(toggleOf(b.element).getAttribute('aria-expanded')).toBe('false');
    toggleOf(b.element).click();
    expect(localStorage.getItem(STRIP_COLLAPSED_KEY)).toBe('0');
    expect(toggleOf(createJobStrip(opts).element).getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const s = createJobStrip(opts);
    expect(() => toggleOf(s.element).click()).not.toThrow();
    expect(toggleOf(s.element).getAttribute('aria-expanded')).toBe('false');
  });

  it('the empty text stays inside the collapsible body', () => {
    const s = createJobStrip(opts);
    s.update([]);
    const body = s.element.querySelector('.job-body');
    expect(body?.id).toBe(toggleOf(s.element).getAttribute('aria-controls'));
    expect(body?.textContent).toContain('Şu an aktif iş yok');
  });

  it('the toggle meets the 44 px touch token', () => {
    expect(css()).toMatch(/\.job-collapse[^{]*\{[^}]*min-height: var\(--touch\)/);
  });
});

describe('HUD layout rail', () => {
  it('stacks the floor panel and the legend in one rail, in that tab order; the strip lives in the settings menu (Rev 35)', () => {
    const root = document.createElement('div');
    const panel = document.createElement('nav');
    const legend = document.createElement('div');
    const strip = document.createElement('section');
    const menu = document.createElement('div');
    menu.append(strip); // Rev 35: the strip is mounted inside the menu's "Aktif işler" section
    const rail = mountHud(root, { menu, panel, legend });
    expect(rail.classList.contains('hud-rail')).toBe(true);
    expect([...rail.children]).toEqual([panel, legend]);
    expect(rail.contains(strip)).toBe(false);
    expect(menu.contains(strip)).toBe(true);
    expect(root.firstElementChild).toBe(menu);
    expect(root.contains(rail)).toBe(true);
  });

  it('the strip is laid out inside the rail, not absolutely over the floor panel', () => {
    const c = css();
    expect(c).toMatch(/\.hud-rail \{[^}]*display: flex/);
    expect(c).toMatch(/\.hud-rail \{[^}]*flex-direction: column/);
    expect(c).not.toMatch(/\.job-strip \{[^}]*position: absolute/);
    expect(c).not.toMatch(/\.floor-panel \{[^}]*position: absolute/);
  });
});
