import { describe, it, expect } from 'vitest';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Ray, Texture, Vector3, type Material, type Object3D } from 'three';
import { buildTower, FLOOR_COUNT, FLOOR_HEIGHT, FLOOR_TOP, HALF_WIDTH, SHAFT_X, SHAFT_Z, type TowerModel } from '../src/scene/model';
import { CAMERA_FOV, floorPose, orgPose, overviewPose, setFrameAspect } from '../src/scene/camera';
import { MEETING_ROOM, STAFF_SHAFT } from '../src/sim/layout';
import { tr } from '../src/i18n/tr';
import { tierStyle } from '../src/scene/robot';
import { pickRobot } from '../src/scene/picking';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { TIERS } from '../src/data/types';

function model(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

function names(root: Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => out.push(o.name));
  return out;
}

function opacities(mats: readonly Material[]): number[] {
  return mats.map((m) => m.opacity);
}

describe('scene model (AC-6)', () => {
  it('has 6 floors and one robot per data unit, each on its overlay floor', () => {
    const m = model();
    expect(m.floors).toHaveLength(6);
    expect(m.robots).toHaveLength(20);
    for (const r of m.robots) {
      expect(r.floor).toBe(r.unit.floor);
      const y = r.group.position.y;
      expect(y).toBeGreaterThanOrEqual(r.floor * FLOOR_HEIGHT);
      expect(y).toBeLessThan((r.floor + 1) * FLOOR_HEIGHT);
    }
  });

  it('robot count follows the data, not a constant', () => {
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const fewer = { floors: r.data.floors, units: r.data.units.filter((u) => u.id !== 'scout') };
    expect(buildTower(fewer).robots).toHaveLength(19);
  });

  it('each floor has desks, a coffee station and a named floor-specific prop', () => {
    const m = model();
    const props = new Set<string>();
    for (const f of m.floors) {
      const n = names(f.group);
      expect(n.filter((x) => x === 'desk').length).toBeGreaterThanOrEqual(1);
      expect(n).toContain('coffee-station');
      const prop = n.find((x) => x.startsWith('floor-prop:'));
      expect(prop).toBeDefined();
      props.add(prop ?? '');
    }
    expect(props.size).toBe(6);
  });

  it('floor 5 has glass walls, a skyline, a signing desk and the ceo robot', () => {
    const m = model();
    const n = names(m.floors[5]!.group);
    expect(n).toContain('glass-wall');
    expect(n).toContain('skyline');
    expect(n).toContain('signing-desk');
    expect(m.robots.find((r) => r.floor === 5)?.unit.tier).toBe('ceo');
  });

  it('every robot owns a distinct desk', () => {
    const m = model();
    const keys = m.robots.map((r) => `${r.floor}:${r.workPoint.x.toFixed(2)},${r.workPoint.z.toFixed(2)}`);
    expect(new Set(keys).size).toBe(m.robots.length);
  });

  it('overview: exterior walls 0.25, all contents 1.0', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    for (const f of m.floors) {
      expect(new Set(opacities(f.materials.walls))).toEqual(new Set([0.25]));
      expect(new Set(opacities([...f.materials.slab, ...f.materials.contents, ...f.materials.robots]))).toEqual(new Set([1]));
    }
  });

  it('floor view: floors above the focus <= 0.10, focused floor walls see-through, floors below unchanged', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 3 });
    for (const id of [4, 5]) {
      const f = m.floors[id]!;
      const all = [...f.materials.walls, ...f.materials.slab, ...f.materials.contents, ...f.materials.robots];
      expect(Math.max(...opacities(all))).toBeLessThanOrEqual(0.1);
    }
    expect(Math.max(...opacities(m.floors[3]!.materials.walls))).toBeLessThanOrEqual(0.05);
    expect(new Set(opacities(m.floors[3]!.materials.robots))).toEqual(new Set([1]));
    expect(new Set(opacities(m.floors[2]!.materials.walls))).toEqual(new Set([0.25]));
    m.setView({ mode: 'overview', focusFloor: 0 });
    expect(new Set(opacities(m.floors[4]!.materials.contents))).toEqual(new Set([1]));
  });

  it('wall and slab meshes are not pickable robots (userData carries no unit id)', () => {
    const m = model();
    m.root.traverse((o) => {
      if (o instanceof Mesh && o.name === 'exterior-wall') expect(o.userData.unitId).toBeUndefined();
    });
  });
});

describe('picking (AC-6)', () => {
  function rayToward(target: Vector3, from: Vector3): Ray {
    return new Ray(from.clone(), target.clone().sub(from).normalize());
  }

  it('finds a robot in overview, through the semi-transparent shell', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    m.root.updateMatrixWorld(true);
    const robot = m.robots.find((r) => r.unit.id === 'qa-engineer')!;
    const target = robot.group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.8, 0));
    const hit = pickRobot(m, rayToward(target, target.clone().add(new Vector3(0, 0, 40))));
    expect(hit?.unit.id).toBe('qa-engineer');
  });

  it('a ray that only crosses the shell finds nothing', () => {
    const m = model();
    m.setView({ mode: 'overview', focusFloor: 0 });
    m.root.updateMatrixWorld(true);
    expect(pickRobot(m, new Ray(new Vector3(0, 40, 40), new Vector3(0, 0, -1)))).toBeNull();
    expect(pickRobot(m, new Ray(new Vector3(200, 2, 0), new Vector3(1, 0, 0)))).toBeNull();
  });

  it('floor view: finds robots on the focused floor only, not on ghosted floors', () => {
    const m = model();
    m.setView({ mode: 'floor', focusFloor: 3 });
    m.root.updateMatrixWorld(true);
    const hitAt = (id: string) => {
      const r = m.robots.find((x) => x.unit.id === id)!;
      const t = r.group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.8, 0));
      return pickRobot(m, rayToward(t, t.clone().add(new Vector3(0, 0, 40))));
    };
    expect(hitAt('scout')?.unit.id).toBe('scout');
    expect(hitAt('chief-of-staff')).toBeNull();
    expect(hitAt('ceo')).toBeNull();
    expect(hitAt('qa-engineer')).toBeNull();
  });
});

describe('robot descriptors (AC-9)', () => {
  it('scale 1.35 / 1.2 / 1.1 / 1.0 and unique markers per tier', () => {
    expect(TIERS.map((t) => tierStyle(t).scale)).toEqual([1.35, 1.2, 1.1, 1.0]);
    expect(TIERS.map((t) => tierStyle(t).marker)).toEqual(['crown', 'badge', 'stripe', 'none']);
    expect(new Set(TIERS.map((t) => tierStyle(t).marker)).size).toBe(4);
    expect(tierStyle('ceo').color).toBe(tierStyle('management').color);
  });

  it('robot meshes carry their tier scale and marker', () => {
    const m = model();
    for (const r of m.robots) {
      const style = tierStyle(r.unit.tier);
      expect(r.group.scale.x).toBeCloseTo(style.scale);
      expect(names(r.group).includes(`marker:${style.marker}`)).toBe(style.marker !== 'none');
    }
  });
});

// ---------------------------------------------------------------- spec 0002

describe('floor-3 meeting room (0002 AC-14, scene model)', () => {
  it('floor 3 has a meeting-room group with a table, 6 seat nodes and a whiteboard; no other floor has one', () => {
    const m = model();
    for (const f of m.floors) {
      const room = f.group.getObjectByName('meeting-room');
      if (f.id !== MEETING_ROOM.floor) {
        expect(room).toBeUndefined();
        continue;
      }
      expect(room).toBeDefined();
      const n = names(room!);
      expect(n).toContain('table');
      expect(n.filter((x) => x === 'seat')).toHaveLength(6);
      expect(n).toContain('whiteboard');
      expect(n).toContain('whiteboard-surface');
    }
    expect(m.meetingRoom.seats).toHaveLength(6);
  });

  it('seat nodes and the table sit at the layout constants', () => {
    const m = model();
    m.root.updateMatrixWorld(true);
    const base = MEETING_ROOM.floor * FLOOR_HEIGHT + FLOOR_TOP;
    m.meetingRoom.seats.forEach((s, i) => {
      const p = s.getWorldPosition(new Vector3());
      const want = MEETING_ROOM.seats[i]!;
      expect(p.x).toBeCloseTo(want.x);
      expect(p.z).toBeCloseTo(want.z);
      expect(p.y).toBeCloseTo(base);
      expect(s.userData.index).toBe(i);
    });
    const table = m.floors[3]!.group.getObjectByName('table')!.getWorldPosition(new Vector3());
    expect(table.x).toBeCloseTo(MEETING_ROOM.table.x);
    expect(table.z).toBeCloseTo(MEETING_ROOM.table.z);
  });

  it('the whiteboard surface faces the floor-3 view camera within 60 degrees and takes a texture', () => {
    const m = model();
    m.root.updateMatrixWorld(true);
    const surface = m.meetingRoom.whiteboardSurface;
    const normal = new Vector3(0, 0, 1).transformDirection(surface.matrixWorld);
    const cam = floorPose(MEETING_ROOM.floor).pos;
    const toCam = cam.clone().sub(surface.getWorldPosition(new Vector3())).normalize();
    expect((Math.acos(normal.dot(toCam)) * 180) / Math.PI).toBeLessThanOrEqual(60);
    expect(m.floors[3]!.materials.contents).toContain(surface.material);
    const t = new Texture();
    m.meetingRoom.setWhiteboardTexture(t);
    const mat: unknown = surface.material;
    expect(mat instanceof MeshBasicMaterial && mat.map === t).toBe(true);
  });

  it('the meeting room has a room label', () => {
    const m = model();
    expect(m.rooms.some((r) => r.floor === 3 && r.text === tr.rooms['meeting-table'] && !r.primary)).toBe(true);
  });
});

describe('east staff elevator (0002 REQ-14, Q-2 geometry)', () => {
  it('a separate staff shaft and cabin stand east of the building; the visitor shaft and cabin are unchanged', () => {
    const m = model();
    const staff = m.root.getObjectByName('staff-cabin')!;
    expect(staff).toBe(m.staffCabin.group);
    expect(staff).not.toBe(m.cabin.group);
    expect(m.root.getObjectByName('staff-shaft')).toBeDefined();
    expect(staff.position.x).toBeCloseTo(STAFF_SHAFT.x);
    expect(staff.position.z).toBeCloseTo(STAFF_SHAFT.z);
    expect(staff.position.x - STAFF_SHAFT.cabinHalf).toBeGreaterThan(HALF_WIDTH);
    expect(m.cabin.group.position.x).toBeCloseTo(SHAFT_X);
    expect(m.cabin.group.position.z).toBeCloseTo(SHAFT_Z);
  });

  it('staff cabin: height and door API; doors on the west face slide apart along z', () => {
    const m = model();
    const c = m.staffCabin;
    c.setHeight(3 * FLOOR_HEIGHT + FLOOR_TOP);
    expect(c.getHeight()).toBeCloseTo(3 * FLOOR_HEIGHT + FLOOR_TOP);
    expect(c.currentFloor()).toBe(3);
    m.root.updateMatrixWorld(true);
    const doors = c.group.children.filter((o) => o.name === 'staff-cabin-door');
    expect(doors).toHaveLength(2);
    const before = doors.map((d) => d.getWorldPosition(new Vector3()));
    c.setDoorsOpen(1);
    m.root.updateMatrixWorld(true);
    const after = doors.map((d) => d.getWorldPosition(new Vector3()));
    expect(c.getDoorsOpen()).toBe(1);
    for (const p of before) expect(p.x).toBeLessThan(STAFF_SHAFT.x - 0.5);
    expect(Math.abs(after[0]!.z - after[1]!.z)).toBeGreaterThan(Math.abs(before[0]!.z - before[1]!.z) + 0.4);
    c.setDoorsOpen(5);
    expect(c.getDoorsOpen()).toBe(1);
  });

  it('every floor has a call button at the landing that can be lit', () => {
    const m = model();
    for (const f of m.floors) {
      expect(f.group.getObjectByName('call-button'), `floor ${f.id}`).toBeInstanceOf(Mesh);
      expect(m.staffCabin.isCallLit(f.id)).toBe(false);
    }
    m.staffCabin.setCallLit(2, true);
    expect(m.staffCabin.isCallLit(2)).toBe(true);
    expect(m.staffCabin.isCallLit(3)).toBe(false);
  });

  it('the east wall has a door gap at the landing on every floor', () => {
    const m = model();
    m.root.updateMatrixWorld(true);
    const v = new Vector3();
    for (const f of m.floors) {
      let blocked = 0;
      f.group.traverse((o) => {
        if (!(o instanceof Mesh) || (o.name !== 'exterior-wall' && o.name !== 'glass-wall')) return;
        const pos = o.geometry.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          const h = v.y - f.group.position.y - FLOOR_TOP;
          if (v.x > HALF_WIDTH - 0.1 && h > 0.03 && v.z > STAFF_SHAFT.doorGap.z0 + 0.05 && v.z < STAFF_SHAFT.doorGap.z1 - 0.05) blocked++;
        }
      });
      expect(blocked, `floor ${f.id}`).toBe(0);
    }
  });

  it('floor view: the staff shaft hides like the visitor shaft; the staff cabin is ghosted above the focus, hidden below', () => {
    const m = model();
    const shaft = m.root.getObjectByName('staff-shaft')!;
    // glass panes keep their own base opacity (0.35) times the floor visibility
    const solid = m.staffCabin.materials.filter((x) => x.userData.baseOpacity === undefined);
    expect(solid.length).toBeGreaterThan(0);
    m.setView({ mode: 'floor', focusFloor: 3 });
    expect(shaft.visible).toBe(false);
    m.staffCabin.setHeight(3 * FLOOR_HEIGHT + FLOOR_TOP);
    expect(m.staffCabin.group.visible).toBe(true);
    expect(new Set(opacities(solid))).toEqual(new Set([1]));
    m.staffCabin.setHeight(5 * FLOOR_HEIGHT + FLOOR_TOP);
    expect(m.staffCabin.group.visible).toBe(true);
    expect(Math.max(...opacities(m.staffCabin.materials))).toBeLessThanOrEqual(0.1);
    m.staffCabin.setHeight(1 * FLOOR_HEIGHT + FLOOR_TOP);
    expect(m.staffCabin.group.visible).toBe(false);
    m.setView({ mode: 'overview', focusFloor: 0 });
    expect(shaft.visible).toBe(true);
    expect(m.staffCabin.group.visible).toBe(true);
    expect(new Set(opacities(solid))).toEqual(new Set([1]));
  });

  it('staff cabin parts carry no unit id (not pickable as robots)', () => {
    const m = model();
    m.staffCabin.group.traverse((o) => expect(o.userData.unitId).toBeUndefined());
  });

  it('overview and org poses frame both shafts on desktop and phone', () => {
    for (const aspect of [1280 / 800, 375 / 667]) {
      setFrameAspect(aspect);
      for (const pose of [overviewPose(), orgPose()]) {
        const cam = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 400);
        cam.position.copy(pose.pos);
        cam.lookAt(pose.target);
        cam.updateMatrixWorld(true);
        for (const y of [0, FLOOR_COUNT * FLOOR_HEIGHT]) {
          for (const x of [STAFF_SHAFT.x + 0.75, SHAFT_X - 0.75]) {
            for (const z of [STAFF_SHAFT.z - 0.75, STAFF_SHAFT.z + 0.75, SHAFT_Z - 0.75, SHAFT_Z + 0.75]) {
              const p = new Vector3(x, y, z).project(cam);
              expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
              expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
    setFrameAspect(16 / 9);
  });
});
