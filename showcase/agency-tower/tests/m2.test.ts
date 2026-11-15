import { describe, it, expect } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3, type Material } from 'three';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { buildTower, type TowerModel } from '../src/scene/model';
import { CAMERA_FOV, CameraRig, OVERVIEW_DURATION, floorPose, orgPose, robotPose, setFrameAspect } from '../src/scene/camera';
import { createActivitySim } from '../src/scene/activity';
import { CYCLE_SECONDS, createDayNight, isNightPhase, lightingFor, skyBrightness } from '../src/scene/daynight';
import { buildOrgLines, orgLines } from '../src/scene/org';
import { bubbleVisible } from '../src/scene/labels';
import { bindReducedMotion, type MediaQueryLike } from '../src/app/motion';
import { createDayNightControl } from '../src/ui/dayNightControl';
import { createOrgLegend } from '../src/ui/orgLegend';
import { Screen } from '../src/scene/screen';

function data() {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}
const model = (): TowerModel => buildTower(data());
const DT = 1 / 60;

function snapshot(m: TowerModel): number[] {
  const out: number[] = [];
  for (const f of m.floors) {
    for (const k of ['walls', 'slab', 'contents', 'robots', 'tinted'] as const) for (const mat of f.materials[k]) out.push(mat.opacity, mat.visible ? 1 : 0);
    for (const c of f.group.children) out.push(c.visible ? 1 : 0);
  }
  for (const r of m.robots) out.push(r.group.visible ? 1 : 0);
  return out;
}

describe('org mode (AC-14)', () => {
  it('one line per unit with a reports-to; solid except the independent unit, which is dashed', () => {
    const d = data();
    const lines = orgLines(d.units);
    expect(lines).toHaveLength(d.units.filter((u) => u.reportsTo).length);
    const dashed = lines.filter((l) => l.dashed);
    expect(dashed.map((l) => l.from)).toEqual(d.units.filter((u) => u.independent && u.reportsTo).map((u) => u.id));
    expect(dashed.map((l) => l.from)).toContain('internal-auditor');
  });

  it('builds static line meshes between the robots it is given, tagged solid or dashed', () => {
    const m = model();
    const pos = new Map(m.robots.map((r) => [r.unit.id, r.group.position.clone()]));
    const g = buildOrgLines(orgLines(m.robots.map((r) => r.unit)), pos, () => 0x6a9cf0);
    const meshes: Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    const solid = new Set(meshes.filter((x) => x.userData.dashed === false).map((x) => String(x.userData.from)));
    const dashed = new Set(meshes.filter((x) => x.userData.dashed === true).map((x) => String(x.userData.from)));
    expect(solid.size + dashed.size).toBe(orgLines(m.robots.map((r) => r.unit)).length);
    expect([...dashed]).toEqual(['internal-auditor']);
    expect(meshes.filter((x) => x.userData.from === 'internal-auditor').length).toBeGreaterThan(3); // dashes
  });

  it('on: shell at most 12 %, robots opaque, every floor visible; off restores the exact previous state', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 3 });
    const before = snapshot(m);
    m.setOrg(true);
    expect(m.isOrg()).toBe(true);
    for (const f of m.floors) {
      for (const mat of [...f.materials.walls, ...f.materials.slab, ...f.materials.contents]) expect(mat.opacity).toBeLessThanOrEqual(0.12);
      for (const mat of f.materials.robots) expect(mat.opacity).toBe(1);
    }
    for (const r of m.robots) expect(r.group.visible).toBe(true);
    expect(m.pickableFloors().size).toBe(6);
    m.setOrg(false);
    expect(snapshot(m)).toEqual(before);
    expect(m.view).toEqual({ mode: 'floor', focusFloor: 3 });
  });

  it('the org camera frames every robot at 1440x900 and 375x667', () => {
    const m = model();
    for (const [w, h] of [[1440, 900], [375, 667]] as const) {
      setFrameAspect(w / h);
      const o = orgPose();
      const cam = new PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 400);
      cam.position.copy(o.pos);
      cam.lookAt(o.target);
      cam.updateMatrixWorld(true);
      for (const r of m.robots) {
        const p = r.group.position.clone().add(new Vector3(0, 0.5, 0)).project(cam);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      }
    }
    setFrameAspect(16 / 9);
  });

  it('the org camera keeps every name pill clear of the toolbar (top) and legend (bottom) at 1146x635 and 375x667', async () => {
    const { setOrgInsets } = await import('../src/scene/camera');
    const { ROBOT_HEIGHT, tierStyle } = await import('../src/scene/robot');
    const m = model();
    for (const [w, h] of [[1146, 635], [1440, 900], [375, 667]] as const) {
      const top = 60 / h;
      const bottom = 90 / h;
      setFrameAspect(w / h);
      setOrgInsets(top, bottom);
      const o = orgPose();
      const cam = new PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 400);
      cam.position.copy(o.pos);
      cam.lookAt(o.target);
      cam.updateMatrixWorld(true);
      for (const r of m.robots) {
        const s = tierStyle(r.unit.tier).scale;
        const feet = r.group.position.clone().project(cam);
        const pill = r.group.position.clone().add(new Vector3(0, ROBOT_HEIGHT * s + 0.06, 0)).project(cam);
        const pillTop = pill.y + (2 * 26) / h; // pill height ~26 px above its anchor
        expect(pillTop).toBeLessThanOrEqual(1 - 2 * top);
        expect(feet.y).toBeGreaterThanOrEqual(-1 + 2 * bottom);
        expect(Math.abs(pill.x)).toBeLessThanOrEqual(0.97);
      }
    }
    setOrgInsets(null);
    setFrameAspect(16 / 9);
  });

  it('rig: entering org takes 1.2 s and parks the cabin at floor 0; leaving restores the previous pose and floor', () => {
    const rig = new CameraRig();
    rig.goToFloor(3);
    while (rig.busy) rig.update(DT);
    rig.position.add(new Vector3(1, 0.5, 0)); // the user orbited
    const pos = rig.position.clone();
    rig.goOrg();
    let t = 0;
    while (rig.busy) {
      rig.update(DT);
      t += DT;
    }
    expect(Math.abs(t - OVERVIEW_DURATION)).toBeLessThanOrEqual(DT * 1.5);
    expect(rig.mode).toBe('org');
    expect(rig.cabinY).toBeCloseTo(floorPose(0).cabinY);
    rig.exitOrg();
    t = 0;
    while (rig.busy) {
      rig.update(DT);
      t += DT;
    }
    expect(Math.abs(t - OVERVIEW_DURATION)).toBeLessThanOrEqual(DT * 1.5);
    expect(rig.mode).toBe('floor');
    expect(rig.floor).toBe(3);
    expect(rig.position.distanceTo(pos)).toBeLessThan(1e-6);
  });

  it('legend names both line styles in text', () => {
    const legend = createOrgLegend();
    expect(legend.textContent).toContain('Düz çizgi');
    expect(legend.textContent).toContain('Kesik çizgi');
  });
});

describe('day / night (AC-15)', () => {
  it('defaults to Otomatik, starts at noon (phase 0.25) and returns there after 90 s', () => {
    const dn = createDayNight();
    expect(dn.mode()).toBe('auto');
    expect(dn.phase()).toBeCloseTo(0.25);
    let t = 0;
    while (t < CYCLE_SECONDS - 1e-9) {
      dn.step(0.1);
      t += 0.1;
    }
    expect(Math.abs(dn.phase() - 0.25) * CYCLE_SECONDS).toBeLessThanOrEqual(1);
  });

  it('brightness follows 0.5 + 0.5 cos(2 pi (phase - 0.25))', () => {
    expect(skyBrightness(0)).toBeCloseTo(0.5);
    expect(skyBrightness(0.25)).toBeCloseTo(1);
    expect(skyBrightness(0.5)).toBeCloseTo(0.5);
    expect(skyBrightness(0.75)).toBeCloseTo(0);
  });

  it('night is true exactly for phase in [0.5, 1)', () => {
    expect(isNightPhase(0.49999)).toBe(false);
    expect(isNightPhase(0.5)).toBe(true);
    expect(isNightPhase(0.99)).toBe(true);
    expect(isNightPhase(0)).toBe(false);
    expect(isNightPhase(0.25)).toBe(false);
  });

  it('Gündüz and Gece hold their state', () => {
    const dn = createDayNight();
    dn.setMode('night');
    for (let i = 0; i < 2000; i++) dn.step(0.1);
    expect(dn.night()).toBe(true);
    dn.setMode('day');
    for (let i = 0; i < 2000; i++) dn.step(0.1);
    expect(dn.night()).toBe(false);
    expect(dn.brightness()).toBe(1);
  });

  it('night lighting: windows and floor lights glow, the sky darkens', () => {
    const day = lightingFor(1, 0);
    const night = lightingFor(0, 1);
    expect(night.windowGlow).toBeGreaterThan(day.windowGlow);
    expect(night.lampGlow).toBeGreaterThan(day.lampGlow);
    expect(night.sun).toBeLessThan(day.sun);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(night.skyTop)).toBeLessThan(lum(day.skyTop) / 3);
  });

  it('the model turns window and floor-light emissive on at night', () => {
    const m = model();
    const glow = (): number => m.nightMaterials().reduce((s, x) => s + (x as Material & { emissiveIntensity: number }).emissiveIntensity, 0);
    m.setNight(0);
    const off = glow();
    m.setNight(1);
    expect(m.nightMaterials().length).toBeGreaterThan(6);
    expect(glow()).toBeGreaterThan(off + 1);
  });

  it('control: three buttons, Otomatik pressed by default, choosing Gece holds night', () => {
    const dn = createDayNight();
    const c = createDayNightControl(dn);
    const buttons = [...c.element.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Gündüz', 'Gece', 'Otomatik']);
    expect(buttons[2]?.getAttribute('aria-pressed')).toBe('true');
    buttons[1]?.click();
    expect(dn.mode()).toBe('night');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('reduced motion (AC-16)', () => {
  function fakeMql(matches: boolean): MediaQueryLike & { set(v: boolean): void } {
    const cbs: ((e: { matches: boolean }) => void)[] = [];
    const q = {
      matches,
      addEventListener: (_: 'change', cb: (e: { matches: boolean }) => void) => void cbs.push(cb),
      set(v: boolean) {
        q.matches = v;
        for (const cb of cbs) cb({ matches: v });
      },
    };
    return q;
  }

  function setup(matches: boolean) {
    const m = model();
    const sim = createActivitySim(m.robots.map((r) => ({ id: r.unit.id, home: r.homePoint, work: r.workPoint, coffee: r.coffeePoint })), 7);
    const rig = new CameraRig();
    const dn = createDayNight();
    const control = createDayNightControl(dn);
    const screens = m.robots.map((r) => r.screen);
    const mql = fakeMql(matches);
    const motion = bindReducedMotion(mql, { rig, sim, dayNight: dn, screens, onChange: () => control.refresh() });
    return { m, sim, rig, dn, control, screens, mql, motion };
  }

  it('on load: elevator ride and click-zoom complete in one frame', () => {
    const s = setup(true);
    s.rig.goToFloor(4, [{ pose: robotPose(new Vector3(0, 12.14, -2)), duration: 0.6 }]);
    s.rig.update(DT);
    expect(s.rig.busy).toBe(false);
    expect(s.rig.mode).toBe('floor');
    expect(s.rig.floor).toBe(4);
  });

  it('no robot walks or waves (a raised-arm pose instead); screens do not scroll', () => {
    const s = setup(true);
    s.sim.select('scout');
    for (let i = 0; i < 600; i++) {
      s.sim.step(100);
      for (const r of s.m.robots) {
        const k = s.sim.get(r.unit.id).kind;
        expect(k).not.toBe('walk');
        expect(k).not.toBe('wave');
      }
    }
    expect(s.sim.get('scout').kind).toBe('raise');
    const screen: Screen = s.screens[0]!;
    screen.scrolling = true;
    screen.update(5);
    expect(screen.offset).toBe(0);
  });

  it('day/night holds Gündüz, Otomatik is disabled, the manual choice still works', () => {
    const s = setup(true);
    expect(s.dn.mode()).toBe('day');
    const [day, night, auto] = [...s.control.element.querySelectorAll('button')];
    expect(auto?.disabled).toBe(true);
    auto?.click();
    expect(s.dn.mode()).toBe('day');
    night?.click();
    expect(s.dn.mode()).toBe('night');
    day?.click();
    expect(s.dn.mode()).toBe('day');
  });

  it('a live change of the query takes effect without reload', () => {
    const s = setup(false);
    expect(s.dn.mode()).toBe('auto');
    s.mql.set(true);
    expect(s.motion.active()).toBe(true);
    expect(s.dn.mode()).toBe('day');
    s.rig.goToFloor(2);
    s.rig.update(DT);
    expect(s.rig.busy).toBe(false);
    s.mql.set(false);
    const auto = [...s.control.element.querySelectorAll('button')][2];
    expect(auto?.disabled).toBe(false);
    s.rig.goToFloor(4);
    s.rig.update(DT);
    expect(s.rig.busy).toBe(true);
  });
});

describe('speech bubbles (AC-18)', () => {
  it('show in overview for any robot and in floor view for the focused floor only', () => {
    expect(bubbleVisible(3, { mode: 'overview', focusFloor: 0 })).toBe(true);
    expect(bubbleVisible(3, { mode: 'floor', focusFloor: 3 })).toBe(true);
    expect(bubbleVisible(2, { mode: 'floor', focusFloor: 3 })).toBe(false);
  });
});

describe('mobile framing and layout (AC-16, REQ-19)', () => {
  it('with a floor strip on top of a 375x667 screen the whole floor plan sits below the strip', async () => {
    const { setFrameInsets, clearFrameInsets, floorPlanPoints } = await import('../src/scene/camera');
    setFrameAspect(375 / 667);
    setFrameInsets(0, 0.12);
    const f = floorPose(2);
    const cam = new PerspectiveCamera(CAMERA_FOV, 375 / 667, 0.1, 400);
    cam.position.copy(f.pos);
    cam.lookAt(f.target);
    cam.updateMatrixWorld(true);
    for (const p of floorPlanPoints(2)) {
      const v = p.clone().project(cam);
      expect(v.y).toBeLessThanOrEqual(1 - 2 * 0.12 + 1e-6);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
    }
    clearFrameInsets();
    setFrameAspect(16 / 9);
  });

  it('a desktop side panel shifts the plan right of the panel edge', async () => {
    const { setFrameInsets, clearFrameInsets, floorPlanPoints } = await import('../src/scene/camera');
    setFrameAspect(1280 / 800);
    setFrameInsets(0.16, 0);
    const f = floorPose(1);
    const cam = new PerspectiveCamera(CAMERA_FOV, 1280 / 800, 0.1, 400);
    cam.position.copy(f.pos);
    cam.lookAt(f.target);
    cam.updateMatrixWorld(true);
    const xs = floorPlanPoints(1).map((p) => p.clone().project(cam).x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1 + 2 * 0.16 - 1e-6);
    clearFrameInsets();
    setFrameAspect(16 / 9);
  });

  it('touch: one finger orbits, two fingers zoom, pan stays off', async () => {
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    const { configureOrbit } = await import('../src/scene/camera');
    const { TOUCH } = await import('three');
    const c = new OrbitControls(new PerspectiveCamera(), document.createElement('canvas'));
    configureOrbit(c);
    expect(c.touches.ONE).toBe(TOUCH.ROTATE);
    expect(c.touches.TWO).toBe(TOUCH.DOLLY_PAN);
    expect(c.enablePan).toBe(false);
    c.dispose();
  });

  it('floor strip buttons keep the floor name in their accessible text', async () => {
    const { createFloorPanel } = await import('../src/ui/floorPanel');
    const p = createFloorPanel(data().floors, () => undefined);
    const b = p.element.querySelector('[data-floor="1"]');
    expect(b?.querySelector('.num')?.textContent).toBe('1');
    expect(b?.textContent).toContain('Mühendislik');
  });
});
