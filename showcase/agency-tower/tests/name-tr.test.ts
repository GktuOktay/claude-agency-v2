// Rev 31: Turkish display names in the unit list; speech bubble size.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createUnitList, sortUnits } from '../src/ui/unitList';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { appRoot } from './helpers';

function data() {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

describe('unit list shows nameTr (Rev 31)', () => {
  it('buttons read "<nameTr> · <role>", keep the sort order and stay buttons', () => {
    const d = data();
    const list = createUnitList(d.units, () => undefined);
    const buttons = [...list.element.querySelectorAll('button')];
    expect(buttons).toHaveLength(20);
    expect(buttons.map((b) => b.textContent)).toEqual(sortUnits(d.units).map((u) => `${u.nameTr} · ${u.roleTr}`));
    expect(buttons[0]?.textContent).toMatch(/^CEO · /);
    expect(list.buttonFor('software-architect')?.textContent).toMatch(/^Yazılım Mimarı · /);
    // order unchanged: still floor, tier, then id
    const f3 = sortUnits(d.units).filter((u) => u.floor === 3).map((u) => u.id);
    expect(f3).toEqual(['product-manager', 'software-architect', 'architecture-board', 'business-analyst', 'scout']);
  });
});

describe('speech bubble size (Rev 31)', () => {
  const css = readFileSync(resolve(appRoot, 'src/ui/style.css'), 'utf8');
  const rule = /\n\.bubble \{([^}]*)\}/.exec(css)?.[1] ?? '';
  it('uses about 80 % of the former 12px font and scaled padding', () => {
    expect(rule).toMatch(/font-size:\s*9\.6px/);
    expect(rule).toMatch(/padding:\s*4px 8px/);
  });
  it('wraps long lines at a max-width so 48 characters take at most 2 lines', () => {
    expect(rule).toMatch(/max-width:\s*28ch/);
    expect(rule).toMatch(/white-space:\s*normal/);
  });
});
