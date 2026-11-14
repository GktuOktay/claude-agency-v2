// UI improvements (KARARLAR Rev 31 CEO authorization): campus group in the floor panel, wing camera
// poses, `K` cycles the wing levels.
import { describe, it, expect, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import hierarchy from '../src/data/hierarchy.json';
import { createFloorPanel } from '../src/ui/floorPanel';
import { CAMPUS_ITEMS, campusItem, nextCampus } from '../src/ui/campusNav';
import { createKeyHandler, type KeyState } from '../src/ui/keymap';
import { CAMERA_FOV, CameraRig, clearFrameInsets, floorPose, setFrameAspect, setFrameInsets, wingPlanPoints, wingPose } from '../src/scene/camera';
import { ROOF_GARDEN_FLOOR, WING, WING_LEVELS } from '../src/sim/layout';

const DT = 1 / 60;
const idle = (rig: CameraRig): void => {
  for (let i = 0; i < 600 && rig.busy; i++) rig.update(DT);
};

describe('campus group in the floor panel', () => {
  const make = () => {
    const onFloor = vi.fn();
    const onCampus = vi.fn();
    const p = createFloorPanel(hierarchy.floors, onFloor, { items: CAMPUS_ITEMS, onSelect: onCampus });
    return { p, onFloor, onCampus };
  };

  it('has a "Kule" and a "Kampüs" group; the campus group lists the four areas in order', () => {
    const { p } = make();
    const groups = [...p.element.querySelectorAll<HTMLElement>('[role="group"]')];
    expect(groups).toHaveLength(2);
    const name = (g: HTMLElement): string => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent ?? g.querySelector('.panel-group-label')?.textContent ?? '';
    document.body.replaceChildren(p.element);
    expect(groups.map(name)).toEqual(['Kule', 'Kampüs']);
    const campus = [...groups[1]!.querySelectorAll('button')];
    expect(campus.map((b) => b.getAttribute('data-floor'))).toEqual(['wing-0', 'wing-1', 'wing-2', 'roof']);
    expect(campus[0]?.textContent).toContain('Yemekhane & Snack bar');
    expect(campus[1]?.textContent).toContain('Spor & Oyun');
    expect(campus[2]?.textContent).toContain('Uyku · Ar-Ge · Arşiv');
    expect(campus[3]?.textContent).toContain('Çatı bahçesi');
    // tower group keeps its 7 buttons and order
    expect([...groups[0]!.querySelectorAll('button')].map((b) => b.getAttribute('data-floor'))).toEqual(['5', '4', '3', '2', '1', '0', 'all']);
  });

  it('a campus button calls the campus handler, not the floor handler', () => {
    const { p, onFloor, onCampus } = make();
    p.element.querySelector<HTMLButtonElement>('[data-floor="wing-2"]')!.click();
    expect(onCampus).toHaveBeenCalledWith('wing-2');
    expect(onFloor).not.toHaveBeenCalled();
  });

  it('marks the current campus area with aria-current and the text marker; only one is current', () => {
    const { p } = make();
    p.setCurrent(2);
    p.setCurrent('roof');
    const cur = [...p.element.querySelectorAll('[aria-current="true"]')];
    expect(cur).toHaveLength(1);
    expect(cur[0]?.getAttribute('data-floor')).toBe('roof');
    expect(cur[0]?.textContent).toContain('●');
    expect(p.element.querySelector('[data-floor="2"]')?.textContent).not.toContain('●');
  });

  it('campus buttons keep a short visible label for the phone strip and the full name in their text', () => {
    const { p } = make();
    const b = p.element.querySelector('[data-floor="wing-1"]')!;
    expect(b.querySelector('.num')?.textContent).toBe('Spor');
    expect(b.querySelector('.name')?.textContent).toContain('Spor & Oyun');
  });
});

describe('campus items', () => {
  it('map to wing levels 0-2 and the roof garden, ghosting with the tower floor of the same index', () => {
    expect(CAMPUS_ITEMS.map((c) => [c.key, c.level, c.focusFloor])).toEqual([
      ['wing-0', 0, 0],
      ['wing-1', 1, 1],
      ['wing-2', 2, 2],
      ['roof', ROOF_GARDEN_FLOOR, ROOF_GARDEN_FLOOR],
    ]);
    expect(WING_LEVELS).toEqual([0, 1, 2]);
    expect(campusItem('wing-1').label).toBe('Spor & Oyun');
  });

  it('K cycles wing-0 → wing-1 → wing-2 → roof → wing-0, starting at wing-0', () => {
    expect(nextCampus(null)).toBe('wing-0');
    expect(nextCampus('wing-0')).toBe('wing-1');
    expect(nextCampus('wing-2')).toBe('roof');
    expect(nextCampus('roof')).toBe('wing-0');
  });
});

describe('wing camera poses', () => {
  const cases = [
    [1280, 800, 0.2, 0],
    [1440, 900, 0.18, 0],
    [375, 667, 0, 0.12],
  ] as const;
  for (const [w, h, left, top] of cases) {
    it(`shows every wing level and the roof fully at ${w}x${h}, clear of the floor panel`, () => {
      setFrameAspect(w / h);
      setFrameInsets(left, top);
      for (const level of [...WING_LEVELS, ROOF_GARDEN_FLOOR]) {
        const pose = wingPose(level);
        const cam = new PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 400);
        cam.position.copy(pose.pos);
        cam.lookAt(pose.target);
        cam.updateMatrixWorld(true);
        for (const p of wingPlanPoints(level)) {
          const v = p.clone().project(cam);
          expect(v.x).toBeGreaterThanOrEqual(-1 + 2 * left - 1e-6);
          expect(v.x).toBeLessThanOrEqual(1);
          expect(v.y).toBeLessThanOrEqual(1 - 2 * top + 1e-6);
          expect(v.y).toBeGreaterThanOrEqual(-1);
          expect(v.z).toBeLessThan(1);
        }
      }
      clearFrameInsets();
      setFrameAspect(16 / 9);
    });
  }

  it('the wing plan covers the whole wing footprint (and the terrace on level 0)', () => {
    const xs = wingPlanPoints(0).map((p) => p.x);
    const zs = wingPlanPoints(0).map((p) => p.z);
    expect(Math.min(...xs)).toBeLessThanOrEqual(WING.x - WING.halfW);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(WING.x + WING.halfW);
    expect(Math.min(...zs)).toBeLessThanOrEqual(-WING.halfD);
    expect(Math.max(...zs)).toBeGreaterThan(WING.halfD);
  });

  it('the wing pose looks at the wing, the cabin reference follows the level', () => {
    const p = wingPose(1);
    expect(p.target.x).toBeLessThan(-8); // west of the tower wall
    expect(p.cabinY).toBeCloseTo(floorPose(1).cabinY);
    expect(new Vector3().subVectors(p.pos, p.target).y).toBeGreaterThan(0);
  });
});

describe('rig: wing views', () => {
  it('goToWing frames the wing and remembers the level; the tower floor of the same index is then a real move', () => {
    const rig = new CameraRig();
    rig.goToWing(1);
    idle(rig);
    expect(rig.mode).toBe('floor');
    expect(rig.floor).toBe(1);
    expect(rig.wing).toBe(1);
    expect(rig.position.distanceTo(wingPose(1).pos)).toBeLessThan(1e-6);
    rig.goToFloor(1);
    expect(rig.busy).toBe(true);
    idle(rig);
    expect(rig.wing).toBeNull();
    expect(rig.position.distanceTo(floorPose(1).pos)).toBeLessThan(1e-6);
  });

  it('requesting the current wing level does not move', () => {
    const rig = new CameraRig();
    rig.goToWing(2);
    idle(rig);
    rig.goToWing(2);
    expect(rig.busy).toBe(false);
  });

  it('leaving org restores a wing view exactly', () => {
    const rig = new CameraRig();
    rig.goToWing(0);
    idle(rig);
    rig.goOrg();
    idle(rig);
    expect(rig.wing).toBeNull();
    rig.exitOrg();
    idle(rig);
    expect(rig.wing).toBe(0);
    expect(rig.position.distanceTo(wingPose(0).pos)).toBeLessThan(1e-6);
  });

  it('returnToFloor after a wing view returns to the wing pose', () => {
    const rig = new CameraRig();
    rig.goToWing(2);
    idle(rig);
    rig.zoomTo(floorPose(2));
    idle(rig);
    rig.returnToFloor();
    idle(rig);
    expect(rig.position.distanceTo(wingPose(2).pos)).toBeLessThan(1e-6);
  });
});

describe('K shortcut', () => {
  function setup(initial: Partial<KeyState> = {}) {
    const state: KeyState = { busy: false, cardOpen: false, mode: 'floor', ...initial };
    const log: string[] = [];
    const h = createKeyHandler({
      getState: () => state,
      goFloor: (n) => log.push(`floor${n}`),
      toggleOrg: () => log.push('org'),
      exitOrg: () => log.push('exitOrg'),
      closeCard: () => log.push('closeCard'),
      cycleCampus: () => log.push('campus'),
      orgEnabled: true,
    });
    const key = (k: string, init: Partial<KeyboardEventInit> = {}) => h.handle({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target: null, ...init });
    return { state, log, h, key };
  }

  it('k and K cycle the campus; a card closes first, org is left first', () => {
    const s = setup();
    s.key('k');
    s.key('K');
    expect(s.log).toEqual(['campus', 'campus']);
    const c = setup({ cardOpen: true });
    c.key('k');
    expect(c.log).toEqual(['closeCard', 'campus']);
    const o = setup({ mode: 'org' });
    o.key('k');
    expect(o.log).toEqual(['exitOrg', 'campus']);
  });

  it('is queued during a ride, ignored with modifiers or when shortcuts are off', () => {
    const s = setup({ busy: true });
    s.key('k');
    expect(s.log).toEqual([]);
    s.state.busy = false;
    s.h.onIdle();
    expect(s.log).toEqual(['campus']);
    s.key('k', { ctrlKey: true });
    s.h.setEnabled(false);
    s.key('k');
    expect(s.log).toEqual(['campus']);
  });

  it('digits 0-5 still go to the tower floors', () => {
    const s = setup();
    s.key('0');
    s.key('5');
    expect(s.log).toEqual(['floor0', 'floor5']);
  });
});
