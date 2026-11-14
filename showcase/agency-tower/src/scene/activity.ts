// Activity state machine (REQ-11) and speech-bubble scheduler (REQ-21). Pure, seedable, no three.js.
import { createRng, range, type Rng } from './rng';

export const MAX_STEP_MS = 100;
export const WALK_SPEED = 1.2; // units per second
const MAX_STEP_S = MAX_STEP_MS / 1000;

export type ActivityKind = 'idle' | 'walk' | 'work' | 'coffee' | 'wave' | 'raise'; // raise: static wave (reduced motion)
type Stay = 'idle' | 'work' | 'coffee';
type WalkTarget = 'desk' | 'coffee' | 'home';

const DURATIONS: Record<Stay, [number, number]> = {
  idle: [3, 8],
  work: [10, 30],
  coffee: [6, 12],
};

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface ActivitySpec {
  id: string;
  home: Point;
  work: Point;
  coffee: Point;
}

export interface ActivityView {
  kind: ActivityKind; // 'wave' while selected, otherwise the cycle state
  x: number;
  y: number;
  z: number;
  facing: number; // yaw: robot front is +z
  walkPhase: number; // grows while walking, drives limb swing
  elapsed: number;
}

export interface SimEvent {
  id: string;
  from: Exclude<ActivityKind, 'wave' | 'raise'>;
  to: Exclude<ActivityKind, 'wave' | 'raise'>;
  time: number;
  duration: number; // time spent in `from`
  distance: number; // for walk: path length
}

interface Internal {
  spec: ActivitySpec;
  kind: Exclude<ActivityKind, 'wave' | 'raise'>;
  pos: Point;
  facing: number;
  elapsed: number;
  limit: number; // seconds for idle/work/coffee
  target: WalkTarget;
  targetPoint: Point;
  walkLength: number;
  walkPhase: number;
  waving: boolean;
}

export interface ActivitySim {
  time: number;
  step(dtMs: number): void;
  get(id: string): ActivityView;
  drainEvents(): SimEvent[];
  select(id: string): void;
  release(id: string): void;
  faceToward(id: string, x: number, z: number): void;
  /** Reduced motion: walkers settle at their target, nothing moves, selection raises an arm (no wave). */
  setStatic(on: boolean): void;
}

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.z - a.z);

export function createActivitySim(specs: readonly ActivitySpec[], seed: number): ActivitySim {
  const rng: Rng = createRng(seed);
  const events: SimEvent[] = [];
  const robots = new Map<string, Internal>();
  let frozen = false;

  // Upper bound is reduced by one maximal step so an elapsed period never exceeds its range.
  const draw = (kind: Stay): number => range(rng, DURATIONS[kind][0], DURATIONS[kind][1] - MAX_STEP_S);

  for (const spec of specs) {
    robots.set(spec.id, {
      spec,
      kind: 'idle',
      pos: { ...spec.home },
      facing: 0,
      elapsed: 0,
      limit: draw('idle'),
      target: 'home',
      targetPoint: spec.home,
      walkLength: 0,
      walkPhase: 0,
      waving: false,
    });
  }

  const pointFor = (r: Internal, t: WalkTarget): Point => (t === 'desk' ? r.spec.work : t === 'coffee' ? r.spec.coffee : r.spec.home);

  const change = (r: Internal, to: Internal['kind'], time: number): void => {
    events.push({ id: r.spec.id, from: r.kind, to, time, duration: r.elapsed, distance: r.walkLength });
    r.kind = to;
    r.elapsed = 0;
  };

  const startWalk = (r: Internal, t: WalkTarget, time: number): void => {
    r.target = t;
    r.targetPoint = pointFor(r, t);
    r.walkLength = dist(r.pos, r.targetPoint);
    change(r, 'walk', time);
  };

  const sim: ActivitySim = {
    time: 0,
    step(dtMs) {
      if (frozen) return;
      const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS) / 1000;
      sim.time += dt;
      for (const r of robots.values()) {
        if (r.waving) continue;
        r.elapsed += dt;
        if (r.kind === 'walk') {
          const remaining = dist(r.pos, r.targetPoint);
          const move = WALK_SPEED * dt;
          r.walkPhase += dt * 6;
          if (remaining > 0.0001) r.facing = Math.atan2(r.targetPoint.x - r.pos.x, r.targetPoint.z - r.pos.z);
          if (move >= remaining) {
            r.pos = { ...r.targetPoint };
            const arrived = r.target;
            // Walk ends on the first step that reaches the target.
            if (arrived === 'desk') {
              change(r, 'work', sim.time);
              r.limit = draw('work');
              r.facing = Math.PI;
            } else if (arrived === 'coffee') {
              change(r, 'coffee', sim.time);
              r.limit = draw('coffee');
              r.facing = Math.PI;
            } else {
              change(r, 'idle', sim.time);
              r.limit = draw('idle');
              r.facing = 0;
            }
          } else {
            r.pos = { x: r.pos.x + ((r.targetPoint.x - r.pos.x) / remaining) * move, y: r.pos.y, z: r.pos.z + ((r.targetPoint.z - r.pos.z) / remaining) * move };
          }
        } else if (r.elapsed >= r.limit) {
          if (r.kind === 'idle') startWalk(r, rng() < 0.5 ? 'desk' : 'coffee', sim.time);
          else startWalk(r, 'home', sim.time);
        }
      }
    },
    get(id) {
      const r = robots.get(id);
      if (!r) throw new Error(`unknown robot ${id}`);
      return { kind: r.waving ? (frozen ? 'raise' : 'wave') : r.kind, x: r.pos.x, y: r.pos.y, z: r.pos.z, facing: r.facing, walkPhase: r.walkPhase, elapsed: r.elapsed };
    },
    drainEvents() {
      return events.splice(0, events.length);
    },
    select(id) {
      const r = robots.get(id);
      if (r) r.waving = true;
    },
    release(id) {
      const r = robots.get(id);
      if (r) r.waving = false;
    },
    setStatic(on) {
      frozen = on;
      if (!on) return;
      for (const r of robots.values()) {
        if (r.kind !== 'walk') continue;
        r.pos = { ...r.targetPoint };
        const to = r.target === 'desk' ? 'work' : r.target === 'coffee' ? 'coffee' : 'idle';
        change(r, to, sim.time);
        r.limit = draw(to);
        r.facing = to === 'idle' ? 0 : Math.PI;
      }
    },
    faceToward(id, x, z) {
      const r = robots.get(id);
      if (r) r.facing = Math.atan2(x - r.pos.x, z - r.pos.z);
    },
  };
  return sim;
}

// ---- Speech bubbles ----

export interface BubbleSource {
  id: string;
  phrases: readonly string[];
}

export interface Bubble {
  id: number;
  unitId: string;
  text: string;
  remaining: number;
}

export const MAX_BUBBLES = 4;

export interface BubbleScheduler {
  step(dtSeconds: number): readonly Bubble[];
}

export function createBubbleScheduler(sources: readonly BubbleSource[], rng: Rng): BubbleScheduler {
  let active: Bubble[] = [];
  let nextId = 1;
  let timer = range(rng, 0.5, 2);

  return {
    step(dt) {
      active = active.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0);
      timer -= dt;
      if (timer <= 0) {
        if (active.length < MAX_BUBBLES && sources.length) {
          const free = sources.filter((s) => !active.some((b) => b.unitId === s.id) && s.phrases.length > 0);
          const pool = free.length ? free : sources;
          const src = pool[Math.floor(rng() * pool.length)];
          const text = src?.phrases[Math.floor(rng() * src.phrases.length)];
          if (src && text !== undefined) {
            active.push({ id: nextId++, unitId: src.id, text, remaining: range(rng, 3, 4.9) });
          }
          timer = range(rng, 1, 5);
        } else {
          timer = 0.5;
        }
      }
      return active;
    },
  };
}
