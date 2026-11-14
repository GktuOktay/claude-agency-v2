// Staff NPCs (CEO-authorized expansion, KARARLAR rev 31): two cleaners, a tea server (çaycı) and two guards.
// Non-functional: not agency units, never pickable, no cards. Pure and seedable like src/scene/activity.ts,
// walking the src/sim/nav.ts graphs built from src/sim/layout.ts. No three.js.
import {
  COFFEE,
  COFFEE_SPOTS,
  FLOOR_COUNT,
  GUARD_POST,
  LOBBY_FLOOR,
  LOBBY_SPOTS,
  MOP_SPOTS,
  PATROL_ROUTE,
  STAFF_CORRIDOR_WEST_X,
  STAFF_LANDING,
  lobbyPropFootprints,
  type Aisle,
  type DeskPlace,
  type FloorLayout,
  type Spot,
  type StaffSpot,
  type XZ,
} from './layout';
import { buildFloorGraph, nearestNode, pointAlong, route, type FloorGraph } from './nav';
import { createRng, range, type Rng } from '../scene/rng';

export type StaffRole = 'cleaner' | 'tea' | 'guard-desk' | 'guard-patrol';
export type StaffState = 'walk' | 'idle' | 'mop' | 'serve' | 'refill' | 'guard' | 'fade-out' | 'fade-in';
type PauseState = 'idle' | 'mop' | 'serve' | 'refill' | 'guard';
type PhraseGroup = 'cleaner' | 'tea' | 'guard';

export const STAFF_IDS = ['staff:cleaner-1', 'staff:cleaner-2', 'staff:tea', 'staff:guard-desk', 'staff:guard-patrol'] as const;
export type StaffId = (typeof STAFF_IDS)[number];

/** Floor sets the two cleaners patrol (cyclic, through the east staff-shaft landing). */
export const CLEANER_FLOORS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 5],
];
/** Tulip glasses on the tray: the tea server refills after at most this many desks. */
export const TEA_CAPACITY = 4;
export const MAX_PHRASE_LENGTH = 48;
/** Max simulated step (s), as in activity.ts. */
export const MAX_STEP_S = 0.1;
/** Seconds for a landing fade-out and again for the fade-in (stand-in for the real elevator ride). */
export const FADE_S = 0.8;
const SPEED: Record<StaffRole, number> = { cleaner: 0.8, tea: 0.9, 'guard-desk': 0.9, 'guard-patrol': 0.9 };
/** Speech: per-person and global cool-downs keep the lines rare. */
const SPEECH_COOLDOWN_S = 30;
const SPEECH_GLOBAL_COOLDOWN_S = 6;
const MAX_QUEUED_EVENTS = 500;

/** Built-in Turkish lines (each at most MAX_PHRASE_LENGTH characters). */
export const STAFF_PHRASES: Readonly<Record<PhraseGroup, readonly string[]>> = {
  cleaner: ['Dikkat, zemin ıslak!', 'Kolay gelsin!', 'Burası pırıl pırıl oldu.', 'Az kaldı, bitiriyorum.', 'Islak zemine basmayın lütfen.'],
  tea: ['Çay ister misiniz?', 'Taze demlendi, buyurun.', 'Şekerli mi, şekersiz mi?', 'Çaylar geldi!', 'Bir çay daha koyayım mı?'],
  guard: ['Hoş geldiniz.', 'Kartınızı okutur musunuz?', 'Turnike açık, buyurun.', 'Her şey yolunda.', 'İyi çalışmalar.'],
};

export interface StaffView {
  id: StaffId;
  role: StaffRole;
  floor: number;
  x: number;
  z: number;
  /** Yaw: front is +z (as robots). */
  facing: number;
  state: StaffState;
  /** Seconds in the current state. */
  stateTime: number;
  /** Grows while walking (limb swing); 0 under reduced motion. */
  walkPhase: number;
  /** 0..1: landing fades. */
  opacity: number;
  /** The graph node the person stands on; null while walking. */
  node: string | null;
}

export type StaffEvent =
  | { type: 'speech'; staffId: StaffId; floor: number; text: string; time: number }
  | { type: 'serve'; staffId: StaffId; floor: number; owner: string; time: number }
  | { type: 'refill'; staffId: StaffId; floor: number; time: number }
  | { type: 'mop'; staffId: StaffId; floor: number; spot: string; time: number }
  | { type: 'floor'; staffId: StaffId; from: number; to: number; x: number; z: number; time: number };
export type SpeechEvent = Extract<StaffEvent, { type: 'speech' }>;

export interface StaffSim {
  readonly time: number;
  /** Advances by dt seconds (clamped to MAX_STEP_S). Does nothing in org mode. */
  step(dtSeconds: number): void;
  snapshot(): StaffView[];
  /** Org mode: everyone freezes in place, no events. */
  setOrg(on: boolean): void;
  /** Reduced motion: walks cut to their end, fades are instant, no walk phase. */
  setReducedMotion(on: boolean): void;
  drainEvents(): StaffEvent[];
  /** Speech lines as they happen, for the bubble scheduler; returns an unsubscribe function. */
  onSpeech(listener: (e: SpeechEvent) => void): () => void;
}

// ---------------------------------------------------------------- staff graph

const toSpot = (s: StaffSpot): Spot => ({ id: s.id, kind: 'home', via: s.via, x: s.x, z: s.z });

/**
 * The floor layout as staff see it: the robot layout plus the mop spots, the west corridor, and on floor 0
 * the lobby path and the security desk and turnstile footprints. The robot layout is not modified.
 */
export function staffLayout(layout: FloorLayout): FloorLayout {
  const lobby = layout.floor === LOBBY_FLOOR;
  const aisles: Aisle[] = layout.aisles.map((a) => (a.id === 'corridor' ? { ...a, a: { x: Math.min(a.a.x, STAFF_CORRIDOR_WEST_X), z: a.a.z } } : a));
  return {
    ...layout,
    aisles,
    spots: [...layout.spots, ...MOP_SPOTS.map(toSpot), ...(lobby ? LOBBY_SPOTS.map(toSpot) : [])],
    footprints: lobby ? [...layout.footprints, ...lobbyPropFootprints()] : layout.footprints,
  };
}

export function staffGraphs(layouts: readonly FloorLayout[]): FloorGraph[] {
  return layouts.map((l) => buildFloorGraph(staffLayout(l)));
}

// ---------------------------------------------------------------- simulation

type Action =
  | { kind: 'walk'; to: string }
  | { kind: 'pause'; state: PauseState; duration: number; facing?: number; speech?: { group: PhraseGroup; chance: number }; event?: 'serve' | 'refill' | 'mop'; owner?: string }
  | { kind: 'floor'; to: number };

interface Walk {
  points: XZ[];
  length: number;
  s: number;
  to: string;
}

interface Person {
  id: StaffId;
  role: StaffRole;
  floor: number;
  pos: XZ;
  facing: number;
  node: string;
  state: StaffState;
  stateTime: number;
  walkPhase: number;
  opacity: number;
  queue: Action[];
  current: Action | null;
  walk: Walk | null;
  pauseLeft: number;
  fadeTo: number;
  lastSpeech: number;
  plan: () => Action[];
}

const yawToward = (from: XZ, to: XZ): number => Math.atan2(to.x - from.x, to.z - from.z);

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/** The spot in front of a desk where the tea server stands: the desk's second hand-over (or signing) spot. */
function deskVisitSpot(layout: FloorLayout, d: DeskPlace): string | null {
  const h = d.handover[1];
  if (!h) return null;
  const s = layout.spots.find((p) => (p.kind === 'handover' || p.kind === 'signing') && Math.abs(p.x - h.x) < 1e-9 && Math.abs(p.z - h.z) < 1e-9);
  return s?.id ?? null;
}

export function createStaffSim(layouts: readonly FloorLayout[], seed: number): StaffSim {
  const rng = createRng(seed ^ 0x5a17f);
  const graphs = staffGraphs(layouts);
  const events: StaffEvent[] = [];
  const listeners = new Set<(e: SpeechEvent) => void>();
  const routes = new Map<string, { points: XZ[]; length: number }>();
  let time = 0;
  let org = false;
  let reduced = false;
  let lastAnySpeech = -Infinity;

  const graph = (floor: number): FloorGraph => {
    const g = graphs[floor];
    if (!g) throw new Error(`no staff graph for floor ${floor}`);
    return g;
  };
  const nodePos = (floor: number, id: string): XZ => {
    const n = graph(floor).nodes.get(id);
    if (!n) throw new Error(`no node ${id} on floor ${floor}`);
    return { x: n.x, z: n.z };
  };
  const landing = (floor: number): string => nearestNode(graph(floor), STAFF_LANDING.entry) ?? '';
  const refillSpot = `coffee:${COFFEE_SPOTS.length - 1}`;
  const routeOf = (floor: number, from: string, to: string): { points: XZ[]; length: number } => {
    const k = `${floor}|${from}|${to}`;
    let r = routes.get(k);
    if (!r) {
      const found = route(graph(floor), from, to);
      r = found ? { points: found.points, length: found.length } : { points: [nodePos(floor, to)], length: 0 };
      routes.set(k, r);
    }
    return r;
  };

  const emit = (e: StaffEvent): void => {
    events.push(e);
    if (events.length > MAX_QUEUED_EVENTS) events.splice(0, events.length - MAX_QUEUED_EVENTS);
    if (e.type === 'speech') for (const l of listeners) l(e);
  };

  // ---- planners (one per role); each returns the next batch of actions ----

  const cleanerPlan = (p: Person, floors: readonly number[]) => (): Action[] => {
    const spots = shuffle(rng, MOP_SPOTS.map((s) => s.id)).slice(0, 2);
    const out: Action[] = [];
    for (const s of spots) {
      out.push({ kind: 'walk', to: s });
      out.push({ kind: 'pause', state: 'mop', duration: range(rng, 6, 10), facing: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, event: 'mop', speech: { group: 'cleaner', chance: 0.3 } });
    }
    const i = floors.indexOf(p.floor);
    const next = floors[(i + 1) % floors.length] ?? p.floor;
    out.push({ kind: 'walk', to: landing(p.floor) });
    out.push({ kind: 'floor', to: next });
    return out;
  };

  const deskFloors = layouts.filter((l) => l.desks.length > 0).map((l) => l.floor);
  const teaPlan = (p: Person) => (): Action[] => {
    const layout = layouts[p.floor];
    const out: Action[] = [];
    const refillAt = nodePos(p.floor, refillSpot);
    const refill = (): void => {
      out.push({ kind: 'walk', to: refillSpot });
      out.push({ kind: 'pause', state: 'refill', duration: range(rng, 4, 6), facing: yawToward(refillAt, COFFEE), event: 'refill' });
    };
    const visits = layout
      ? layout.desks.flatMap((d) => {
          const s = deskVisitSpot(layout, d);
          return s ? [{ spot: s, owner: d.owner, desk: { x: d.x, z: d.z } }] : [];
        })
      : [];
    visits.forEach((v, i) => {
      if (i % TEA_CAPACITY === 0) refill();
      out.push({ kind: 'walk', to: v.spot });
      out.push({ kind: 'pause', state: 'serve', duration: range(rng, 2.5, 4), facing: yawToward(nodePos(p.floor, v.spot), v.desk), event: 'serve', owner: v.owner, speech: { group: 'tea', chance: 0.35 } });
    });
    const i = deskFloors.indexOf(p.floor);
    const next = deskFloors[(i + 1) % Math.max(1, deskFloors.length)] ?? p.floor;
    if (next !== p.floor) {
      out.push({ kind: 'walk', to: landing(p.floor) });
      out.push({ kind: 'floor', to: next });
    } else if (out.length === 0) {
      out.push({ kind: 'pause', state: 'idle', duration: 5 });
    }
    return out;
  };

  const guardDeskPlan = () => (): Action[] => [
    { kind: 'pause', state: 'guard', duration: range(rng, 5, 10), facing: [0, 0.6, -0.6, 1.1][Math.floor(rng() * 4)] ?? 0, speech: { group: 'guard', chance: 0.15 } },
  ];

  const patrolPlan = () => (): Action[] =>
    PATROL_ROUTE.flatMap((id): Action[] => [
      { kind: 'walk', to: id },
      { kind: 'pause', state: 'guard', duration: range(rng, 3, 6), ...(id === 'staff:entrance' ? { facing: 0 } : {}), speech: { group: 'guard', chance: 0.1 } },
    ]);

  // ---- cast ----

  const people: Person[] = [];
  const person = (id: StaffId, role: StaffRole, floor: number, node: string, facing: number): Person => {
    const p: Person = { id, role, floor, pos: nodePos(floor, node), facing, node, state: 'idle', stateTime: 0, walkPhase: 0, opacity: 1, queue: [], current: null, walk: null, pauseLeft: 0, fadeTo: floor, lastSpeech: -Infinity, plan: () => [] };
    people.push(p);
    return p;
  };
  CLEANER_FLOORS.forEach((floors, i) => {
    const floor = floors[Math.floor(rng() * floors.length)] ?? 0;
    const mop = MOP_SPOTS[Math.floor(rng() * MOP_SPOTS.length)]?.id ?? '';
    const p = person(i === 0 ? 'staff:cleaner-1' : 'staff:cleaner-2', 'cleaner', floor, mop, Math.PI / 2);
    p.plan = cleanerPlan(p, floors);
  });
  const teaFloor = deskFloors[Math.floor(rng() * deskFloors.length)] ?? 0;
  const tea = person('staff:tea', 'tea', teaFloor, refillSpot, 0);
  tea.plan = teaPlan(tea);
  person('staff:guard-desk', 'guard-desk', LOBBY_FLOOR, GUARD_POST.id, GUARD_POST.facing).plan = guardDeskPlan();
  person('staff:guard-patrol', 'guard-patrol', LOBBY_FLOOR, 'staff:entrance', 0).plan = patrolPlan();

  // ---- action engine ----

  const setState = (p: Person, s: StaffState): void => {
    p.state = s;
    p.stateTime = 0;
  };

  const finishWalk = (p: Person, w: Walk): void => {
    const end = w.points[w.points.length - 1] ?? p.pos;
    const before = w.points[w.points.length - 2];
    if (before && Math.hypot(end.x - before.x, end.z - before.z) > 1e-9) p.facing = yawToward(before, end);
    p.pos = { x: end.x, z: end.z };
    p.node = w.to;
    p.walk = null;
    p.current = null;
  };

  const switchFloor = (p: Person, to: number): void => {
    const from = p.floor;
    p.floor = to;
    p.node = landing(to);
    p.pos = nodePos(to, p.node);
    emit({ type: 'floor', staffId: p.id, from, to, x: p.pos.x, z: p.pos.z, time });
  };

  const say = (p: Person, s: { group: PhraseGroup; chance: number }): void => {
    if (time - p.lastSpeech < SPEECH_COOLDOWN_S || time - lastAnySpeech < SPEECH_GLOBAL_COOLDOWN_S) return;
    if (rng() >= s.chance) return;
    const lines = STAFF_PHRASES[s.group];
    const text = lines[Math.floor(rng() * lines.length)];
    if (text === undefined) return;
    p.lastSpeech = time;
    lastAnySpeech = time;
    emit({ type: 'speech', staffId: p.id, floor: p.floor, text, time });
  };

  const start = (p: Person, a: Action): void => {
    p.current = a;
    if (a.kind === 'walk') {
      const r = routeOf(p.floor, p.node, a.to);
      p.walk = { points: r.points, length: r.length, s: 0, to: a.to };
      if (reduced || r.length < 1e-9) {
        finishWalk(p, p.walk);
        return;
      }
      setState(p, 'walk');
    } else if (a.kind === 'pause') {
      setState(p, a.state);
      p.pauseLeft = a.duration;
      if (a.facing !== undefined) p.facing = a.facing;
      if (a.event === 'serve') emit({ type: 'serve', staffId: p.id, floor: p.floor, owner: a.owner ?? '', time });
      else if (a.event === 'refill') emit({ type: 'refill', staffId: p.id, floor: p.floor, time });
      else if (a.event === 'mop') emit({ type: 'mop', staffId: p.id, floor: p.floor, spot: p.node, time });
      if (a.speech) say(p, a.speech);
    } else {
      p.fadeTo = a.to;
      if (reduced) {
        switchFloor(p, a.to);
        p.current = null;
        return;
      }
      setState(p, 'fade-out');
    }
  };

  const advance = (p: Person, dt: number): void => {
    let budget = dt;
    for (let guard = 0; guard < 12; guard++) {
      if (!p.current) {
        if (p.queue.length === 0) p.queue = p.plan();
        const next = p.queue.shift();
        if (!next) return;
        start(p, next);
        continue; // instant actions (cuts) chain; timed ones consume the budget below
      }
      if (budget <= 0) return;
      const a = p.current;
      p.stateTime += budget;
      if (a.kind === 'walk' && p.walk) {
        const w = p.walk;
        w.s += SPEED[p.role] * budget;
        p.walkPhase += budget * 6;
        if (w.s >= w.length) {
          finishWalk(p, w);
        } else {
          const at = pointAlong(w.points, w.s);
          if (Math.hypot(at.x - p.pos.x, at.z - p.pos.z) > 1e-9) p.facing = yawToward(p.pos, at);
          p.pos = at;
        }
        budget = 0;
      } else if (a.kind === 'pause') {
        p.pauseLeft -= budget;
        budget = 0;
        if (p.pauseLeft <= 0) p.current = null;
      } else if (a.kind === 'floor') {
        if (p.state === 'fade-out') {
          p.opacity = Math.max(0, 1 - p.stateTime / FADE_S);
          if (p.stateTime >= FADE_S) {
            switchFloor(p, a.to);
            setState(p, 'fade-in');
            p.opacity = 0;
          }
        } else {
          p.opacity = Math.min(1, p.stateTime / FADE_S);
          if (p.stateTime >= FADE_S) {
            p.opacity = 1;
            p.current = null;
          }
        }
        budget = 0;
      } else {
        p.current = null;
      }
    }
  };

  const settle = (p: Person): void => {
    // Reduced motion switched on: cut a walk to its end, finish a fade, drop the walk phase.
    const a = p.current;
    if (a?.kind === 'walk' && p.walk) finishWalk(p, p.walk);
    else if (a?.kind === 'floor') {
      if (p.state === 'fade-out') switchFloor(p, a.to);
      p.current = null;
    }
    p.opacity = 1;
    p.walkPhase = 0;
    if (p.state === 'walk' || p.state === 'fade-in' || p.state === 'fade-out') setState(p, 'idle');
    advance(p, 0);
  };

  for (const p of people) advance(p, 0);

  return {
    get time() {
      return time;
    },
    step(dtSeconds) {
      if (org) return;
      const dt = Math.min(Math.max(dtSeconds, 0), MAX_STEP_S);
      if (dt <= 0) return;
      time += dt;
      for (const p of people) advance(p, dt);
    },
    snapshot() {
      return people.map((p) => ({
        id: p.id,
        role: p.role,
        floor: p.floor,
        x: p.pos.x,
        z: p.pos.z,
        facing: p.facing,
        state: p.state,
        stateTime: p.stateTime,
        walkPhase: p.walkPhase,
        opacity: p.opacity,
        node: p.state === 'walk' ? null : p.node,
      }));
    },
    setOrg(on) {
      org = on;
    },
    setReducedMotion(on) {
      if (on === reduced) return;
      reduced = on;
      if (on) for (const p of people) settle(p);
    },
    drainEvents() {
      return events.splice(0, events.length);
    },
    onSpeech(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Floors that have staff graphs (all of them); handy for wiring checks. */
export const STAFF_FLOORS: readonly number[] = Array.from({ length: FLOOR_COUNT }, (_, f) => f);
