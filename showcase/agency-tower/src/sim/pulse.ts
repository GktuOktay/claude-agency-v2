// "Şirket nabzı" and "Olay akışı" (KARARLAR Rev 43 C1 / C2). Pure: derived only from the workflow engine events
// (job-done, room-hold, step-start / step-end, sign) and from samples of the ambient breaks; no DOM, no timers,
// no random draws, so it never changes the simulation.
import { CAMPUS_ITEMS } from '../ui/campusNav';
import { ROOF_GARDEN_FLOOR } from './layout';
import type { WfEvent } from './workflow';

export interface PulseCounts {
  jobsDone: number;
  /** Meeting room taken by a job (one meeting). */
  meetings: number;
  /** Coffee / tea at the station or a campus break started (rising edges). */
  breaks: number;
}

export interface Place {
  key: string;
  name: string;
}

export interface Busiest {
  name: string;
  count: number;
}

export interface Pulse {
  ingest(events: readonly WfEvent[]): void;
  /** One sample per frame: [robot id, on a break now]. */
  sampleBreaks(sample: Iterable<readonly [string, boolean]>): void;
  counts(): PulseCounts;
  /** The place with most robots in `places` (one entry per robot); ties to the first seen; null when empty. */
  busiest(places: readonly Place[]): Busiest | null;
}

/** A robot's place: a tower floor, a campus wing level or the roof garden. */
export function placeOf(floor: number, inWing: boolean, floorName: string): Place {
  if (!inWing) return { key: `floor-${floor}`, name: floorName };
  const item = floor === ROOF_GARDEN_FLOOR ? CAMPUS_ITEMS.find((c) => c.key === 'roof') : CAMPUS_ITEMS.find((c) => c.key === `wing-${floor}`);
  return { key: item?.key ?? `wing-${floor}`, name: item?.label ?? floorName };
}

export function createPulse(): Pulse {
  const c: PulseCounts = { jobsDone: 0, meetings: 0, breaks: 0 };
  const onBreak = new Set<string>();
  return {
    ingest(events) {
      for (const e of events) {
        if (e.type === 'job-done') c.jobsDone++;
        else if (e.type === 'room-hold') c.meetings++;
      }
    },
    sampleBreaks(sample) {
      for (const [id, on] of sample) {
        if (on && !onBreak.has(id)) {
          onBreak.add(id);
          c.breaks++;
        } else if (!on) onBreak.delete(id);
      }
    },
    counts: () => ({ ...c }),
    busiest(places) {
      const n = new Map<string, Busiest>();
      for (const p of places) {
        const b = n.get(p.key);
        if (b) b.count++;
        else n.set(p.key, { name: p.name, count: 1 });
      }
      let best: Busiest | null = null;
      for (const b of n.values()) if (!best || b.count > best.count) best = b;
      return best ? { ...best } : null;
    },
  };
}

// ---------------------------------------------------------------- Olay akışı

export interface FeedItem {
  id: number;
  /** Turkish line, e.g. "QA kırmızı · İş #5". */
  text: string;
  /** Office time "HH:MM" when it happened. */
  time: string;
  job: number;
  /** Robot the camera goes to (the step's first actor, or the job's last one); absent: the job's floor. */
  unit?: string;
}

export const FEED_TEXT = {
  sign: 'Spec imzaya hazır',
  meeting: 'Toplantı başladı',
  qaRed: 'QA kırmızı',
  done: 'İş bitti',
  job: (n: number): string => `İş #${n}`,
} as const;

export interface FeedModel {
  /** The notable events among `events`, oldest first. */
  ingest(events: readonly WfEvent[], officeTime: string): FeedItem[];
}

export function createFeedModel(): FeedModel {
  let next = 1;
  const lastUnit = new Map<number, string>();
  return {
    ingest(events, officeTime) {
      const out: FeedItem[] = [];
      const add = (e: WfEvent, what: string, unit = lastUnit.get(e.job)): void => {
        out.push({ id: next++, text: `${what} · ${FEED_TEXT.job(e.job)}`, time: officeTime, job: e.job, ...(unit ? { unit } : {}) });
      };
      for (const e of events) {
        if (e.type === 'step-start') {
          const u = e.units?.[0];
          if (u) lastUnit.set(e.job, u);
          if (e.kind === 'sign') add(e, FEED_TEXT.sign, u);
        } else if (e.type === 'room-hold') add(e, FEED_TEXT.meeting);
        else if (e.type === 'step-end' && e.kind === 'test' && e.outcome === 'reject') add(e, FEED_TEXT.qaRed);
        else if (e.type === 'job-done') {
          add(e, FEED_TEXT.done);
          lastUnit.delete(e.job);
        }
      }
      return out;
    },
  };
}
