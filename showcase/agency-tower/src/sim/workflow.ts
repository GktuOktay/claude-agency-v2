// Workflow engine (spec 0002 REQ-4..10, R-3, R-11, §7.4, §7.5). Pure and seedable like
// scene/activity.ts: no three.js, no DOM, no timers. It replays jobs through the validated
// scenarios on the simulation clock, reserves units and places all-or-nothing in the R-3 order and
// drives robots through a Movement port (default: nav movement + staff elevator, Rev 32). Random numbers come only from
// the `engine` stream and only on events (job start, step start, slot free), never per frame.
import { createRng, type Rng } from '../scene/rng';
import { indexScenario, roomAhead, usesRoom, type Scenario, type ScenarioIndex, type ScenarioSet, type Step, type UnitFloors } from '../data/scenarios';
import type { Movement, Target } from './movement';
import { createNavMovement } from './navMovement';

export const MASTER_SEED = 0x2002;
export const HANDOVER_S = 1.2;
export const WAIT_ALLOWANCE_S = 8;
export const DONE_DISPLAY_S = 4;
export const ROOM_SEATS = 6;
export const ROOM_FLOOR = 3;
export const SIGNING_FLOOR = 5;
const START_DELAY: [number, number] = [4, 10];
const SLOT_START_SCRIPTED_S = 4;
const EPS = 1e-9;

/** Per-module stream seed derived from the master seed (R-1): FNV-1a of the module name. */
export function streamSeed(master: number, name: string): number {
  let h = 0x811c9dc5;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return (h ^ master) >>> 0;
}

export type Outcome = 'pass' | 'reject';
export type DrawPurpose = 'outcome' | 'lane' | 'variant' | 'start-delay' | 'duration';
export const DRAW_PURPOSES: readonly DrawPurpose[] = ['outcome', 'lane', 'variant', 'start-delay', 'duration'];

export type ScriptOutcomes = Readonly<Record<string, readonly Outcome[]>>;
export interface ScriptEntry {
  variant: string;
  /** Start time in seconds; `slot` = 4 s after the first slot frees (§7.4 job #3 on `low`). */
  at: number | 'slot';
  outcomes: ScriptOutcomes;
}

/** §7.4 scripted opening. Job #3 starts at 30 s on `high`, or 4 s after the first slot frees on `low`. */
export function scriptedStart(maxJobs: number): ScriptEntry[] {
  return [
    { variant: 'l2-base', at: 2, outcomes: { 'rev-sc': ['reject', 'pass'], test: ['pass'] } },
    { variant: 'l3-full', at: 15, outcomes: { gates: ['pass'], test: ['reject', 'pass'] } },
    { variant: 'l1-quick', at: maxJobs >= 3 ? 30 : 'slot', outcomes: { test: ['pass'] } },
  ];
}

export type EventType =
  | 'job-start' | 'step-start' | 'step-end' | 'handover' | 'tray-drop' | 'tray-take' | 'reject' | 'sign'
  | 'call' | 'copies' | 'wait-start' | 'wait-end' | 'room-hold' | 'room-release' | 'job-done' | 'slot-free';

export interface WfEvent {
  t: number;
  type: EventType;
  job: number;
  step?: string;
  kind?: string;
  units?: string[];
  place?: string;
  from?: string;
  to?: string;
  prop?: string;
  copy?: number;
  outcome?: Outcome;
  loops?: number;
  variant?: string;
}

export interface GrantCandidate {
  job: number;
  step: string;
  since: number;
  holder: boolean;
  needs: string[];
  room: boolean;
  signing: boolean;
  placeBlocked: boolean;
  granted: boolean;
}
export interface GrantRound {
  t: number;
  /** Units busy (reserved or extended escort) before the round. */
  busy: string[];
  /** Candidates in R-3 order; place-blocked ones first-listed are skipped. */
  candidates: GrantCandidate[];
}

/** §7.5 directed states the engine can tell (the director refines movement-only states). */
export type DirectedState =
  | 'step-walk' | 'carry-walk' | 'handover' | 'wait' | 'escort-wait' | 'call-hold' | 'call' | 'call-wait' | 'ride'
  | 'seat-wait' | 'seated' | 'present' | 'pair' | 'build' | 'review' | 'test' | 'stamp-raise' | 'stamp-press'
  | 'step-work' | 'called';

export interface UnitState {
  state: DirectedState;
  job: number;
  step: string;
  label: string;
  /** Carry recipient, escort's reviewer, pair partner. */
  other?: string;
  prop?: string;
  /** Build progress 0-100 (integer). */
  progress?: number;
}

export type StepMark = 'done' | 'now' | 'next' | 'returned';
export interface JobView {
  n: number;
  lane: number;
  variant: string;
  title: string;
  /** Running step label (a call's label while its branches run); else the waiting step's label. */
  label: string;
  loops: number;
  done: boolean;
  /** Some running step of the job is paused by a selected robot (§7.8). */
  pausedBySelection: boolean;
  /** Why the job's waiting step is not granted, if it waits. */
  waitingFor?: 'room' | 'signing-desk' | 'units';
  steps: { id: string; label: string; mark: StepMark }[];
}

export interface WorkflowOptions {
  scenarios: ScenarioSet;
  units: UnitFloors;
  maxJobs?: number;
  seed?: number;
  /** Engine stream override (tests instrument it); defaults to the `engine` stream of `seed`. */
  rng?: Rng;
  /** §7.4 scripted opening (default on). */
  scripted?: boolean;
  /** Generate jobs when slots free (default on); off for hand-built fixtures (`startJob`). */
  autoStart?: boolean;
  /** `max`: every durationS at its maximum and no duration draws (AC-5). */
  durations?: 'random' | 'max';
  /** Replace every positive rejectP (AC-8 fixture: 1). */
  forceRejectP?: number;
  /** Test hook: fixed outcome for (job, step, run index); draws nothing when it answers. */
  outcome?: (job: number, step: string, run: number) => Outcome | undefined;
  /** Unscripted jobs use only this variant (AC-5 per-variant runs). */
  onlyVariant?: string;
  movement?: Movement;
  isSelected?: (unit: string) => boolean;
  titles?: () => string;
  /** Keep the full event trace and grant rounds (tests). */
  record?: boolean;
}

export interface Workflow {
  readonly time: number;
  step(dt: number): void;
  /** Starts a job now, outside the slot schedule (fixtures). Returns its number. */
  startJob(variant: string, outcomes?: ScriptOutcomes): number;
  /** Events since the last call; the director/strip must drain every frame (the queue is unbounded). */
  drainEvents(): WfEvent[];
  /** Full trace, kept only with `record` (tests). */
  trace(): readonly WfEvent[];
  rounds(): readonly GrantRound[];
  jobs(): JobView[];
  unitState(unit: string): UnitState | null;
  running(): { job: number; step: string; kind: string; units: string[]; paused: boolean }[];
  /** Units holding an extended escort reservation (R-11), with the job. */
  extended(): [string, number][];
  roomHolder(): number | null;
  /** Elapsed fraction 0-1 of job n's running step (0 while it gathers); null when not running. */
  stepProgress(n: number, step: string): number | null;
  draws(): Record<DrawPurpose, number>;
  /** Floor for the strip entry of job n (§7.6b); null when the job is done or unknown. */
  stripFloor(n: number): number | null;
  snapshot(): unknown;
  readonly movement: Movement;
}

// ---------------------------------------------------------------- internal model
interface CarryState {
  idx: number;
  phase: 'walk' | 'wait' | 'handover';
  t: number;
  inPlace: boolean;
}

interface Run {
  key: string;
  job: Job;
  step: Step;
  units: string[];
  phase: 'gather' | 'copy' | 'active';
  elapsed: number;
  duration: number;
  outcome?: Outcome;
  call?: CallRun;
  carry?: CarryState;
  moved: boolean;
  needsCopy: boolean;
}

interface CallRun {
  key: string;
  job: Job;
  step: Step;
  caller: string;
  room: boolean;
  open: number;
  rejected: boolean;
  queue: Run[];
  handing?: { run: Run; t: number };
}

interface Cursor {
  stepId: string;
  since: number;
  call?: CallRun;
}

interface Job {
  n: number;
  scenario: Scenario;
  ix: ScenarioIndex;
  title: string;
  outcomes?: ScriptOutcomes;
  loops: number;
  loopCount: Map<string, number>;
  runCount: Map<string, number>;
  cursors: Cursor[];
  holdsRoom: boolean;
  marks: Map<string, StepMark>;
  prevStep?: Step;
  lastStep?: Step;
  finishedAt?: number;
  trays: Set<string>;
  waitingFor?: JobView['waitingFor'];
}

interface Pending {
  at: number;
  script?: ScriptEntry;
  slot: boolean;
}

export function createWorkflow(opts: WorkflowOptions): Workflow {
  const maxJobs = opts.maxJobs ?? 3;
  const rng: Rng = opts.rng ?? createRng(streamSeed(opts.seed ?? MASTER_SEED, 'engine'));
  const movement = opts.movement ?? createNavMovement({ units: opts.units });
  const isSelected = opts.isSelected ?? (() => false);
  const record = opts.record ?? false;
  const scenarioIx = new Map(opts.scenarios.scenarios.map((s) => [s.id, indexScenario(s)]));
  const drawCounts: Record<DrawPurpose, number> = { outcome: 0, lane: 0, variant: 0, 'start-delay': 0, duration: 0 };
  const queue: WfEvent[] = [];
  const full: WfEvent[] = [];
  const rounds: GrantRound[] = [];

  let time = 0;
  let jobCounter = 0;
  let runCounter = 0;
  const jobs: Job[] = [];
  const finished: Job[] = [];
  const runs: Run[] = [];
  const calls: CallRun[] = [];
  const reserved = new Map<string, string>(); // unit → run/call key
  const extendedEscort = new Map<string, number>(); // unit → job n (R-11)
  const pending: Pending[] = [];
  const scriptQueue: ScriptEntry[] = [];

  const draw = (purpose: DrawPurpose): number => {
    drawCounts[purpose]++;
    return rng();
  };
  const emit = (e: Omit<WfEvent, 't'>): void => {
    const ev = { t: round3(time), ...e };
    queue.push(ev);
    if (record) full.push(ev);
  };

  // -------------------------------------------------------------- places and targets
  const floorOfHome = (u: string): number => opts.units.get(u) ?? 0;
  const desk = (u: string): Target => ({ floor: floorOfHome(u), spot: `desk:${u}` });
  const handoverSpot = (u: string): Target => ({ floor: floorOfHome(u), spot: `handover:${u}` });
  const home = (u: string): Target => ({ floor: floorOfHome(u), spot: `home:${u}` });
  const ROOM: Target = { floor: ROOM_FLOOR, spot: 'meeting-room' };
  const SIGNING: Target = { floor: SIGNING_FLOOR, spot: 'signing-desk' };

  /** Meeting lead (REQ-15): actors[0] of a meeting step stands at the whiteboard, the rest sit. */
  const ROOM_LEAD: Target = { floor: ROOM_FLOOR, spot: 'meeting-room:lead' };
  const targetFor = (s: Step, actor?: string): Target => {
    switch (s.place) {
      case 'signing-desk':
        return SIGNING;
      case 'meeting-room':
        return s.kind === 'meeting' && actor !== undefined && actor === s.actors[0] ? ROOM_LEAD : ROOM;
      case 'pair-desk':
        return desk(s.actors[1]!);
      default:
        return desk(s.actors[0]!);
    }
  };

  // -------------------------------------------------------------- job generation (REQ-4, §7.4)
  const slotsUsed = (): number => jobs.length + pending.length;

  function scheduleInitial(): void {
    if (opts.scripted ?? true) {
      for (const e of scriptedStart(maxJobs)) {
        if (e.at === 'slot') scriptQueue.push(e);
        else pending.push({ at: e.at, script: e, slot: false });
      }
    }
    if (opts.autoStart ?? true) {
      while (slotsUsed() + scriptQueue.length < maxJobs) scheduleUnscripted();
    }
  }

  function scheduleUnscripted(): void {
    const [lo, hi] = START_DELAY;
    // The start is checked once per step, so the drawn delay leaves one maximal step of headroom.
    const d = lo + draw('start-delay') * (hi - lo - 0.1);
    pending.push({ at: time + d, slot: true });
  }

  function onSlotFree(): void {
    emit({ type: 'slot-free', job: 0 });
    const s = scriptQueue.shift();
    if (s) pending.push({ at: time + SLOT_START_SCRIPTED_S, script: s, slot: true });
    else if (opts.autoStart ?? true) scheduleUnscripted();
  }

  function pickVariant(): string {
    if (opts.onlyVariant) {
      draw('lane');
      draw('variant');
      return opts.onlyVariant;
    }
    const lw = opts.scenarios.laneWeights;
    let r = draw('lane') * 100;
    let lane = 3;
    for (let i = 0; i < 4; i++) {
      if (r < lw[i]!) {
        lane = i;
        break;
      }
      r -= lw[i]!;
    }
    const pool = opts.scenarios.scenarios.filter((s) => s.lane === lane);
    const total = pool.reduce((a, s) => a + s.weight, 0);
    let v = draw('variant') * total;
    for (const s of pool) {
      if (v < s.weight) return s.id;
      v -= s.weight;
    }
    return pool[pool.length - 1]!.id;
  }

  function startJob(variant: string, outcomes?: ScriptOutcomes): number {
    const ix = scenarioIx.get(variant);
    if (!ix) throw new Error(`unknown variant ${variant}`);
    const job: Job = {
      n: ++jobCounter,
      scenario: ix.scenario,
      ix,
      title: opts.titles ? opts.titles() : '',
      outcomes,
      loops: 0,
      loopCount: new Map(),
      runCount: new Map(),
      cursors: [{ stepId: ix.scenario.start, since: time }],
      holdsRoom: false,
      marks: new Map(),
      trays: new Set(),
    };
    jobs.push(job);
    emit({ type: 'job-start', job: job.n, variant });
    return job.n;
  }

  // -------------------------------------------------------------- reservations
  const isFree = (u: string): boolean => !reserved.has(u) && !extendedEscort.has(u);
  const busyList = (): string[] => [...new Set([...reserved.keys(), ...extendedEscort.keys()])].sort();

  function reserve(units: string[], key: string): void {
    for (const u of units) {
      if (reserved.has(u)) throw new Error(`double reservation of ${u}`);
      reserved.set(u, key);
    }
  }

  function release(u: string): void {
    reserved.delete(u);
    if (!reserved.has(u) && !extendedEscort.has(u)) movement.moveTo(u, home(u));
  }

  const seatsOf = (r: Run): number => {
    if (r.step.place !== 'meeting-room') return 0;
    if (r.step.kind === 'meeting') return r.step.actors.length - 1;
    if (r.call) return 1;
    return 0;
  };
  const seatsTakenBy = (job: Job): number =>
    runs.filter((r) => r.job === job).reduce((a, r) => a + seatsOf(r), 0) + calls.filter((c) => c.job === job && c.room).length;

  function needsOf(job: Job, s: Step): { units: string[]; seats: number; room: boolean; signing: boolean } {
    if (s.kind === 'call') {
      const branches = (s.parallel ?? []).map((b) => job.ix.byId.get(b)!);
      const units = [s.actors[0]!, ...branches.flatMap((b) => [...b.actors, ...(b.escort ? [b.escort] : [])])];
      const room = usesRoom(job.ix, s);
      const seats = room ? branches.filter((b) => b.place === 'meeting-room').length + 1 : 0;
      return { units, seats, room, signing: branches.some((b) => b.place === 'signing-desk') };
    }
    const units = [...s.actors, ...(s.escort ? [s.escort] : [])];
    const room = s.place === 'meeting-room';
    const seats = room && s.kind === 'meeting' ? s.actors.length - 1 : 0;
    return { units, seats, room, signing: s.place === 'signing-desk' };
  }

  const roomHolder = (): Job | undefined => jobs.find((j) => j.holdsRoom);
  const signingBusy = (): boolean => runs.some((r) => r.step.place === 'signing-desk');

  // -------------------------------------------------------------- grants (R-3)
  function grantRound(): void {
    interface Cand {
      job: Job;
      cursor: Cursor;
      step: Step;
      needs: ReturnType<typeof needsOf>;
      placeBlocked: boolean;
      holder: boolean;
      reason?: JobView['waitingFor'];
    }
    const cands: Cand[] = [];
    for (const job of jobs) {
      job.waitingFor = undefined;
      for (const cursor of job.cursors) {
        const step = job.ix.byId.get(cursor.stepId)!;
        const needs = needsOf(job, step);
        let reason: JobView['waitingFor'];
        if (needs.room) {
          const holder = roomHolder();
          if ((holder && holder !== job) || needs.seats > ROOM_SEATS - seatsTakenBy(job)) reason = 'room';
        }
        if (!reason && needs.signing && signingBusy()) reason = 'signing-desk';
        cands.push({ job, cursor, step, needs, placeBlocked: reason !== undefined, holder: job.holdsRoom, reason });
      }
    }
    if (cands.length === 0) return;
    const busyBefore = record ? busyList() : [];
    const blocked = cands.filter((c) => c.placeBlocked);
    const open = cands.filter((c) => !c.placeBlocked);
    open.sort((a, b) => Number(b.holder) - Number(a.holder) || a.cursor.since - b.cursor.since || a.job.n - b.job.n || (a.step.id < b.step.id ? -1 : a.step.id > b.step.id ? 1 : 0));
    const claimed = new Set<string>();
    const granted = new Set<Cand>();
    for (const c of open) {
      const ok = c.needs.units.every((u) => isFree(u) && !claimed.has(u));
      // A step granted earlier in this round may have taken the room or the signing desk.
      const placeOk = (!c.needs.room || !roomHolder() || roomHolder() === c.job) && (!c.needs.signing || !signingBusy())
        && (!c.needs.room || c.needs.seats <= ROOM_SEATS - seatsTakenBy(c.job));
      if (ok && placeOk) {
        grant(c.job, c.cursor, c.step);
        granted.add(c);
      } else {
        for (const u of c.needs.units) claimed.add(u);
        c.reason = placeOk ? 'units' : c.needs.room ? 'room' : 'signing-desk';
      }
    }
    for (const c of cands) if (!granted.has(c) && c.reason) c.job.waitingFor ??= c.reason;
    if (record) {
      rounds.push({
        t: round3(time),
        busy: busyBefore,
        candidates: [...open, ...blocked].map((c) => ({
          job: c.job.n,
          step: c.step.id,
          since: round3(c.cursor.since),
          holder: c.holder,
          needs: [...c.needs.units],
          room: c.needs.room,
          signing: c.needs.signing,
          placeBlocked: c.placeBlocked,
          granted: granted.has(c),
        })),
      });
    }
  }

  function decide(job: Job, s: Step, call?: CallRun): Outcome | undefined {
    const p0 = s.rejectP ?? 0;
    if (!(p0 > 0)) return undefined;
    const owner = call ? call.step : s;
    const max = owner.loop?.maxLoops ?? 0;
    if ((job.loopCount.get(owner.id) ?? 0) >= max) return 'pass'; // forced pass: no draw (REQ-9)
    const run = job.runCount.get(s.id) ?? 0;
    // A call's run count was already raised when it was granted.
    const ownerRun = call ? (job.runCount.get(owner.id) ?? 1) - 1 : run;
    if (job.outcomes) return job.outcomes[s.id]?.[run] ?? job.outcomes[owner.id]?.[ownerRun] ?? 'pass';
    const fixed = opts.outcome?.(job.n, s.id, run);
    if (fixed) return fixed;
    const p = opts.forceRejectP ?? p0;
    return draw('outcome') < p ? 'reject' : 'pass';
  }

  function durationOf(s: Step): number {
    if (!s.durationS) return 0;
    const [lo, hi] = s.durationS;
    if ((opts.durations ?? 'random') === 'max' || lo === hi) return hi;
    return lo + draw('duration') * (hi - lo);
  }

  function newRun(job: Job, s: Step, units: string[], call?: CallRun): Run {
    const run: Run = {
      key: `r${++runCounter}`,
      job,
      step: s,
      units,
      phase: 'gather',
      elapsed: 0,
      duration: durationOf(s),
      call,
      moved: false,
      needsCopy: call !== undefined && call.room && s.place === 'meeting-room',
    };
    run.outcome = decide(job, s, call);
    job.runCount.set(s.id, (job.runCount.get(s.id) ?? 0) + 1);
    job.marks.set(s.id, 'now');
    reserve(units, run.key);
    runs.push(run);
    emit({ type: 'step-start', job: job.n, step: s.id, kind: s.kind, units: [...units], place: s.place });
    for (const a of s.actors) {
      if (job.trays.delete(a)) emit({ type: 'tray-take', job: job.n, step: s.id, to: a });
    }
    if (s.kind === 'carry') {
      run.carry = { idx: 0, phase: 'walk', t: 0, inPlace: false };
      beginCarryStop(run);
    } else {
      for (const a of s.actors) movement.moveTo(a, targetFor(s, a));
      if (s.escort) movement.moveTo(s.escort, handoverSpot(s.actors[0]!));
    }
    return run;
  }

  function grant(job: Job, cursor: Cursor, s: Step): void {
    job.cursors = job.cursors.filter((c) => c !== cursor);
    if (usesRoom(job.ix, s) && !job.holdsRoom) {
      job.holdsRoom = true;
      emit({ type: 'room-hold', job: job.n, step: s.id });
    }
    if (s.kind !== 'call') {
      newRun(job, s, needsOf(job, s).units, cursor.call);
      return;
    }
    const call: CallRun = {
      key: `c${++runCounter}`,
      job,
      step: s,
      caller: s.actors[0]!,
      room: usesRoom(job.ix, s),
      open: (s.parallel ?? []).length,
      rejected: false,
      queue: [],
    };
    reserve([call.caller], call.key);
    calls.push(call);
    job.runCount.set(s.id, (job.runCount.get(s.id) ?? 0) + 1);
    job.marks.set(s.id, 'now');
    emit({ type: 'call', job: job.n, step: s.id, units: needsOf(job, s).units });
    if (call.room) emit({ type: 'copies', job: job.n, step: s.id, prop: 'spec-paper', copy: call.open, to: call.caller });
    for (const b of s.parallel ?? []) {
      const bs = job.ix.byId.get(b)!;
      newRun(job, bs, [...bs.actors, ...(bs.escort ? [bs.escort] : [])], call);
    }
  }

  // -------------------------------------------------------------- carries (REQ-6)
  function beginCarryStop(run: Run): void {
    const c = run.carry!;
    const to = run.step.to![c.idx]!;
    const prev = run.job.prevStep;
    // Escort exception: the recipient is the escort of the step the carrier comes from (back-sc).
    c.inPlace = prev !== undefined && prev.escort === to && prev.actors[0] === run.step.actors[0] && extendedEscort.get(to) === run.job.n;
    c.phase = 'walk';
    c.t = 0;
    const carrier = run.step.actors[0]!;
    if (!c.inPlace) {
      movement.moveTo(carrier, handoverSpot(to));
      return;
    }
    // Where both stand: the carrier stays at (or returns to) the review place instead of walking home
    // on release, and the escort comes to (or stays at) the carrier's hand-over spot.
    movement.moveTo(carrier, inPlaceSpot(run));
    if (!isSelected(to)) movement.moveTo(to, handoverSpot(carrier));
  }

  /** The carrier's spot for an in-place hand-over: where it stood in the step it comes from. */
  function inPlaceSpot(run: Run): Target {
    return targetFor(run.job.prevStep!, run.step.actors[0]);
  }

  /** Escort exception: carrier at its review place and escort at the carrier's hand-over spot. */
  function coLocated(run: Run, to: string): boolean {
    const carrier = run.step.actors[0]!;
    return movement.isAt(carrier, inPlaceSpot(run)) && movement.isAt(to, handoverSpot(carrier));
  }

  function recipientReady(run: Run, to: string): boolean {
    if (isSelected(to)) return false; // a selected robot counts as busy (REQ-17)
    const freeHere = isFree(to) || extendedEscort.get(to) === run.job.n;
    if (!freeHere) return false;
    if (run.carry!.inPlace) return coLocated(run, to);
    return movement.isAt(to, desk(to));
  }

  function finishStop(run: Run, to: string): void {
    if (extendedEscort.get(to) === run.job.n) {
      extendedEscort.delete(to);
      if (!reserved.has(to)) movement.moveTo(to, home(to));
    }
    const c = run.carry!;
    c.idx++;
    if (c.idx >= run.step.to!.length) endRun(run);
    else beginCarryStop(run);
  }

  function advanceCarry(run: Run, dt: number): void {
    const c = run.carry!;
    const carrier = run.step.actors[0]!;
    const to = run.step.to![c.idx]!;
    if (c.phase === 'walk') {
      if (!movement.isAt(carrier, c.inPlace ? inPlaceSpot(run) : handoverSpot(to))) return;
      if (recipientReady(run, to)) {
        c.phase = 'handover';
        c.t = 0;
      } else {
        c.phase = 'wait';
        c.t = 0;
        emit({ type: 'wait-start', job: run.job.n, step: run.step.id, from: carrier, to });
        // A free recipient away from its desk is called there (§7.5 interrupt transition).
        if (isFree(to) && !isSelected(to) && !movement.isAt(to, desk(to))) movement.moveTo(to, desk(to));
        return;
      }
    }
    if (c.phase === 'wait') {
      c.t += dt;
      if (recipientReady(run, to)) {
        emit({ type: 'wait-end', job: run.job.n, step: run.step.id, from: carrier, to });
        c.phase = 'handover';
        c.t = 0;
        return;
      }
      if (c.t + EPS >= WAIT_ALLOWANCE_S) {
        emit({ type: 'wait-end', job: run.job.n, step: run.step.id, from: carrier, to });
        run.job.trays.add(to);
        emit({ type: 'tray-drop', job: run.job.n, step: run.step.id, from: carrier, to, prop: run.step.prop, copy: c.idx });
        finishStop(run, to);
      }
      return;
    }
    c.t += dt;
    if (c.t + EPS >= HANDOVER_S) {
      emit({ type: 'handover', job: run.job.n, step: run.step.id, from: carrier, to, prop: run.step.prop, copy: c.idx });
      finishStop(run, to);
    }
  }

  // -------------------------------------------------------------- run lifecycle
  const runPaused = (r: Run): boolean => r.units.some(isSelected);
  const callPaused = (c: CallRun): boolean => isSelected(c.caller);

  function allArrived(r: Run): boolean {
    // A review's escort waits beside the reviewer (R-11): its clock runs once the escort is there too.
    const escort = r.step.escort;
    return r.step.actors.every((a) => movement.isAt(a, targetFor(r.step, a))) && (escort === undefined || movement.isAt(escort, handoverSpot(r.step.actors[0]!)));
  }

  function advanceRun(r: Run, dt: number): void {
    if (r.step.kind === 'carry') {
      advanceCarry(r, dt);
      return;
    }
    if (r.phase === 'gather') {
      if (!r.moved && r.step.actors.some((a) => movement.phase(a) !== 'still')) r.moved = true;
      if (!allArrived(r)) return;
      r.moved = true;
      if (r.needsCopy) {
        r.phase = 'copy';
        r.call!.queue.push(r);
        return;
      }
      r.phase = 'active';
      return;
    }
    if (r.phase === 'copy') return;
    r.elapsed += dt;
    if (r.elapsed + EPS >= r.duration) endRun(r);
  }

  function advanceCall(c: CallRun, dt: number): void {
    if (!c.handing) {
      const next = c.queue.shift();
      if (next) c.handing = { run: next, t: 0 };
      else return;
    }
    c.handing.t += dt;
    if (c.handing.t + EPS >= HANDOVER_S) {
      const r = c.handing.run;
      emit({ type: 'handover', job: c.job.n, step: r.step.id, from: c.caller, to: r.step.actors[0], prop: 'spec-paper', copy: (c.step.parallel ?? []).indexOf(r.step.id) });
      r.phase = 'active';
      c.handing = undefined;
    }
  }

  function endRun(r: Run): void {
    const idx = runs.indexOf(r);
    if (idx >= 0) runs.splice(idx, 1);
    const job = r.job;
    const s = r.step;
    const rejected = r.outcome === 'reject';
    emit({ type: 'step-end', job: job.n, step: s.id, kind: s.kind, outcome: r.outcome });
    if (s.kind === 'sign') emit({ type: 'sign', job: job.n, step: s.id, place: s.place });
    // R-11: on reject the escort stays reserved until the carry-back hand-over or tray drop ends.
    if (rejected && s.escort) {
      extendedEscort.set(s.escort, job.n);
      reserved.delete(s.escort);
    }
    for (const u of r.units) if (reserved.get(u) === r.key) release(u);
    job.marks.set(s.id, rejected ? 'returned' : 'done');
    job.lastStep = s;
    if (r.call) {
      const call = r.call;
      if (rejected) call.rejected = true;
      const nextId = typeof s.next === 'string' ? s.next : undefined;
      if (nextId !== undefined && nextId !== call.step.join) {
        job.cursors.push({ stepId: nextId, since: time, call });
        return;
      }
      call.open--;
      if (call.open === 0) endCall(call);
      return;
    }
    job.prevStep = s;
    if (rejected) {
      afterReject(job, s);
      return;
    }
    if (s.kind === 'done') {
      finishJob(job);
      return;
    }
    proceed(job, s, typeof s.next === 'string' ? s.next : undefined);
  }

  function endCall(call: CallRun): void {
    const job = call.job;
    const i = calls.indexOf(call);
    if (i >= 0) calls.splice(i, 1);
    emit({ type: 'step-end', job: job.n, step: call.step.id, kind: 'call', outcome: call.rejected ? 'reject' : 'pass' });
    release(call.caller);
    job.marks.set(call.step.id, call.rejected ? 'returned' : 'done');
    job.prevStep = call.step;
    job.lastStep = call.step;
    if (call.rejected) afterReject(job, call.step);
    else proceed(job, call.step, call.step.join);
  }

  function afterReject(job: Job, s: Step): void {
    job.loopCount.set(s.id, (job.loopCount.get(s.id) ?? 0) + 1);
    job.loops++;
    emit({ type: 'reject', job: job.n, step: s.id, loops: job.loops });
    proceed(job, s, s.loop!.to);
  }

  function proceed(job: Job, from: Step, nextId: string | undefined): void {
    if (nextId === undefined) return;
    if (job.holdsRoom && !roomAhead(job.ix, nextId)) {
      job.holdsRoom = false;
      emit({ type: 'room-release', job: job.n, step: from.id });
    }
    job.cursors.push({ stepId: nextId, since: time });
    if (job.marks.get(nextId) !== 'returned') job.marks.set(nextId, 'next');
  }

  function finishJob(job: Job): void {
    jobs.splice(jobs.indexOf(job), 1);
    job.finishedAt = time;
    finished.push(job);
    emit({ type: 'job-done', job: job.n, loops: job.loops });
    onSlotFree();
  }

  // -------------------------------------------------------------- views
  function frozen(u: string): boolean {
    if (isSelected(u)) return true;
    const key = reserved.get(u);
    if (!key) return false;
    const r = runs.find((x) => x.key === key);
    if (r) return runPaused(r);
    const c = calls.find((x) => x.key === key);
    return c ? callPaused(c) : false;
  }

  function jobView(job: Job, done: boolean): JobView {
    const own = runs.filter((r) => r.job === job);
    const call = calls.find((c) => c.job === job);
    let label: string;
    if (call) label = call.step.labelTr;
    else if (own[0]) label = own[0].step.labelTr;
    else if (job.cursors[0]) label = job.ix.byId.get(job.cursors[0].stepId)!.labelTr;
    else label = job.lastStep?.labelTr ?? '';
    const steps = job.scenario.steps
      .filter((s) => !job.ix.branchOf.has(s.id) || job.marks.has(s.id))
      .map((s) => ({ id: s.id, label: s.labelTr, mark: job.marks.get(s.id) ?? ('next' as StepMark) }));
    return {
      n: job.n,
      lane: job.scenario.lane,
      variant: job.scenario.id,
      title: job.title,
      label,
      loops: job.loops,
      done,
      pausedBySelection: own.some(runPaused) || (call !== undefined && callPaused(call)),
      waitingFor: own.length === 0 && !call ? job.waitingFor : undefined,
      steps,
    };
  }

  function unitState(u: string): UnitState | null {
    const key = reserved.get(u);
    const ext = extendedEscort.get(u);
    if (!key && ext === undefined) {
      // A free recipient called to its desk walks there (§7.5).
      for (const r of runs) {
        if (r.carry && r.carry.phase === 'wait' && r.step.to![r.carry.idx] === u && movement.phase(u) !== 'still') {
          return { state: 'step-walk', job: r.job.n, step: r.step.id, label: r.step.labelTr };
        }
      }
      return null;
    }
    if (!key && ext !== undefined) {
      const job = jobs.find((j) => j.n === ext)!;
      const s = job.prevStep ?? job.lastStep!;
      return { state: 'escort-wait', job: ext, step: s.id, label: s.labelTr, other: s.actors[0] };
    }
    const call = calls.find((c) => c.key === key);
    if (call) {
      const st: DirectedState = call.handing ? 'handover' : 'call-hold';
      return { state: st, job: call.job.n, step: call.step.id, label: call.step.labelTr };
    }
    const r = runs.find((x) => x.key === key)!;
    const base = { job: r.job.n, step: r.step.id, label: r.step.labelTr };
    const mv = movement.phase(u);
    if (r.step.escort === u) return { ...base, state: 'escort-wait', other: r.step.actors[0] };
    if (r.carry) {
      const to = r.step.to![r.carry.idx]!;
      if (mv === 'call' || mv === 'call-wait' || mv === 'ride') return { ...base, state: mv, other: to, prop: r.step.prop };
      const state: DirectedState = r.carry.phase === 'walk' ? 'carry-walk' : r.carry.phase;
      return { ...base, state, other: to, prop: r.step.prop };
    }
    if (r.phase === 'gather' || r.phase === 'copy') {
      if (r.call && !r.moved) return { ...base, state: 'called' };
      if (mv === 'call' || mv === 'call-wait' || mv === 'ride') return { ...base, state: mv };
      if (mv === 'walk') return { ...base, state: 'step-walk' };
      if (r.step.kind === 'meeting') return { ...base, state: r.step.actors[0] === u ? 'present' : 'seat-wait' };
      if (r.phase === 'copy' || r.call) return { ...base, state: 'seated' };
      return { ...base, state: 'step-work' };
    }
    switch (r.step.kind) {
      case 'meeting':
        return { ...base, state: r.step.actors[0] === u ? 'present' : 'seated' };
      case 'review':
      case 'test':
        return { ...base, state: r.step.kind };
      case 'build': {
        const progress = Math.min(100, Math.floor((100 * r.elapsed) / Math.max(r.duration, EPS) + EPS));
        if (r.step.actors.length === 2) return { ...base, state: 'pair', other: r.step.actors.find((a) => a !== u), progress };
        return { ...base, state: 'build', progress };
      }
      case 'sign':
        if (u === 'ceo') return { ...base, state: r.elapsed < r.duration / 2 ? 'stamp-raise' : 'stamp-press' };
        return { ...base, state: 'step-work' };
      default:
        return { ...base, state: 'step-work' };
    }
  }

  function stripFloor(n: number): number | null {
    const job = jobs.find((j) => j.n === n);
    if (!job) return null;
    const own = runs.filter((r) => r.job === job);
    const call = calls.find((c) => c.job === job);
    const actors = [...own.flatMap((r) => r.step.actors), ...(call ? [call.caller] : [])];
    if (actors.length) return Math.min(...actors.map((a) => movement.floorOf(a)));
    const waiting = [...job.cursors].sort((a, b) => a.since - b.since)[0];
    if (waiting) return movement.floorOf(job.ix.byId.get(waiting.stepId)!.actors[0]!);
    return job.lastStep ? movement.floorOf(job.lastStep.actors[0]!) : null;
  }

  scheduleInitial();

  const wf: Workflow = {
    get time() {
      return time;
    },
    movement,
    step(dt) {
      if (!(dt > 0)) return;
      time += dt;
      movement.step(dt, frozen);
      // Job starts due now.
      pending.sort((a, b) => a.at - b.at);
      while (pending.length && pending[0]!.at <= time + EPS) {
        const p = pending.shift()!;
        if (p.script) startJob(p.script.variant, p.script.outcomes);
        else startJob(pickVariant());
      }
      for (const c of [...calls]) if (!callPaused(c)) advanceCall(c, dt);
      for (const r of [...runs]) if (runs.includes(r) && !runPaused(r)) advanceRun(r, dt);
      // Finished jobs leave the strip after 4 s of simulation time.
      for (let i = finished.length - 1; i >= 0; i--) if (time - finished[i]!.finishedAt! + EPS >= DONE_DISPLAY_S) finished.splice(i, 1);
      grantRound();
    },
    startJob,
    drainEvents: () => queue.splice(0, queue.length),
    trace: () => full,
    rounds: () => rounds,
    jobs: () => [...jobs.map((j) => jobView(j, false)), ...finished.map((j) => jobView(j, true))],
    unitState,
    running: () => [
      ...runs.map((r) => ({ job: r.job.n, step: r.step.id, kind: r.step.kind, units: [...r.units], paused: runPaused(r) })),
      ...calls.map((c) => ({ job: c.job.n, step: c.step.id, kind: 'call', units: [c.caller], paused: callPaused(c) })),
    ],
    extended: () => [...extendedEscort],
    roomHolder: () => roomHolder()?.n ?? null,
    stepProgress(n, step) {
      const r = runs.find((x) => x.job.n === n && x.step.id === step);
      if (!r) return null;
      if (r.phase !== 'active') return 0;
      return r.duration > 0 ? Math.min(1, r.elapsed / r.duration) : 1;
    },
    draws: () => ({ ...drawCounts }),
    stripFloor,
    snapshot() {
      const jobSnap = (j: Job) => ({
        n: j.n,
        variant: j.scenario.id,
        title: j.title,
        loops: j.loops,
        loopCount: [...j.loopCount],
        runCount: [...j.runCount],
        cursors: j.cursors.map((c) => ({ stepId: c.stepId, since: c.since, call: c.call?.key })),
        holdsRoom: j.holdsRoom,
        marks: [...j.marks],
        trays: [...j.trays],
        prev: j.prevStep?.id,
        finishedAt: j.finishedAt,
      });
      return {
        time,
        jobCounter,
        runCounter,
        jobs: jobs.map(jobSnap),
        finished: finished.map(jobSnap),
        runs: runs.map((r) => ({ key: r.key, job: r.job.n, step: r.step.id, units: r.units, phase: r.phase, elapsed: r.elapsed, duration: r.duration, outcome: r.outcome, carry: r.carry ? { ...r.carry } : undefined, moved: r.moved })),
        calls: calls.map((c) => ({ key: c.key, job: c.job.n, step: c.step.id, open: c.open, rejected: c.rejected, queue: c.queue.map((r) => r.key), handing: c.handing ? { run: c.handing.run.key, t: c.handing.t } : undefined })),
        reserved: [...reserved],
        extended: [...extendedEscort],
        pending: pending.map((p) => ({ at: p.at, variant: p.script?.variant, slot: p.slot })),
        scriptQueue: scriptQueue.map((s) => s.variant),
        draws: { ...drawCounts },
        events: queue.length + full.length,
        movement: movement.snapshot(),
      };
    },
  };
  return wf;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
