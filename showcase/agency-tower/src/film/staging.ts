// Film staging (KARARLAR Rev 46, `?film=1` only): "4 kişi kodluyor diyorsun ama odada 2 kişi var ... ceo geldiğinde
// bir ağırlık olmalı". Pure data and one pure function, read by the activity sim's `stage` hook and the room life:
// - scene 1: the CEO waits for the staff elevator in the lobby; the welcome group (Chief of Staff, Ürün Yöneticisi,
//   Teslimat Yöneticisi) gathers in a loose arc on the penthouse landing, facing the elevator door; two penthouse
//   staff (assistant, tea tray) stand with them. The film job starts with scene 2, so the CEO rides up to them.
// - scenes 1–3: the welcome group holds there (the Chief of Staff leaves for the intake), then disperses.
// - the whole film: every other robot keeps to its own floor (no campus break; the wing scenes show the room life). So
//   the four builders build in one room, and no wing traffic jams the corridors (Ruling, Rev 46 report);
//   four extra engineering staff stand at the desks (room life) to keep the room busy.
import type { StageOrder } from '../scene/activity';
import { PENTHOUSE, STAFF_LANDING, type XZ } from '../sim/layout';
import type { LifeAnchor } from '../sim/roomLifeSim';

export const FILM_BUILDERS = ['dotnet-engineer', 'react-engineer', 'polyglot-engineer', 'devops-sre'] as const;
export const WELCOME_GROUP = ['chief-of-staff', 'product-manager', 'delivery-manager'] as const;
/** Engineering floor and its work room (north of the corridor partition, floors 0–4 layout). */
export const ENGINEERING_FLOOR = 1;
export const ENGINEERING_ROOM = { x0: -8, x1: 8, z0: -5.5, z1: -1.6 } as const;

/** Where the CEO steps out of the cabin on the penthouse (the welcome group faces it). */
export const ELEVATOR_DOOR: XZ = STAFF_LANDING.entry;
const yawToward = (from: XZ, to: XZ): number => Math.atan2(to.x - from.x, to.z - from.z);

/** Penthouse nav spots of the welcome arc (coffee-station spots next to the landing) and their xz. */
const ARC: Readonly<Record<(typeof WELCOME_GROUP)[number], { spot: string; at: XZ }>> = {
  'chief-of-staff': { spot: 'coffee:4', at: { x: 5.1, z: -2.25 } },
  'product-manager': { spot: 'coffee:5', at: { x: 6.1, z: -2.25 } },
  'delivery-manager': { spot: 'coffee:2', at: { x: 6.6, z: -2.8 } },
};

const STAY: StageOrder = { kind: 'stay' };

/** The film's staging order for a free robot in scene `scene` (1-based; before the start counts as scene 1). */
export function filmStage(scene: number, id: string): StageOrder | null {
  const n = Math.max(1, scene);
  if (id === 'ceo') return n === 1 ? { kind: 'spot', target: { floor: 0, spot: 'landing' }, facing: Math.PI / 2 } : STAY;
  const arc = ARC[id as keyof typeof ARC];
  if (arc) return n <= 3 ? { kind: 'spot', target: { floor: PENTHOUSE, spot: arc.spot }, facing: yawToward(arc.at, ELEVATOR_DOOR) } : STAY;
  // Everyone else (the four builders included) keeps to its own floor: no wing trips during the film.
  return STAY;
}

const life = (id: string, room: 'engineering' | 'penthouse', floor: number, x: number, z: number, facing: number, activity: LifeAnchor['activity'], held: LifeAnchor['held'], outfit: LifeAnchor['outfit']): LifeAnchor => ({
  id: `life:film-${id}`,
  room,
  floor,
  x,
  z,
  facing,
  activity,
  posture: 'stand',
  seat: 0,
  profile: 'staff',
  group: `film-${id}`,
  wander: 0,
  held,
  outfit,
});

const S = 0;
const E = Math.PI / 2;
const W = -Math.PI / 2;

/** Film-only room life: the extra engineering staff and the penthouse welcome staff (assistant, tea tray). */
export const FILM_LIFE_ANCHORS: readonly LifeAnchor[] = [
  life('eng-a', 'engineering', ENGINEERING_FLOOR, -4.4, -4.65, S, 'discuss', ['tablet'], 'office'),
  life('eng-b', 'engineering', ENGINEERING_FLOOR, -0.4, -4.65, S, 'talk', ['cup'], 'smart'),
  life('eng-c', 'engineering', ENGINEERING_FLOOR, 2.3, -4.3, W, 'discuss', [], 'office'),
  life('eng-d', 'engineering', ENGINEERING_FLOOR, -7.0, -4.1, E, 'devices', ['tablet'], 'office'),
  life('assistant', 'penthouse', PENTHOUSE, 3.55, -2.35, yawToward({ x: 3.55, z: -2.35 }, ELEVATOR_DOOR), 'visit', ['tablet'], 'smart'),
  life('tea', 'penthouse', PENTHOUSE, 3.4, -1.45, yawToward({ x: 3.4, z: -1.45 }, ELEVATOR_DOOR), 'coffee', ['cup'], 'chef'),
];
