// KARARLAR Rev 35 (P1): everything under the settings menu, one module per section; only the floor
// panel stays open. Tests query by role, label and text.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createSettingsMenu } from '../src/ui/settingsMenu';
import { createAppearanceSection, QUALITY_KEY, QUALITY_TIERS, readStoredQuality, toLegacyQuality, type QualityTier } from '../src/ui/settings/appearance';
import { createActiveJobsSection } from '../src/ui/settings/activeJobs';
import { createOfficeSection, createScheduleView, PLACEHOLDER_SCHEDULE, type OfficeSchedule } from '../src/ui/settings/office';
import { createScenarioSection } from '../src/ui/settings/scenario';
import { createAccessibilitySection } from '../src/ui/settings/accessibility';
import { createJobStrip, type StripEntry } from '../src/ui/jobStrip';
import { createKeyHandler } from '../src/ui/keymap';

const btn = (text: string): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  return b;
};
const keys = () =>
  createKeyHandler({
    getState: () => ({ busy: false, cardOpen: false, mode: 'floor' }),
    goFloor: () => undefined,
    toggleOrg: () => undefined,
    exitOrg: () => undefined,
    closeCard: () => undefined,
    orgEnabled: true,
  });
const stripOpts = { onActivate: () => undefined, isNarrow: () => false, expandByDefault: () => false };
const entry = (n: number, done = false): StripEntry => ({ n, lane: 1, title: `İş ${n}`, label: 'Adım', loops: 0, done, pause: null, steps: [] });

function fullMenu(onQuality = vi.fn()) {
  const strip = createJobStrip(stripOpts);
  const sections = [
    createAppearanceSection({ dayNight: btn('Gündüz'), current: 'high', onQuality }),
    createActiveJobsSection({ strip: strip.element }),
    createOfficeSection({ controls: [btn('Hareketi durdur'), btn('Organizasyon şeması')], schedule: PLACEHOLDER_SCHEDULE }),
    createScenarioSection({ seed: 7, laneWeights: [15, 35, 30, 20], quality: 'high', maxJobs: { low: 2, high: 3 } }),
    createAccessibilitySection({ keys: keys() }),
  ];
  const menu = createSettingsMenu({ sections });
  document.body.append(menu.element);
  return { menu, strip, onQuality };
}
const tabs = (menu: { panel: HTMLElement }): HTMLElement[] => [...menu.panel.querySelectorAll<HTMLElement>('[role="tab"]')];
const visiblePanel = (menu: { panel: HTMLElement }): HTMLElement => [...menu.panel.querySelectorAll<HTMLElement>('[role="tabpanel"]')].find((p) => !p.hidden)!;

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});
afterEach(() => vi.restoreAllMocks());

describe('settings menu shell: tabs, one module per section', () => {
  it('shows five tabs in order, the first selected, and each tab controls its own panel', () => {
    const { menu } = fullMenu();
    menu.open();
    const list = menu.panel.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-label')).toBe('Ayarlar bölümleri');
    expect(tabs(menu).map((t) => t.textContent)).toEqual(['Görünüm', 'Aktif işler', 'Ofis', 'Senaryo', 'Erişilebilirlik & kısayollar']);
    expect(tabs(menu).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    for (const t of tabs(menu)) {
      const p = document.getElementById(t.getAttribute('aria-controls')!)!;
      expect(p.getAttribute('role')).toBe('tabpanel');
      expect(p.getAttribute('aria-labelledby')).toBe(t.id);
    }
    expect(visiblePanel(menu).textContent).toContain('Görüntü kalitesi');
  });

  it('clicking a tab shows only its panel; arrow keys, Home and End move between tabs (roving tabindex)', () => {
    const { menu } = fullMenu();
    menu.open();
    const t = tabs(menu);
    t[2]!.click();
    expect(t[2]!.getAttribute('aria-selected')).toBe('true');
    expect(visiblePanel(menu).textContent).toContain('Mola saatleri');
    expect(menu.panel.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    t[2]!.focus();
    t[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(t[3]);
    expect(t[3]!.getAttribute('aria-selected')).toBe('true');
    expect(t.map((x) => x.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '0', '-1']);
    t[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(t[4]);
    t[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(t[0]);
    t[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(t[4]);
    t[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(t[0]);
  });

  it('is a non-modal dialog (no focus trap); opening focuses the selected tab and keeps the last tab', () => {
    const { menu } = fullMenu();
    expect(menu.panel.getAttribute('role')).toBe('dialog');
    expect(menu.panel.hasAttribute('aria-modal')).toBe(false);
    menu.open();
    expect(document.activeElement).toBe(tabs(menu)[0]);
    tabs(menu)[1]!.click();
    menu.close();
    menu.open();
    expect(document.activeElement).toBe(tabs(menu)[1]);
    expect(visiblePanel(menu).textContent).toContain('Aktif işler — simülasyon');
  });

  it('has one file per section under src/ui/settings/, none building markup from strings', () => {
    const files = readdirSync('src/ui/settings').sort();
    for (const f of ['accessibility.ts', 'activeJobs.ts', 'appearance.ts', 'office.ts', 'scenario.ts']) expect(files).toContain(f);
    for (const f of files) expect(readFileSync(`src/ui/settings/${f}`, 'utf8')).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
  });

  it('CSS: side panel on desktop, bottom sheet on phones, 44 px tabs and options, motion only when allowed', () => {
    const css = readFileSync('src/ui/style.css', 'utf8');
    expect(css).toMatch(/\.settings-tab \{[^}]*min-height: var\(--touch\)/);
    expect(css).toMatch(/\.quality-option \{[^}]*min-height: var\(--touch\)/);
    expect(css).toMatch(/\.settings-panel \{[^}]*position: fixed/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{[\s\S]*\.settings-panel \{[^}]*bottom: 0/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^@]*\.settings-panel/);
  });
});

describe('Görünüm: day/night and "Görüntü kalitesi"', () => {
  it('holds the day/night control and four quality options with the current tier checked', () => {
    const dn = btn('Gündüz');
    const s = createAppearanceSection({ dayNight: dn, current: 'medium', onQuality: () => undefined });
    expect(s.title).toBe('Görünüm');
    expect(s.element.contains(dn)).toBe(true);
    const fs = s.element.querySelector('fieldset')!;
    expect(fs.querySelector('legend')?.textContent).toBe('Görüntü kalitesi');
    const radios = [...fs.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.labels?.[0]?.textContent)).toEqual(['Düşük', 'Orta', 'Yüksek', 'Ultra']);
    expect(radios.map((r) => r.value)).toEqual([...QUALITY_TIERS]);
    expect(radios.find((r) => r.checked)?.value).toBe('medium');
  });

  it('choosing a tier calls onQuality(tier) and persists it; a new section starts from the stored tier', () => {
    const onQuality = vi.fn<(t: QualityTier) => void>();
    const s = createAppearanceSection({ dayNight: btn('x'), current: 'high', onQuality });
    const ultra = s.element.querySelector<HTMLInputElement>('input[value="ultra"]')!;
    ultra.click();
    expect(onQuality).toHaveBeenCalledWith('ultra');
    expect(localStorage.getItem(QUALITY_KEY)).toBe('ultra');
    expect(readStoredQuality()).toBe('ultra');
    const again = createAppearanceSection({ dayNight: btn('x'), current: readStoredQuality() ?? 'high', onQuality });
    expect(again.element.querySelector<HTMLInputElement>('input:checked')?.value).toBe('ultra');
  });

  it('ignores an unknown stored value and keeps working when localStorage throws', () => {
    localStorage.setItem(QUALITY_KEY, '<b>max</b>');
    expect(readStoredQuality()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredQuality()).toBeNull();
    const onQuality = vi.fn();
    const s = createAppearanceSection({ dayNight: btn('x'), current: 'high', onQuality });
    expect(() => s.element.querySelector<HTMLInputElement>('input[value="low"]')!.click()).not.toThrow();
    expect(onQuality).toHaveBeenCalledWith('low');
  });

  it('maps the four tiers onto the existing ?quality tiers until the quality engine exists', () => {
    expect(QUALITY_TIERS.map(toLegacyQuality)).toEqual(['low', 'high', 'high', 'high']);
  });
});

describe('Aktif işler: the job strip lives in the menu; badge on the settings button', () => {
  it('the section holds the strip with its heading, step lists and pause text', () => {
    const strip = createJobStrip(stripOpts);
    const s = createActiveJobsSection({ strip: strip.element });
    expect(s.title).toBe('Aktif işler');
    expect(s.element.contains(strip.element)).toBe(true);
    strip.update([{ ...entry(4), pause: 'Duraklatıldı', steps: [{ id: 'a', label: 'Spec', mark: 'now' }] }]);
    expect(s.element.textContent).toContain('Adımlar');
    expect(s.element.textContent).toContain('Duraklatıldı');
  });

  it('the strip reports the number of active (not finished) jobs when it changes', () => {
    const strip = createJobStrip(stripOpts);
    const seen: number[] = [];
    strip.onCount((n) => seen.push(n));
    strip.update([entry(1), entry(2)]);
    strip.update([entry(1), entry(2)]);
    strip.update([entry(1, true), entry(2)]);
    strip.update([]);
    expect(seen).toEqual([2, 1, 0]);
  });

  it('closed menu: a badge shape with the number on the button, named in the button label; hidden when open or zero', () => {
    const { menu } = fullMenu();
    const badge = (): HTMLElement => menu.button.querySelector<HTMLElement>('.settings-badge')!;
    expect(badge().hidden).toBe(true);
    menu.setBadge(3);
    expect(badge().hidden).toBe(false);
    expect(badge().textContent).toBe('3');
    expect(badge().getAttribute('aria-hidden')).toBe('true');
    expect(menu.button.getAttribute('aria-label')).toBe('Ayarlar · 3 aktif iş');
    menu.open();
    expect(badge().hidden).toBe(true);
    menu.close();
    expect(badge().hidden).toBe(false);
    menu.setBadge(0);
    expect(badge().hidden).toBe(true);
    expect(menu.button.getAttribute('aria-label')).toBe('Ayarlar');
  });

  it('the badge is a shape (border + radius), not colour alone', () => {
    expect(readFileSync('src/ui/style.css', 'utf8')).toMatch(/\.settings-badge \{[^}]*border: [^}]*border-radius/);
  });
});

describe('Ofis: motion, org chart and "Mola saatleri"', () => {
  it('holds the given controls and the placeholder schedule in time order', () => {
    const pause = btn('Hareketi durdur');
    const org = btn('Organizasyon şeması');
    const s = createOfficeSection({ controls: [pause, org], schedule: PLACEHOLDER_SCHEDULE });
    expect(s.title).toBe('Ofis');
    expect(s.element.contains(pause) && s.element.contains(org)).toBe(true);
    const rows = [...s.element.querySelectorAll('.schedule li')].map((li) => li.querySelector('.schedule-text')?.textContent);
    expect(rows).toEqual(['08:00 Mesai başlar', '10:30 Kahve molası', '12:30 Öğle yemeği', '15:30 Çay molası', '18:00 Mesai biter']);
    expect(s.element.querySelector('h3')?.textContent).toBe('Mola saatleri');
  });

  it('renders any OfficeSchedule: "Şu an" line and the current slot marked in text, refreshed on demand', () => {
    let t = { hh: 10, mm: 35, label: 'Kahve molası' };
    const schedule: OfficeSchedule = {
      now: () => t,
      slots: [
        { start: '09:00', end: '10:30', labelTr: 'Mesai', kind: 'work' },
        { start: '10:30', end: '10:45', labelTr: 'Kahve molası', kind: 'coffee' },
      ],
    };
    const v = createScheduleView(schedule);
    expect(v.element.querySelector('.schedule-now')?.textContent).toBe('Şu an: 10:35 · Kahve molası');
    const current = v.element.querySelectorAll('li[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('(şu an)');
    expect(current[0]?.textContent).toContain('10:30 Kahve molası');
    t = { hh: 9, mm: 5, label: 'Mesai' };
    v.refresh();
    expect(v.element.querySelector('.schedule-now')?.textContent).toBe('Şu an: 09:05 · Mesai');
    expect(v.element.querySelector('li[aria-current="true"]')?.textContent).toContain('09:00 Mesai');
  });

  it('the placeholder is labelled as an example until the schedule engine is wired in', () => {
    const s = createOfficeSection({ controls: [], schedule: PLACEHOLDER_SCHEDULE });
    expect(s.element.textContent).toContain('örnek');
  });
});

describe('Senaryo and Erişilebilirlik & kısayollar sections', () => {
  it('Senaryo is the read-only scenario info as its own module', () => {
    const s = createScenarioSection({ seed: 9, laneWeights: [15, 35, 30, 20], quality: 'low', maxJobs: { low: 2, high: 3 } });
    expect(s.title).toBe('Senaryo');
    expect(s.element.textContent).toContain('Düşük kalite: en çok 2 aktif iş (şu an)');
    expect(s.element.querySelectorAll('button, input')).toHaveLength(0);
  });

  it('Erişilebilirlik holds the shortcut toggle and the key list', () => {
    const s = createAccessibilitySection({ keys: keys() });
    expect(s.title).toBe('Erişilebilirlik & kısayollar');
    const toggle = s.element.querySelector<HTMLButtonElement>('button.shortcut-toggle')!;
    expect(toggle.textContent).toBe('Kısayollar: açık');
    const terms = [...s.element.querySelectorAll('dt kbd')].map((k) => k.textContent);
    expect(terms).toEqual(['0–5', 'O', 'K', 'Esc']);
    expect(s.element.textContent).toContain('Kat seç');
  });
});
