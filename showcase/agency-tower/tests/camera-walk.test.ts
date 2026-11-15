// KARARLAR Rev 42 "Gezinti": first person at eye height, keyboard / drag / click-to-walk, never through a wall.
import { describe, it, expect } from 'vitest';
import { buildCampusGraph, distanceToGraph } from '../src/sim/nav';
import { floorY, type Rect, type XZ } from '../src/sim/layout';
import { layoutsFromUnits } from '../src/sim/navMovement';
import { EYE_HEIGHT, PITCH_LIMIT, WALK_RADIUS, createWalker, isWalkKey, walkInputFromKeys, walkRoute, type WalkInput } from '../src/scene/walk';
import { unitFloors } from './workflowHelpers';

const layouts = layoutsFromUnits(unitFloors());
const setup = (floor: number, start: XZ = { x: 0, z: -0.9 }, yaw = 0) => {
  const g = buildCampusGraph(layouts[floor]!);
  const w = createWalker({ graph: g, footprints: g.layout.footprints, floor, start, yaw });
  return { g, w, footprints: g.layout.footprints };
};
const inRect = (r: Rect, p: XZ): boolean => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
const none: WalkInput = { forward: 0, strafe: 0, turn: 0 };

describe('walk mode (KARARLAR Rev 42)', () => {
  it('starts on the floor graph at eye height of the selected floor', () => {
    for (const floor of [0, 3, 5]) {
      const { g, w } = setup(floor);
      const s = w.state();
      expect(distanceToGraph(g, s)).toBeLessThan(1e-6);
      expect(w.pose().pos.y).toBeCloseTo(floorY(floor) + EYE_HEIGHT, 6);
    }
  });

  it('maps W/A/S/D and the arrow keys to walk, strafe and turn', () => {
    expect(walkInputFromKeys(new Set(['w']))).toEqual({ forward: 1, strafe: 0, turn: 0 });
    expect(walkInputFromKeys(new Set(['ArrowDown', 'D']))).toEqual({ forward: -1, strafe: 1, turn: 0 });
    expect(walkInputFromKeys(new Set(['ArrowLeft']))).toEqual({ forward: 0, strafe: 0, turn: -1 });
    expect(walkInputFromKeys(new Set(['w', 's']))).toEqual({ forward: 0, strafe: 0, turn: 0 });
    expect(['w', 'A', 'ArrowUp', 'ArrowRight'].every(isWalkKey)).toBe(true);
    expect(['1', 'o', 'Escape', 'e'].some(isWalkKey)).toBe(false);
  });

  it('W walks forward along the heading', () => {
    const { w } = setup(2, { x: 0, z: -0.9 }, Math.PI / 2); // facing +x along the corridor
    const x0 = w.state().x;
    for (let i = 0; i < 30; i++) w.update(1 / 60, { forward: 1, strafe: 0, turn: 0 });
    expect(w.state().x).toBeGreaterThan(x0 + 0.5);
  });

  it('never enters a wall or furniture footprint and never leaves the walkable band, whatever the keys', () => {
    for (const floor of [0, 1, 3, 5]) {
      const { g, w, footprints } = setup(floor);
      let turnSign = 1;
      for (let i = 0; i < 3000; i++) {
        if (i % 140 === 0) turnSign = -turnSign;
        const input: WalkInput = { forward: i % 400 < 330 ? 1 : -1, strafe: i % 90 < 20 ? 1 : 0, turn: i % 70 < 12 ? turnSign : 0 };
        w.update(1 / 30, input);
        const p = w.state();
        for (const r of footprints) expect(inRect(r, p), `${floor} ${r.name} @${i}`).toBe(false);
        expect(distanceToGraph(g, p)).toBeLessThanOrEqual(WALK_RADIUS + 1e-9);
      }
    }
  });

  it('a long frame does not tunnel through a wall (sub-stepped)', () => {
    const { w, footprints } = setup(2, { x: 0, z: -0.9 }, Math.PI); // facing -z, toward the work area wall
    for (let i = 0; i < 20; i++) w.update(0.1, { forward: 1, strafe: 0, turn: 0 });
    const p = w.state();
    for (const r of footprints) expect(inRect(r, p)).toBe(false);
  });

  it('drag looks around; the pitch is clamped', () => {
    const { w } = setup(2);
    const y0 = w.state().yaw;
    w.look(100, 0);
    expect(w.state().yaw).not.toBeCloseTo(y0, 3);
    w.look(0, 100000);
    expect(w.state().pitch).toBeCloseTo(PITCH_LIMIT, 6);
    w.look(0, -100000);
    expect(w.state().pitch).toBeCloseTo(-PITCH_LIMIT, 6);
  });

  it('click-to-walk follows the graph to the clicked point, every step walkable', () => {
    const floor = 2;
    const { g, w, footprints } = setup(floor, { x: 5, z: -0.9 });
    const desk = layouts[floor]!.desks[0]!;
    const goal = { x: desk.seat.x, z: desk.seat.z };
    expect(w.walkTo(goal, false)).toBe(true);
    expect(w.walking()).toBe(true);
    let t = 0;
    while (w.walking() && t < 60) {
      w.update(1 / 30, none);
      t += 1 / 30;
      const p = w.state();
      for (const r of footprints) expect(inRect(r, p), r.name).toBe(false);
      expect(distanceToGraph(g, p)).toBeLessThanOrEqual(WALK_RADIUS);
    }
    expect(w.walking()).toBe(false);
    const p = w.state();
    expect(Math.hypot(p.x - goal.x, p.z - goal.z)).toBeLessThan(0.3);
    expect(t).toBeGreaterThan(1); // walked, not teleported
  });

  it('reduced motion: click-to-walk arrives at once (a cut)', () => {
    const { w } = setup(2, { x: 5, z: -0.9 });
    const desk = layouts[2]!.desks[0]!;
    expect(w.walkTo({ x: desk.seat.x, z: desk.seat.z }, true)).toBe(true);
    expect(w.walking()).toBe(false);
    expect(Math.hypot(w.state().x - desk.seat.x, w.state().z - desk.seat.z)).toBeLessThan(0.3);
  });

  it('a click far outside the floor is not a destination; a key press cancels a route', () => {
    const { w } = setup(2);
    expect(w.walkTo({ x: 60, z: 60 }, false)).toBe(false);
    expect(w.walkTo({ x: 5, z: -0.9 }, false)).toBe(true);
    w.update(1 / 60, { forward: 0, strafe: 0, turn: 1 });
    expect(w.walking()).toBe(false);
  });

  it('routes start and end on the graph and every leg stays on the graph', () => {
    const g = buildCampusGraph(layouts[1]!);
    const r = walkRoute(g, { x: 6, z: -0.9 }, { x: -3, z: -3.5 })!;
    expect(r.length).toBeGreaterThan(2);
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1]!;
      const b = r[i]!;
      for (let s = 0; s <= 10; s++) {
        const p = { x: a.x + ((b.x - a.x) * s) / 10, z: a.z + ((b.z - a.z) * s) / 10 };
        expect(distanceToGraph(g, p)).toBeLessThanOrEqual(WALK_RADIUS);
      }
    }
  });
});
