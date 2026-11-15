// KARARLAR Rev 46 film staging: the four builders work in one engineering room in scene 11 (in frame, room busy with
// 6–10 people), and a welcome group waits in the penthouse when scene 2 cuts to the CEO. Runs the app wiring at
// `?film=1`: engine with nav + staff elevator, ambient with the app's campus options and the film's stage hook,
// director, story director, 30 fps wall frames at the film's speed.
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { appCampusOptions, createActivitySim } from '../src/scene/activity';
import { createAnchors, createDirector } from '../src/scene/director';
import { floorY, PENTHOUSE } from '../src/sim/layout';
import type { NavMovement } from '../src/sim/navMovement';
import { buildCampusGraph, pointSegmentDistance } from '../src/sim/nav';
import { breakPeriodAt, createOfficeSchedule } from '../src/sim/schedule';
import { createStepPacer } from '../src/sim/dayControl';
import { createWorkflow, type WfEvent } from '../src/sim/workflow';
import { isPresent, LIFE_ANCHORS, type LifeAnchor } from '../src/sim/roomLifeSim';
import { createFilmDirector } from '../src/film/director';
import { loadFilmScenario, withFilm } from '../src/film/filmData';
import { filmShotPlan } from '../src/film/shots';
import { FILM_REF_ASPECT } from '../src/film/framing';
import { ENGINEERING_FLOOR, ENGINEERING_ROOM, FILM_BUILDERS, FILM_LIFE_ANCHORS, WELCOME_GROUP, filmStage } from '../src/film/staging';
import { towerLayouts } from './directorHelpers';
import { scenarioSet, unitFloors } from './workflowHelpers';

interface Pt {
  id: string;
  floor: number;
  x: number;
  y: number;
  z: number;
}

interface Sample {
  scene: number;
  local: number;
  robots: Pt[];
  minutes: number;
}

function playStagedFilm(maxWallS = 260): { samples: Sample[]; done: boolean; elapsed: number } {
  const units = unitFloors();
  const scn = loadFilmScenario(units);
  if (!scn) throw new Error('film scenario invalid');
  const layouts = towerLayouts();
  const anchors = createAnchors(layouts);
  const wf = createWorkflow({ scenarios: withFilm(scenarioSet(), scn), units, scripted: false, autoStart: false });
  const nav = wf.movement as NavMovement;
  const fd = createFilmDirector({ workflow: wf, scenario: scn });
  const office = createOfficeSchedule({ get time() { return fd.officeClock(); } });
  const specs = [...units.keys()].map((id) => {
    const d = anchors.deskOf(id)!;
    const y = floorY(d.floor);
    return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
  });
  const ambient = createActivitySim(specs, 20261113, {
    campus: appCampusOptions({
      movement: nav,
      floors: units,
      period: () => office.breakPeriod(),
      periodAhead: (s) => breakPeriodAt(fd.officeClock() + s),
      queued: () => nav.elevator.queue().length,
      stage: (id) => filmStage(fd.sceneNumber() || 1, id),
    }),
  });
  const dir = createDirector({ scenarios: withFilm(scenarioSet(), scn), layouts, homeFloors: units, ambient, position: (u) => nav.renderPosition(u, false) });
  const samples: Sample[] = [];
  const pace = createStepPacer();
  const dt = 1 / 30;
  let speed = 1;
  fd.start();
  for (let i = 0; i < maxWallS * 30 && !fd.done; i++) {
    const events: WfEvent[] = [];
    const steps = Math.max(1, pace(speed));
    for (let k = 0; k < steps; k++) {
      ambient.step(dt * 1000);
      wf.step(dt);
      const ev = wf.drainEvents();
      events.push(...ev);
      dir.ingest(ev);
      dir.update(dt, wf);
    }
    const f = fd.update(dt, events);
    speed = f.speed;
    if (i % 3 === 0) {
      const robots = [...units.keys()].map((id) => {
        const v = dir.view(id);
        return { id, floor: v.floor, x: v.x, y: v.y, z: v.z };
      });
      samples.push({ scene: f.scene.n, local: f.local, robots, minutes: office.minutes() });
    }
  }
  return { samples, done: fd.done, elapsed: fd.elapsed };
}

const inRoom = (p: Pt): boolean => p.floor === ENGINEERING_FLOOR && p.x >= ENGINEERING_ROOM.x0 && p.x <= ENGINEERING_ROOM.x1 && p.z >= ENGINEERING_ROOM.z0 && p.z <= ENGINEERING_ROOM.z1;
const lifeIn = (room: LifeAnchor['room'], minutes: number): number => FILM_LIFE_ANCHORS.filter((a) => a.room === room && isPresent(a, minutes)).length;

function inFrame(p: Vector3, pose: { pos: Vector3; target: Vector3; fov: number }, aspect: number): boolean {
  const c = new PerspectiveCamera(pose.fov, aspect, 0.3, 400);
  c.position.copy(pose.pos);
  c.lookAt(pose.target);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const q = p.clone().project(c);
  return Math.abs(q.x) <= 0.97 && Math.abs(q.y) <= 0.97 && q.z < 1;
}

describe('film staging (Rev 46)', () => {
  const run = playStagedFilm();

  it('plays to the end within 140–170 s with the full app wiring (no wing traffic jam)', () => {
    console.info(`staged film ${run.elapsed.toFixed(1)} s`);
    expect(run.elapsed).toBeGreaterThanOrEqual(140);
    expect(run.elapsed).toBeLessThanOrEqual(170);
    expect(run.done).toBe(true);
  });

  it('scene 11: all four builders are on floor 1 inside the engineering room and in frame (16:9 and 9:16)', () => {
    const s11 = run.samples.filter((s) => s.scene === 11);
    expect(s11.length).toBeGreaterThan(30);
    const poses = [FILM_REF_ASPECT, 9 / 16].map((aspect) => ({ aspect, poses: filmShotPlan('engineering', aspect).flatMap((seg) => (seg.kind === 'path' ? seg.poses : [])) }));
    for (const s of s11) {
      for (const id of FILM_BUILDERS) {
        const p = s.robots.find((r) => r.id === id)!;
        expect(inRoom(p), `${id} at scene 11 +${s.local.toFixed(1)} s: floor ${p.floor} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).toBe(true);
        const head = new Vector3(p.x, floorY(ENGINEERING_FLOOR) + 1.0, p.z);
        for (const { aspect, poses: ps } of poses) for (const pose of ps) expect(inFrame(head, pose, aspect), `${id} in frame at ${aspect.toFixed(2)}`).toBe(true);
      }
    }
  });

  it('scene 11: the engineering room holds 6–10 people (robots plus engineering staff)', () => {
    for (const s of run.samples.filter((x) => x.scene === 11 && x.local > 2)) {
      const n = s.robots.filter(inRoom).length + lifeIn('engineering', s.minutes);
      expect(n, `scene 11 +${s.local.toFixed(1)} s`).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it('scene 2: at least 4 characters wait in the penthouse when the shot cuts to the CEO (the welcome group among them)', () => {
    const cut = run.samples.find((s) => s.scene === 2 && s.local >= 3);
    if (!cut) throw new Error('no scene 2 cut');
    const up = cut.robots.filter((r) => r.floor === PENTHOUSE);
    const welcome = up.filter((r) => (WELCOME_GROUP as readonly string[]).includes(r.id));
    expect(welcome.map((r) => r.id).sort(), 'welcome group in the penthouse').toEqual([...WELCOME_GROUP].sort());
    expect(up.length + lifeIn('penthouse', cut.minutes)).toBeGreaterThanOrEqual(4);
    expect(lifeIn('penthouse', cut.minutes)).toBeGreaterThanOrEqual(1);
  });

  it('scene 2: the CEO starts in the lobby and rides up to the penthouse before scene 3', () => {
    const start = run.samples.find((s) => s.scene === 2)!;
    expect(start.robots.find((r) => r.id === 'ceo')!.floor).toBe(0);
    const s3 = run.samples.find((s) => s.scene === 3)!;
    expect(s3.robots.find((r) => r.id === 'ceo')!.floor).toBe(PENTHOUSE);
  });

  it('the welcome group disperses after the intake: by scene 5 none of them stands on the penthouse arc', () => {
    const s5 = run.samples.find((s) => s.scene === 5 && s.local > 3);
    if (!s5) throw new Error('no scene 5');
    for (const id of ['product-manager', 'delivery-manager']) expect(s5.robots.find((r) => r.id === id)!.floor, id).not.toBe(PENTHOUSE);
  });
});

describe('film staging crew (room life)', () => {
  const layouts = towerLayouts();
  const graphs = new Map(layouts.map((l) => [l.floor, buildCampusGraph(l)]));

  it('is film-only: never in LIFE_ANCHORS, ids unique', () => {
    const ids = new Set(LIFE_ANCHORS.map((a) => a.id));
    for (const a of FILM_LIFE_ANCHORS) expect(ids.has(a.id)).toBe(false);
    expect(new Set(FILM_LIFE_ANCHORS.map((a) => a.id)).size).toBe(FILM_LIFE_ANCHORS.length);
  });

  it('keeps >= 0.45 u from every stationary spot and out of aisles (>= 0.5 through, >= 0.45 spur)', () => {
    for (const a of FILM_LIFE_ANCHORS) {
      const g = graphs.get(a.floor)!;
      for (const id of g.stationary) {
        const n = g.nodes.get(id)!;
        expect(Math.hypot(a.x - n.x, a.z - n.z), `${a.id} vs ${id}`).toBeGreaterThanOrEqual(0.45);
      }
      for (const e of g.edges) {
        const d = pointSegmentDistance(a, g.nodes.get(e.a)!, g.nodes.get(e.b)!);
        expect(d, `${a.id} vs ${e.a}-${e.b}`).toBeGreaterThanOrEqual(e.through ? 0.5 : 0.45);
      }
    }
  });

  it('stands clear of the furniture footprints', () => {
    for (const a of FILM_LIFE_ANCHORS) {
      const l = layouts[a.floor]!;
      for (const f of l.footprints) {
        const inside = a.x > f.x0 - 0.2 && a.x < f.x1 + 0.2 && a.z > f.z0 - 0.2 && a.z < f.z1 + 0.2;
        expect(inside, `${a.id} vs ${f.name}`).toBe(false);
      }
    }
  });
});
