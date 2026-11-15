// East staff-only elevator simulation (spec 0002 REQ-14, §7.5b, §7.8, AC-13; Q-2 option a; KARARLAR Rev 44).
// Pure and deterministic: it draws no random numbers and reads time only from the dt it is stepped
// with (the 0002 simulation clock). A global pause feeds dt 0 and nothing changes; a selection holds a
// caller's call (it does not board) and re-queues it at the end on release. The cabin keeps running
// while a rider is selected. Rendering hooks: cabinY(), doorOpen(), state().floor, callLit(floor)
// (another unit wires them to model.staffCabin).
//
// Collective control (Rev 44): an empty cabin serves the oldest queued call (request order). On the way there it
// picks up callers going its way whose ride ends at or before that call's floor (so the oldest caller is never
// delayed past its floor). With riders aboard it keeps its direction, stops at each rider's floor and picks up
// callers going the same direction, up to CABIN_CAPACITY. A call made while the cabin travels is still picked up if
// its floor is at least half a floor ahead (the cabin re-plans the stop; travel time restarts from there). Doors are fully open while riders board or exit.
import { FLOOR_COUNT, floorY } from './layout';

/** Doors at every stop (§7.5b): riders exit and board while they are fully open */
export const DOOR_S = 0.6;
/** Door open and close ramps inside DOOR_S; the doors are fully open between them. */
export const DOOR_RAMP_S = 0.2;
/** Riders board at this instant of a door phase (doors fully open). */
export const DOOR_PASS_S = DOOR_S / 2;
/** Riders step out the moment the doors are fully open (all of them together, not one by one). */
export const DOOR_EXIT_S = DOOR_RAMP_S;
/** Door sensor: fully open doors wait at most this long for the doorway to clear before they close anyway. */
export const MAX_DOOR_HOLD_S = 2.5;
/** Riders per cabin (KARARLAR Rev 44: 3 -> 6, the cabin and its doors widened to fit). */
export const CABIN_CAPACITY = 6;
/** Pre-Rev 44 cabin size (the `legacy` policy, kept for the before/after traffic measurement). */
export const LEGACY_CAPACITY = 3;
/**
 * `collective` (Rev 44, default): stops on the way to drop each rider at their floor and to pick up callers going the
 * same direction. `legacy` (before Rev 44): one trip per head call, shared only by callers with the identical
 * from -> to, at most LEGACY_CAPACITY riders.
 */
export type ElevatorPolicy = 'collective' | 'legacy';

/** Seconds per floor of cabin travel (§7.5b). */
export const TRAVEL_PER_FLOOR_S = 0.6;
/** Shortest and longest cabin trip (§7.5b). */
export const TRAVEL_MIN_S = 0.8;
export const TRAVEL_MAX_S = 3.0;

/** Cabin travel time for a number of floors, empty or loaded: clamp(0.6 s x floors, 0.8 s, 3.0 s). */
export function travelS(floors: number): number {
  const n = Math.abs(floors);
  return n === 0 ? 0 : Math.min(Math.max(TRAVEL_PER_FLOOR_S * n, TRAVEL_MIN_S), TRAVEL_MAX_S);
}

/** Non-stop ride leg after the cabin-arrival wait, cabin side: doors at boarding + travel + doors at exit. */
export function rideLegS(floors: number): number {
  return DOOR_S + travelS(floors) + DOOR_S;
}

/** Rider side of the same ride: it ends when the rider steps out (doors fully open at the exit floor). */
export function riderLegS(floors: number): number {
  return DOOR_S + travelS(floors) + DOOR_EXIT_S;
}

/**
 * `alighting`: the doors are fully open at the rider's floor and the rider steps out (the cabin keeps the doors open
 * while its door sensor sees someone in the doorway); `arrived` once the doors have closed behind them.
 */
export type CallStatus = 'none' | 'queued' | 'held' | 'boarding' | 'riding' | 'alighting' | 'arrived';
export type CabinMode = 'idle' | 'travel' | 'doors';

export interface QueuedCall {
  unit: string;
  from: number;
  to: number;
  /** Request (or re-queue) time. */
  t: number;
}

export interface ElevatorLog {
  type: 'call' | 'ride-start' | 'board' | 'riders' | 'exit' | 'ride-end' | 'hold' | 'requeue' | 'cancel' | 'stop';
  t: number;
  unit?: string;
  floor?: number;
  doors?: number;
  /** `riders`: riders in the cabin once the doors' exchange is done. */
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
  /** Riders aboard and boarding, in rider-spot order. */
  riders: string[];
  doors: number;
  /** Travel direction of the current sweep: 1 up, -1 down, 0 none. */
  dir: number;
}

export interface ElevatorOptions {
  startFloor?: number;
  /** Keep the event log (tests). */
  record?: boolean;
  /** Dispatch policy (default `collective`). */
  policy?: ElevatorPolicy;
}

export interface Elevator {
  readonly time: number;
  readonly capacity: number;
  /** Registers a call at `from` to `to` (a new call replaces the unit's old one) at the end of the queue. */
  call(unit: string, from: number, to: number): void;
  /** Selection hold: a held call is skipped; on release it goes to the end of the queue (REQ-17). */
  hold(unit: string, on: boolean): void;
  cancel(unit: string): void;
  /** Clears an `alighting` or `arrived` status once the rider has walked off. */
  clear(unit: string): void;
  status(unit: string): CallStatus;
  /**
   * Advances the cabin. `doorBlocked` is the door sensor: while it reports someone in the doorway the fully open doors
   * do not start to close (at most MAX_DOOR_HOLD_S per stop).
   */
  step(dt: number, doorBlocked?: () => boolean): void;
  cabinY(): number;
  doorOpen(): number;
  /** Rider y (equals the cabin y) while boarding or riding, else null. */
  riderY(unit: string): number | null;
  /** Rider spot index (0 .. capacity-1) of a rider boarding or aboard, else -1. Stable for the whole ride. */
  riderIndex(unit: string): number;
  callLit(floor: number): boolean;
  queue(): QueuedCall[];
  state(): CabinState;
  log(): readonly ElevatorLog[];
  snapshot(): unknown;
}

interface Rider {
  unit: string;
  to: number;
  slot: number;
}

/** The oldest call the empty cabin committed to: it is served on this sweep. */
interface Commit {
  floor: number;
  dir: number;
  /** Legacy policy: only callers with this destination share the trip. */
  to: number;
}

const EPS = 1e-9;
/** A travelling cabin can still stop at a floor at least this far ahead (in floors). */
const BRAKE_FLOORS = 0.5;
const dirOf = (c: { from: number; to: number }): number => (c.to < c.from ? -1 : 1);
const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

export function createElevator(opts: ElevatorOptions = {}): Elevator {
  const record = opts.record ?? false;
  const policy: ElevatorPolicy = opts.policy ?? 'collective';
  const capacity = policy === 'legacy' ? LEGACY_CAPACITY : CABIN_CAPACITY;
  const start = Math.min(FLOOR_COUNT - 1, Math.max(0, opts.startFloor ?? 0));
  let time = 0;
  let mode: CabinMode = 'idle';
  let pos = start;
  let fromPos = start;
  let toPos = start;
  let t = 0;
  let dur = 0;
  let dir = 0;
  let commit: Commit | null = null;
  /** Riders aboard (travelling, or exiting during a door phase). */
  let riders: Rider[] = [];
  /** Door phase exchange: who exits and who boards at this stop. */
  let exiting: Rider[] = [];
  let boarding: Rider[] = [];
  let stopFloor = start;
  /** Door-sensor hold used at the current stop. */
  let holdS = 0;
  const queue: QueuedCall[] = [];
  const held = new Map<string, QueuedCall>();
  const status = new Map<string, CallStatus>();
  const logs: ElevatorLog[] = [];

  const log = (e: Omit<ElevatorLog, 't'>, at = time): void => {
    if (record) logs.push({ t: round6(at), ...e });
  };
  const doorsAt = (x: number): number => Math.min(1, Math.max(0, Math.min(x / DOOR_RAMP_S, (DOOR_S - x) / DOOR_RAMP_S)));
  const removeQueued = (unit: string): QueuedCall | undefined => {
    const i = queue.findIndex((c) => c.unit === unit);
    return i >= 0 ? queue.splice(i, 1)[0] : undefined;
  };
  const near = (a: number, b: number): boolean => Math.abs(a - b) < EPS;

  /** A call the commit still stands for (it may have been held or cancelled meanwhile). */
  const matchesCommit = (c: QueuedCall, k: Commit): boolean =>
    c.from === k.floor && dirOf(c) === k.dir && (policy === 'collective' || c.to === k.to);
  function validCommit(): Commit | null {
    if (commit && !queue.some((c) => matchesCommit(c, commit!))) commit = null;
    return commit;
  }
  function commitToHead(): Commit | null {
    if (validCommit()) return commit;
    const head = queue[0];
    commit = head ? { floor: head.from, dir: dirOf(head), to: head.to } : null;
    return commit;
  }

  /**
   * May a caller at a floor other than the commit floor ride with the cabin going `d`? Only under the collective
   * policy, going `d`, and (when the commit lies ahead and turns the cabin round) only if the ride ends by then.
   */
  function pickupAllowed(c: QueuedCall, d: number): boolean {
    if (policy !== 'collective' || dirOf(c) !== d) return false;
    const k = validCommit();
    if (k && k.dir !== d && (k.floor - pos) * d > EPS) return (c.to - k.floor) * d <= 0;
    return true;
  }

  /** Nearest floor ahead of the cabin in direction `d` with something to do. */
  function nextStop(d: number): number | null {
    let best: number | null = null;
    const consider = (f: number): void => {
      if ((f - pos) * d <= EPS) return;
      if (best === null || Math.abs(f - pos) < Math.abs(best - pos)) best = f;
    };
    for (const r of riders) consider(r.to);
    const k = validCommit();
    if (k) consider(k.floor);
    if (riders.length < capacity) for (const c of queue) if (pickupAllowed(c, d)) consider(c.from);
    return best;
  }

  function startTravel(target: number): void {
    mode = 'travel';
    fromPos = pos;
    toPos = target;
    t = 0;
    dur = travelS(target - pos);
  }

  /**
   * Collective policy, while travelling: a caller who pressed the button after the doors closed is still picked up if
   * their floor lies ahead, at least BRAKE_FLOORS before the planned stop, and they may ride along.
   */
  function retarget(): void {
    if (policy !== 'collective' || dir === 0 || riders.length >= capacity) return;
    const d = Math.sign(toPos - pos);
    if (d !== dir) return;
    let f = d > 0 ? Math.ceil(pos + BRAKE_FLOORS - EPS) : Math.floor(pos - BRAKE_FLOORS + EPS);
    for (; (toPos - f) * d > EPS; f += d) {
      if (!queue.some((c) => c.from === f && pickupAllowed(c, d))) continue;
      fromPos = pos;
      toPos = f;
      t = 0;
      dur = travelS(f - pos);
      return;
    }
  }

  /** Works out the exchange at the floor the cabin stands at; opens the doors if anyone exits or boards. */
  function arriveAt(floor: number): boolean {
    stopFloor = floor;
    exiting = riders.filter((r) => r.to === floor);
    const staying = riders.length - exiting.length;
    let nd = 0;
    if (staying > 0) nd = dir;
    else {
      const k = commitToHead();
      if (k) {
        nd = k.floor === floor ? k.dir : Math.sign(k.floor - floor);
      }
    }
    boarding = [];
    if (nd !== 0) {
      const k = commit;
      const free = capacity - staying;
      const want = queue.filter((c) => {
        if (c.from !== floor) return false;
        if (k && k.floor === floor && matchesCommit(c, k) && (staying === 0 || k.dir === nd)) return true;
        return pickupAllowed(c, nd);
      });
      const used = new Set(riders.filter((r) => r.to !== floor).map((r) => r.slot));
      const freeSlots: number[] = [];
      for (let s = 0; s < capacity; s++) if (!used.has(s) && !exiting.some((r) => r.slot === s)) freeSlots.push(s);
      for (const r of exiting) freeSlots.push(r.slot);
      for (const c of want.slice(0, free)) {
        removeQueued(c.unit);
        status.set(c.unit, 'boarding');
        boarding.push({ unit: c.unit, to: c.to, slot: freeSlots.shift() ?? 0 });
        log({ type: 'ride-start', unit: c.unit, floor, waited: round6(time - c.t) });
      }
      // The commit floor is served on this stop (callers left behind by a full cabin wait for their turn).
      if (k && k.floor === floor && (staying === 0 || k.dir === nd)) commit = null;
    }
    if (boarding.length || staying > 0) dir = nd;
    else if (!exiting.length) dir = 0;
    if (!exiting.length && !boarding.length) return false;
    mode = 'doors';
    t = 0;
    dur = DOOR_S;
    holdS = 0;
    log({ type: 'stop', floor });
    return true;
  }

  /** Idle cabin: decide what to do next. False when there is nothing to do. */
  function dispatch(): boolean {
    if (riders.length) {
      const s = nextStop(dir);
      if (s !== null) {
        startTravel(s);
        return true;
      }
      // Unreachable while riders keep their direction; drop them where the cabin stands rather than lock up.
      if (arriveAt(Math.round(pos))) return true;
      return false;
    }
    const k = commitToHead();
    if (!k) {
      dir = 0;
      return false;
    }
    if (near(pos, k.floor)) return arriveAt(k.floor);
    dir = Math.sign(k.floor - pos);
    const s = nextStop(dir);
    startTravel(s ?? k.floor);
    return true;
  }

  function finishPhase(): void {
    if (mode === 'travel') {
      pos = toPos;
      if (!arriveAt(Math.round(pos))) mode = 'idle';
      return;
    }
    if (mode === 'doors') {
      for (const r of exiting) {
        // A rider who already walked off (cleared) or called again keeps that status.
        if (status.get(r.unit) === 'alighting') status.set(r.unit, 'arrived');
        log({ type: 'ride-end', unit: r.unit, floor: stopFloor });
      }
      const gone = new Set(exiting.map((r) => r.unit));
      riders = riders.filter((r) => !gone.has(r.unit));
      for (const r of boarding) status.set(r.unit, 'riding');
      riders.push(...boarding);
      exiting = [];
      boarding = [];
      if (!riders.length && !validCommit()) dir = 0;
    }
    mode = 'idle';
  }

  const aboard = (): Rider[] => [...riders.filter((r) => !exiting.includes(r)), ...boarding].sort((a, b) => a.slot - b.slot);

  const el: Elevator = {
    get time() {
      return time;
    },
    capacity,
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
      const st = status.get(unit);
      if (st === 'arrived' || st === 'alighting') status.delete(unit);
    },
    status: (unit) => status.get(unit) ?? 'none',
    step(dt, doorBlocked) {
      if (!(dt > 0)) return;
      let left = dt;
      let guard = 0;
      const closeAt = DOOR_S - DOOR_RAMP_S;
      while (left > EPS && guard++ < 64) {
        if (mode === 'idle') {
          if (!dispatch()) {
            time += left;
            left = 0;
          }
          continue;
        }
        if (mode === 'travel') retarget();
        // Door sensor: fully open doors wait while someone stands in the doorway.
        if (mode === 'doors' && near(t, closeAt) && holdS < MAX_DOOR_HOLD_S - EPS && doorBlocked?.()) {
          const h = Math.min(left, MAX_DOOR_HOLD_S - holdS);
          holdS += h;
          time += h;
          left -= h;
          continue;
        }
        // A door phase stops at its marks (exit, boarding, closing) so each happens at its instant.
        const mark = mode === 'doors' ? ([DOOR_EXIT_S, DOOR_PASS_S, closeAt, DOOR_S].find((m) => m > t + EPS) ?? dur) : dur;
        const used = Math.min(left, Math.max(mark - t, 0));
        if (mode === 'doors' && t < DOOR_EXIT_S - EPS && t + used >= DOOR_EXIT_S - EPS) {
          const at = time + (DOOR_EXIT_S - t);
          const doors = doorsAt(DOOR_EXIT_S);
          for (const r of exiting) {
            status.set(r.unit, 'alighting');
            log({ type: 'exit', unit: r.unit, floor: stopFloor, doors }, at);
          }
        }
        if (mode === 'doors' && t < DOOR_PASS_S - EPS && t + used >= DOOR_PASS_S - EPS) {
          const at = time + (DOOR_PASS_S - t);
          const doors = doorsAt(DOOR_PASS_S);
          for (const r of boarding) log({ type: 'board', unit: r.unit, floor: stopFloor, doors }, at);
          if (boarding.length) log({ type: 'riders', count: riders.length - exiting.length + boarding.length, floor: stopFloor }, at);
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
    riderIndex(unit) {
      const r = boarding.find((x) => x.unit === unit) ?? riders.find((x) => x.unit === unit);
      return r ? r.slot : -1;
    },
    callLit: (floor) => queue.some((c) => c.from === floor) || [...held.values()].some((c) => c.from === floor),
    queue: () => queue.map((c) => ({ ...c })),
    state: () => ({ mode, floor: Math.round(pos), pos, riders: aboard().map((r) => r.unit), doors: el.doorOpen(), dir }),
    log: () => logs,
    snapshot: () => ({
      time,
      mode,
      pos,
      fromPos,
      toPos,
      t,
      dur,
      dir,
      commit: commit ? { ...commit } : null,
      stopFloor,
      holdS,
      riders: riders.map((r) => ({ ...r })),
      exiting: exiting.map((r) => r.unit),
      boarding: boarding.map((r) => ({ ...r })),
      queue: queue.map((c) => ({ ...c })),
      held: [...held.values()].map((c) => ({ ...c })),
      status: [...status],
    }),
  };
  return el;
}
