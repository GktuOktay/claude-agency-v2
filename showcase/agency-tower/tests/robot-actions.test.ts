// KARARLAR Rev 43 package B: robots visibly do things with objects where they are (coffee, gym, office, social).
// The action layer is a pure render overlay: it reads the ambient state, never feeds back into any simulation.
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import type { ActivityView, BreakPhase, PoseKind } from '../src/scene/activity';
import {
  BELT_TOP,
  BOARD_AT,
  MACHINE_FRONT,
  POUR_S,
  TEA_S,
  createActionLayer,
  type ActionInput,
  type RobotAction,
} from '../src/scene/actions';
import { applyPose, sipAmount } from '../src/scene/pose';
import type { RobotParts } from '../src/scene/robot';
import { AMENITY_SPOTS, LAB_STATIONS, type AmenitySpot } from '../src/sim/layout';

const Y = 2.5;
const robots = [
  { id: 'a', home: { x: 0, y: Y, z: 0 }, coffee: { x: 4.6, y: Y, z: -2.8 } },
  { id: 'b', home: { x: 1.0, y: Y, z: 0 }, coffee: { x: 5.6, y: Y, z: -2.8 } },
  { id: 'c', home: { x: 8, y: Y, z: 3 }, coffee: { x: 6.6, y: Y, z: -2.8 } },
];
const view = (v: Partial<ActivityView> & { x: number; z: number }): ActivityView => ({ kind: 'idle', y: Y, facing: 0, walkPhase: 0, elapsed: 0, ...v });
const input = (id: string, v: ActivityView, spot: AmenitySpot | null = null, phase: BreakPhase | null = null, busy = false): ActionInput => ({ id, busy, view: v, spot, phase });
const spotOf = (kind: AmenitySpot['kind'], i = 0): AmenitySpot => {
  const s = AMENITY_SPOTS.filter((x) => x.kind === kind)[i];
  if (!s) throw new Error(kind);
  return s;
};
const must = (a: RobotAction | null): RobotAction => {
  if (!a) throw new Error('no action');
  return a;
};
const parts = (): RobotParts => ({ body: new Group(), head: new Group(), armL: new Group(), armR: new Group(), legL: new Group(), legR: new Group() });
/** Runs `n` frames of `dt` seconds with inputs from `f(t)`. */
function run(layer: ReturnType<typeof createActionLayer>, from: number, seconds: number, f: (t: number) => ActionInput[], reduced = false, dt = 0.1): number {
  let t = from;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    t += dt;
    layer.update(t, f(t), reduced);
  }
  return t;
}

describe('coffee bar: queue, cup, sip, walk back drinking, drop (Rev 43 B)', () => {
  it('one robot at a time goes to the machine and pours; the other waits facing the machine with empty hands', () => {
    const L = createActionLayer(robots);
    const at = (t: number): ActionInput[] => [
      input('a', view({ kind: 'coffee', x: 4.6, z: -2.8, facing: Math.PI, elapsed: t })),
      input('b', view({ kind: 'coffee', x: 5.6, z: -2.8, facing: Math.PI, elapsed: t - 0.5 })),
    ];
    run(L, 0, 0.1, at);
    const b0 = must(L.get('b'));
    expect(b0.props).toEqual([]);
    run(L, 0.1, 1.9, at); // a reaches the machine front
    const a = must(L.get('a'));
    expect(a.pose).toBe('pour');
    expect(Math.hypot(4.6 + a.dx - MACHINE_FRONT.x, -2.8 + a.dz - MACHINE_FRONT.z)).toBeLessThan(0.05);
    expect(a.props).toEqual([]);
    const b = must(L.get('b'));
    expect(b.props).toEqual([]);
    expect(b.pose).toBe('idle');
    expect(b.facing).toBeCloseTo(Math.atan2(MACHINE_FRONT.x - 5.6, MACHINE_FRONT.z - 0.5 - -2.8), 1);
  });

  it('after pouring the robot holds a cup and sips; then the next robot takes the machine', () => {
    const L = createActionLayer(robots);
    const at = (t: number): ActionInput[] => [
      input('a', view({ kind: 'coffee', x: 4.6, z: -2.8, facing: Math.PI, elapsed: t })),
      input('b', view({ kind: 'coffee', x: 5.6, z: -2.8, facing: Math.PI, elapsed: t - 0.5 })),
    ];
    run(L, 0, 2 + POUR_S + 2.5, at);
    const a = must(L.get('a'));
    expect(a.props).toEqual(['cup']);
    expect(['sip', 'chat']).toContain(a.pose);
    const t = run(L, 2 + POUR_S + 2.5, POUR_S + 1.5, at);
    expect(must(L.get('b')).props).toEqual(['cup']);
    expect(t).toBeGreaterThan(0);
  });

  it('walks back drinking (cup in hand, walking pose) and drops the cup at home', () => {
    const L = createActionLayer(robots);
    const t = run(L, 0, 6 + POUR_S, (s) => [input('a', view({ kind: 'coffee', x: 4.6, z: -2.8, facing: Math.PI, elapsed: s }))]);
    expect(must(L.get('a')).props).toEqual(['cup']);
    const t2 = run(L, t, 1, () => [input('a', view({ kind: 'walk', x: 3, z: -1.5, walkPhase: 2 }))]);
    const w = must(L.get('a'));
    expect(w.pose).toBe('cup-walk');
    expect(w.props).toEqual(['cup']);
    run(L, t2, 0.2, () => [input('a', view({ kind: 'idle', x: 0, z: 0 }))]);
    expect(L.get('a')?.props ?? []).not.toContain('cup');
  });

  it('a snack-bar break gives a cup; the walk back keeps it until home', () => {
    const L = createActionLayer(robots);
    const s = spotOf('snack');
    run(L, 0, 1, () => [input('a', view({ kind: 'coffee', pose: 'eat', x: s.x, z: s.z }), s, 'stay')]);
    expect(must(L.get('a')).props).toEqual(['cup']);
    run(L, 1, 1, () => [input('a', view({ kind: 'walk', pose: 'walk', x: s.x, z: s.z + 1 }), s, 'back')]);
    expect(must(L.get('a')).pose).toBe('cup-walk');
    run(L, 2, 0.2, () => [input('a', view({ kind: 'idle', x: 0, z: 0 }))]);
    expect(L.get('a')?.props ?? []).not.toContain('cup');
  });

  it('the tea server hands a glass to a robot at its desk; it sips while working, then puts it down', () => {
    const L = createActionLayer(robots);
    const at = (): ActionInput[] => [input('c', view({ kind: 'work', x: 8, z: 2, facing: Math.PI }))];
    run(L, 0, 0.1, at);
    L.serve('c');
    run(L, 0.1, 1, at);
    const c = must(L.get('c'));
    expect(c.props).toEqual(['cup']);
    expect(c.pose).toBe('work-sip');
    run(L, 1.1, TEA_S + 1, at);
    expect(L.get('c')?.props ?? []).not.toContain('cup');
  });

  it('sipping brings the cup to the mouth periodically', () => {
    const lo = parts();
    const hi = parts();
    let tLo = 0;
    let tHi = 0;
    for (let t = 0; t < 10; t += 0.05) {
      if (sipAmount(t) < sipAmount(tLo)) tLo = t;
      if (sipAmount(t) > sipAmount(tHi)) tHi = t;
    }
    applyPose(lo, 'sip', 0, tLo);
    applyPose(hi, 'sip', 0, tHi);
    expect(sipAmount(tHi)).toBeGreaterThan(0.9);
    expect(sipAmount(tLo)).toBeLessThan(0.1);
    expect(hi.armR.rotation.x).toBeLessThan(lo.armR.rotation.x - 0.8); // arm up to the mouth
    expect(hi.armR.rotation.x).toBeLessThan(-2);
  });
});

describe('gym: treadmill, dumbbells, mat (Rev 43 B)', () => {
  it('runs on the treadmill belt (lifted onto it), in the run pose', () => {
    const L = createActionLayer(robots);
    const s = spotOf('treadmill');
    run(L, 0, 0.2, () => [input('a', view({ kind: 'coffee', pose: 'run', x: s.x, z: s.z }), s, 'stay')]);
    const a = must(L.get('a'));
    expect(a.pose).toBe('run');
    expect(a.dy).toBeCloseTo(BELT_TOP);
  });

  it('lifts with a dumbbell in each hand; on the mat, sets of stretching and of dumbbell work', () => {
    const L = createActionLayer(robots);
    const w = spotOf('weights');
    const m = spotOf('mat');
    const seen = new Set<string>();
    for (let t = 0.1; t < 400; t += 0.5) {
      L.update(t, [input('a', view({ kind: 'coffee', pose: 'lift', x: w.x, z: w.z }), w, 'stay'), input('b', view({ kind: 'coffee', pose: 'lift', x: m.x, z: m.z }), m, 'stay')], false);
      expect(must(L.get('a')).props).toEqual(['dumbbell']);
      expect(must(L.get('a')).pose).toBe('lift');
      const b = must(L.get('b'));
      expect(b.pose === 'stretch' ? b.props : ['dumbbell']).toEqual(b.pose === 'stretch' ? [] : b.props);
      seen.add(b.pose);
    }
    expect([...seen].sort()).toEqual(['lift', 'stretch']);
    const p = parts();
    applyPose(p, 'stretch', 0, 1);
    expect(Math.abs(p.armR.rotation.z) + Math.abs(p.armR.rotation.x)).toBeGreaterThan(2); // arms overhead
  });
});

describe('office: whiteboard, stand-up, phone, desk stretch (Rev 43 B)', () => {
  const wall = AMENITY_SPOTS.filter((s) => LAB_STATIONS.get(s.id) === 'wall');

  it('the lab stand-up: one robot writes on the whiteboard with a marker, the others stand in a circle facing it', () => {
    expect(wall.length).toBeGreaterThanOrEqual(3);
    const L = createActionLayer(robots);
    const at = (): ActionInput[] => ['a', 'b', 'c'].map((id, i) => {
      const s = wall[i] as AmenitySpot;
      return input(id, view({ kind: 'coffee', pose: 'work', x: s.x, z: s.z, facing: s.facing }), s, 'stay');
    });
    run(L, 0, 8, at);
    const writer = must(L.get('a'));
    expect(writer.pose).toBe('write');
    expect(writer.props).toEqual(['marker']);
    const wx = (wall[0] as AmenitySpot).x + writer.dx;
    const wz = (wall[0] as AmenitySpot).z + writer.dz;
    expect(Math.hypot(wx - BOARD_AT.x, wz - BOARD_AT.z)).toBeLessThan(0.7);
    expect(writer.facing).toBeCloseTo(Math.atan2(BOARD_AT.x - wx, BOARD_AT.z - wz), 1);
    for (const [id, i] of [['b', 1], ['c', 2]] as const) {
      const m = must(L.get(id));
      expect(m.pose).toBe('chat');
      const x = (wall[i] as AmenitySpot).x + m.dx;
      const z = (wall[i] as AmenitySpot).z + m.dz;
      expect(Math.hypot(x - BOARD_AT.x, z - BOARD_AT.z)).toBeGreaterThan(0.8);
      expect(Math.hypot(x - BOARD_AT.x, z - BOARD_AT.z)).toBeLessThan(1.5);
    }
    // standing, not seated, in the circle
    expect(['b', 'c'].map((id) => Math.hypot(must(L.get(id)).dx, must(L.get(id)).dz)).every((d) => d > 0.5)).toBe(true);
  });

  it('the marker arm moves while writing', () => {
    const a = parts();
    const b = parts();
    applyPose(a, 'write', 0, 0.2);
    applyPose(b, 'write', 0, 0.9);
    expect(a.armR.rotation.x).toBeLessThan(-1.2);
    expect(a.armR.rotation.x !== b.armR.rotation.x || a.armR.rotation.z !== b.armR.rotation.z).toBe(true);
  });

  it('robots at home sometimes take a phone call: hand at the ear, a phone in it, pacing', () => {
    const L = createActionLayer(robots);
    const poses = new Set<PoseKind>();
    const xs = new Set<number>();
    let phone = 0;
    run(L, 0, 600, () => [input('c', view({ kind: 'idle', x: 8, z: 3 }))], false, 0.25);
    for (let t = 600; t < 1200; t += 0.25) {
      L.update(t, [input('c', view({ kind: 'idle', x: 8, z: 3 }))], false);
      const c = L.get('c');
      if (c?.props.includes('phone')) {
        phone++;
        poses.add(c.pose);
        xs.add(Math.round(c.dx * 100));
      }
    }
    expect(phone).toBeGreaterThan(40);
    expect(phone).toBeLessThan(2400 * 0.6);
    expect([...poses].some((p) => p === 'phone-walk' || p === 'phone-stand')).toBe(true);
    expect(xs.size).toBeGreaterThan(3); // pacing
    const p = parts();
    applyPose(p, 'phone-stand', 0, 0);
    expect(p.armR.rotation.x).toBeLessThan(-2.2); // hand up at the ear
  });

  it('robots at the desk occasionally stretch, arms up, then go back to typing', () => {
    const L = createActionLayer(robots);
    let up = 0;
    let n = 0;
    for (let t = 0; t < 600; t += 0.1) {
      L.update(t, [input('c', view({ kind: 'work', x: 8, z: 2, facing: Math.PI }))], false);
      n++;
      const c = L.get('c');
      if (c?.pose === 'arms-up') up++;
    }
    expect(up).toBeGreaterThan(0);
    expect(up / n).toBeLessThan(0.15);
    const p = parts();
    applyPose(p, 'arms-up', 0, 1);
    expect(p.armL.rotation.x).toBeLessThan(-2.4);
    expect(p.armR.rotation.x).toBeLessThan(-2.4);
    expect(p.body.position.y).toBeCloseTo(0.07); // still seated
  });
});

describe('social: chat, tray (Rev 43 B)', () => {
  it('two idle robots close together face each other and chat', () => {
    const L = createActionLayer(robots);
    // A window when neither is on the phone: scan for frames where both chat.
    let both = 0;
    for (let t = 0; t < 300; t += 0.5) {
      L.update(t, [input('a', view({ kind: 'idle', x: 0, z: 0 })), input('b', view({ kind: 'idle', x: 1, z: 0 }))], false);
      const a = L.get('a');
      const b = L.get('b');
      if (a?.pose === 'chat' && b?.pose === 'chat') {
        both++;
        expect(a.facing).toBeCloseTo(Math.PI / 2, 1);
        expect(b.facing).toBeCloseTo(-Math.PI / 2, 1);
      }
    }
    expect(both).toBeGreaterThan(100);
    const p = parts();
    const q = parts();
    applyPose(p, 'chat', 0, 0.3);
    applyPose(q, 'chat', 0, 1.4);
    expect(p.head.rotation.x !== q.head.rotation.x || p.armR.rotation.x !== q.armR.rotation.x).toBe(true); // nods, gestures
  });

  it('a robot heading to a cafeteria table carries a food tray', () => {
    const L = createActionLayer(robots);
    const s = spotOf('dining');
    run(L, 0, 0.5, () => [input('a', view({ kind: 'walk', pose: 'walk', x: s.x + 2, z: s.z, walkPhase: 3 }), s, 'go')]);
    const a = must(L.get('a'));
    expect(a.props).toEqual(['tray']);
    expect(a.pose).toBe('tray-walk');
    const p = parts();
    applyPose(p, 'tray-walk', 1, 0);
    expect(p.armL.rotation.x).toBeLessThan(-1);
    expect(p.armR.rotation.x).toBeCloseTo(p.armL.rotation.x);
    expect(p.legL.rotation.x).not.toBe(0);
  });
});

describe('action layer contract: pure overlay, deterministic, pause, reduced motion', () => {
  const day = (t: number): ActionInput[] => {
    const k = Math.floor(t / 7) % 3;
    const kind = k === 0 ? 'idle' : k === 1 ? 'work' : 'coffee';
    return robots.map((r) => input(r.id, view({ kind, x: kind === 'coffee' ? r.coffee.x : r.home.x, z: kind === 'coffee' ? r.coffee.z : r.home.z, elapsed: t % 7 })));
  };

  it('a workflow step, reservation or selection gets no action (the engine owns the robot)', () => {
    const L = createActionLayer(robots);
    run(L, 0, 1, () => [input('a', view({ kind: 'work', x: 0, z: 0 }), null, null, true)]);
    expect(L.get('a')).toBeNull();
  });

  it('same inputs, same outputs (seeded by robot id and sim time only)', () => {
    const A = createActionLayer(robots);
    const B = createActionLayer(robots);
    const outA: string[] = [];
    const outB: string[] = [];
    for (let t = 0; t < 200; t += 0.1) {
      A.update(t, day(t), false);
      B.update(t, day(t), false);
      outA.push(JSON.stringify(robots.map((r) => A.get(r.id))));
      outB.push(JSON.stringify(robots.map((r) => B.get(r.id))));
    }
    expect(outA).toEqual(outB);
  });

  it('pause: the sim clock holds, so actions hold (same time twice = same frame)', () => {
    const L = createActionLayer(robots);
    run(L, 0, 29.9, day);
    L.update(30, day(30), false);
    const before = JSON.stringify(robots.map((r) => L.get(r.id)));
    L.update(30, day(30), false);
    L.update(30, day(30), false);
    // time did not advance: nothing moved, no limb time advanced
    const after = JSON.stringify(robots.map((r) => L.get(r.id)));
    expect(JSON.parse(after)).toEqual(JSON.parse(before));
  });

  it('reduced motion: no limb animation time, no walk phase, no pacing; props and static poses stay', () => {
    const L = createActionLayer(robots);
    let props = 0;
    for (let t = 0; t < 900; t += 0.25) {
      L.update(t, [input('c', view({ kind: 'idle', x: 8, z: 3 })), input('a', view({ kind: 'coffee', x: 4.6, z: -2.8, elapsed: t % 9 }))], true);
      for (const id of ['a', 'c']) {
        const r = L.get(id);
        if (!r) continue;
        expect(r.timeSec).toBe(0);
        expect(r.walkPhase).toBe(0);
        if (r.props.length) props++;
        if (id === 'c') expect(r.dx).toBe(0);
      }
    }
    expect(props).toBeGreaterThan(0);
  });
});
