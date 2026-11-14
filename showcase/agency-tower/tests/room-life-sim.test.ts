// Room life (KARARLAR Rev 39): non-unit "ekip" occupants that fill every room. Pure sim tests.
import { describe, expect, it } from 'vitest';
import { buildTower } from '../src/scene/model';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { AMENITY_SPOTS, LOBBY_SPOTS, MOP_SPOTS, LOBBY_FLOOR, type XZ } from '../src/sim/layout';
import { buildCampusGraph, pointSegmentDistance } from '../src/sim/nav';
import {
  LIFE_ANCHORS,
  LIFE_ROOMS,
  createRoomLifeSim,
  lifeOffset,
  occupancyAt,
  periodAtMinutes,
  type LifeRoom,
} from '../src/sim/roomLifeSim';

const hm = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** Every 5 office minutes in [from, to). */
const samples = (from: string, to: string): number[] => {
  const out: number[] = [];
  for (let m = hm(from); m < hm(to); m += 5) out.push(m);
  return out;
};
const workDay = samples('09:00', '18:00');
const byPeriod = (p: string): number[] => samples('00:00', '24:00').filter((m) => periodAtMinutes(m) === p);
const avg = (ms: readonly number[], room: LifeRoom | null, seed = 1): number => {
  let s = 0;
  for (const m of ms) {
    const occ = occupancyAt(m, seed);
    s += room ? (occ.get(room) ?? 0) : [...occ.values()].reduce((a, b) => a + b, 0);
  }
  return s / ms.length;
};

describe('room life: who is where (Rev 39)', () => {
  it('has 30-50 occupants, none of them a unit, each with its own anchor id', () => {
    expect(LIFE_ANCHORS.length).toBeGreaterThanOrEqual(30);
    expect(LIFE_ANCHORS.length).toBeLessThanOrEqual(50);
    const ids = new Set(LIFE_ANCHORS.map((a) => a.id));
    expect(ids.size).toBe(LIFE_ANCHORS.length);
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const units = new Set(r.data.units.map((u) => u.id));
    for (const a of LIFE_ANCHORS) {
      expect(units.has(a.id)).toBe(false);
      expect(a.id.startsWith('life:')).toBe(true);
    }
    const spotIds = new Set(AMENITY_SPOTS.map((s) => s.id));
    for (const a of LIFE_ANCHORS) expect(spotIds.has(a.id)).toBe(false);
  });

  it('every listed room has occupants at every sample of the work day (nap pods: some of the time)', () => {
    for (const seed of [1, 2, 3]) {
      for (const room of LIFE_ROOMS) {
        const counts = workDay.map((m) => occupancyAt(m, seed).get(room) ?? 0);
        if (room === 'sleep-pods') {
          expect(counts.some((c) => c > 0), `${room} seed ${seed}`).toBe(true);
          expect(counts.every((c) => c > 0), `${room} seed ${seed} should be occasional`).toBe(false);
        } else {
          expect(Math.min(...counts), `${room} seed ${seed}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('Ar-Ge is the busiest room during work periods ("the brain")', () => {
    const work = byPeriod('work');
    for (const seed of [1, 2, 3]) {
      const lab = avg(work, 'rnd-lab', seed);
      for (const room of LIFE_ROOMS) if (room !== 'rnd-lab') expect(lab, `${room} seed ${seed}`).toBeGreaterThan(avg(work, room, seed) * 2);
      let wins = 0;
      for (const m of work) {
        const occ = occupancyAt(m, seed);
        const l = occ.get('rnd-lab') ?? 0;
        if (LIFE_ROOMS.every((r) => r === 'rnd-lab' || (occ.get(r) ?? 0) < l)) wins++;
      }
      expect(wins / work.length).toBeGreaterThanOrEqual(0.9);
      // Ar-Ge also has the most occupants of any room across the whole office day.
      for (const room of LIFE_ROOMS) if (room !== 'rnd-lab') expect(avg(workDay, 'rnd-lab', seed)).toBeGreaterThan(avg(workDay, room, seed));
    }
  });

  it('the cafeteria peaks at the lunch slot', () => {
    for (const seed of [1, 2, 3]) {
      const lunch = avg(byPeriod('lunch'), 'yemekhane', seed);
      expect(lunch).toBeGreaterThan(2 * avg(byPeriod('work'), 'yemekhane', seed));
      expect(lunch).toBeGreaterThan(avg(byPeriod('coffee'), 'yemekhane', seed));
      expect(lunch).toBeGreaterThan(avg(byPeriod('tea'), 'yemekhane', seed));
      for (const room of LIFE_ROOMS) if (room !== 'yemekhane') expect(lunch, room).toBeGreaterThan(avg(byPeriod('lunch'), room, seed));
    }
  });

  it('break slots fill the gym, game room, lounges, terraces and snack bar', () => {
    const leisure: LifeRoom[] = ['gym', 'game-room', 'lounge', 'terrace', 'roof-garden', 'roof-terrace', 'snack-bar'];
    const sum = (ms: number[], seed: number): number => leisure.reduce((s, r) => s + avg(ms, r, seed), 0);
    for (const seed of [1, 2, 3]) {
      const work = sum(byPeriod('work'), seed);
      expect(sum(byPeriod('coffee'), seed)).toBeGreaterThan(work * 1.5);
      expect(sum(byPeriod('tea'), seed)).toBeGreaterThan(work * 1.5);
    }
  });

  it('after hours the office is mostly empty', () => {
    for (const seed of [1, 2, 3]) {
      const after = avg(byPeriod('after'), null, seed);
      expect(after).toBeLessThanOrEqual(0.2 * avg(byPeriod('work'), null, seed));
      expect(after).toBeGreaterThan(0); // a night owl or two in Ar-Ge
    }
  });
});

describe('room life: never in the units\' way', () => {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  const model = buildTower(r.data, { city: false, grounds: false, facade: false });
  const graphs = new Map(model.layouts.map((l) => [l.floor, buildCampusGraph(l)]));
  /** Anchor plus the extremes and midpoints of its local move. */
  const reach = (a: (typeof LIFE_ANCHORS)[number]): XZ[] =>
    [-1, -0.5, 0, 0.5, 1].map((k) => {
      const o = lifeOffset(a, k);
      return { x: a.x + o.x, z: a.z + o.z };
    });

  it('keeps >= 0.45 u from every amenity spot and every other stationary spot (and staff spots)', () => {
    for (const a of LIFE_ANCHORS) {
      const g = graphs.get(a.floor)!;
      const staff = [...MOP_SPOTS, ...(a.floor === LOBBY_FLOOR ? LOBBY_SPOTS : [])];
      for (const p of reach(a)) {
        for (const s of AMENITY_SPOTS) if (s.floor === a.floor) expect(Math.hypot(p.x - s.x, p.z - s.z), `${a.id} vs ${s.id}`).toBeGreaterThanOrEqual(0.45);
        for (const id of g.stationary) {
          const n = g.nodes.get(id)!;
          expect(Math.hypot(p.x - n.x, p.z - n.z), `${a.id} vs ${id}`).toBeGreaterThanOrEqual(0.45);
        }
        for (const s of staff) expect(Math.hypot(p.x - s.x, p.z - s.z), `${a.id} vs ${s.id}`).toBeGreaterThanOrEqual(0.45);
      }
    }
  });

  it('stays out of aisles: >= 0.5 u from through edges, >= 0.45 u from spur edges', () => {
    for (const a of LIFE_ANCHORS) {
      const g = graphs.get(a.floor)!;
      for (const p of reach(a)) {
        for (const e of g.edges) {
          const na = g.nodes.get(e.a)!;
          const nb = g.nodes.get(e.b)!;
          const d = pointSegmentDistance(p, na, nb);
          expect(d, `${a.id} vs ${e.a}-${e.b}`).toBeGreaterThanOrEqual(e.through ? 0.5 : 0.45);
        }
      }
    }
  });

  it('occupants keep >= 0.45 u from each other', () => {
    for (const a of LIFE_ANCHORS)
      for (const b of LIFE_ANCHORS) if (a !== b && a.floor === b.floor) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(0.45);
  });

  it('local moves are small (<= 0.6 u); no long walks', () => {
    for (const a of LIFE_ANCHORS) expect(a.wander).toBeLessThanOrEqual(0.6);
    const sim = createRoomLifeSim({ seed: 1 });
    const start = new Map(sim.snapshot().map((v) => [v.id, v]));
    for (let i = 0; i < 600; i++) sim.step(0.1);
    for (const v of sim.snapshot()) {
      const s = start.get(v.id)!;
      const a = LIFE_ANCHORS.find((x) => x.id === v.id)!;
      expect(Math.hypot(v.x - s.x, v.z - s.z)).toBeLessThanOrEqual(2 * a.wander + 1e-9);
      expect(v.floor).toBe(s.floor);
    }
  });
});

describe('room life sim: clock, org and reduced motion', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const run = (seed: number): string => {
      const sim = createRoomLifeSim({ seed });
      const out: string[] = [];
      for (const t of ['09:30', '10:35', '12:45', '15:35', '20:00']) {
        sim.setOfficeTime(t);
        for (let i = 0; i < 20; i++) sim.step(0.1);
        out.push(JSON.stringify(sim.snapshot().map((v) => [v.present, v.x.toFixed(4), v.t.toFixed(3)])));
      }
      return out.join('|');
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });

  it('presence follows the office time it is given (HH:MM or minutes)', () => {
    const sim = createRoomLifeSim({ seed: 1 });
    sim.setOfficeTime('13:00');
    sim.step(5);
    const lunch = sim.snapshot().filter((v) => v.present && v.room === 'yemekhane').length;
    sim.setOfficeTime(hm('22:00'));
    sim.step(5);
    expect(sim.snapshot().filter((v) => v.present && v.room === 'yemekhane').length).toBeLessThan(lunch);
    expect(sim.snapshot().filter((v) => v.present).length).toBeLessThan(10);
  });

  it('org mode freezes everything: no animation, no move, no arrival or departure', () => {
    const sim = createRoomLifeSim({ seed: 1 });
    sim.setOfficeTime('12:45');
    sim.step(1);
    sim.setOrg(true);
    const before = JSON.stringify(sim.snapshot());
    sim.setOfficeTime('22:00');
    for (let i = 0; i < 50; i++) sim.step(0.1);
    expect(JSON.stringify(sim.snapshot())).toBe(before);
    sim.setOrg(false);
    sim.step(5);
    expect(JSON.stringify(sim.snapshot())).not.toBe(before);
  });

  it('reduced motion holds static poses: no local move, animation time held, arrivals without a fade', () => {
    const sim = createRoomLifeSim({ seed: 1, reducedMotion: true });
    sim.setOfficeTime('10:00');
    sim.step(0.1);
    const a = JSON.stringify(sim.snapshot());
    for (let i = 0; i < 30; i++) sim.step(0.1);
    expect(JSON.stringify(sim.snapshot())).toBe(a);
    for (const v of sim.snapshot()) {
      const anchor = LIFE_ANCHORS.find((x) => x.id === v.id)!;
      expect(v.x).toBe(anchor.x);
      expect(v.z).toBe(anchor.z);
      expect(v.t).toBe(0);
      expect(v.appear === 0 || v.appear === 1).toBe(true);
    }
    sim.setOfficeTime('12:50');
    sim.step(0.1);
    for (const v of sim.snapshot()) expect(v.appear).toBe(v.present ? 1 : 0);
  });
});
