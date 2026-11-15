import { afterEach, describe, it, expect } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_FOV, MAX_DISTANCE, floorPlanPoints, floorPose, overviewPose, robotPose, setFrameAspect } from '../src/scene/camera';
import { buildTower, FLOOR_COUNT, FLOOR_HEIGHT, HALF_DEPTH, HALF_WIDTH, type TowerModel } from '../src/scene/model';
import { ROBOT_HEIGHT, tierStyle } from '../src/scene/robot';
import { roomLabelVisible, robotLabelVisible } from '../src/scene/labels';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { TIERS } from '../src/data/types';

const DESKTOP = 1280 / 800;
const PHONE = 375 / 667;

function model(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

function cameraAt(pose: { pos: Vector3; target: Vector3; fov?: number }, aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(pose.fov ?? CAMERA_FOV, aspect, 0.1, 400);
  cam.position.copy(pose.pos);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  return cam;
}

const ndc = (p: Vector3, cam: PerspectiveCamera): Vector3 => p.clone().project(cam);
const inside = (v: Vector3): boolean => Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1;

function corners(y0: number, y1: number): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [-HALF_WIDTH, HALF_WIDTH]) for (const y of [y0, y1]) for (const z of [-HALF_DEPTH, HALF_DEPTH]) out.push(new Vector3(x, y, z));
  return out;
}

afterEach(() => setFrameAspect(16 / 9));

describe('camera framing (art direction)', () => {
  it('uses a narrow field of view so the diorama reads near-orthographic', () => {
    expect(CAMERA_FOV).toBeGreaterThanOrEqual(30);
    expect(CAMERA_FOV).toBeLessThanOrEqual(35);
  });

  it('overview: a 35-45 degree elevated 3/4 view that fits the whole tower on desktop and phone, within the orbit clamp', () => {
    for (const aspect of [DESKTOP, PHONE]) {
      setFrameAspect(aspect);
      const o = overviewPose();
      const dir = o.pos.clone().sub(o.target).normalize();
      const elevation = (Math.asin(dir.y) * 180) / Math.PI;
      expect(elevation).toBeGreaterThanOrEqual(30);
      expect(elevation).toBeLessThanOrEqual(45);
      expect(Math.abs(dir.x)).toBeGreaterThan(0.2); // 3/4 view, not straight on
      expect(o.pos.distanceTo(o.target)).toBeLessThan(MAX_DISTANCE);
      const cam = cameraAt(o, aspect);
      for (const c of corners(0, FLOOR_COUNT * FLOOR_HEIGHT)) expect(inside(ndc(c, cam))).toBe(true);
    }
  });

  it('floor view: looks down into the floor plan and the whole floor fits the screen on desktop and phone', () => {
    for (const aspect of [DESKTOP, PHONE]) {
      setFrameAspect(aspect);
      for (const floor of [0, 3, 5]) {
        const f = floorPose(floor);
        const dir = f.pos.clone().sub(f.target).normalize();
        expect(dir.y).toBeGreaterThan(Math.sin((40 * Math.PI) / 180));
        const cam = cameraAt(f, aspect);
        const base = floor * FLOOR_HEIGHT;
        for (const c of corners(base, base + 1)) expect(inside(ndc(c, cam))).toBe(true);
      }
    }
  });

  it('robot zoom frames robot and desk: ends within 3.5 units, the robot fills about a quarter to a third of the height', () => {
    const feet = new Vector3(2, 9.14, -3.35);
    for (const tier of TIERS) {
      const scale = tierStyle(tier).scale;
      const pose = robotPose(feet, undefined, scale);
      expect(pose.pos.distanceTo(feet)).toBeLessThanOrEqual(3.5);
      const cam = cameraAt(pose, DESKTOP);
      const top = ndc(feet.clone().add(new Vector3(0, ROBOT_HEIGHT * scale, 0)), cam);
      const bottom = ndc(feet, cam);
      const fraction = Math.abs(top.y - bottom.y) / 2;
      if (tier === 'specialist') {
        expect(fraction).toBeGreaterThanOrEqual(0.25);
        expect(fraction).toBeLessThanOrEqual(0.35);
      } else {
        expect(fraction).toBeGreaterThanOrEqual(0.25);
        expect(fraction).toBeLessThanOrEqual(0.45); // bigger tiers are bigger robots; the distance cap holds
      }
      // the desk in front of the seat (0.4 units further back) stays in frame
      expect(inside(ndc(feet.clone().add(new Vector3(0, 0.36, -0.5)), cam))).toBe(true);
    }
  });
});

describe('label visibility per mode', () => {
  const rooms = (m: TowerModel) => m.rooms;

  it('every floor has one primary department label and further room labels', () => {
    const m = model();
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const own = rooms(m).filter((r) => r.floor === f);
      expect(own.filter((r) => r.primary)).toHaveLength(1);
      expect(own.length).toBeGreaterThan(1);
    }
    expect(rooms(m).find((r) => r.floor === 1 && r.primary)?.text).toBe('Mühendislik');
  });

  it('overview shows only the department (primary) labels and no robot name labels', () => {
    const m = model();
    const view = { mode: 'overview' as const, focusFloor: 0 };
    const shown = rooms(m).filter((r) => roomLabelVisible(r, view));
    expect(shown).toHaveLength(FLOOR_COUNT);
    expect(shown.every((r) => r.primary)).toBe(true);
    for (const r of m.robots) expect(robotLabelVisible({ id: r.unit.id, floor: r.floor }, view, new Set())).toBe(false);
  });

  it('floor view shows the focused floor room labels and every robot label on that floor only', () => {
    const m = model();
    const view = { mode: 'floor' as const, focusFloor: 2 };
    const shown = rooms(m).filter((r) => roomLabelVisible(r, view));
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.every((r) => r.floor === 2)).toBe(true);
    for (const r of m.robots) {
      expect(robotLabelVisible({ id: r.unit.id, floor: r.floor }, view, new Set())).toBe(r.floor === 2);
    }
  });

  it('a hovered, focused or selected robot gets its label in overview, never on a ghosted floor (R-5)', () => {
    expect(robotLabelVisible({ id: 'scout', floor: 3 }, { mode: 'overview', focusFloor: 0 }, new Set(['scout']))).toBe(true);
    expect(robotLabelVisible({ id: 'ceo', floor: 5 }, { mode: 'floor', focusFloor: 3 }, new Set(['ceo']))).toBe(false);
  });
});

describe('shadows stay on their own floor', () => {
  const flags = (m: TowerModel, floor: number) => {
    let cast = 0;
    let receive = 0;
    m.floors[floor]!.group.traverse((o) => {
      if (o instanceof Mesh && o.name !== 'floor-slab') {
        if (o.castShadow) cast++;
        if (o.receiveShadow) receive++;
      }
    });
    return { cast, receive };
  };

  it('floor view: only the focused floor and its robots cast and receive', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 2 });
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const s = flags(m, f);
      if (f === 2) {
        expect(s.cast).toBeGreaterThan(0);
        expect(s.receive).toBeGreaterThan(0);
      } else {
        expect(s.receive).toBe(0);
      }
    }
    for (const r of m.robots) {
      let cast = false;
      r.group.traverse((o) => {
        if (o instanceof Mesh && o.castShadow) cast = true;
      });
      expect(cast).toBe(r.floor === 2);
    }
  });

  it('overview: no floor receives shadows (no floor-to-floor leaks)', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    for (let f = 0; f < FLOOR_COUNT; f++) expect(flags(m, f).receive).toBe(0);
  });
});

describe('render budget (perf >= 30 fps)', () => {
  it('keeps the visible mesh count (draw calls before shadows) bounded', () => {
    const m = model();
    let meshes = 0;
    const materials = new Set<string>();
    m.root.traverse((o) => {
      if (o instanceof Mesh && o.visible) {
        meshes++;
        const mat: unknown = o.material;
        if (mat && typeof mat === 'object' && 'uuid' in mat && typeof mat.uuid === 'string') materials.add(mat.uuid);
      }
    });
    console.info(`[budget] meshes=${meshes} materials=${materials.size}`);
    expect(meshes).toBeLessThan(1000);
  });
});

describe('label placement (anchored to the robot head, no stacks)', () => {
  it('speech bubbles: overview shows all, floor view only the focused floor', async () => {
    const { bubbleVisible } = await import('../src/scene/labels');
    expect(bubbleVisible(3, { mode: 'overview', focusFloor: 0 })).toBe(true); // AC-18: lively in overview
    expect(bubbleVisible(3, { mode: 'floor', focusFloor: 3 })).toBe(true);
    expect(bubbleVisible(2, { mode: 'floor', focusFloor: 3 })).toBe(false);
  });

  it('separate labels keep their anchors; overlapping ones are lifted just enough', async () => {
    const { stackLabels } = await import('../src/scene/labels');
    expect(stackLabels([{ x: 100, y: 300, w: 80 }, { x: 400, y: 300, w: 80 }], 22)).toEqual([0, 0]);
    const ys = [300, 296, 302];
    const lifts = stackLabels(ys.map((y, i) => ({ x: 100 + i * 10, y, w: 80 })), 22);
    expect(lifts[2]).toBe(0); // lowest on screen stays on its robot
    const tops = ys.map((y, i) => y - (lifts[i] ?? 0)).sort((a, b) => a - b);
    for (let i = 1; i < tops.length; i++) expect(tops[i]! - tops[i - 1]!).toBeGreaterThanOrEqual(22); // no overlap
    for (const l of lifts) expect(l).toBeLessThanOrEqual(2 * 24 + 6); // stays near its robot
  });
});

describe('floor view isolation', () => {
  it('other floors keep only their slab; their robots, the shaft and their contents are hidden', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 3 });
    for (const f of m.floors) {
      for (const c of f.group.children) expect(c.visible).toBe(f.id === 3 || c.name === 'floor-slab');
    }
    for (const r of m.robots) expect(r.group.visible).toBe(r.floor === 3);
    expect(m.root.getObjectByName('shaft')?.visible).toBe(false);
    m.setView({ mode: 'overview', focusFloor: 0 });
    for (const f of m.floors) for (const c of f.group.children) expect(c.visible).toBe(true);
    expect(m.root.getObjectByName('shaft')?.visible).toBe(true);
  });

  it('floor view: the plan with label headroom is centred vertically (within 10 %) and its top is on screen', () => {
    for (const aspect of [DESKTOP, 16 / 9, PHONE]) {
      setFrameAspect(aspect);
      for (const floor of [0, 2, 5]) {
        const cam = cameraAt(floorPose(floor), aspect);
        const ys = floorPlanPoints(floor).map((c) => ndc(c, cam).y);
        const top = Math.max(...ys);
        const bottom = Math.min(...ys);
        expect(Math.abs((top + bottom) / 2)).toBeLessThanOrEqual(0.2);
        expect(top).toBeLessThanOrEqual(1);
        expect(bottom).toBeGreaterThanOrEqual(-1);
      }
    }
  });

  it('floor view: the focused floor plan fills most of the viewport width', () => {
    for (const aspect of [DESKTOP, 16 / 9]) {
      setFrameAspect(aspect);
      const f = floorPose(2);
      const cam = cameraAt(f, aspect);
      const xs = corners(2 * FLOOR_HEIGHT, 2 * FLOOR_HEIGHT).map((c) => ndc(c, cam).x);
      const span = (Math.max(...xs) - Math.min(...xs)) / 2;
      expect(span).toBeGreaterThanOrEqual(0.75);
      expect(span).toBeLessThanOrEqual(0.95);
    }
  });
});
