// Campus areas in the floor panel (KARARLAR Rev 31 UI pass). Each entry frames one wing level (or the
// wing roof) and ghosts the tower like the tower floor of the same index (0001 REQ-8). `K` cycles them.
import { ROOF_GARDEN_FLOOR, WING_LEVELS } from '../sim/layout';

export type CampusKey = 'wing-0' | 'wing-1' | 'wing-2' | 'roof';

export interface CampusItem {
  readonly key: CampusKey;
  /** Full Turkish name (panel text, accessible name). */
  readonly label: string;
  /** Short visible label on the phone strip. */
  readonly short: string;
  /** Wing level framed by the camera (the roof is the level above the top wing level). */
  readonly level: number;
  /** Tower floor whose ghosting the view follows. */
  readonly focusFloor: number;
}

const [L0 = 0, L1 = 1, L2 = 2] = WING_LEVELS;

export const CAMPUS_ITEMS: readonly CampusItem[] = [
  { key: 'wing-0', label: 'Yemekhane & Snack bar', short: 'Yemek', level: L0, focusFloor: L0 },
  { key: 'wing-1', label: 'Spor & Oyun', short: 'Spor', level: L1, focusFloor: L1 },
  { key: 'wing-2', label: 'Uyku · Ar-Ge · Arşiv', short: 'Ar-Ge', level: L2, focusFloor: L2 },
  { key: 'roof', label: 'Çatı bahçesi', short: 'Çatı', level: ROOF_GARDEN_FLOOR, focusFloor: ROOF_GARDEN_FLOOR },
];

export function campusItem(key: CampusKey): CampusItem {
  const item = CAMPUS_ITEMS.find((c) => c.key === key);
  if (!item) throw new Error(`unknown campus area ${key}`);
  return item;
}

/** The area `K` moves to next: the first one from outside the campus, then in panel order, wrapping. */
export function nextCampus(current: CampusKey | null): CampusKey {
  const i = current === null ? -1 : CAMPUS_ITEMS.findIndex((c) => c.key === current);
  const next = CAMPUS_ITEMS[(i + 1) % CAMPUS_ITEMS.length];
  if (!next) throw new Error('no campus areas');
  return next.key;
}
