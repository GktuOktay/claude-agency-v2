// Phone floor strip (KARARLAR Rev 38 polish): at 375 px the "Bina" floors, "Tüm şirket" and the "Kampüs" areas
// are all reachable without a hidden horizontal scroll. Two rows: floors 5..0 on top; "Tüm şirket" and the campus
// areas below. jsdom has no layout, so the phone rules are checked in the stylesheet plus a width budget.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFloorPanel } from '../src/ui/floorPanel';
import { CAMPUS_ITEMS } from '../src/ui/campusNav';
import hierarchy from '../src/data/hierarchy.json';

const css = readFileSync('src/ui/style.css', 'utf8').replace(/\/\*[^]*?\*\//g, ''); // comments stripped

/** Body of the `@media (max-width: 767px)` block (balanced braces). */
function phoneBlock(): string {
  const at = css.indexOf('@media (max-width: 767px)');
  expect(at).toBeGreaterThan(0);
  let i = css.indexOf('{', at) + 1;
  const start = i;
  for (let depth = 1; depth > 0; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
  }
  return css.slice(start, i - 1);
}
const rulesFor = (block: string, selector: string): string[] => {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(block); m; m = re.exec(block)) {
    if (m[1]!.split(',').some((s) => s.trim() === selector)) out.push(m[2]!);
  }
  return out;
};

describe('phone floor strip: two rows, no hidden horizontal scroll', () => {
  it('marks a grouped panel so the phone layout can place the rows', () => {
    const p = createFloorPanel(hierarchy.floors, () => undefined, { items: CAMPUS_ITEMS, onSelect: () => undefined });
    expect(p.element.classList.contains('has-groups')).toBe(true);
    expect(createFloorPanel(hierarchy.floors, () => undefined).element.classList.contains('has-groups')).toBe(false);
    // Desktop order and grouping unchanged: floors 5..0 then "Tüm şirket" in Bina, campus areas in Kampüs.
    const groups = [...p.element.querySelectorAll('[role="group"]')];
    expect(groups).toHaveLength(2);
    expect([...groups[0]!.querySelectorAll('button')].map((b) => b.dataset.floor)).toEqual(['5', '4', '3', '2', '1', '0', 'all']);
    expect([...groups[1]!.querySelectorAll('button')].map((b) => b.dataset.floor)).toEqual(CAMPUS_ITEMS.map((c) => c.key));
  });

  it('the phone strip never scrolls sideways: no overflow-x auto/scroll on the panel or its groups', () => {
    const block = phoneBlock();
    for (const sel of ['.floor-panel', '.floor-panel.has-groups', '.panel-group', '.floor-panel.has-groups .panel-group']) {
      for (const body of rulesFor(block, sel)) expect(body).not.toMatch(/overflow-x:\s*(auto|scroll)/);
    }
    expect(rulesFor(block, '.floor-panel:not(.has-groups)').join(';')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('places the tower group over two rows with "Tüm şirket" wrapping to the second row beside the campus areas', () => {
    const block = phoneBlock();
    const grid = rulesFor(block, '.floor-panel.has-groups').join(';');
    expect(grid).toMatch(/display:\s*grid/);
    const tower = rulesFor(block, '.floor-panel.has-groups .panel-group:first-child').join(';');
    expect(tower).toMatch(/flex-wrap:\s*wrap/);
    expect(tower).toMatch(/grid-area:\s*1\s*\/\s*1/);
    const campus = rulesFor(block, '.floor-panel.has-groups .is-campus').join(';');
    expect(campus).toMatch(/grid-area:\s*1\s*\/\s*1/);
    expect(campus).toMatch(/align-self:\s*end/);
  });

  it('keeps 44 px targets and fits 375 px: both rows stay left of the settings button', () => {
    const block = phoneBlock();
    expect(rulesFor(block, '.floor-panel button').join(';')).toMatch(/min-width:\s*var\(--touch\)[^;]*;[^]*min-height:\s*var\(--touch\)|min-height:\s*var\(--touch\)[^;]*;[^]*min-width:\s*var\(--touch\)/);
    // Width budget at 375 px: rail 375 - 2*8, minus the settings corner (44 + 8), minus the panel padding (2*4).
    const TOUCH = 44;
    const GAP = 4;
    const room = 375 - 16 - (TOUCH + 8) - 8;
    const row1 = 6 * TOUCH + 5 * GAP;
    expect(row1).toBeLessThanOrEqual(room);
    // Row 2: "Tüm şirket" (fixed 4.5rem) + gap + divider (1 px + 4 px) + campus buttons at a conservative 7.6 px
    // per glyph of 0.8rem text plus 2*8 px padding (no dot on phones), at least 44 px each.
    const allW = 4.5 * 16;
    const campusW = CAMPUS_ITEMS.reduce((s, c) => s + Math.max(TOUCH, [...c.short].length * 7.6 + 16), 0) + (CAMPUS_ITEMS.length - 1) * GAP;
    expect(allW + GAP + 5 + campusW).toBeLessThanOrEqual(room);
    expect(rulesFor(block, ".floor-panel.has-groups button[data-floor='all']").join(';')).toMatch(/width:\s*4\.5rem/);
    expect(rulesFor(block, '.floor-panel.has-groups .is-campus button').join(';')).toMatch(/padding:\s*4px 8px/);
    expect(rulesFor(block, '.floor-panel.has-groups .is-campus .dot').join(';')).toMatch(/display:\s*none/);
  });
});
