// Director (spec 0002 §6 option A, T-6): turns the workflow engine's reservations and events into
// what each robot shows. Pure and deterministic like activity.ts: no three.js, no DOM, no timers, no
// random draws. It reads `workflow.unitState`, the drained events and the Movement port only.
//
// - Ambient robots keep the 0001 cycle (activity.ts); a reservation interrupts it (§7.5 interrupt rows)
//   and the robot follows the engine; after its last step it walks home and idles again (new idle draw).
// - Rendered positions: exact positions from the movement adapter when it offers them (`position`,
//   T-5 nav), otherwise a follower walks to the anchor of the engine's current target spot.
// - Props and copies (REQ-6), stamp (REQ-7), progress bar, QA lamp and lane-0 evidence screen (REQ-8).
import type { PropKind, Scenario, ScenarioSet, Step } from '../data/scenarios';
import { floorY, MEETING_ROOM, SIGNING_SPOTS, STAFF_LANDING, type DeskPlace, type FloorLayout, type XZ } from '../sim/layout';
import type { Movement, Target } from '../sim/movement';
import type { Outcome, UnitState, WfEvent } from '../sim/workflow';
import { isWaiting, WALK_SPEED, type ActivityKind, type ActivityView, type DirectedKind, type Point, type PoseKind } from './activity';

/** Lamp and lane-0 evidence screen show for 6 s of simulation time (REQ-8). */
export const LAMP_S = 6;
export const EVIDENCE_S = 6;
/** The finished build keeps "100 %" on screen this long before the code view returns. */
export const PROGRESS_HOLD_S = 2;
/** Follower catch-up speed bounds (u/s); see the Ruling in the T-6 report. */
const FOLLOW_MAX = 4;
const EPS = 1e-6;

export interface EnginePort {
  readonly time: number;
  unitState(unit: string): UnitState | null;
  readonly movement: Movement;
}

export interface AmbientPort {
  get(id: string): ActivityView;
  reserve(id: string): void;
  resume(id: string): void;
}

export interface PropCopy {
  key: string;
  job: number;
  step: string;
  kind: PropKind;
  copy: number;
  holder: string | null;
  tray: string | null;
  stamped: boolean;
}

export type Marker = 'hourglass' | 'call' | null;
export type LampState = 'off' | 'pass' | 'fail';
export type ScreenView = { mode: 'code' } | { mode: 'progress'; pct: number } | { mode: 'evidence' };

export interface RobotView {
  id: string;
  directed: boolean;
  state: DirectedKind | ActivityKind;
  pose: PoseKind;
  x: number;
  y: number;
  z: number;
  facing: number;
  walkPhase: number;
  floor: number;
  marker: Marker;
  /** The CEO holds the stamp in `stamp-raise` / `stamp-press`. */
  stamp: boolean;
  /** Desk screen scrolls code (ambient work, or desk work in a step). */
  screenScroll: boolean;
}

export interface Transition {
  t: number;
  id: string;
  from: string;
  to: string;
}

export interface Anchor {
  floor: number;
  x: number;
  z: number;
  facing: number;
  sit: boolean;
}

export interface Anchors {
  desk(u: string): Anchor;
  home(u: string): Anchor;
  handover(owner: string, slot: number): Anchor;
  pair(owner: string): Anchor;
  signing(slot: number): Anchor;
  lead(): Anchor;
  seat(i: number): Anchor;
  signTable(): Anchor;
  landing(floor: number, slot: number): Anchor;
  cabin(floor: number, slot: number): Anchor;
  deskOf(u: string): { floor: number; place: DeskPlace } | null;
}

const at = (floor: number, p: XZ, facing: number, sit = false): Anchor => ({ floor, x: p.x, z: p.z, facing, sit });

/** Scene anchors from the floor layouts the tower was built from (world x/z equal layout x/z). */
export function createAnchors(layouts: readonly FloorLayout[]): Anchors {
  const desks = new Map<string, { floor: number; place: DeskPlace }>();
  for (const l of layouts) for (const d of l.desks) desks.set(d.owner, { floor: l.floor, place: d });
  const get = (u: string): { floor: number; place: DeskPlace } => {
    const d = desks.get(u);
    if (!d) throw new Error(`no desk for ${u}`);
    return d;
  };
  const room = MEETING_ROOM.floor;
  return {
    desk: (u) => {
      const d = get(u);
      return at(d.floor, d.place.seat, Math.PI, true);
    },
    home: (u) => {
      const d = get(u);
      return at(d.floor, d.place.home, 0);
    },
    handover: (owner, slot) => {
      const d = get(owner);
      return at(d.floor, d.place.handover[slot % 2] ?? d.place.seat, Math.PI);
    },
    pair: (owner) => {
      const d = get(owner);
      return at(d.floor, d.place.pair, Math.PI);
    },
    signing: (slot) => at(5, SIGNING_SPOTS[slot % SIGNING_SPOTS.length] ?? { x: 0, z: 0 }, Math.PI),
    lead: () => at(room, MEETING_ROOM.leadSpot, MEETING_ROOM.leadSpot.facing),
    seat: (i) => {
      const s = MEETING_ROOM.seats[i % MEETING_ROOM.seats.length] ?? MEETING_ROOM.seats[0]!;
      return at(room, s, s.facing, true);
    },
    signTable: () => at(room, MEETING_ROOM.signSpot, MEETING_ROOM.signSpot.facing),
    landing: (floor, slot) => at(floor, STAFF_LANDING.waitingSpots[slot % 3] ?? STAFF_LANDING.entry, Math.PI / 2),
    cabin: (floor, slot) => at(floor, STAFF_LANDING.riderSpots[slot % STAFF_LANDING.riderSpots.length] ?? STAFF_LANDING.entry, -Math.PI / 2),
    deskOf: (u) => desks.get(u) ?? null,
  };
}

export interface DirectorOptions {
  scenarios: ScenarioSet;
  layouts: readonly FloorLayout[];
  /** Unit id → home floor, for every robot in the scene. */
  homeFloors: ReadonlyMap<string, number>;
  ambient: AmbientPort;
  /** Exact rendered position from the movement adapter, if it has one (T-5 nav); null = use anchors. */
  position?: (unit: string) => Point | null;
  /** Reduced motion: rendered positions cut to the goal (T-9 refines leg-start rendering). */
  still?: () => boolean;
}

export interface Director {
  ingest(events: readonly WfEvent[]): void;
  /** After the engine stepped `dt` simulation seconds (0 while paused). */
  update(dt: number, engine: EnginePort): void;
  view(unit: string): RobotView;
  copies(): readonly PropCopy[];
  held(unit: string): PropCopy[];
  /** Floor a copy is on: its holder's current floor, or its tray owner's desk floor. */
  copyFloor(c: PropCopy): number | null;
  lamp(unit: string): LampState;
  screen(unit: string): ScreenView;
  transitions(): readonly Transition[];
  /** Units with a QA lamp (test-step actors outside lane 0) and units with a step screen. */
  readonly lampUnits: readonly string[];
  readonly screenUnits: readonly string[];
}

interface Bot {
  id: string;
  homeFloor: number;
  mode: 'ambient' | 'directed' | 'return';
  state: DirectedKind | ActivityKind;
  pos: Point;
  floor: number;
  facing: number;
  walkPhase: number;
  moving: boolean;
  sit: boolean;
  slot: number;
}

const DESK_SCROLL = new Set<string>(['step-work', 'review', 'test']);

/** Reduced motion (REQ-19): progress shown in whole 10 % steps (floor, so 100 only when done). */
export const tenths = (pct: number): number => Math.floor(pct / 10) * 10;

export function createDirector(o: DirectorOptions): Director {
  const anchors = createAnchors(o.layouts);
  const byVariant = new Map<string, Scenario>(o.scenarios.scenarios.map((s) => [s.id, s]));
  const jobScenario = new Map<number, Scenario>();
  const bots = new Map<string, Bot>();
  const copies: PropCopy[] = [];
  const lamps = new Map<string, { outcome: Outcome; until: number }>();
  const evidence = new Map<string, number>();
  const progress = new Map<string, { pct: number; until?: number }>();
  const awaited = new Map<string, number>(); // recipient → open waits for it
  const claims = new Set<string>();
  const hands = new Map<string, string>(); // copy key → recipient, hand-over pending a shared floor
  const log: Transition[] = [];
  let now = 0;
  let copyCounter = 0;

  const lampUnits = new Set<string>();
  const screenUnits = new Set<string>();
  for (const s of o.scenarios.scenarios) {
    for (const st of s.steps) {
      if (st.kind === 'test') (s.lane === 0 ? screenUnits : lampUnits).add(st.actors[0]!);
      if (st.kind === 'build') screenUnits.add(deskOwnerOf(st));
    }
  }

  for (const [id, floor] of o.homeFloors) {
    const a = o.ambient.get(id);
    bots.set(id, { id, homeFloor: floor, mode: 'ambient', state: a.kind, pos: { x: a.x, y: a.y, z: a.z }, floor, facing: a.facing, walkPhase: 0, moving: false, sit: false, slot: 0 });
  }

  function deskOwnerOf(s: Step): string {
    return s.place === 'pair-desk' ? s.actors[1]! : s.actors[0]!;
  }
  const stepOf = (job: number, id: string | undefined): Step | undefined => (id ? jobScenario.get(job)?.steps.find((s) => s.id === id) : undefined);
  const bot = (u: string): Bot => {
    const b = bots.get(u);
    if (!b) throw new Error(`unknown robot ${u}`);
    return b;
  };

  // ------------------------------------------------------------ props and copies (REQ-6, REQ-7)
  function create(job: number, step: string, kind: PropKind, copy: number, holder: string): PropCopy {
    const c: PropCopy = { key: `p${++copyCounter}`, job, step, kind, copy, holder, tray: null, stamped: kind === 'spec-stamped' };
    copies.push(c);
    return c;
  }
  function retire(pred: (c: PropCopy) => boolean): void {
    for (let i = copies.length - 1; i >= 0; i--) {
      if (!pred(copies[i]!)) continue;
      claims.delete(copies[i]!.key);
      hands.delete(copies[i]!.key);
      copies.splice(i, 1);
    }
  }
  function find(job: number, holder: string | undefined, kind: string | undefined, copy: number | undefined, step?: string): PropCopy | undefined {
    const pool = copies.filter((c) => c.job === job && c.holder === holder && (kind === undefined || c.kind === kind));
    return pool.find((c) => c.copy === copy && c.step === step) ?? pool.find((c) => c.copy === copy) ?? pool[0];
  }

  function fileHeld(u: string, job?: number): void {
    for (const c of copies) {
      if (c.holder === u && (job === undefined || c.job === job)) {
        c.holder = null;
        c.tray = u;
      }
    }
  }

  function onStepStart(e: WfEvent, s: Step): void {
    switch (s.kind) {
      case 'carry': {
        const carrier = s.actors[0]!;
        retire((c) => c.job === e.job && c.holder === carrier);
        (s.to ?? []).forEach((_, i) => create(e.job, s.id, s.prop ?? 'spec-paper', i, carrier));
        break;
      }
      case 'intake':
        create(e.job, s.id, s.prop ?? 'envelope', 0, s.actors[0]!);
        break;
      case 'sign': {
        const signer = s.actors[0]!;
        const other = s.actors[1];
        const own = copies.find((c) => c.job === e.job && c.holder === signer && c.kind === 'spec-paper');
        if (own) break;
        const lead = other ? copies.find((c) => c.job === e.job && c.holder === other && c.kind === 'spec-paper') : undefined;
        if (lead) lead.holder = signer;
        else create(e.job, s.id, 'spec-paper', 0, signer); // l3: the lead lays the paper on the table
        break;
      }
      case 'build':
        progress.set(deskOwnerOf(s), { pct: 0 });
        break;
      default:
        break;
    }
  }

  function onStepEnd(e: WfEvent, s: Step): void {
    const actor = s.actors[0]!;
    switch (s.kind) {
      case 'intake': {
        const env = copies.find((c) => c.job === e.job && c.holder === actor && c.kind === 'envelope');
        if (env && s.actors[1]) env.holder = s.actors[1];
        break;
      }
      case 'sign': {
        // REQ-7: stamped (raise, press), then handed back to the carrier or meeting lead.
        for (const c of copies) {
          if (c.job !== e.job || c.holder !== actor || c.kind !== 'spec-paper') continue;
          c.stamped = true;
          c.holder = s.actors[1] ?? actor;
        }
        break;
      }
      case 'review': {
        // Each reviewer keeps its copy, filed in its tray (REQ-10); away from its desk floor it keeps
        // holding it until it is home (a prop changes floor only with its holder, AC-6).
        const b = bots.get(actor);
        if (b && b.floor === b.homeFloor) fileHeld(actor, e.job);
        break;
      }
      case 'test':
        if (jobScenario.get(e.job)?.lane === 0) evidence.set(actor, e.t + EVIDENCE_S);
        else lamps.set(actor, { outcome: e.outcome ?? 'pass', until: e.t + LAMP_S });
        break;
      case 'build':
        progress.set(deskOwnerOf(s), { pct: 100, until: e.t + PROGRESS_HOLD_S });
        break;
      default:
        break;
    }
  }

  /**
   * Hand a copy over. If the two robots are not on one floor (the engine's escort exception does not
   * wait for the escort to arrive), the giver keeps it until both are on one floor, so the copy
   * never changes floor outside a ride (AC-6).
   */
  function handTo(c: PropCopy, to: string): void {
    const from = c.holder ? bots.get(c.holder) : undefined;
    const rec = bots.get(to);
    if (!from || !rec || from.floor === rec.floor) {
      c.holder = to;
      hands.delete(c.key);
    } else hands.set(c.key, to);
  }
  function settleHands(): void {
    for (const [key, to] of hands) {
      const c = copies.find((x) => x.key === key);
      if (!c) hands.delete(key);
      else if (c.holder && bots.get(c.holder)?.floor === bots.get(to)?.floor) handTo(c, to);
    }
  }

  /** Tray copies whose owner's step has started: picked up as soon as the owner is on its desk floor. */
  function pickUp(): void {
    for (const c of copies) {
      if (!claims.has(c.key) || !c.tray) continue;
      const b = bots.get(c.tray);
      if (b && b.floor === anchors.deskOf(c.tray)?.floor) {
        c.holder = c.tray;
        c.tray = null;
        claims.delete(c.key);
      }
    }
  }

  /** A called recipient stays at its desk until the carrier's hand-over or tray drop ends. */
  function unawait(u: string | undefined): void {
    if (!u || !awaited.has(u)) return;
    const n = awaited.get(u)! - 1;
    if (n > 0) awaited.set(u, n);
    else awaited.delete(u);
  }

  function ingest(events: readonly WfEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'job-start': {
          const s = e.variant ? byVariant.get(e.variant) : undefined;
          if (s) jobScenario.set(e.job, s);
          break;
        }
        case 'step-start': {
          const s = stepOf(e.job, e.step);
          if (s) onStepStart(e, s);
          break;
        }
        case 'step-end': {
          const s = stepOf(e.job, e.step);
          if (s) onStepEnd(e, s);
          break;
        }
        case 'copies':
          if (e.to) for (let i = 0; i < (e.copy ?? 0); i++) create(e.job, e.step ?? '', 'spec-paper', i, e.to);
          break;
        case 'handover': {
          const c = find(e.job, e.from, e.prop, e.copy, e.step);
          if (c && e.to) handTo(c, e.to);
          unawait(e.to);
          break;
        }
        case 'tray-drop': {
          const c = find(e.job, e.from, e.prop, e.copy, e.step);
          if (c && e.to) {
            c.holder = null;
            c.tray = e.to;
          }
          unawait(e.to);
          break;
        }
        case 'tray-take':
          // Taken when the step starts; a robot away from its desk floor picks it up once it is back
          // on that floor (a prop changes floor only with its holder, AC-6).
          for (const c of copies) if (c.job === e.job && c.tray === e.to && e.to) claims.add(c.key);
          pickUp();
          break;
        case 'wait-start':
          if (e.to) awaited.set(e.to, (awaited.get(e.to) ?? 0) + 1);
          break;
        case 'job-done':
          retire((c) => c.job === e.job);
          jobScenario.delete(e.job);
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------ positions
  const landingSlots = new Map<number, Map<string, number>>();
  function landingSlot(floor: number, u: string): number {
    let m = landingSlots.get(floor);
    if (!m) landingSlots.set(floor, (m = new Map()));
    const have = m.get(u);
    if (have !== undefined) return have;
    const used = new Set(m.values());
    let s = 0;
    while (used.has(s) && s < 2) s++;
    m.set(u, s);
    return s;
  }
  const freeLanding = (u: string): void => {
    for (const m of landingSlots.values()) m.delete(u);
  };

  /** Where the engine wants `u` for its state; 'hold' = stay where it stands. */
  function targetAnchor(u: string, st: UnitState, eng: EnginePort): Anchor | 'hold' {
    const s = stepOf(st.job, st.step);
    switch (st.state) {
      case 'carry-walk':
      case 'wait':
      case 'handover':
        if (s?.kind === 'carry' && s.actors[0] === u && st.other) {
          // Escort exception: the recipient waits beside the carrier's desk; hand over where both stand.
          const rs = eng.unitState(st.other);
          if (rs?.state === 'escort-wait' && rs.other === u) return 'hold';
          return anchors.handover(st.other, 0);
        }
        return 'hold';
      case 'escort-wait':
        return st.other ? anchors.handover(st.other, 1) : 'hold';
      case 'call-hold':
        return 'hold';
      default:
        break;
    }
    if (!s) return 'hold';
    if (s.kind === 'carry') return anchors.desk(u); // a free recipient called to its desk
    if (s.kind === 'call') return 'hold';
    switch (s.place) {
      case 'signing-desk':
        return u === s.actors[0] && u === 'ceo' ? anchors.desk(u) : anchors.signing(0);
      case 'meeting-room': {
        if (s.kind === 'meeting') return u === s.actors[0] ? anchors.lead() : anchors.seat(Math.max(0, s.actors.indexOf(u) - 1));
        if (s.kind === 'sign') return u === s.actors[0] ? anchors.signTable() : anchors.lead();
        const sc = jobScenario.get(st.job);
        const call = sc?.steps.find((x) => x.parallel?.includes(s.id));
        if (call) return anchors.seat(call.parallel!.indexOf(s.id));
        return anchors.lead();
      }
      case 'pair-desk':
        return u === s.actors[1] ? anchors.desk(u) : anchors.pair(s.actors[1]!);
      default:
        return anchors.desk(u);
    }
  }

  const homeTarget = (b: Bot): Target => ({ floor: b.homeFloor, spot: `home:${b.id}` });
  const deskTarget = (b: Bot): Target => ({ floor: b.homeFloor, spot: `desk:${b.id}` });

  function setState(b: Bot, to: DirectedKind | ActivityKind): void {
    if (b.state === to) return;
    log.push({ t: Math.round(now * 1000) / 1000, id: b.id, from: b.state, to });
    b.state = to;
  }

  function follow(b: Bot, goal: Anchor | 'hold', dt: number, exact: Point | null): void {
    const prev = { x: b.pos.x, z: b.pos.z };
    // Exact mode chases the movement adapter's position (closing the gap left by the ambient cycle,
    // which the movement does not know); anchor mode walks to the goal anchor.
    const aim: { x: number; z: number } | null = exact ?? (goal === 'hold' ? null : goal);
    if (aim) {
      const dx = aim.x - b.pos.x;
      const dz = aim.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      const speed = exact ? Math.min(Math.max(d * 2, WALK_SPEED * 1.5), 6) : Math.min(Math.max(d / 2, WALK_SPEED), FOLLOW_MAX);
      const step = o.still?.() ? d : speed * dt;
      const y = exact ? exact.y : floorY(b.floor);
      if (d <= step + EPS) b.pos = { x: aim.x, y, z: aim.z };
      else b.pos = { x: b.pos.x + (dx / d) * step, y, z: b.pos.z + (dz / d) * step };
    }
    const mx = b.pos.x - prev.x;
    const mz = b.pos.z - prev.z;
    b.moving = Math.hypot(mx, mz) > 1e-5;
    const near = goal !== 'hold' && Math.hypot(goal.x - b.pos.x, goal.z - b.pos.z) < (exact ? 0.6 : 1e-3);
    if (b.moving) {
      b.facing = Math.atan2(mx, mz);
      b.walkPhase += dt * 6;
      b.sit = false;
    } else if (goal !== 'hold') {
      if (near) b.facing = goal.facing;
      b.sit = near && goal.sit;
    }
  }

  /** Floor routing: a goal on another floor first sends the robot to the landing; rides cut floors. */
  function route(b: Bot, target: Anchor | 'hold', eng: EnginePort): Anchor | 'hold' {
    const mv = eng.movement;
    const phase = mv.phase(b.id);
    const fl = mv.floorOf(b.id);
    if (fl !== b.floor) {
      // The holder changes floor only inside the cabin (the stand-in reports the destination at ride start).
      b.floor = fl;
      const c = anchors.cabin(fl, landingSlot(fl, b.id));
      b.pos = { x: c.x, y: floorY(fl), z: c.z };
    }
    if (phase === 'ride') return anchors.cabin(b.floor, landingSlot(b.floor, b.id));
    if (phase === 'call' || phase === 'call-wait') return anchors.landing(b.floor, landingSlot(b.floor, b.id));
    freeLanding(b.id);
    if (target === 'hold') return 'hold';
    if (target.floor !== b.floor) return anchors.landing(b.floor, landingSlot(b.floor, b.id));
    return target;
  }

  function update(dt: number, eng: EnginePort): void {
    now = eng.time;
    if (claims.size) pickUp();
    for (const b of bots.values()) {
      const st = eng.unitState(b.id);
      const amb = o.ambient.get(b.id);
      if (st) {
        if (b.mode === 'ambient') {
          // §7.5 interrupt: idle / work / coffee / walk → the step's first state (re-pathed from here).
          o.ambient.reserve(b.id);
          b.pos = { x: amb.x, y: amb.y, z: amb.z };
          b.facing = amb.facing;
          // Floor latch (Rev 35): a robot interrupted on a wing break keeps its current floor and walks back
          // (no jump into the cabin); the engine port's movement knows where it is.
          b.floor = eng.movement.floorOf(b.id);
          b.state = amb.kind === 'wave' || amb.kind === 'raise' ? 'idle' : amb.kind;
        }
        b.mode = 'directed';
        setState(b, st.state);
        if (st.state === 'stamp-press') for (const c of copies) if (c.job === st.job && c.holder === b.id && c.kind === 'spec-paper') c.stamped = true;
        if (st.state === 'build' || st.state === 'pair') {
          const s = stepOf(st.job, st.step);
          const owner = s ? deskOwnerOf(s) : b.id;
          const p = progress.get(owner);
          if (p && p.until === undefined) p.pct = Math.max(p.pct, Math.min(100, Math.floor(st.progress ?? 0)));
        }
        const goal = route(b, targetAnchor(b.id, st, eng), eng);
        follow(b, goal, dt, o.position?.(b.id) ?? null);
        continue;
      }
      if (b.mode === 'ambient') {
        b.pos = { x: amb.x, y: amb.y, z: amb.z };
        b.facing = amb.facing;
        // A break walk changes floor through the same movement: the view (visibility, picking) follows it (R-5).
        b.floor = eng.movement.floorOf(b.id);
        b.state = amb.kind === 'wave' || amb.kind === 'raise' ? b.state : amb.kind;
        b.moving = amb.kind === 'walk';
        continue;
      }
      // Directed → ambient (§7.5 last row): walk to the home point, then idle.
      b.mode = 'return';
      const mv = eng.movement;
      const waitedFor = awaited.has(b.id);
      const atDesk = mv.isAt(b.id, deskTarget(b));
      const atHome = mv.isAt(b.id, homeTarget(b));
      if (!waitedFor && !atHome && mv.phase(b.id) === 'still' && !(amb.kind === 'wave' || amb.kind === 'raise')) mv.moveTo(b.id, homeTarget(b));
      const target = atDesk && waitedFor ? anchors.desk(b.id) : anchors.home(b.id);
      const goal = route(b, target, eng);
      follow(b, goal, dt, o.position?.(b.id) ?? null);
      const home = anchors.home(b.id);
      const exactHome = o.position?.(b.id) ?? null;
      const arrived = b.floor === b.homeFloor && !b.moving && Math.hypot(b.pos.x - (exactHome?.x ?? home.x), b.pos.z - (exactHome?.z ?? home.z)) < 1e-3;
      if (arrived && mv.isAt(b.id, homeTarget(b))) {
        setState(b, 'idle');
        fileHeld(b.id); // home again: what it still holds goes into its desk tray
        o.ambient.resume(b.id);
        b.mode = 'ambient';
        b.moving = false;
      } else {
        setState(b, b.moving ? 'walk' : 'idle');
      }
    }
    if (hands.size) settleHands();
  }

  function poseOf(b: Bot, selected: ActivityKind | null): PoseKind {
    if (selected) return selected;
    if (b.mode === 'ambient') return b.state as ActivityKind;
    if (b.moving) return 'walk';
    switch (b.state) {
      case 'seated':
      case 'seat-wait':
        return b.sit ? 'sit' : 'idle';
      case 'build':
      case 'pair':
      case 'review':
      case 'test':
      case 'step-work':
        return b.sit ? 'work' : 'idle';
      case 'stamp-raise':
        return 'raise';
      case 'stamp-press':
      case 'call':
        return 'press';
      case 'handover':
        return 'reach';
      default:
        return 'idle';
    }
  }

  function view(u: string): RobotView {
    const b = bot(u);
    const amb = o.ambient.get(u);
    const selected = amb.kind === 'wave' || amb.kind === 'raise' ? amb.kind : null;
    const directed = b.mode === 'directed';
    const marker: Marker = directed && isWaiting(b.state) ? 'hourglass' : directed && b.state === 'called' ? 'call' : null;
    return {
      id: u,
      directed,
      state: b.state,
      pose: poseOf(b, selected),
      x: b.pos.x,
      y: b.pos.y,
      z: b.pos.z,
      facing: b.mode === 'ambient' ? amb.facing : b.facing,
      walkPhase: b.mode === 'ambient' ? amb.walkPhase : b.walkPhase,
      floor: b.floor,
      marker,
      stamp: directed && (b.state === 'stamp-raise' || b.state === 'stamp-press'),
      screenScroll: b.mode === 'ambient' ? b.state === 'work' : directed && DESK_SCROLL.has(b.state) && b.sit,
    };
  }

  return {
    ingest,
    update,
    view,
    copies: () => copies,
    held: (u) => copies.filter((c) => c.holder === u),
    copyFloor(c) {
      if (c.holder) return bots.get(c.holder)?.floor ?? null;
      if (c.tray) return anchors.deskOf(c.tray)?.floor ?? null;
      return null;
    },
    lamp(u) {
      const l = lamps.get(u);
      if (!l || now + EPS >= l.until) return 'off';
      return l.outcome === 'reject' ? 'fail' : 'pass';
    },
    screen(u) {
      const ev = evidence.get(u);
      if (ev !== undefined && now + EPS < ev) return { mode: 'evidence' };
      const p = progress.get(u);
      // Reduced motion (REQ-19): the bar moves in 10 % steps.
      if (p && (p.until === undefined || now + EPS < p.until)) return { mode: 'progress', pct: o.still?.() ? tenths(p.pct) : p.pct };
      return { mode: 'code' };
    },
    transitions: () => log,
    lampUnits: [...lampUnits],
    screenUnits: [...screenUnits],
  };
}
