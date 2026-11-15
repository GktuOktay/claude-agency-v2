// KARARLAR Rev 43 package A: switching between robots in "Ajan gözü" (◀ ▶, Tab / Shift+Tab, the picker) and the
// wider follow framing (further back and higher, pulled in when a wall is behind).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { createCameraModeUi } from '../src/ui/cameraModeUi';
import { createKeyHandler, type KeyState } from '../src/ui/keymap';
import { cycleFollow, followBounds, followOrder, followPose, createFollower } from '../src/scene/follow';
import { HALF_DEPTH, HALF_WIDTH } from '../src/sim/layout';

const css = readFileSync('src/ui/style.css', 'utf8');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(^|\\n)\\s*${esc} \\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join(';');
};

describe('follow order and cycling (Rev 43)', () => {
  const robots = [
    { id: 'qa', floor: 2 },
    { id: 'ceo', floor: 5 },
    { id: 'ba', floor: 1 },
    { id: 'arch', floor: 3 },
    { id: 'appsec', floor: 2 },
  ];
  it('orders robots by floor, then id (stable)', () => {
    expect(followOrder(robots)).toEqual(['ba', 'appsec', 'qa', 'arch', 'ceo']);
    expect(followOrder([...robots].reverse())).toEqual(['ba', 'appsec', 'qa', 'arch', 'ceo']);
  });
  it('next / previous wrap around the ends', () => {
    const order = followOrder(robots);
    expect(cycleFollow(order, 'ba', 1)).toBe('appsec');
    expect(cycleFollow(order, 'ceo', 1)).toBe('ba');
    expect(cycleFollow(order, 'ba', -1)).toBe('ceo');
    expect(cycleFollow(order, 'missing', 1)).toBe('ba');
    expect(cycleFollow([], 'x', 1)).toBeNull();
  });
});

describe('mode bar: ◀ ▶ and the agent picker (Rev 43)', () => {
  const make = () => {
    const onStep = vi.fn();
    const onPick = vi.fn();
    const ui = createCameraModeUi({ onWalk: () => undefined, onExit: () => undefined, onStep, onPick, touch: false });
    document.body.append(ui.walkButton, ui.bar);
    const agents = [
      { id: 'ba', name: 'İş Analisti', floor: 'Kat 1' },
      { id: 'qa', name: 'Test Mühendisi', floor: 'Kat 2' },
    ];
    return { ui, onStep, onPick, agents };
  };

  it('follow shows named ◀ ▶ buttons that step to the previous / next robot', () => {
    const { ui, onStep, agents } = make();
    ui.showFollow('İş Analisti', { agents, current: 'ba' });
    const prev = ui.bar.querySelector<HTMLButtonElement>('button[aria-label="Önceki ajan"]');
    const next = ui.bar.querySelector<HTMLButtonElement>('button[aria-label="Sonraki ajan"]');
    expect(prev?.hidden).toBe(false);
    expect(next?.hidden).toBe(false);
    expect(prev!.textContent).toBe('◀');
    expect(next!.textContent).toBe('▶');
    prev!.click();
    next!.click();
    expect(onStep.mock.calls).toEqual([[-1], [1]]);
    expect(ui.bar.textContent).toContain('Tab');
    ui.hide();
  });

  it('the picker lists every robot with its Turkish name and floor; choosing one follows it', () => {
    const { ui, onPick, agents } = make();
    ui.showFollow('İş Analisti', { agents, current: 'ba' });
    const sel = ui.bar.querySelector<HTMLSelectElement>('select');
    expect(sel).not.toBeNull();
    expect(sel!.getAttribute('aria-label')).toBe('Takip edilecek ajan');
    expect([...sel!.options].map((o) => o.textContent)).toEqual(['İş Analisti · Kat 1', 'Test Mühendisi · Kat 2']);
    expect(sel!.value).toBe('ba');
    sel!.value = 'qa';
    sel!.dispatchEvent(new Event('change'));
    expect(onPick).toHaveBeenCalledWith('qa');
    ui.hide();
  });

  it('switching updates the title and picker but keeps focus where it is', () => {
    const { ui, agents } = make();
    ui.showFollow('İş Analisti', { agents, current: 'ba' });
    const next = ui.bar.querySelector<HTMLButtonElement>('button[aria-label="Sonraki ajan"]')!;
    next.focus();
    ui.updateFollow('Test Mühendisi', { agents, current: 'qa' });
    expect(ui.bar.textContent).toContain('Ajan gözü: Test Mühendisi');
    expect(ui.bar.querySelector('select')!.value).toBe('qa');
    expect(document.activeElement).toBe(next);
    ui.hide();
  });

  it('walk mode hides the switching controls', () => {
    const { ui } = make();
    ui.showWalk('Kat 2');
    expect(ui.bar.querySelector<HTMLButtonElement>('button[aria-label="Sonraki ajan"]')!.hidden).toBe(true);
    expect(ui.bar.querySelector<HTMLSelectElement>('select')!.hidden).toBe(true);
    ui.hide();
  });

  it('the ◀ ▶ buttons and the picker meet the 44 px touch token', () => {
    for (const sel of ['.camera-mode-step', '.camera-mode-pick']) {
      expect(rule(sel), sel).toMatch(/min-height: var\(--touch\)/);
      expect(rule(sel), sel).toMatch(/min-width: var\(--touch\)/);
    }
  });
});

describe('Tab / Shift+Tab in "Ajan gözü" (Rev 43)', () => {
  function setup(camera: KeyState['camera']) {
    const state: KeyState = { busy: false, cardOpen: false, mode: 'floor', camera };
    const log: string[] = [];
    const h = createKeyHandler({
      getState: () => state,
      goFloor: (n) => log.push(`floor${n}`),
      toggleOrg: () => log.push('org'),
      exitOrg: () => log.push('exitOrg'),
      closeCard: () => log.push('closeCard'),
      exitCamera: () => log.push('exitCamera'),
      stepFollow: (d) => log.push(`step${d}`),
      orgEnabled: true,
    });
    const key = (k: string, shiftKey = false, target: EventTarget | null = null) => {
      const preventDefault = vi.fn();
      h.handle({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey, target, preventDefault });
      return preventDefault;
    };
    return { log, key };
  }

  it('Tab steps to the next robot, Shift+Tab to the previous, and the browser focus move is suppressed', () => {
    const s = setup('follow');
    const p1 = s.key('Tab');
    const p2 = s.key('Tab', true);
    expect(s.log).toEqual(['step1', 'step-1']);
    expect(p1).toHaveBeenCalled();
    expect(p2).toHaveBeenCalled();
  });

  it('Tab on the picker keeps normal focus order; walk mode and no mode leave Tab alone', () => {
    const s = setup('follow');
    const p = s.key('Tab', false, document.createElement('select'));
    expect(p).not.toHaveBeenCalled();
    expect(s.log).toEqual([]);
    for (const mode of ['walk', null] as const) {
      const t = setup(mode);
      const q = t.key('Tab');
      expect(t.log).toEqual([]);
      expect(q).not.toHaveBeenCalled();
    }
  });
});

describe('follow framing (Rev 43: further back and higher)', () => {
  const head = (f: { x: number; y: number; z: number }) => new Vector3(f.x, f.y + 0.9, f.z);
  it('stands well back and above the robot, looking slightly down at it', () => {
    for (const facing of [0, 1, Math.PI, -2]) {
      const feet = { x: 0, y: 3, z: 0 };
      const { pos, target } = followPose(feet, facing);
      const d = pos.distanceTo(head(feet));
      expect(d).toBeGreaterThan(5); // ~3x the Rev 42 head distance (~2 u)
      expect(d).toBeLessThan(8);
      expect(pos.y - feet.y).toBeGreaterThan(2);
      expect(pos.y - feet.y).toBeLessThan(2.8); // under the slab of the floor above (3 u)
      const look = target.clone().sub(pos);
      const down = Math.atan2(-look.y, Math.hypot(look.x, look.z)) * (180 / Math.PI);
      expect(down).toBeGreaterThan(10);
      expect(down).toBeLessThan(35);
    }
  });

  it('pulls in when a wall is behind, staying inside the floor (but never onto the robot)', () => {
    const feet = { x: 0, y: 0, z: -HALF_DEPTH + 1 };
    const facing = 0; // facing +z: the camera wants to go out through the back wall
    const { pos } = followPose(feet, facing, 1, followBounds(feet));
    expect(pos.z).toBeGreaterThanOrEqual(-HALF_DEPTH);
    expect(Math.abs(pos.x)).toBeLessThanOrEqual(HALF_WIDTH);
    expect(Math.hypot(pos.x - feet.x, pos.z - feet.z)).toBeGreaterThan(0.6);
  });

  it('a new robot is eased to (no jump); reduced motion cuts', () => {
    const f = createFollower(new Vector3(0, 2.5, -5), new Vector3(0, 0.5, 1));
    const a = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 120; i++) f.update(a, 0, 1 / 60, false);
    const b = { x: 6, y: 6, z: 2 };
    const before = f.update(a, 0, 0, false).pos;
    const first = f.update(b, 0, 1 / 60, false).pos;
    expect(first.distanceTo(before)).toBeLessThan(1);
    const g = createFollower(new Vector3(0, 2.5, -5), new Vector3(0, 0.5, 1));
    expect(g.update(b, 1, 1 / 60, true).pos.distanceTo(followPose(b, 1).pos)).toBeLessThan(1e-9);
  });
});
