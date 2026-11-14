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
