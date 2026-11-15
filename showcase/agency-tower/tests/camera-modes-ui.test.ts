// KARARLAR Rev 42 camera modes, user-visible parts: "Takip et" on the card, the mode bar with its exit button,
// the "İçeride gez" entry, Esc, and the overview floor labels that zoom to their floor.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCard } from '../src/ui/card';
import { createCameraModeUi } from '../src/ui/cameraModeUi';
import { createKeyHandler, type KeyState } from '../src/ui/keymap';
import { floorLabelAt } from '../src/scene/labels';
import { CameraRig, OVERVIEW_DURATION, floorPose } from '../src/scene/camera';
import type { Unit } from '../src/data/types';

const css = readFileSync('src/ui/style.css', 'utf8');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(^|\\n)\\s*${esc} \\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join(';');
};

const unit: Unit = {
  id: 'x',
  name: 'x',
  nameTr: 'Örnek Rol',
  floor: 2,
  tier: 'specialist',
  reportsTo: null,
  independent: false,
  roleTr: 'Rol',
  phrasesTr: ['a'],
  description: 'd',
  descriptionTr: 'a',
  tools: [],
  model: null,
};

describe('"Takip et" on the robot card', () => {
  it('shows a named "Takip et" button that starts following the robot', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const onFollow = vi.fn();
    const card = createCard(parent, { resolveName: (id) => id, onFollow });
    card.open(unit, null);
    const b = [...parent.querySelectorAll('button')].find((x) => x.textContent === 'Takip et');
    expect(b).toBeDefined();
    expect(b!.getAttribute('aria-label')).toBe('Takip et: Örnek Rol');
    expect(b!.classList.contains('card-follow')).toBe(true);
    b!.click();
    expect(onFollow).toHaveBeenCalledWith(unit);
    parent.remove();
  });

  it('the fallback card (no scene) has no follow button', () => {
    const parent = document.createElement('div');
    const card = createCard(parent, { resolveName: (id) => id });
    card.open(unit, null);
    expect([...parent.querySelectorAll('button')].some((x) => x.textContent === 'Takip et')).toBe(false);
  });

  it('the follow, exit and walk buttons meet the 44 px touch token', () => {
    for (const sel of ['.card-follow', '.camera-mode-exit', '.walk-enter']) {
      expect(rule(sel), sel).toMatch(/min-height: var\(--touch\)/);
      expect(rule(sel), sel).toMatch(/min-width: var\(--touch\)/);
    }
  });
});

describe('camera mode bar', () => {
  const make = () => {
    const onWalk = vi.fn();
    const onExit = vi.fn();
    const ui = createCameraModeUi({ onWalk, onExit, touch: false });
    document.body.append(ui.walkButton, ui.bar);
    return { ui, onWalk, onExit };
  };

  it('"İçeride gez" is offered only where walking is possible and starts the walk', () => {
    const { ui, onWalk } = make();
    expect(ui.walkButton.textContent).toBe('İçeride gez');
    expect(ui.walkButton.getAttribute('aria-label')).toContain('İçeride gez');
    ui.setWalkAvailable(false);
    expect(ui.walkButton.hidden).toBe(true);
    ui.setWalkAvailable(true, 'Kat 2');
    expect(ui.walkButton.hidden).toBe(false);
    expect(ui.walkButton.getAttribute('aria-label')).toBe('İçeride gez: Kat 2');
    ui.walkButton.click();
    expect(onWalk).toHaveBeenCalledTimes(1);
  });

  it('follow: the bar names the robot and "Takibi bırak" exits; the walk entry hides', () => {
    const { ui, onExit } = make();
    ui.setWalkAvailable(true, 'Kat 2');
    expect(ui.bar.hidden).toBe(true);
    ui.showFollow('Örnek Rol');
    expect(ui.bar.hidden).toBe(false);
    expect(ui.bar.textContent).toContain('Ajan gözü: Örnek Rol');
    expect(ui.bar.textContent).toContain('Esc');
    expect(ui.walkButton.hidden).toBe(true);
    const exit = ui.bar.querySelector<HTMLButtonElement>('button')!;
    expect(exit.textContent).toBe('Takibi bırak');
    expect(document.activeElement).toBe(exit);
    exit.click();
    expect(onExit).toHaveBeenCalledTimes(1);
    ui.hide();
    expect(ui.bar.hidden).toBe(true);
    expect(document.documentElement.classList.contains('is-follow')).toBe(false);
  });

  it('walk: "Çık" exits, the hint names the keys, the HUD is hidden while walking', () => {
    const { ui, onExit } = make();
    ui.showWalk('Kat 3');
    expect(document.documentElement.classList.contains('is-walk')).toBe(true);
    expect(ui.bar.textContent).toContain('Gezinti: Kat 3');
    expect(ui.bar.textContent).toMatch(/W A S D/);
    const exit = ui.bar.querySelector<HTMLButtonElement>('button')!;
    expect(exit.textContent).toBe('Çık');
    expect(exit.getAttribute('aria-label')).toBe('Gezintiden çık');
    exit.click();
    expect(onExit).toHaveBeenCalledTimes(1);
    ui.hide();
    expect(document.documentElement.classList.contains('is-walk')).toBe(false);
    // The stylesheet hides the HUD clutter in walk mode but never the mode bar.
    expect(css).toMatch(/html\.is-walk \.hud-rail/);
    expect(css).toMatch(/html\.is-walk \.overlay/);
    expect(css).toMatch(/html\.is-walk \.settings/);
    expect(css).not.toMatch(/html\.is-walk \.camera-mode[ ,{]/);
  });

  it('touch screens get the touch hint', () => {
    const ui = createCameraModeUi({ onWalk: () => undefined, onExit: () => undefined, touch: true });
    ui.showWalk('Kat 1');
    expect(ui.bar.textContent).toContain('Zemine dokun: oraya git');
    ui.hide();
  });
});

describe('Esc and keys in a camera mode', () => {
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
      orgEnabled: true,
    });
    const key = (k: string) => h.handle({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target: null });
    return { log, key, state };
  }

  it('follow and walk: Esc leaves the mode; floor and org keys do nothing', () => {
    for (const mode of ['follow', 'walk'] as const) {
      const s = setup(mode);
      s.key('3');
      s.key('o');
      s.key('k');
      s.key('Escape');
      expect(s.log).toEqual(['exitCamera']);
    }
  });

  it('no camera mode: keys work as before', () => {
    const s = setup(null);
    s.key('3');
    s.key('Escape');
    expect(s.log).toEqual(['floor3']);
  });
});

describe('overview floor label click zooms to the floor', () => {
  const rects = [
    { x0: 100, y0: 50, x1: 180, y1: 72 },
    { x0: 100, y0: 80, x1: 180, y1: 102 },
  ];
  it('hits the label under the pointer (with a small touch slop) and nothing else', () => {
    expect(floorLabelAt(rects, [5, 4], 120, 60)).toBe(5);
    expect(floorLabelAt(rects, [5, 4], 179, 101)).toBe(4);
    expect(floorLabelAt(rects, [5, 4], 98, 90)).toBe(4);
    expect(floorLabelAt(rects, [5, 4], 300, 60)).toBeNull();
    expect(floorLabelAt([], [], 120, 60)).toBeNull();
  });

  it('the camera flies smoothly from the overview to the floor; reduced motion cuts', () => {
    const rig = new CameraRig();
    rig.goToFloor(2);
    rig.update(OVERVIEW_DURATION / 2);
    expect(rig.busy).toBe(true);
    rig.update(OVERVIEW_DURATION);
    expect(rig.mode).toBe('floor');
    expect(rig.position.distanceTo(floorPose(2).pos)).toBeLessThan(1e-6);

    const cut = new CameraRig();
    cut.reducedMotion = true;
    cut.goToFloor(4);
    cut.update(1 / 60);
    expect(cut.busy).toBe(false);
    expect(cut.floor).toBe(4);
  });
});
