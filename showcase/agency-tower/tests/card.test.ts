import { describe, it, expect, vi } from 'vitest';
import { createCard } from '../src/ui/card';
import type { Unit } from '../src/data/types';

const unit: Unit = {
  id: 'x',
  name: '<img src=x onerror=alert(1)>',
  nameTr: 'Örnek <u>Rol</u>',
  floor: 2,
  tier: 'specialist',
  reportsTo: 'boss',
  independent: false,
  roleTr: 'Rol <b>kalın</b>',
  phrasesTr: ['a', 'b'],
  description: '<script>alert(1)</script> desc',
  tools: ['Read', '<i>Write</i>'],
  model: 'sonnet',
};

describe('card (AC-10, AC-13)', () => {
  it('renders every field in Turkish labels, as text only (no elements created from data)', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const card = createCard(parent, { resolveName: (id) => (id === 'boss' ? 'Patron' : id) });
    card.open(unit, null);
    const el = parent.querySelector('[role="dialog"]');
    expect(el).not.toBeNull();
    const text = el?.textContent ?? '';
    for (const label of ['Ajan adı', 'Kademe', 'Rol', 'Açıklama', 'Araçlar', 'Model', 'Bağlı olduğu']) expect(text).toContain(label);
    expect(text).toContain('<img src=x onerror=alert(1)>');
    expect(text).toContain('<script>alert(1)</script> desc');
    expect(text).toContain('Patron');
    expect(text).toContain('sonnet');
    expect(parent.querySelector('img, script, b, i')).toBeNull();
  });

  it('titles the card with nameTr and keeps the original id on a labelled "Ajan adı" line', () => {
    const parent = document.createElement('div');
    const card = createCard(parent, { resolveName: (id) => id });
    card.open({ ...unit, name: 'software-architect', nameTr: 'Yazılım Mimarı' }, null);
    const dlg = parent.querySelector('[role="dialog"]');
    expect(dlg?.getAttribute('aria-label')).toBe('Yazılım Mimarı');
    expect(dlg?.querySelector('h2')?.textContent).toBe('Yazılım Mimarı');
    const dts = [...parent.querySelectorAll('dt')];
    const dt = dts.find((d) => d.textContent === 'Ajan adı');
    expect(dt?.nextElementSibling?.textContent).toBe('software-architect');
  });

  it('shows a dash when there is no reports-to and no model', () => {
    const parent = document.createElement('div');
    const card = createCard(parent, { resolveName: (id) => id });
    card.open({ ...unit, reportsTo: null, model: null, tools: [] }, null);
    expect(parent.textContent).toContain('—');
  });

  it('closing restores focus to the opener and calls onClose; Esc inside the card closes', () => {
    const parent = document.createElement('div');
    const opener = document.createElement('button');
    document.body.append(opener, parent);
    const onClose = vi.fn();
    const card = createCard(parent, { resolveName: (id) => id, onClose });
    card.open(unit, opener);
    expect(card.isOpen()).toBe(true);
    parent.querySelector<HTMLButtonElement>('button')?.click();
    expect(card.isOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(onClose).toHaveBeenCalledTimes(1);

    card.open(unit, opener);
    parent.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(card.isOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('the close button has the accessible name "Kapat"', () => {
    const parent = document.createElement('div');
    const card = createCard(parent, { resolveName: (id) => id });
    card.open(unit, null);
    expect(parent.querySelector('button')?.getAttribute('aria-label')).toBe('Kapat');
  });
});
