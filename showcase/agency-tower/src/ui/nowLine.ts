// Card "Şu an" line and job line (spec 0002 REQ-12, §7.6). Pure; the card sets the result as text.
import type { PropKind } from '../data/scenarios';
import { tr } from '../i18n/tr';
import type { ActivityKind, BreakPhase } from '../scene/activity';
import { venueOfSpot } from '../scene/breaks';
import type { AmenitySpot } from '../sim/layout';
import type { OfficePeriod } from '../sim/schedule';
import type { UnitState } from '../sim/workflow';

/** Every §7.5 state a card can show (wave and raise never appear: the state before selection is shown). */
export type CardState = keyof typeof tr.nowTpl;
export const CARD_STATES = Object.keys(tr.nowTpl) as CardState[];

export interface NowInput {
  state: CardState;
  label?: string;
  prop?: PropKind;
  other?: string;
  floor?: number;
  progress?: number;
}

export function templateOf(state: CardState): string {
  return tr.nowTpl[state];
}

export function nowLine(i: NowInput): string {
  return templateOf(i.state)
    .split('<adım etiketi>').join(i.label ?? '')
    .split('<eşya adı>').join(i.prop ? tr.props[i.prop] : '')
    .split('<unit id>').join(i.other ?? '')
    .split('<n>').join(String(i.floor ?? ''))
    .split('<p>').join(String(i.progress ?? 0));
}

/** Break line keys (Rev 38): a campus venue, or the floor station in the tea / coffee slot. */
export type BreakKey = keyof typeof tr.breakTpl;
export const BREAK_KEYS = Object.keys(tr.breakTpl) as BreakKey[];

export const breakLine = (key: BreakKey): string => tr.breakTpl[key];

export interface BreakInfo {
  /** Amenity spot of a campus break, null at the desk or the floor station. */
  spot: AmenitySpot | null;
  phase: BreakPhase | null;
  kind: ActivityKind;
  /** Office break period now (the tea slot names the station break "Çay molasında"). */
  period?: OfficePeriod;
}

/**
 * Break key of an ambient robot, or null (the generic ambient line applies). A campus break names its venue
 * while walking there and staying; walking back it is just walking. The floor station follows the slot.
 */
export function breakKeyOf(i: BreakInfo): BreakKey | null {
  if (i.spot) return i.phase === 'back' ? null : venueOfSpot(i.spot);
  if (i.kind === 'coffee') return i.period === 'tea' ? 'tea' : 'coffee';
  return null;
}

export function jobLine(n: number, title: string, lane: number): string {
  return `${tr.now.job} #${n} · ${title} · ${tr.strip.lane} ${lane}`;
}

export interface CardLines {
  now: string;
  job?: string;
}

const isPropKind = (p: string | undefined): p is PropKind => p !== undefined && p in tr.props;

/**
 * Lines for a robot at selection: the engine state when it is in a job, else its ambient state.
 * `rideFloor` is the destination floor of a rider (§7.6 "Asansörde → kat <n>"). `brk` (Rev 38): the break
 * line replaces the ambient line of a robot that is not in a job.
 */
export function cardLines(
  unit: UnitState | null,
  ambient: ActivityKind,
  job: { n: number; title: string; lane: number } | null,
  rideFloor?: number,
  nameOf: (id: string) => string = (id) => id,
  brk: BreakKey | null = null,
): CardLines {
  if (!unit) {
    if (brk) return { now: breakLine(brk) };
    // wave/raise are selection gestures; the caller captures the state before selection, so idle is a guard only.
    const state: CardState = ambient === 'wave' || ambient === 'raise' ? 'idle' : ambient;
    return { now: nowLine({ state }) };
  }
  const now = nowLine({
    state: unit.state,
    label: unit.label,
    prop: isPropKind(unit.prop) ? unit.prop : undefined,
    other: unit.other === undefined ? undefined : nameOf(unit.other),
    floor: rideFloor,
    progress: unit.progress,
  });
  return job ? { now, job: jobLine(job.n, job.title, job.lane) } : { now };
}
