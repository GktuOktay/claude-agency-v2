import { describe, it, expect, vi } from 'vitest';
import { createKeyHandler, type KeyState } from '../src/ui/keymap';

function setup(initial: Partial<KeyState> = {}, orgEnabled = true) {
  const state: KeyState = { busy: false, cardOpen: false, mode: 'floor', ...initial };
  const log: string[] = [];
  const deps = {
    getState: () => state,
    goFloor: vi.fn((n: number) => log.push(`floor${n}`)),
    toggleOrg: vi.fn(() => log.push('org')),
    exitOrg: vi.fn(() => log.push('exitOrg')),
    closeCard: vi.fn(() => log.push('closeCard')),
    orgEnabled,
  };
  const h = createKeyHandler(deps);
  const key = (k: string, init: KeyboardEventInit = {}, target: EventTarget | null = null) =>
    h.handle({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target, ...init });
  return { state, log, deps, h, key };
}

describe('key map (AC-11)', () => {
  it('overview / floor, no card: digits go to the floor, O toggles org, Esc does nothing', () => {
    const s = setup();
    s.key('3');
    s.key('0');
    s.key('o');
    s.key('Escape');
    expect(s.log).toEqual(['floor3', 'floor0', 'org']);
  });

  it('ride in progress: only the last request is queued and applied on arrival; Esc ignored', () => {
    const s = setup({ busy: true });
    s.key('1');
    s.key('4');
    s.key('Escape');
    expect(s.log).toEqual([]);
    s.state.busy = false;
    s.h.onIdle();
    expect(s.log).toEqual(['floor4']);
    s.h.onIdle();
    expect(s.log).toEqual(['floor4']);
  });

  it('ride in progress: O and floor keys share one queue, last wins', () => {
    const s = setup({ busy: true });
    s.key('2');
    s.key('O');
    s.state.busy = false;
    s.h.onIdle();
    expect(s.log).toEqual(['org']);

    const t = setup({ busy: true });
    t.key('O');
    t.key('5');
    t.state.busy = false;
    t.h.onIdle();
    expect(t.log).toEqual(['floor5']);
  });

  it('card open: digit closes the card then rides; O closes then toggles org; Esc closes', () => {
    const a = setup({ cardOpen: true });
    a.key('2');
    expect(a.log).toEqual(['closeCard', 'floor2']);
    const b = setup({ cardOpen: true });
    b.key('o');
    expect(b.log).toEqual(['closeCard', 'org']);
    const c = setup({ cardOpen: true });
    c.key('Escape');
    expect(c.log).toEqual(['closeCard']);
  });

  it('org mode: digits leave org mode and go to the floor; O and Esc leave org mode', () => {
    const a = setup({ mode: 'org' });
    a.key('3');
    expect(a.log).toEqual(['exitOrg', 'floor3']);
    const b = setup({ mode: 'org' });
    b.key('O');
    expect(b.log).toEqual(['exitOrg']);
    const c = setup({ mode: 'org' });
    c.key('Escape');
    expect(c.log).toEqual(['exitOrg']);
  });

  it('O does nothing before M2 (org disabled)', () => {
    const s = setup({}, false);
    s.key('o');
    expect(s.log).toEqual([]);
    const c = setup({ cardOpen: true }, false);
    c.key('o');
    expect(c.log).toEqual([]);
  });

  it('ignores modifier keys, text fields, unknown keys and floor 6-9', () => {
    const s = setup();
    s.key('3', { ctrlKey: true });
    s.key('3', { altKey: true });
    s.key('3', { metaKey: true });
    s.key('3', { shiftKey: true });
    const input = document.createElement('input');
    s.key('3', {}, input);
    const ta = document.createElement('textarea');
    s.key('3', {}, ta);
    s.key('6');
    s.key('x');
    expect(s.log).toEqual([]);
  });

  it('the toolbar toggle turns shortcuts off and on again', () => {
    const s = setup();
    s.h.setEnabled(false);
    s.key('2');
    s.key('Escape');
    expect(s.log).toEqual([]);
    s.h.setEnabled(true);
    s.key('2');
    expect(s.log).toEqual(['floor2']);
  });
});
