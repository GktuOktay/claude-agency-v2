// Campus break choices (KARARLAR rev 31): which amenity a free robot visits on a break, how long it stays
// and which pose it shows there. Pure and seedable; activity.ts runs the walk through the nav movement.
import { AMENITY_SPOTS, type AmenityKind, type AmenitySpot, type AmenityZoneId } from '../sim/layout';
import type { PoseKind } from './activity';
import { range, type Rng } from './rng';

export type BreakVenue = 'gym' | 'game' | 'snack' | 'cafeteria' | 'terrace' | 'pods' | 'lab' | 'archive';

/** Curious units may spend a break in the R&D lab ("Ar-Ge"), Rev 31 rare-break path. */
export const CURIOUS_UNITS: ReadonlySet<string> = new Set(['scout', 'product-manager', 'software-architect']);
/** Rev 35 star area: in schedule slots the lab draws the curious units and the engineers strongly. */
export const LAB_FANS: ReadonlySet<string> = new Set([...CURIOUS_UNITS, 'react-engineer', 'dotnet-engineer', 'polyglot-engineer']);
/** Archive (closed projects) breaks are for the auditing units. */
export const ARCHIVE_UNITS: ReadonlySet<string> = new Set(['internal-auditor', 'quality-office']);
/** Rev 31 default: units that never take campus breaks (the CEO keeps to the penthouse). Rev 35 lifts it in the app. */
export const NO_CAMPUS_BREAK: ReadonlySet<string> = new Set(['ceo']);

export const VENUE_KINDS: Readonly<Record<BreakVenue, readonly AmenityKind[]>> = {
  gym: ['treadmill', 'weights'],
  game: ['ping-pong', 'foosball', 'arcade'],
  snack: ['snack'],
  cafeteria: ['dining'],
  terrace: ['terrace'],
  pods: ['pod'],
  lab: ['lab-bench'],
  archive: ['archive'],
};

/** Stay at the amenity, seconds [min, max). */
export const STAY_S: Readonly<Record<BreakVenue, readonly [number, number]>> = {
  gym: [12, 24],
  game: [12, 24],
  snack: [8, 14],
  cafeteria: [14, 24],
  terrace: [14, 24],
  pods: [20, 35],
  lab: [12, 24],
  archive: [12, 24],
};

/** Pose at an amenity spot. The lab bench has stools: seated work, like a desk. */
export const POSE_OF: Readonly<Record<AmenityKind, PoseKind>> = {
  treadmill: 'run',
  weights: 'lift',
  mat: 'lift',
  'ping-pong': 'paddle',
  foosball: 'play',
  arcade: 'play',
  snack: 'eat',
  dining: 'eat',
  terrace: 'eat',
  serving: 'idle',
  'bean-bag': 'sit',
  pod: 'sleep',
  'lab-bench': 'work',
  archive: 'read',
};

export const venueOf = (kind: AmenityKind): BreakVenue | null => {
  for (const [v, kinds] of Object.entries(VENUE_KINDS) as [BreakVenue, readonly AmenityKind[]][]) if (kinds.includes(kind)) return v;
  return null;
};

/** The R&D lab is a zone: every spot in it counts, whatever its kind (more lab spots may be added). */
const LAB_ZONE: AmenityZoneId = 'rnd-lab';

/** Venue of a break spot: the lab by zone, the rest by kind. */
export const venueOfSpot = (s: AmenitySpot): BreakVenue | null => (s.zone === LAB_ZONE ? 'lab' : venueOf(s.kind));

/** Does a spot belong to a venue? Read from AMENITY_SPOTS at call time (no hard-coded spot list). */
export const inVenue = (s: AmenitySpot, venue: BreakVenue): boolean => venueOfSpot(s) === venue;

export type SlotKind = 'coffee' | 'lunch' | 'tea';

/**
 * Venue weights in a schedule slot (Rev 35): coffee / tea fill the gym, game room, snack bar and the lab
 * (open to anyone, a strong draw for curious units); lunch fills the cafeteria and the terrace.
 * `station`: the floor coffee station instead of the campus.
 */
export function slotVenueWeights(unit: string, slot: SlotKind): [BreakVenue | 'station', number][] {
  if (slot === 'lunch') return [['cafeteria', 8], ['terrace', 2.5], ['snack', 1]];
  const w: [BreakVenue | 'station', number][] = [
    ['gym', 3],
    ['game', 3],
    ['snack', 3],
    ['station', 2.5],
    ['lab', LAB_FANS.has(unit) ? 7 : 2.5],
    ['pods', 0.3],
  ];
  if (ARCHIVE_UNITS.has(unit)) w.push(['archive', 2]);
  return w;
}

/** Venue weights for a unit: the cafeteria only at lunch, nap pods rarely, lab and archive by unit. */
export function venueWeights(unit: string, lunch: boolean): [BreakVenue, number][] {
  const w: [BreakVenue, number][] = [
    ['gym', 3],
    ['game', 3],
    ['snack', 2],
    ['pods', 0.5],
  ];
  if (lunch) w.push(['cafeteria', 5]);
  if (CURIOUS_UNITS.has(unit)) w.push(['lab', 3]); // Ar-Ge draw in slots: slotVenueWeights (Rev 35)
  if (ARCHIVE_UNITS.has(unit)) w.push(['archive', 3]);
  return w;
}

export function pickWeighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T | null {
  const total = items.reduce((s, [, w]) => s + w, 0);
  if (!(total > 0)) return null;
  let x = rng() * total;
  for (const [v, w] of items) {
    if (x < w) return v;
    x -= w;
  }
  return items[items.length - 1]?.[0] ?? null;
}

export const drawStay = (rng: Rng, venue: BreakVenue): number => range(rng, STAY_S[venue][0], STAY_S[venue][1]);

/** The two ping-pong spots face each other across the table. */
export const PING_PONG: readonly AmenitySpot[] = AMENITY_SPOTS.filter((s) => s.kind === 'ping-pong');

// ---------------------------------------------------------------- occupancy director (KARARLAR rev 39)
// "Alanları aktif kullanalım": during work hours every social and amenity zone keeps a target number of
// robots (walking there or staying), filled from free ambient robots in rotation. Ar-Ge is the company's
// brain: the engineers, the architect, product, scout, the CEO and the chief of staff hold their ambient
// work sessions there (deep work at the workstations, stand-up at the video wall, prototyping at the bench,
// device-lab testing).

/** Units whose ambient work sessions happen in the R&D lab. */
export const LAB_WORKERS: ReadonlySet<string> = new Set([
  'react-engineer',
  'dotnet-engineer',
  'polyglot-engineer',
  'software-architect',
  'product-manager',
  'scout',
  'ceo',
  'chief-of-staff',
]);

/** Robots committed (walking there or staying) per zone during work hours. */
export const OCCUPANCY_WORK: Readonly<Partial<Record<AmenityZoneId, number>>> = {
  'rnd-lab': 6,
  gym: 2,
  'game-room': 2,
  'snack-bar': 1,
  terrace: 1,
  archive: 1,
  'sleep-pods': 1,
};
/** At lunch the slot joins fill the cafeteria; the director tops the cafeteria, the terrace and the lab up. */
export const OCCUPANCY_LUNCH: Readonly<Partial<Record<AmenityZoneId, number>>> = {
  yemekhane: 4,
  terrace: 1,
  'rnd-lab': 3,
};
/** Shortly before the morning the lab crew heads in (the rest of the office stays home after hours). */
export const OCCUPANCY_MORNING: Readonly<Partial<Record<AmenityZoneId, number>>> = {
  'rnd-lab': 3,
};
/** In the coffee and tea slots the joins fill the social zones; the director keeps the lab staffed. */
export const OCCUPANCY_SLOT: Readonly<Partial<Record<AmenityZoneId, number>>> = {
  'rnd-lab': 5,
};
/**
 * Director stay per zone, seconds [min, max). A trip to the wing takes 15–90 s (bridge or staff elevator),
 * so a session stays long enough to outweigh its walk; lab sessions are the longest (deep work).
 */
export const ZONE_STAY_S: Readonly<Record<AmenityZoneId, readonly [number, number]>> = {
  'rnd-lab': [70, 110],
  gym: [45, 70],
  'game-room': [45, 70],
  'snack-bar': [30, 45],
  terrace: [40, 60],
  archive: [40, 60],
  'sleep-pods': [40, 60],
  yemekhane: [50, 70],
  'roof-garden': [40, 60],
};
/** A robot back from a director session rests at least this long before the next one (rotation). */
export const ROTATE_REST_S = 12;
/** Nap pods are "occasional": a pods top-up is attempted on this share of director ticks only. */
export const PODS_TICK_CHANCE = 0.25;

/** Preference of a robot for a zone (lower is better): fans first, then robots that need no elevator. */
export function zoneRank(unit: string, zone: AmenityZoneId, homeFloor: number, zoneFloor: number): number {
  const fan = zone === 'rnd-lab' ? LAB_WORKERS.has(unit) : zone === 'archive' ? ARCHIVE_UNITS.has(unit) : false;
  const near = homeFloor === zoneFloor;
  if (fan) return near ? 0 : 1;
  // Lab workers are kept for the lab while another zone has other candidates.
  if (zone !== 'rnd-lab' && LAB_WORKERS.has(unit)) return near ? 3 : 5;
  return near ? 2 : 4;
}
