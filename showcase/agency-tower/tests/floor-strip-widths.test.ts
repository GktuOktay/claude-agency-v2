// Floor strip at every width from 320 to 1280 px (live preview 748 px: "Tüm kule" under "Yemek"). jsdom has no
// layout, so the stylesheet's sizing rules are read and the strip is laid out with a small flex-wrap model:
// nothing overlaps and both rows fit left of the settings button.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMPUS_ITEMS } from '../src/ui/campusNav';

const css = readFileSync('src/ui/style.css', 'utf8').replace(/\/\*[^]*?\*\//g, '');

function mediaBlock(query: string): string {
  const at = css.indexOf(`@media (${query})`);
  if (at < 0) throw new Error(query);
  let i = css.indexOf('{', at) + 1;
  const start = i;
  for (let depth = 1; depth > 0; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
  return css.slice(start, i - 1);
}
const rules = (block: string, selector: string): string => {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(block); m; m = re.exec(block)) if (m[1]!.split(',').some((s) => s.trim() === selector)) out.push(m[2]!);
  return out.join(';');
};

const PHONE = mediaBlock('max-width: 767px');
const NARROW = mediaBlock('max-width: 374px');
const TOUCH = 44;
const GAP = 4;
const ALL_W = 4.5 * 16;
/** Conservative campus button width: 7.6 px per glyph of 0.8rem text plus 2 * 8 px padding, at least 44 px. */
const campusW = (): number[] => CAMPUS_ITEMS.map((c) => Math.max(TOUCH, [...c.short].length * 7.6 + 16));
/** Free width of the strip: rail insets (2 * 8), the settings corner (44 + 8), the panel padding (2 * 4). */
const room = (w: number): number => w - 16 - (TOUCH + 8) - 8;

/** Lays out flex-wrap items in `width`; returns their boxes [x0, x1, row]. */
function wrap(widths: readonly number[], width: number, gap: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  let x = 0;
  let row = 0;
  for (const w of widths) {
    if (x > 0 && x + w > width) {
      x = 0;
      row++;
    }
    out.push([x, x + w, row]);
    x += w + gap;
  }
  return out;
}

describe('floor strip widths (320-1280 px)', () => {
  it('phone floors are fixed 44 px wide and "Tüm kule" clips inside its fixed box', () => {
    const floors = rules(PHONE, ".floor-panel.has-groups .panel-group:first-child button:not([data-floor='all'])");
    expect(floors).toMatch(/width:\s*var\(--touch\)/);
    expect(floors).toMatch(/padding:\s*4px 0/);
    const all = rules(PHONE, ".floor-panel.has-groups button[data-floor='all']");
    expect(all).toMatch(/width:\s*4\.5rem/);
    expect(all).toMatch(/overflow:\s*hidden/);
    expect(all).toMatch(/white-space:\s*nowrap/);
  });

  it('375-767 px: six floors fill row 1, "Tüm kule" and the campus areas share row 2 without touching', () => {
    const tower = rules(PHONE, '.floor-panel.has-groups .panel-group:first-child');
    const towerW = Number(/width:\s*calc\(6 \* var\(--touch\) \+ 5 \* 4px \+ 2px\)/.test(tower) ? 6 * TOUCH + 5 * GAP + 2 : NaN);
    const margin = /margin-left:\s*calc\(4\.5rem \+ (\d+)px\)/.exec(rules(PHONE, '.floor-panel.has-groups .is-campus'));
    if (!margin) throw new Error('campus offset');
    const campusX0 = ALL_W + Number(margin[1]);
    for (let w = 375; w <= 767; w++) {
      const boxes = wrap([...Array<number>(6).fill(TOUCH), ALL_W], towerW, GAP);
      expect(boxes.slice(0, 6).every((b) => b[2] === 0), `${w}px: floors on row 1`).toBe(true);
      const all = boxes[6]!;
      expect(all[2], `${w}px: "Tüm kule" on row 2`).toBe(1);
      expect(all[1] + GAP, `${w}px: "Tüm kule" clear of the campus areas`).toBeLessThanOrEqual(campusX0);
      const rowW = campusX0 + 5 + campusW().reduce((s, x) => s + x, 0) + (CAMPUS_ITEMS.length - 1) * GAP;
      expect(Math.max(towerW, rowW), `${w}px: fits left of the settings button`).toBeLessThanOrEqual(room(w));
    }
  });

  it('320-374 px: floors wrap in the free width and the campus areas take their own row', () => {
    expect(rules(NARROW, '.floor-panel.has-groups')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(rules(NARROW, '.floor-panel.has-groups .panel-group:first-child')).toMatch(/width:\s*auto/);
    const campus = rules(NARROW, '.floor-panel.has-groups .is-campus');
    expect(campus).toMatch(/grid-area:\s*2\s*\/\s*1/);
    expect(campus).toMatch(/margin-left:\s*0/);
    expect(campus).toMatch(/flex-wrap:\s*wrap/);
    for (let w = 320; w <= 374; w++) {
      const tower = wrap([...Array<number>(6).fill(TOUCH), ALL_W], room(w), GAP);
      for (const b of tower) expect(b[1], `${w}px tower`).toBeLessThanOrEqual(room(w));
      for (let i = 1; i < tower.length; i++) if (tower[i]![2] === tower[i - 1]![2]) expect(tower[i]![0]).toBeGreaterThanOrEqual(tower[i - 1]![1] + GAP);
      for (const b of wrap(campusW(), room(w), GAP)) expect(b[1], `${w}px campus`).toBeLessThanOrEqual(room(w));
    }
  });

  it('768-1280 px: the desktop panel is a column, so the buttons stack and cannot overlap', () => {
    const base = css.slice(0, css.indexOf('@media'));
    expect(rules(base, '.floor-panel')).toMatch(/flex-direction:\s*column/);
    expect(rules(base, '.panel-group')).toMatch(/flex-direction:\s*column/);
  });
});
