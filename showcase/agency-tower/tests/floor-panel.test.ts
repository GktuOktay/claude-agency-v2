import { describe, it, expect, vi } from 'vitest';
import { createFloorPanel } from '../src/ui/floorPanel';
import hierarchy from '../src/data/hierarchy.json';

describe('floor panel (AC-8)', () => {
  it('has buttons 5..0 with Turkish names plus "Tüm kule"', () => {
    const onSelect = vi.fn();
    const p = createFloorPanel(hierarchy.floors, onSelect);
    const buttons = [...p.element.querySelectorAll('button')];
    expect(buttons).toHaveLength(7);
    expect(buttons.map((b) => b.getAttribute('data-floor'))).toEqual(['5', '4', '3', '2', '1', '0', 'all']);
    expect(buttons[0]?.textContent).toContain('Penthouse — CEO Ofisi');
    expect(buttons[2]?.textContent).toContain('Strateji ve Mimari');
    expect(buttons[6]?.textContent).toContain('Tüm kule');
    buttons[2]?.click();
    expect(onSelect).toHaveBeenCalledWith(3);
    buttons[6]?.click();
    expect(onSelect).toHaveBeenCalledWith('all');
  });

  it('marks the current floor with aria-current and a text marker, not color alone', () => {
    const p = createFloorPanel(hierarchy.floors, () => undefined);
    p.setCurrent(3);
    const cur = [...p.element.querySelectorAll('button')].filter((b) => b.getAttribute('aria-current') === 'true');
    expect(cur).toHaveLength(1);
    expect(cur[0]?.getAttribute('data-floor')).toBe('3');
    expect(cur[0]?.textContent).toContain('●');
    p.setCurrent('all');
    const all = [...p.element.querySelectorAll('button')].filter((b) => b.getAttribute('aria-current') === 'true');
    expect(all).toHaveLength(1);
    expect(all[0]?.getAttribute('data-floor')).toBe('all');
    expect(p.element.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });
});
