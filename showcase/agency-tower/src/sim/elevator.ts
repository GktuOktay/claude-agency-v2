// East staff-only elevator simulation (spec 0002 REQ-14, §7.5b, §7.8, AC-13; Q-2 option a).
// Pure and deterministic: it draws no random numbers and reads time only from the dt it is stepped
// with (the 0002 simulation clock). A global pause feeds dt 0 and nothing changes; a selection holds a
// caller's call (it does not board) and re-queues it at the end on release. The cabin keeps running
// while a rider is selected. Rendering hooks: cabinY(), doorOpen(), state().floor, callLit(floor)
// (another unit wires them to model.staffCabin).
import { FLOOR_COUNT, floorY } from './layout';

/** Doors at boarding and again at exit (§7.5b). */
export const DOOR_S = 0.6;
/** Door open and close ramps inside DOOR_S; the doors are fully open between them. */
export const DOOR_RAMP_S = 0.2;
/** Riders board and exit at this instant of a door phase (doors fully open). */
export const DOOR_PASS_S = DOOR_S / 2;
export const CABIN_CAPACITY = 3;

/** Cabin travel time for a number of floors, empty or loaded: clamp(0.6 s x floors, 0.8 s, 3.0 s). */
export function travelS(floors: number): number {
  const n = Math.abs(floors);
  return n === 0 ? 0 : Math.min(Math.max(0.6 * n, 0.8), 3.0);
}

/** Ride leg after the cabin-arrival wait: doors at boarding + travel + doors at exit. */
export function rideLegS(floors: number): number {
  return DOOR_S + travelS(floors) + DOOR_S;
}

export type CallStatus = 'none' | 'queued' | 'held' | 'boarding' | 'riding' | 'arrived';
export type CabinMode = 'idle' | 'travel' | 'doors';

export interface QueuedCall {
  unit: string;
  from: number;
  to: number;
  /** Request (or re-queue) time. */
  t: number;
}

export interface ElevatorLog {
  type: 'call' | 'ride-start' | 'board' | 'riders' | 'exit' | 'ride-end' | 'hold' | 'requeue' | 'cancel';
  t: number;
  unit?: string;
  floor?: number;
  doors?: number;
  count?: number;
  /** Cabin-arrival wait (call or re-queue to ride start), on `ride-start`. */
  waited?: number;
}

export interface CabinState {
  mode: CabinMode;
  /** Nearest floor (the floor the cabin is ghosted with). */
  floor: number;
  /** Continuous floor position. */
  pos: number;
  riders: string[];
  doors: number;
}

export interface ElevatorOptions {
  startFloor?: number;
  /** Keep the event log (tests). */
  record?: boolean;
}

export interface Elevator {
  readonly time: number;
  /** Registers a call at `from` to `to` (a new call replaces the unit's old one) at the end of the queue. */
  call(unit: string, from: number, to: number): void;
  /** Selection hold: a held call is skipped; on release it goes to the end of the queue (REQ-17). */
  hold(unit: string, on: boolean): void;
  cancel(unit: string): void;
  /** Clears an `arrived` status after the rider has walked off. */
  clear(unit: string): void;
  status(unit: string): CallStatus;
  step(dt: number): void;
  cabinY(): number;
  doorOpen(): number;
  /** Rider y (equals the cabin y) while boarding or riding, else null. */
  riderY(unit: string): number | null;
  /** Index of a rider in the cabin (rider spot), else -1. */
  riderIndex(unit: string): number;
  callLit(floor: number): boolean;
  queue(): QueuedCall[];
  state(): CabinState;
  log(): readonly ElevatorLog[];
  snapshot(): unknown;
}

interface Trip {
  from: number;
  to: number;
  riders: string[];
}

const EPS = 1e-9;

export function createElevator(opts: ElevatorOptions = {}): Elevator {
  const record = opts.record ?? false;
  const start = Math.min(FLOOR_COUNT - 1, Math.max(0, opts.startFloor ?? 0));
  let time = 0;
  let mode: CabinMode = 'idle';
  let pos = start;
  let fromPos = start;
  let toPos = start;
  let t = 0;
  let dur = 0;
  let doorsKind: 'board' | 'exit' = 'board';
  let trip: Trip | null = null;
  const queue: QueuedCall[] = [];
  const held = new Map<string, QueuedCall>();
  const status = new Map<string, CallStatus>();
  const logs: ElevatorLog[] = [];

  const log = (e: Omit<ElevatorLog, 't'>, at = time): void => {
    if (record) logs.push({ t: Math.round(at * 1e6) / 1e6, ...e });
  };
  const doorsAt = (x: number): number => Math.min(1, Math.max(0, Math.min(x / DOOR_RAMP_S, (DOOR_S - x) / DOOR_RAMP_S)));
  const removeQueued = (unit: string): QueuedCall | undefined => {
    const i = queue.findIndex((c) => c.unit === unit);
    return i >= 0 ? queue.splice(i, 1)[0] : undefined;
  };

  function startTravel(target: number): void {
    mode = 'travel';
    fromPos = pos;
    toPos = target;
    t = 0;
    dur = travelS(target - pos);
  }

  function startDoors(kind: 'board' | 'exit'): void {
    mode = 'doors';
    doorsKind = kind;
    t = 0;
    dur = DOOR_S;
    if (kind !== 'board' || !trip) return;
    // Head call plus later calls with the same origin and destination, in queue order, up to 3.
    const boarders = queue.filter((c) => c.from === trip!.from && c.to === trip!.to).slice(0, CABIN_CAPACITY);
    for (const c of boarders) {
      removeQueued(c.unit);
      status.set(c.unit, 'boarding');
      trip.riders.push(c.unit);
      log({ type: 'ride-start', unit: c.unit, floor: c.from, waited: Math.round((time - c.t) * 1e6) / 1e6 });
    }
  }

  function dispatch(): boolean {
    const head = queue[0];
    if (!head) return false;
    trip = { from: head.from, to: head.to, riders: [] };
    if (Math.abs(pos - head.from) < EPS) startDoors('board');
    else startTravel(head.from);
    return true;
  }

  function finishPhase(): void {
    if (mode === 'travel') {
      pos = toPos;
      if (!trip) {
        mode = 'idle';
        return;
      }
      if (trip.riders.length === 0) {
        // Arrived empty at the call floor; the head call may have been held meanwhile.
        if (queue.some((c) => c.from === trip!.from && c.to === trip!.to)) startDoors('board');
        else {
          trip = null;
          mode = 'idle';
        }
      } else startDoors('exit');
      return;
    }
    if (mode === 'doors' && trip) {
      if (doorsKind === 'board') {
        if (trip.riders.length === 0) {
          trip = null;
          mode = 'idle';
        } else {
          for (const u of trip.riders) status.set(u, 'riding');
          startTravel(trip.to);
        }
        return;
      }
      for (const u of trip.riders) {
        status.set(u, 'arrived');
        log({ type: 'ride-end', unit: u, floor: trip.to });
      }
      trip = null;
      mode = 'idle';
      return;
    }
    mode = 'idle';
  }

  const el: Elevator = {
    get time() {
      return time;
    },
    call(unit, from, to) {
      removeQueued(unit);
      held.delete(unit);
      const c = { unit, from, to, t: time };
      queue.push(c);
      status.set(unit, 'queued');
      log({ type: 'call', unit, floor: from });
    },
    hold(unit, on) {
      if (on) {
        const c = removeQueued(unit);
        if (!c) return;
        held.set(unit, c);
        status.set(unit, 'held');
        log({ type: 'hold', unit, floor: c.from });
        return;
      }
      const c = held.get(unit);
      if (!c) return;
      held.delete(unit);
      queue.push({ ...c, t: time });
      status.set(unit, 'queued');
      log({ type: 'requeue', unit, floor: c.from });
    },
    cancel(unit) {
      const st = status.get(unit);
      if (st === 'boarding' || st === 'riding') return; // a rider cannot leave the cabin mid-ride
      removeQueued(unit);
      held.delete(unit);
      status.delete(unit);
      if (st === 'queued' || st === 'held') log({ type: 'cancel', unit });
    },
    clear(unit) {
      if (status.get(unit) === 'arrived') status.delete(unit);
    },
    status: (unit) => status.get(unit) ?? 'none',
    step(dt) {
      if (!(dt > 0)) return;
      let left = dt;
      let guard = 0;
      while (left > EPS && guard++ < 64) {
        if (mode === 'idle') {
          if (!dispatch()) {
            time += left;
            left = 0;
          }
          continue;
        }
        const need = dur - t;
        const used = Math.min(left, Math.max(need, 0));
        if (mode === 'doors' && trip && t < DOOR_PASS_S - EPS && t + used >= DOOR_PASS_S - EPS) {
          const at = time + (DOOR_PASS_S - t);
          const floor = doorsKind === 'board' ? trip.from : trip.to;
          for (const u of trip.riders) log({ type: doorsKind === 'board' ? 'board' : 'exit', unit: u, floor, doors: doorsAt(DOOR_PASS_S) }, at);
          if (doorsKind === 'board' && trip.riders.length) log({ type: 'riders', count: trip.riders.length, floor }, at);
        }
        t += used;
        time += used;
        left -= used;
        if (mode === 'travel') pos = dur > 0 ? fromPos + (toPos - fromPos) * Math.min(1, t / dur) : toPos;
        if (t >= dur - EPS) finishPhase();
      }
      if (guard >= 64) time += Math.max(left, 0);
    },
    cabinY: () => floorY(pos),
    doorOpen: () => (mode === 'doors' ? doorsAt(t) : 0),
    riderY(unit) {
      const st = status.get(unit);
      return st === 'boarding' || st === 'riding' ? floorY(pos) : null;
    },
    riderIndex: (unit) => trip?.riders.indexOf(unit) ?? -1,
    callLit: (floor) => queue.some((c) => c.from === floor) || [...held.values()].some((c) => c.from === floor),
    queue: () => queue.map((c) => ({ ...c })),
    state: () => ({ mode, floor: Math.round(pos), pos, riders: trip ? [...trip.riders] : [], doors: el.doorOpen() }),
    log: () => logs,
    snapshot: () => ({
      time,
      mode,
      pos,
      fromPos,
      toPos,
      t,
      dur,
      doorsKind,
      trip: trip ? { ...trip, riders: [...trip.riders] } : null,
      queue: queue.map((c) => ({ ...c })),
      held: [...held.values()].map((c) => ({ ...c })),
      status: [...status],
    }),
  };
  return el;
}
