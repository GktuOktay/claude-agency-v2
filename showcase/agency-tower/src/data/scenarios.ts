// Scenario data (spec 0002 §7.1, §7.2): schema, per-kind field matrix, pipeline rules P-1..P-9 and
// the variant tables. Hand-written guards like loader.ts (REQ-1: no schema-library dependency).
// Every failure message starts with the rule it enforces (`schema`, `matrix`, `P-n`, `loop`,
// `branch`, `lanes`), so tests can prove the intended rule fired.
import { VARIANT_TABLES, type VariantTable } from './variantTables';

export const STEP_KINDS = ['intake', 'carry', 'work', 'meeting', 'call', 'review', 'test', 'build', 'sign', 'done'] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export const PLACES = ['desk', 'pair-desk', 'meeting-room', 'signing-desk'] as const;
export type Place = (typeof PLACES)[number];
export const PROPS = ['envelope', 'spec-paper', 'spec-stamped', 'build-tablet', 'evidence'] as const;
export type PropKind = (typeof PROPS)[number];
export type Lane = 0 | 1 | 2 | 3;

export interface LoopRule {
  to: string;
  maxLoops: number;
}

export interface Step {
  id: string;
  kind: StepKind;
  labelTr: string;
  actors: string[];
  escort?: string;
  place?: Place;
  to?: string[];
  prop?: PropKind;
  durationS?: [number, number];
  next?: string | null;
  parallel?: string[];
  join?: string;
  rejectP?: number;
  loop?: LoopRule;
  sections?: number;
}

export interface Scenario {
  id: string;
  lane: Lane;
  weight: number;
  variantTr: string;
  start: string;
  steps: Step[];
}

export interface ScenarioSet {
  laneWeights: [number, number, number, number];
  scenarios: Scenario[];
}

export type ScenarioResult = { ok: true; data: ScenarioSet } | { ok: false; error: string };

/** Unit id → floor, from the validated hierarchy. */
export type UnitFloors = ReadonlyMap<string, number>;

export const BUILDERS: ReadonlySet<string> = new Set(['dotnet-engineer', 'react-engineer', 'polyglot-engineer', 'devops-sre']);
export const LANE0_EVIDENCE_LABEL = 'Kanıt: test çıktısı';
const GATES = ['spec-critic', 'appsec', 'architecture-board'];
const LANE1_FORBIDDEN = ['spec-critic', 'appsec', 'architecture-board', 'delivery-manager', 'internal-auditor', 'quality-office'];
const LANE2_FORBIDDEN = ['quality-office', 'delivery-manager'];
const ID_RE = /^[a-z0-9-]+$/;
const MAX_HOPS = 64;

class Invalid extends Error {}
function fail(msg: string): never {
  throw new Invalid(msg);
}

const codePoints = (s: string): number => [...s].length;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

// ---------------------------------------------------------------- per-kind field matrix (§7.1)
type Field = 'actors' | 'escort' | 'place' | 'to' | 'prop' | 'durationS' | 'next' | 'parallel' | 'join' | 'rejectP' | 'loop' | 'sections';
type Need = 'R' | 'O' | '-';
const FIELDS: readonly Field[] = ['actors', 'escort', 'place', 'to', 'prop', 'durationS', 'next', 'parallel', 'join', 'rejectP', 'loop', 'sections'];
const ALWAYS = new Set(['id', 'kind', 'labelTr']);
// Columns: actors escort place to prop durationS next parallel join rejectP loop sections.
// `loop` on call/review/test is conditional and checked separately (marked O here).
const MATRIX: Record<StepKind, string> = {
  intake: 'R-R-RRR-----',
  carry: 'R--RR-R-----',
  work: 'R-R--RR-----',
  meeting: 'R-R--RR----R',
  call: 'R------RR-O-',
  review: 'ROR--RR--OO-',
  test: 'R-R--RR--OO-',
  build: 'R-R--RR-----',
  sign: 'R-R--RR-----',
  done: 'R-R--RR-----',
};
const need = (kind: StepKind, f: Field): Need => MATRIX[kind][FIELDS.indexOf(f)] as Need;

function parseStep(raw: unknown, w: string, units: UnitFloors): Step {
  if (!isRecord(raw)) fail(`schema: ${w}: expected object`);
  for (const k of Object.keys(raw)) if (!ALWAYS.has(k) && !(FIELDS as readonly string[]).includes(k)) fail(`schema: ${w}: unknown field ${k}`);
  const id = raw.id;
  if (typeof id !== 'string' || !ID_RE.test(id) || id.length > 40) fail(`schema: ${w}.id`);
  const kind = raw.kind;
  if (typeof kind !== 'string' || !(STEP_KINDS as readonly string[]).includes(kind)) fail(`schema: ${w}.kind`);
  const k = kind as StepKind;
  const labelTr = raw.labelTr;
  if (typeof labelTr !== 'string' || codePoints(labelTr) < 1 || codePoints(labelTr) > 40) fail(`schema: ${w}.labelTr: 1-40 code points`);
  for (const f of FIELDS) {
    const present = raw[f] !== undefined;
    const n = need(k, f);
    if (n === 'R' && !present) fail(`matrix: ${w} (${k}) requires ${f}`);
    if (n === '-' && present) fail(`matrix: ${w} (${k}) forbids ${f}`);
  }
  const unit = (v: unknown, what: string): string => {
    if (typeof v !== 'string') return fail(`schema: ${what}: expected unit id`);
    if (!units.has(v)) fail(`P-9: ${what}: unknown unit ${v}`);
    return v;
  };
  const unitList = (v: unknown, what: string, min: number, max: number): string[] => {
    if (!Array.isArray(v) || v.length < min || v.length > max) return fail(`matrix: ${what}: expected ${min}-${max} unit ids`);
    const list = v.map((x, i) => unit(x, `${what}[${i}]`));
    if (new Set(list).size !== list.length) fail(`matrix: ${what}: duplicate unit`);
    return list;
  };
  const step: Step = { id, kind: k, labelTr, actors: unitList(raw.actors, `${w}.actors`, 1, 8) };
  if (raw.escort !== undefined) step.escort = unit(raw.escort, `${w}.escort`);
  if (raw.place !== undefined) {
    if (typeof raw.place !== 'string' || !(PLACES as readonly string[]).includes(raw.place)) fail(`schema: ${w}.place`);
    step.place = raw.place as Place;
  }
  if (raw.to !== undefined) step.to = unitList(raw.to, `${w}.to`, 1, 3);
  if (raw.prop !== undefined) {
    if (typeof raw.prop !== 'string' || !(PROPS as readonly string[]).includes(raw.prop)) fail(`schema: ${w}.prop`);
    step.prop = raw.prop as PropKind;
  }
  if (raw.durationS !== undefined) {
    const d = raw.durationS;
    if (!Array.isArray(d) || d.length !== 2) return fail(`schema: ${w}.durationS: [min, max]`);
    const [a, b] = d as unknown[];
    if (typeof a !== 'number' || typeof b !== 'number' || !(a >= 1 && b <= 40 && a <= b)) fail(`schema: ${w}.durationS: 1-40, min <= max`);
    step.durationS = [a, b];
  }
  if (raw.next !== undefined) {
    const nx = raw.next;
    if (nx !== null && (typeof nx !== 'string' || !ID_RE.test(nx))) fail(`schema: ${w}.next`);
    step.next = nx;
  }
  if (raw.parallel !== undefined) {
    const p = raw.parallel;
    if (!Array.isArray(p) || p.length < 2 || p.length > 4 || !p.every((x) => typeof x === 'string')) fail(`matrix: ${w}.parallel: 2-4 step ids`);
    step.parallel = p as string[];
  }
  if (raw.join !== undefined) {
    if (typeof raw.join !== 'string') fail(`schema: ${w}.join`);
    step.join = raw.join;
  }
  if (raw.rejectP !== undefined) {
    const r = raw.rejectP;
    if (typeof r !== 'number' || !(r >= 0 && r <= 0.6)) fail(`schema: ${w}.rejectP: 0-0.6`);
    step.rejectP = r;
  }
  if (raw.loop !== undefined) {
    const l = raw.loop;
    if (!isRecord(l) || typeof l.to !== 'string' || Object.keys(l).some((x) => x !== 'to' && x !== 'maxLoops')) fail(`schema: ${w}.loop`);
    if (!isInt(l.maxLoops) || l.maxLoops < 1 || l.maxLoops > 2) fail(`schema: ${w}.loop.maxLoops: 1-2`);
    step.loop = { to: l.to, maxLoops: l.maxLoops };
  }
  if (raw.sections !== undefined) {
    if (!isInt(raw.sections) || raw.sections < 3 || raw.sections > 8) fail(`schema: ${w}.sections: 3-8`);
    step.sections = raw.sections;
  }
  if (step.escort !== undefined && step.actors.includes(step.escort)) fail(`matrix: ${w}: escort ${step.escort} is also an actor`);
  checkKindShape(step, w, units);
  return step;
}

function checkKindShape(s: Step, w: string, units: UnitFloors): void {
  const a = s.actors;
  const placeIs = (...ok: Place[]): void => {
    if (s.place === undefined || !ok.includes(s.place)) fail(`matrix: ${w} (${s.kind}) place must be ${ok.join(' or ')}`);
  };
  const one = (): void => {
    if (a.length !== 1) fail(`matrix: ${w} (${s.kind}) takes exactly 1 actor`);
  };
  switch (s.kind) {
    case 'intake':
      if (a.length !== 2 || a[0] !== 'ceo' || a[1] !== 'chief-of-staff') fail(`matrix: ${w}: intake actors are [ceo, chief-of-staff]`);
      placeIs('signing-desk');
      if (s.prop !== 'envelope') fail(`matrix: ${w}: intake prop is envelope`);
      break;
    case 'carry': {
      one();
      const floors = new Set((s.to ?? []).map((u) => units.get(u)));
      if (floors.size !== 1) fail(`matrix: ${w}: recipients must share one floor`);
      if ((s.to ?? []).includes(a[0]!)) fail(`matrix: ${w}: carrier cannot be a recipient`);
      break;
    }
    case 'work':
      one();
      placeIs('desk', 'meeting-room');
      break;
    case 'meeting':
      if (a.length < 2 || a.length > 6) fail(`matrix: ${w}: meeting takes 2-6 actors including the lead`);
      if (a[0] !== 'business-analyst') fail(`matrix: ${w}: meeting lead (first actor) is business-analyst`);
      placeIs('meeting-room');
      break;
    case 'call':
      one();
      break;
    case 'review':
      one();
      placeIs('desk', 'meeting-room');
      break;
    case 'test':
      one();
      placeIs('desk');
      if (s.loop !== undefined && !(s.rejectP !== undefined && s.rejectP > 0)) fail(`matrix: ${w}: loop without rejectP`);
      if (s.rejectP !== undefined && s.rejectP > 0 && s.loop === undefined) fail(`matrix: ${w}: rejectP > 0 requires loop`);
      break;
    case 'build':
      if (a.length === 1) placeIs('desk');
      else if (a.length === 2) placeIs('pair-desk');
      else fail(`matrix: ${w}: build takes 1 (desk) or 2 (pair-desk) actors`);
      break;
    case 'sign':
      if (a.length !== 2 || a[0] !== 'ceo') fail(`matrix: ${w}: sign actors are [ceo, carrier or meeting lead]`);
      placeIs('signing-desk', 'meeting-room');
      break;
    case 'done':
      if (a.length !== 1 || a[0] !== 'chief-of-staff') fail(`matrix: ${w}: done actor is chief-of-staff`);
      placeIs('desk');
      if (s.next !== null) fail(`matrix: ${w}: done.next must be null`);
      break;
  }
  if (s.kind !== 'done' && s.next === null) fail(`matrix: ${w}: next is null only for done`);
}

// ---------------------------------------------------------------- graph helpers (shared with the engine)
export interface ScenarioIndex {
  scenario: Scenario;
  byId: Map<string, Step>;
  /** Branch step id → its call step. */
  branchOf: Map<string, Step>;
}

export function indexScenario(scn: Scenario): ScenarioIndex {
  const byId = new Map(scn.steps.map((s) => [s.id, s]));
  const branchOf = new Map<string, Step>();
  for (const s of scn.steps) {
    if (s.kind !== 'call') continue;
    for (const start of s.parallel ?? []) {
      let cur = byId.get(start);
      for (let hop = 0; cur && cur.id !== s.join && hop < MAX_HOPS; hop++) {
        branchOf.set(cur.id, s);
        cur = typeof cur.next === 'string' ? byId.get(cur.next) : undefined;
      }
    }
  }
  return { scenario: scn, byId, branchOf };
}

/** Forward edges: `next`, a call's branch starts and its join (loops excluded). */
export function forward(s: Step): string[] {
  if (s.kind === 'call') return [...(s.parallel ?? []), ...(s.join !== undefined ? [s.join] : [])];
  return typeof s.next === 'string' ? [s.next] : [];
}

function reach(ix: ScenarioIndex, from: string[], opts: { loops?: boolean; skip?: string } = {}): Set<string> {
  const seen = new Set<string>();
  const stack = [...from];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || id === opts.skip) continue;
    const s = ix.byId.get(id);
    if (!s) continue;
    seen.add(id);
    stack.push(...forward(s));
    if (opts.loops && s.loop) stack.push(s.loop.to);
  }
  return seen;
}

/** True when step `b` is reachable from step `a` by forward edges (a before b). */
const before = (ix: ScenarioIndex, a: string, b: string): boolean => a !== b && reach(ix, forward(ix.byId.get(a)!)).has(b);

/** A step uses the meeting room when its place is the room or it is a call with a branch in the room. */
export function usesRoom(ix: ScenarioIndex, s: Step): boolean {
  if (s.place === 'meeting-room') return true;
  return s.kind === 'call' && (s.parallel ?? []).some((b) => ix.byId.get(b)?.place === 'meeting-room');
}

/**
 * Room hold (REQ-15): after step `s` ends the job keeps the room when a later step on its forward
 * path still uses it (l3: meeting → call → sign); otherwise the hold ends with `s` (l2: meeting only).
 */
export function keepsRoomAfter(ix: ScenarioIndex, s: Step): boolean {
  if (!usesRoom(ix, s) && !ix.branchOf.has(s.id) && s.kind !== 'call') return false;
  for (const id of reach(ix, forward(s))) {
    const t = ix.byId.get(id)!;
    if (ix.branchOf.has(id)) continue;
    if (usesRoom(ix, t)) return true;
  }
  return false;
}

/** True when step `id` or a step after it on the forward path uses the room (hold continues). */
export function roomAhead(ix: ScenarioIndex, id: string): boolean {
  for (const r of reach(ix, [id])) {
    if (ix.branchOf.has(r)) continue;
    if (usesRoom(ix, ix.byId.get(r)!)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- structural rules per scenario
function checkGraph(ix: ScenarioIndex, w: string): void {
  const { scenario: scn, byId } = ix;
  const ref = (id: string | undefined, what: string): void => {
    if (id !== undefined && !byId.has(id)) fail(`P-1: ${w}: ${what} references unknown step ${id}`);
  };
  for (const s of scn.steps) {
    ref(typeof s.next === 'string' ? s.next : undefined, `${s.id}.next`);
    ref(s.join, `${s.id}.join`);
    ref(s.loop?.to, `${s.id}.loop.to`);
    for (const p of s.parallel ?? []) ref(p, `${s.id}.parallel`);
  }
  const start = byId.get(scn.start);
  if (!start || start.kind !== 'intake') fail(`P-1: ${w}: start must be the intake step`);
  if (scn.steps.filter((s) => s.kind === 'intake').length !== 1) fail(`P-1: ${w}: exactly one intake`);
  const dones = scn.steps.filter((s) => s.kind === 'done');
  if (dones.length !== 1) fail(`P-1: ${w}: exactly one done step required`);

  // `next` acyclic (forward edges), by DFS colouring.
  const colour = new Map<string, 1 | 2>();
  const visit = (id: string): void => {
    const c = colour.get(id);
    if (c === 1) fail(`P-1: ${w}: next cycle through ${id}`);
    if (c === 2) return;
    colour.set(id, 1);
    for (const n of forward(byId.get(id)!)) visit(n);
    colour.set(id, 2);
  };
  for (const s of scn.steps) visit(s.id);
}

/** P-1 reachability, after the loop rules so a bad loop target is reported as such. */
function checkReach(ix: ScenarioIndex, w: string): void {
  const scn = ix.scenario;
  const reachable = reach(ix, [scn.start], { loops: true });
  for (const s of scn.steps) if (!reachable.has(s.id)) fail(`P-1: ${w}: step ${s.id} is unreachable`);
  // In an acyclic graph, every path reaches done iff done is the only step without a forward edge.
  for (const s of scn.steps) if (s.kind !== 'done' && forward(s).length === 0) fail(`P-1: ${w}: path ends at ${s.id} without done`);
}

function checkCalls(ix: ScenarioIndex, w: string): void {
  for (const call of ix.scenario.steps) {
    if (call.kind !== 'call') continue;
    const branchActors = new Map<string, string>();
    let anyReject = false;
    for (const startId of call.parallel ?? []) {
      let cur = ix.byId.get(startId);
      const seen: Step[] = [];
      for (let hop = 0; cur && cur.id !== call.join; hop++) {
        if (hop > MAX_HOPS || cur.kind === 'call' || cur.kind === 'done') {
          fail(`branch: ${w}: branch ${startId} of ${call.id} does not end at join ${String(call.join)}`);
        }
        seen.push(cur);
        cur = typeof cur.next === 'string' ? ix.byId.get(cur.next) : undefined;
      }
      if (!cur) fail(`branch: ${w}: branch ${startId} of ${call.id} does not end at join ${String(call.join)}`);
      for (const st of seen) {
        if (st.loop !== undefined) fail(`branch: ${w}: loop on ${st.id} inside a call branch`);
        if (st.rejectP !== undefined && st.rejectP > 0) anyReject = true;
        for (const u of st.actors) {
          const other = branchActors.get(u);
          if (other !== undefined && other !== startId) fail(`branch: ${w}: branches ${other} and ${startId} share actor ${u}`);
          branchActors.set(u, startId);
        }
      }
    }
    if (branchActors.has(call.actors[0]!)) fail(`branch: ${w}: caller of ${call.id} is also a branch actor`);
    if (anyReject && call.loop === undefined) fail(`matrix: ${w}: call ${call.id} with a rejecting branch requires loop`);
  }
  for (const s of ix.scenario.steps) {
    if (s.kind !== 'review' || ix.branchOf.has(s.id)) continue;
    if (s.rejectP !== undefined && s.rejectP > 0 && s.loop === undefined) fail(`matrix: ${w}: review ${s.id} with rejectP requires loop`);
    if (s.loop !== undefined && !(s.rejectP !== undefined && s.rejectP > 0)) fail(`matrix: ${w}: review ${s.id} loop without rejectP`);
  }
}

function checkLoops(ix: ScenarioIndex, w: string): void {
  for (const s of ix.scenario.steps) {
    if (!s.loop) continue;
    const target = ix.byId.get(s.loop.to)!;
    const rejecting = s.kind === 'call'
      ? new Set((s.parallel ?? []).flatMap((b) => ix.byId.get(b)?.actors ?? []))
      : new Set(s.actors);
    let ok = false;
    if (target.kind === 'carry') {
      const rework = typeof target.next === 'string' ? ix.byId.get(target.next) : undefined;
      ok = rejecting.has(target.actors[0]!) && rework !== undefined && (rework.kind === 'work' || rework.kind === 'build')
        && target.to?.length === 1 && rework.actors.includes(target.to[0]!);
    } else {
      ok = target.kind === 'work' || target.kind === 'build';
    }
    // The `next` chain from loop.to must re-enter the rejecting step or call.
    let cur: Step | undefined = target;
    let reenters = false;
    for (let hop = 0; cur && hop < MAX_HOPS; hop++) {
      if (cur.id === s.id) {
        reenters = true;
        break;
      }
      cur = typeof cur.next === 'string' ? ix.byId.get(cur.next) : undefined;
    }
    if (!ok || !reenters) fail(`loop: ${w}: ${s.id}.loop.to ${s.loop.to} is neither a carry-back to the rework actor nor a rework step re-entering ${s.id}`);
  }
}

function checkRoomWork(ix: ScenarioIndex, w: string): void {
  const preds = new Map<string, Step[]>();
  for (const s of ix.scenario.steps) {
    for (const t of [...forward(s), ...(s.loop ? [s.loop.to] : [])]) preds.set(t, [...(preds.get(t) ?? []), s]);
  }
  for (const s of ix.scenario.steps) {
    if (s.kind !== 'work' || s.place !== 'meeting-room') continue;
    const ps = preds.get(s.id) ?? [];
    if (ps.length === 0 || !ps.every((p) => keepsRoomAfter(ix, p) || usesRoom(ix, p))) fail(`matrix: ${w}: work ${s.id} in the meeting room only while the job holds it`);
  }
}

function allUnits(scn: Scenario): Set<string> {
  return new Set(scn.steps.flatMap((s) => [...s.actors, ...(s.escort ? [s.escort] : []), ...(s.to ?? [])]));
}

function checkPipeline(ix: ScenarioIndex, w: string): void {
  const scn = ix.scenario;
  const steps = scn.steps;
  const of = (k: StepKind): Step[] => steps.filter((s) => s.kind === k);
  const done = of('done')[0]!;
  const preds = (id: string): Step[] => steps.filter((s) => forward(s).includes(id));
  const units = allUnits(scn);

  if (scn.lane === 0) {
    for (const k of ['sign', 'meeting', 'review', 'carry'] as const) if (of(k).length) fail(`P-2: ${w}: lane 0 has no ${k} step`);
    for (const s of [...of('work'), ...of('test')]) if (s.actors.length !== 1 || s.actors[0] !== 'chief-of-staff') fail(`P-2: ${w}: lane-0 ${s.kind} only by chief-of-staff`);
    for (const s of of('test')) if (s.labelTr !== LANE0_EVIDENCE_LABEL) fail(`P-2: ${w}: lane-0 test must be labelled "${LANE0_EVIDENCE_LABEL}"`);
    const p = preds(done.id);
    if (p.length !== 1 || p[0]!.kind !== 'test') fail(`P-2: ${w}: lane-0 test step directly before done`);
    return;
  }

  // P-3: one sign by the CEO; no build before sign on any path; evidence carried to chief-of-staff.
  const signs = of('sign');
  if (signs.length !== 1) fail(`P-3: ${w}: exactly one sign step`);
  const sign = signs[0]!;
  const withoutSign = reach(ix, [scn.start], { loops: true, skip: sign.id });
  for (const b of of('build')) if (withoutSign.has(b.id)) fail(`P-3: ${w}: build ${b.id} reachable without sign`);
  const dp = preds(done.id);
  if (dp.length === 0 || !dp.every((p) => p.kind === 'carry' && p.prop === 'evidence' && p.to?.length === 1 && p.to[0] === 'chief-of-staff')) {
    fail(`P-3: ${w}: done must be directly preceded by an evidence carry to chief-of-staff`);
  }
  const signPreds = preds(sign.id);
  const signers = new Set<string>([
    ...signPreds.filter((p) => p.kind === 'carry').map((p) => p.actors[0]!),
    ...steps.filter((s) => s.kind === 'call' && s.join === sign.id).map((s) => s.actors[0]!),
    ...of('meeting').map((m) => m.actors[0]!),
  ]);
  if (!signers.has(sign.actors[1]!)) fail(`matrix: ${w}: sign's second actor must be the carrier or meeting lead`);

  // P-4: the maker never verifies.
  const builds = of('build');
  for (const b of builds) {
    for (const id of reach(ix, forward(b), { loops: true })) {
      const v = ix.byId.get(id)!;
      if ((v.kind === 'test' || v.kind === 'review') && v.actors.some((a) => b.actors.includes(a))) fail(`P-4: ${w}: ${v.id} shares an actor with build ${b.id}`);
    }
  }
  const afterBuild = new Set(builds.flatMap((b) => [...reach(ix, forward(b), { loops: true })]));
  for (const r of of('review')) {
    if (afterBuild.has(r.id)) continue;
    const makers = new Set<string>();
    for (const s of steps) {
      if (!before(ix, s.id, r.id)) continue;
      if (s.kind === 'work') s.actors.forEach((a) => makers.add(a));
      if (s.kind === 'meeting') makers.add(s.actors[0]!);
    }
    if (r.actors.some((a) => makers.has(a))) fail(`P-4: ${w}: review ${r.id} shares an actor with the spec's work or meeting lead`);
  }

  // P-5: builders.
  for (const b of builds) if (!b.actors.every((a) => BUILDERS.has(a))) fail(`P-5: ${w}: build ${b.id} actors must be engineers`);

  const testsAfterBuild = of('test').filter((t) => afterBuild.has(t.id));
  if (scn.lane === 1) {
    for (const u of LANE1_FORBIDDEN) if (units.has(u)) fail(`P-6: ${w}: lane 1 has no ${u}`);
    if (of('meeting').length) fail(`P-6: ${w}: lane 1 has no meeting`);
    if (!of('work').some((s) => s.actors[0] === 'business-analyst' && before(ix, s.id, sign.id))) fail(`P-6: ${w}: lane-1 spec is a business-analyst work step`);
    if (of('test').length !== 1 || testsAfterBuild.length !== 1 || testsAfterBuild[0]!.actors[0] !== 'qa-engineer') fail(`P-6: ${w}: exactly one qa-engineer test after build`);
  }
  if (scn.lane === 2) {
    for (const u of LANE2_FORBIDDEN) if (units.has(u)) fail(`P-7: ${w}: lane 2 has no ${u}`);
    if (!of('meeting').some((m) => before(ix, m.id, sign.id))) fail(`P-7: ${w}: lane-2 spec meeting before sign`);
    if (!of('review').some((r) => r.actors[0] === 'spec-critic' && before(ix, r.id, sign.id))) fail(`P-7: ${w}: spec-critic review before sign`);
    const qaTests = testsAfterBuild.filter((t) => t.actors[0] === 'qa-engineer');
    const ok = qaTests.length > 0 && qaTests.every((t) => of('review').some((r) => r.actors[0] === 'internal-auditor' && before(ix, t.id, r.id)));
    if (!ok) fail(`P-7: ${w}: after build a qa-engineer test, then an internal-auditor review`);
  }
  if (scn.lane === 3) {
    const firstWork = firstOnPath(ix, (s) => s.kind === 'work');
    if (!firstWork || firstWork.actors[0] !== 'software-architect') fail(`P-8: ${w}: first work by software-architect`);
    if (!of('meeting').some((m) => before(ix, m.id, sign.id))) fail(`P-8: ${w}: spec meeting before sign`);
    const gateCalls = of('call').filter((c) => before(ix, c.id, sign.id));
    const gatesOk = gateCalls.length === 1 && (() => {
      const branches = (gateCalls[0]!.parallel ?? []).map((b) => ix.byId.get(b)!);
      const set = branches.map((b) => b.actors[0]!).sort();
      return branches.every((b) => b.kind === 'review' && b.place === 'meeting-room' && b.next === gateCalls[0]!.join)
        && set.length === GATES.length && set.every((u, i) => u === [...GATES].sort()[i]);
    })();
    if (!gatesOk) fail(`P-8: ${w}: one call before sign with branches exactly spec-critic, appsec, architecture-board in the meeting room`);
    if (sign.place !== 'meeting-room') fail(`P-8: ${w}: lane-3 sign in the meeting room`);
    const dm = of('work').filter((s) => s.actors[0] === 'delivery-manager');
    const mainBuilds = builds.filter((b) => !isLoopRow(ix, b));
    if (!dm.some((d) => before(ix, sign.id, d.id) && mainBuilds.every((b) => before(ix, d.id, b.id)))) {
      fail(`P-8: ${w}: delivery-manager work after sign and before build`);
    }
    const chain = ['carry', 'test:qa-engineer', 'carry', 'review:appsec', 'carry', 'review:internal-auditor', 'carry', 'review:quality-office'];
    for (const b of builds) {
      let cur = typeof b.next === 'string' ? ix.byId.get(b.next) : undefined;
      for (const want of chain) {
        const [kind, actor] = want.split(':');
        const okStep = cur !== undefined && cur.kind === kind && (actor === undefined || cur.actors[0] === actor) && (kind !== 'carry' || cur.prop === 'build-tablet');
        if (!okStep || cur === undefined) fail(`P-8: ${w}: verify chain after ${b.id} must be qa-engineer → appsec → internal-auditor → quality-office with a carry between each`);
        cur = typeof cur.next === 'string' ? ix.byId.get(cur.next) : undefined;
      }
    }
  }
}

/** A loop row is reachable only through a `loop` edge. */
export function isLoopRow(ix: ScenarioIndex, s: Step): boolean {
  return !reach(ix, [ix.scenario.start]).has(s.id);
}

function firstOnPath(ix: ScenarioIndex, pred: (s: Step) => boolean): Step | undefined {
  // Breadth-first along forward edges from start: the nearest matching step.
  const seen = new Set<string>();
  let layer = [ix.scenario.start];
  while (layer.length) {
    const nextLayer: string[] = [];
    for (const id of layer) {
      if (seen.has(id)) continue;
      seen.add(id);
      const s = ix.byId.get(id)!;
      if (pred(s)) return s;
      nextLayer.push(...forward(s));
    }
    layer = nextLayer;
  }
  return undefined;
}

// ---------------------------------------------------------------- variant tables (P-9)
const norm = (row: string): string => row.split('|').map((c) => c.trim().replace(/\s+/g, ' ')).join(' | ');

/** Renders a step in the §7.2 column format (see variantTables.ts). */
export function renderRow(ix: ScenarioIndex, s: Step): string {
  const kind = s.kind === 'meeting' ? `meeting ${String(s.sections)}` : s.kind;
  const toEscort = s.to ? `→ ${s.to.join(' → ')}` : s.escort ? `escort ${s.escort}` : '—';
  const dur = s.durationS ? `${s.durationS[0]}–${s.durationS[1]}` : '—';
  const next = s.kind === 'call' ? `join ${String(s.join)}` : s.next === null ? 'null' : String(s.next);
  const loop = s.loop ? `loop → ${s.loop.to}, max ${s.loop.maxLoops}` : '';
  let last: string;
  if (s.kind === 'call') last = `parallel ${(s.parallel ?? []).join(', ')}${loop ? `; ${loop}` : ''}`;
  else last = [s.rejectP !== undefined ? String(s.rejectP) : '', loop].filter(Boolean).join(', ');
  if (isLoopRow(ix, s)) last = [last, 'loop row'].filter(Boolean).join(', ');
  return norm([s.id, kind, s.actors.join(', '), s.place ?? '—', toEscort, s.prop ?? '—', dur, next, last].join(' | '));
}

function checkVariant(ix: ScenarioIndex, table: VariantTable, w: string): void {
  const scn = ix.scenario;
  if (scn.lane !== table.lane) fail(`P-9: ${w}: lane must be ${table.lane}`);
  if (scn.weight !== table.weight) fail(`P-9: ${w}: weight must be ${table.weight}`);
  const want = new Map(table.rows.map((r) => [r.split('|')[0]!.trim(), norm(r)]));
  if (want.size !== scn.steps.length) fail(`P-9: ${w}: expected ${want.size} rows, found ${scn.steps.length}`);
  for (const s of scn.steps) {
    const row = want.get(s.id);
    if (row === undefined) fail(`P-9: ${w}: step ${s.id} not in the §7.2 table`);
    const got = renderRow(ix, s);
    if (got !== row) fail(`P-9: ${w}: row ${s.id} differs from §7.2: "${got}" vs "${row}"`);
  }
}

// ---------------------------------------------------------------- entry points
function parseScenario(raw: unknown, w: string, units: UnitFloors): Scenario {
  if (!isRecord(raw)) fail(`schema: ${w}: expected object`);
  const id = raw.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) fail(`schema: ${w}.id`);
  const lane = raw.lane;
  if (!isInt(lane) || lane < 0 || lane > 3) fail(`schema: ${w}.lane: 0-3`);
  if (!isInt(raw.weight) || raw.weight < 1 || raw.weight > 10) fail(`schema: ${w}.weight: 1-10`);
  const vt = raw.variantTr;
  if (typeof vt !== 'string' || codePoints(vt) < 1 || codePoints(vt) > 24) fail(`schema: ${w}.variantTr: 1-24 code points`);
  if (typeof raw.start !== 'string') fail(`schema: ${w}.start`);
  if (!Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 40) fail(`schema: ${w}.steps: 2-40 entries`);
  const steps = (raw.steps as unknown[]).map((s, i) => parseStep(s, `${w}.steps[${i}]`, units));
  const ids = new Set<string>();
  for (const s of steps) {
    if (ids.has(s.id)) fail(`schema: ${w}: duplicate step id ${s.id}`);
    ids.add(s.id);
  }
  return { id, lane: lane as Lane, weight: raw.weight, variantTr: vt, start: raw.start, steps };
}

/** Structural validation of one scenario (matrix, P-1..P-8); exported for the engine's fixtures. */
export function checkScenario(scn: Scenario, w = scn.id): ScenarioIndex {
  const ix = indexScenario(scn);
  checkGraph(ix, w);
  checkCalls(ix, w);
  checkLoops(ix, w);
  checkReach(ix, w);
  checkRoomWork(ix, w);
  checkPipeline(ix, w);
  return ix;
}

function validate(raw: unknown, units: UnitFloors, tables: readonly VariantTable[]): ScenarioSet {
  if (!isRecord(raw)) fail('schema: expected object');
  if (raw.schemaVersion !== 1) fail('schema: schemaVersion must be 1');
  for (const k of Object.keys(raw)) if (!['schemaVersion', 'laneWeights', 'scenarios'].includes(k)) fail(`schema: unknown field ${k}`);
  const lw = raw.laneWeights;
  if (!isRecord(lw) || Object.keys(lw).sort().join() !== '0,1,2,3') fail('schema: laneWeights needs keys 0-3');
  const weights = [lw['0'], lw['1'], lw['2'], lw['3']];
  if (!weights.every((x) => isInt(x) && x >= 0 && x <= 100)) fail('schema: laneWeights: integers 0-100');
  const nums = weights as number[];
  if (nums.reduce((a, b) => a + b, 0) !== 100) fail('schema: laneWeights must sum to 100');
  if (!Array.isArray(raw.scenarios)) fail('schema: scenarios: expected array');
  const scenarios = (raw.scenarios as unknown[]).map((s, i) => parseScenario(s, `scenarios[${i}]`, units));
  const ids = new Set<string>();
  for (const s of scenarios) {
    if (ids.has(s.id)) fail(`schema: duplicate scenario ${s.id}`);
    ids.add(s.id);
  }
  const indexes = scenarios.map((s) => checkScenario(s));
  for (let lane = 0; lane <= 3; lane++) if (!scenarios.some((s) => s.lane === lane)) fail(`lanes: lane ${lane} has no scenario`);
  for (const t of tables) if (!ids.has(t.id)) fail(`P-9: variant ${t.id} missing`);
  for (const ix of indexes) {
    const table = tables.find((t) => t.id === ix.scenario.id);
    if (!table) fail(`P-9: ${ix.scenario.id} is not a §7.2 variant`);
    checkVariant(ix, table, ix.scenario.id);
  }
  return { laneWeights: [nums[0]!, nums[1]!, nums[2]!, nums[3]!], scenarios };
}

export function loadScenarios(raw: unknown, units: UnitFloors, tables: readonly VariantTable[] = VARIANT_TABLES): ScenarioResult {
  try {
    return { ok: true, data: validate(raw, units, tables) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}
