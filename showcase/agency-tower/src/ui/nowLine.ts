// Card "Şu an" line and job line (spec 0002 REQ-12, §7.6). Pure; the card sets the result as text.
import type { PropKind } from '../data/scenarios';
import { tr } from '../i18n/tr';
import type { ActivityKind } from '../scene/activity';
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
 * `rideFloor` is the destination floor of a rider (§7.6 "Asansörde → kat <n>").
 */
export function cardLines(
  unit: UnitState | null,
  ambient: ActivityKind,
  job: { n: number; title: string; lane: number } | null,
  rideFloor?: number,
  nameOf: (id: string) => string = (id) => id,
): CardLines {
  if (!unit) {
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
