// Object activities (KARARLAR Rev 43 B): robots visibly do things with objects where they are. Coffee bar
// (queue at the machine, pour, sip, walk back drinking, drop the cup at home; a tea glass from the tea server),
// gym (on the treadmill belt, dumbbells, mat stretch), office (lab stand-up at the whiteboard with a writer,
// phone calls with pacing, desk stretches), social (face-to-face chat, food tray to the cafeteria table).
//
// A pure render overlay: it reads the ambient views (src/scene/activity.ts) and returns a pose, a small render
// offset and the hand props per robot. It never feeds back into the ambient sim, the nav movement or the
// workflow engine, so every trace stays unchanged. Time is the ambient sim clock (frozen while paused);
// choices are hashed from the robot id and the sim time (deterministic, no RNG stream consumed). Reduced
// motion: no limb time, no walk phase, no pacing; offsets snap; props and static poses stay. No three.js.
import type { ActivityView, BreakPhase, Point, PoseKind } from './activity';
import { WALK_SPEED } from './activity';
import { AMENITY_SPOTS, COFFEE, LAB_STATIONS, wingX, type AmenitySpot } from '../sim/layout';

export type HandProp = 'cup' | 'dumbbell' | 'tray' | 'phone' | 'marker';

export interface ActionRobot {
  id: string;
  home: Point;
  coffee: Point;
}

export interface ActionInput {
  id: string;
  /** A workflow step, a reservation or the selection gesture owns the robot: no action. */
  busy: boolean;
  /** The ambient view (`ActivitySim.get`). */
  view: ActivityView;
  /** Campus break spot and phase (`onBreak`, `breakPhase`), else null. */
  spot: AmenitySpot | null;
  phase: BreakPhase | null;
}

export interface RobotAction {
  pose: PoseKind;
  /** Render offset from the view position (machine, stand-up circle, pacing, treadmill belt). */
  dx: number;
  dy: number;
  dz: number;
  facing: number;
  walkPhase: number;
  /** Limb time for `applyPose` (sim clock based; 0 under reduced motion). */
  timeSec: number;
  /** `dumbbell` means one in each hand; `tray` is held in both hands. */
  props: readonly HandProp[];
}

export interface ActionLayer {
  /** One frame: `simTime` is the ambient sim clock; call it every frame (a paused clock repeats the time). */
  update(simTime: number, inputs: readonly ActionInput[], reduced: boolean): void;
  /** The robot's action this frame, or null: render it as before. */
  get(id: string): RobotAction | null;
  /** The tea server handed a glass to `owner` (staff `serve` event); kept only if it is at its desk. */
  serve(owner: string): void;
}

/** Coffee machine on the station island (src/scene/furniture.ts coffeeIsland: machine at x +0.45). */
export const MACHINE_AT = { x: COFFEE.x + 0.45, z: COFFEE.z } as const;
/** Where the robot stands to pour, in front of the counter. */
export const MACHINE_FRONT = { x: MACHINE_AT.x, z: COFFEE.z + 0.5 } as const;
/** Pouring a cup takes this long at the machine, sim seconds. */
export const POUR_S = 2.5;
/** A tea glass from the tea server lasts this long at the desk. */
export const TEA_S = 20;
/** Treadmill belt top above the floor (src/scene/amenities.ts level1: deck 0.1 + belt 0.012). */
export const BELT_TOP = 0.112;
/** Two idle robots this close at home face each other and chat. */
export const CHAT_RANGE = 1.6;
/** Lab whiteboard wall face (src/scene/amenities.ts: board at wing x -0.193, centred at z -4.175). */
export const BOARD_AT = { x: wingX(-0.19), z: -4.175 } as const;
/** The stand-up writer stands here, facing the board. */
export const WRITER_AT = { x: wingX(0.3), z: -4.175 } as const;
/** The other stand-up members stand on this radius around the board, at these angles (from +x). */
export const HUDDLE_RADIUS = 1.1;
const HUDDLE_ANGLES = [-0.6, 0.6, -1.05, 1.05] as const;
/** Phone call: in windows of PHONE_WINDOW_S a robot at home or walking takes a call of PHONE_S with this chance. */
export const PHONE_WINDOW_S = 45;
export const PHONE_S = 14;
export const PHONE_CHANCE = 0.3;
const PACE = 0.3;
/** Desk stretch: in windows of STRETCH_WINDOW_S a working robot stretches for STRETCH_S with this chance. */
export const STRETCH_WINDOW_S = 14;
export const STRETCH_S = 2.4;
export const STRETCH_CHANCE = 0.45;
/** A mat set (stretch or dumbbells) lasts this long. */
export const MAT_SET_S = 20;
/** Robots gliding to an action spot walk at the ambient speed. */
const GLIDE_SPEED = WALK_SPEED;
const MAX_DT = 0.25;

const WALL_SPOTS: readonly AmenitySpot[] = AMENITY_SPOTS.filter((s) => LAB_STATIONS.get(s.id) === 'wall');
const WALL_INDEX = new Map(WALL_SPOTS.map((s, i) => [s.id, i]));

const NONE: readonly HandProp[] = [];
const CUP: readonly HandProp[] = ['cup'];
const DUMBBELL: readonly HandProp[] = ['dumbbell'];
const TRAY: readonly HandProp[] = ['tray'];
const PHONE: readonly HandProp[] = ['phone'];
const MARKER: readonly HandProp[] = ['marker'];

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
/** Uniform [0, 1) from two integers (integer hash, no state). */
function h01(a: number, b: number): number {
  let x = (a ^ Math.imul((b + 0x9e3779b9) | 0, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

interface State {
  hash: number;
  /** Phase offset of the robot's windows and limb time, seconds-scale fraction. */
  frac: number;
  home: Point;
  coffee: Point;
  ox: number;
  oz: number;
  glideWalk: number;
  glideFacing: number;
  cup: boolean;
  /** This coffee stay: reached the machine at (null: not yet) / poured. */
  pourAt: number | null;
  poured: boolean;
  tea: number;
  lastKind: string;
  out: RobotAction | null;
}

const near = (a: { x: number; z: number }, b: { x: number; z: number }, eps: number): boolean => Math.hypot(a.x - b.x, a.z - b.z) < eps;
const yaw = (fx: number, fz: number, tx: number, tz: number): number => Math.atan2(tx - fx, tz - fz);

export function createActionLayer(robots: readonly ActionRobot[]): ActionLayer {
  const st = new Map<string, State>();
  for (const r of robots) {
    const hash = fnv(r.id);
    st.set(r.id, { hash, frac: h01(hash, 7), home: r.home, coffee: r.coffee, ox: 0, oz: 0, glideWalk: 0, glideFacing: 0, cup: false, pourAt: null, poured: false, tea: -Infinity, lastKind: '', out: null });
  }
  /** Coffee machine holder per floor (key: rounded floor height). */
  const holder = new Map<number, string>();
  let last: number | null = null;
  let now = 0;

  const windowOn = (s: State, t: number, w: number, dur: number, chance: number, salt: number): number => {
    const x = t + s.frac * w;
    const k = Math.floor(x / w);
    const into = x - k * w;
    return into < dur && h01(s.hash ^ salt, k) < chance ? into : -1;
  };

  function update(simTime: number, inputs: readonly ActionInput[], reduced: boolean): void {
    const dt = last === null ? 0 : Math.min(Math.max(simTime - last, 0), MAX_DT);
    last = simTime;
    now = simTime;
    const floorKey = (v: ActivityView): number => Math.round(v.y * 100);

    // ---- coffee stations: who waits for the machine (no cup yet), per floor
    const atStation = (i: ActionInput, s: State): boolean => !i.busy && !i.spot && i.view.kind === 'coffee' && near(i.view, s.coffee, 0.05);
    const waiting = new Map<number, ActionInput[]>();
    for (const i of inputs) {
      const s = st.get(i.id);
      if (!s) continue;
      if (!atStation(i, s)) {
        s.pourAt = null;
        s.poured = false;
      } else if (!s.poured) {
        const k = floorKey(i.view);
        waiting.set(k, [...(waiting.get(k) ?? []), i]);
      }
    }
    for (const k of [...holder.keys()]) if (!(waiting.get(k) ?? []).some((i) => i.id === holder.get(k))) holder.delete(k);
    for (const [k, list] of waiting) {
      if (holder.has(k)) continue;
      // First come, first served: the longest stay at the station takes the machine (ties: id order).
      const first = [...list].sort((a, b) => b.view.elapsed - a.view.elapsed || (a.id < b.id ? -1 : 1))[0];
      if (first) holder.set(k, first.id);
    }

    // ---- stand-up at the lab whiteboard: the occupant of the lowest wall spot writes, the rest form a circle
    const wall = inputs
      .filter((i) => !i.busy && i.phase === 'stay' && i.spot && WALL_INDEX.has(i.spot.id))
      .sort((a, b) => (WALL_INDEX.get(a.spot?.id ?? '') ?? 0) - (WALL_INDEX.get(b.spot?.id ?? '') ?? 0));
    const huddleRole = new Map<string, number>(wall.map((i, n) => [i.id, n]));

    // ---- phone calls and chat pairs among robots idle at home
    const phoneInto = new Map<string, number>();
    const idleHome: ActionInput[] = [];
    for (const i of inputs) {
      const s = st.get(i.id);
      if (!s || i.busy || i.spot || s.cup) continue;
      const k = i.view.kind;
      if (k !== 'idle' && k !== 'walk') continue;
      const into = windowOn(s, simTime, PHONE_WINDOW_S, PHONE_S, PHONE_CHANCE, 0x9d0e);
      if (into >= 0) phoneInto.set(i.id, into);
      else if (k === 'idle' && near(i.view, s.home, 0.05)) idleHome.push(i);
    }
    const partner = new Map<string, ActionInput>();
    idleHome.sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const a of idleHome) {
      if (partner.has(a.id)) continue;
      let best: ActionInput | null = null;
      let bd = CHAT_RANGE;
      for (const b of idleHome) {
        if (b === a || partner.has(b.id) || Math.abs(b.view.y - a.view.y) > 0.01) continue;
        const d = Math.hypot(b.view.x - a.view.x, b.view.z - a.view.z);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) {
        partner.set(a.id, best);
        partner.set(best.id, a);
      }
    }
    // Cup holders at one station chat with the nearest other cup holder there.
    const cupMates = new Map<number, ActionInput[]>();

    for (const i of inputs) {
      const s = st.get(i.id);
      if (!s) continue;
      if (i.busy) {
        s.ox = 0;
        s.oz = 0;
        s.cup = false;
        s.tea = -Infinity;
        s.out = null;
        s.lastKind = '';
        continue;
      }
      const v = i.view;
      s.lastKind = v.kind;
      const base: PoseKind = v.pose ?? v.kind;
      let pose: PoseKind | null = null;
      let props: readonly HandProp[] = NONE;
      let facing = v.facing;
      let tx = 0;
      let tz = 0;
      let dy = 0;
      let carry: 'cup' | 'tray' | 'phone' | null = null;
      const walking = base === 'walk';
      if (s.tea < simTime && s.tea !== -Infinity) s.tea = -Infinity;

      if (i.spot) {
        const sp = i.spot;
        if (i.phase === 'stay') {
          s.cup = false;
          switch (sp.kind) {
            case 'treadmill':
              pose = base;
              dy = BELT_TOP;
              break;
            case 'weights':
              pose = base;
              props = DUMBBELL;
              break;
            case 'mat':
              // Mat sets alternate: a stretch, or dumbbell work on the mat.
              if (windowOn(s, simTime, MAT_SET_S, MAT_SET_S, 0.5, 0x3a7) >= 0) {
                pose = 'lift';
                props = DUMBBELL;
              } else pose = 'stretch';
              break;
            case 'snack':
              pose = base;
              props = CUP;
              s.cup = true;
              break;
            case 'serving':
              pose = 'tray-stand';
              props = TRAY;
              break;
            default:
              // Seated deep work (lab workstations, bench, device lab): the occasional stretch too.
              if (base === 'work' && windowOn(s, simTime, STRETCH_WINDOW_S, STRETCH_S, STRETCH_CHANCE, 0x57e7) >= 0) pose = 'arms-up';
              break;
          }
          const role = huddleRole.get(i.id);
          if (role !== undefined) {
            if (role === 0) {
              tx = WRITER_AT.x - v.x;
              tz = WRITER_AT.z - v.z;
              pose = 'write';
              props = MARKER;
              facing = yaw(WRITER_AT.x, WRITER_AT.z, BOARD_AT.x, BOARD_AT.z);
            } else {
              const a = HUDDLE_ANGLES[(role - 1) % HUDDLE_ANGLES.length] ?? 0;
              const px = BOARD_AT.x + Math.cos(a) * HUDDLE_RADIUS;
              const pz = BOARD_AT.z + Math.sin(a) * HUDDLE_RADIUS;
              tx = px - v.x;
              tz = pz - v.z;
              pose = 'chat';
              facing = yaw(px, pz, BOARD_AT.x, BOARD_AT.z);
            }
          }
        } else if (i.phase === 'go' && (sp.kind === 'dining' || sp.kind === 'terrace')) {
          s.cup = false;
          props = TRAY;
          pose = walking ? 'tray-walk' : 'tray-stand';
          carry = 'tray';
        } else if (i.phase === 'back' && s.cup) {
          props = CUP;
          pose = walking ? 'cup-walk' : 'cup-stand';
          carry = 'cup';
        }
      } else if (atStation(i, s)) {
        const k = floorKey(v);
        if (!s.poured && holder.get(k) === i.id) {
          tx = MACHINE_FRONT.x - v.x;
          tz = MACHINE_FRONT.z - v.z;
          facing = yaw(MACHINE_FRONT.x, MACHINE_FRONT.z, MACHINE_AT.x, MACHINE_AT.z);
          if (Math.hypot(tx - s.ox, tz - s.oz) < 0.01 || reduced) {
            if (s.pourAt === null) s.pourAt = simTime;
            pose = 'pour';
            if (simTime - s.pourAt >= POUR_S) {
              s.poured = true;
              s.cup = true;
              holder.delete(k);
            }
          }
        } else if (!s.poured) {
          pose = 'idle';
          facing = yaw(v.x, v.z, MACHINE_AT.x, MACHINE_AT.z);
        }
        if (s.poured) {
          props = CUP;
          pose = 'sip';
          carry = 'cup';
          const list = cupMates.get(k) ?? [];
          list.push(i);
          cupMates.set(k, list);
        }
      } else if (v.kind === 'work') {
        s.cup = false;
        if (s.tea >= simTime) {
          pose = 'work-sip';
          props = CUP;
        } else if (windowOn(s, simTime, STRETCH_WINDOW_S, STRETCH_S, STRETCH_CHANCE, 0x57e7) >= 0) pose = 'arms-up';
      } else {
        // Ambient idle or walk (reduced motion reports a walker as idle at its leg start).
        if (s.cup && near(v, s.home, 0.05) && v.kind !== 'walk') s.cup = false; // home: the cup goes down
        if (s.cup) {
          props = CUP;
          pose = v.kind === 'walk' ? 'cup-walk' : 'cup-stand';
          carry = 'cup';
        } else {
          const into = phoneInto.get(i.id);
          if (into !== undefined) {
            props = PHONE;
            carry = 'phone';
            pose = v.kind === 'walk' ? 'phone-walk' : 'phone-stand';
            if (v.kind === 'idle' && near(v, s.home, 0.05) && !reduced) {
              // Pacing along the desk row (x), a slow back and forth.
              tx = Math.sin(into * 0.55) * PACE;
            }
          } else {
            const p = partner.get(i.id);
            if (p) {
              pose = 'chat';
              facing = yaw(v.x, v.z, p.view.x, p.view.z);
            }
          }
        }
      }

      // Glide the render offset toward its target (snap under reduced motion).
      let moving = false;
      if (reduced) {
        s.ox = tx;
        s.oz = tz;
      } else {
        const rx = tx - s.ox;
        const rz = tz - s.oz;
        const rem = Math.hypot(rx, rz);
        const step = GLIDE_SPEED * dt;
        if (rem > 1e-4) {
          s.glideFacing = Math.atan2(rx, rz);
          if (step >= rem) {
            s.ox = tx;
            s.oz = tz;
          } else {
            s.ox += (rx / rem) * step;
            s.oz += (rz / rem) * step;
          }
          s.glideWalk += dt * 6;
        }
        moving = Math.hypot(tx - s.ox, tz - s.oz) > 0.01;
      }
      if (moving && !walking) {
        pose = carry === 'cup' ? 'cup-walk' : carry === 'tray' ? 'tray-walk' : carry === 'phone' ? 'phone-walk' : 'walk';
        facing = s.glideFacing;
      }
      const offset = Math.abs(s.ox) > 1e-6 || Math.abs(s.oz) > 1e-6 || dy !== 0;
      if (pose === null && !offset) {
        s.out = null;
        continue;
      }
      const glideWalk = moving && !walking;
      s.out = {
        pose: pose ?? base,
        dx: s.ox,
        dy,
        dz: s.oz,
        facing,
        walkPhase: reduced ? 0 : glideWalk ? s.glideWalk : v.walkPhase,
        timeSec: reduced ? 0 : simTime + s.frac * 10,
        props,
      };
    }

    // Station chat: cup holders pair with the nearest other cup holder there; turns between a sip and a word.
    for (const list of cupMates.values()) {
      if (list.length < 2) continue;
      for (const a of list) {
        const s = st.get(a.id);
        const o = s?.out;
        if (!s || !o || o.pose !== 'sip') continue;
        let best: ActionInput | null = null;
        let bd = CHAT_RANGE;
        for (const b of list) {
          if (b === a) continue;
          const d = Math.hypot(b.view.x - a.view.x, b.view.z - a.view.z);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
        if (!best) continue;
        o.facing = yaw(a.view.x, a.view.z, best.view.x, best.view.z);
        if ((Math.floor(simTime / 3) + (s.hash & 1)) % 2 === 0) o.pose = 'chat';
      }
    }
  }

  return {
    update,
    get: (id) => st.get(id)?.out ?? null,
    serve(owner) {
      const s = st.get(owner);
      if (s && s.lastKind === 'work') s.tea = now + TEA_S;
    },
  };
}
