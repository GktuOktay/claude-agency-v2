// Job titles (spec 0002 §7.3, REQ-3): validator and title order. The title list itself lives in
// jobTitles.json (content owner: tech-comms). Pure and seedable; draws only on the `titles` stream.
import type { Rng } from '../scene/rng';

export const SCRIPTED_TITLES = 3;
const MIN_TITLES = 12;
const MAX_TITLES = 40;
const MAX_CODE_POINTS = 36;
// Control characters (C0, DEL, C1) and markup brackets are rejected (§8: titles reach the DOM as text).
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f<>]/;

export type TitlesResult = { ok: true; data: string[] } | { ok: false; error: string };

export function loadJobTitles(raw: unknown): TitlesResult {
  const bad = (error: string): TitlesResult => ({ ok: false, error });
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return bad('expected object');
  const rec = raw as Record<string, unknown>;
  if (Object.keys(rec).some((k) => k !== 'schemaVersion' && k !== 'titlesTr')) return bad('unknown field');
  if (rec.schemaVersion !== 1) return bad('schemaVersion must be 1');
  const list = rec.titlesTr;
  if (!Array.isArray(list) || list.length < MIN_TITLES || list.length > MAX_TITLES) return bad(`titlesTr: ${MIN_TITLES}-${MAX_TITLES} titles`);
  const out: string[] = [];
  for (const [i, t] of (list as unknown[]).entries()) {
    if (typeof t !== 'string') return bad(`titlesTr[${i}]: expected string`);
    const n = [...t].length;
    if (n < 1 || n > MAX_CODE_POINTS) return bad(`titlesTr[${i}]: 1-${MAX_CODE_POINTS} code points`);
    if (FORBIDDEN.test(t)) return bad(`titlesTr[${i}]: control character or < >`);
    if (out.includes(t)) return bad(`titlesTr[${i}]: duplicate`);
    out.push(t);
  }
  return { ok: true, data: out };
}

export interface TitleSequence {
  next(): string;
}

/**
 * Scripted jobs take titles 1-3 in file order (no draw); afterwards a seeded shuffle of the whole
 * list; on exhaustion a reshuffle whose first title differs from the last one used (AC-3).
 */
export function createTitleSequence(titles: readonly string[], rng: Rng): TitleSequence {
  if (titles.length < 2) throw new Error('title sequence needs at least 2 titles');
  let used = 0;
  let order: string[] = [];
  let pos = 0;
  let last: string | undefined;

  const shuffle = (): string[] => {
    const a = [...titles];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    if (a[0] === last) {
      const j = 1 + Math.floor(rng() * (a.length - 1));
      [a[0], a[j]] = [a[j]!, a[0]!];
    }
    return a;
  };

  return {
    next() {
      let t: string;
      if (used < SCRIPTED_TITLES && used < titles.length) {
        t = titles[used]!;
      } else {
        if (pos >= order.length) {
          order = shuffle();
          pos = 0;
        }
        t = order[pos++]!;
      }
      used++;
      last = t;
      return t;
    },
  };
}
