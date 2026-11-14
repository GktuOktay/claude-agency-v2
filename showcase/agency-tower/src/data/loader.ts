// Validates the generated roster and the hand-authored overlay (REQ-6, REQ-7, AC-4).
// Hand-written guards: the spec allows no schema-library dependency.
import { TIERS, type Floor, type LoadResult, type Tier, type Unit } from './types';

const ID_RE = /^[a-z0-9-]+$/;
const MANUAL_IDS = new Set(['ceo', 'chief-of-staff']);

class Invalid extends Error {}

function fail(msg: string): never {
  throw new Invalid(msg);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, what: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.length < min || v.length > max) fail(`${what}: expected string of ${min}-${max} chars`);
  return v;
}

function strArray(v: unknown, what: string): string[] {
  if (!Array.isArray(v)) return fail(`${what}: expected array`);
  return v.map((x, i) => str(x, `${what}[${i}]`, 0, 200));
}

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (TIERS as readonly string[]).includes(v);
}

interface CardSource {
  description: string;
  tools: string[];
  model: string | null;
}

function parseCard(v: unknown, what: string): CardSource {
  if (!isRecord(v)) return fail(`${what}: expected object`);
  const model = v.model;
  if (model !== null && typeof model !== 'string') fail(`${what}.model`);
  return {
    description: str(v.description, `${what}.description`, 1, 600),
    tools: strArray(v.tools, `${what}.tools`),
    model,
  };
}

function validate(rosterIn: unknown, overlayIn: unknown) {
  if (!isRecord(rosterIn)) fail('roster: expected object');
  if (!isRecord(overlayIn)) fail('overlay: expected object');
  if (rosterIn.schemaVersion !== 1) fail('roster.schemaVersion');
  if (overlayIn.schemaVersion !== 1) fail('overlay.schemaVersion');
  if (typeof rosterIn.sourceSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(rosterIn.sourceSha256)) fail('roster.sourceSha256');
  if (!Array.isArray(rosterIn.agents)) return fail('roster.agents');

  const agents = new Map<string, CardSource>();
  for (const [i, raw] of (rosterIn.agents as unknown[]).entries()) {
    if (!isRecord(raw)) fail(`roster.agents[${i}]`);
    const name = str(raw.name, `roster.agents[${i}].name`, 1, 100);
    if (!ID_RE.test(name)) fail(`roster.agents[${i}].name pattern`);
    if (agents.has(name)) fail(`roster: duplicate agent ${name}`);
    agents.set(name, parseCard(raw, `roster.agents[${i}]`));
  }

  if (!Array.isArray(overlayIn.floors) || overlayIn.floors.length !== 6) fail('overlay.floors: expected 6 entries');
  const floors: Floor[] = [];
  for (const [i, raw] of (overlayIn.floors as unknown[]).entries()) {
    if (!isRecord(raw) || raw.id !== i) fail(`overlay.floors[${i}]: ids must be 0..5`);
    floors.push({ id: i, nameTr: str(raw.nameTr, `overlay.floors[${i}].nameTr`, 1, 80) });
  }

  if (!Array.isArray(overlayIn.units) || overlayIn.units.length === 0) fail('overlay.units: empty');
  const units: Unit[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of (overlayIn.units as unknown[]).entries()) {
    const w = `overlay.units[${i}]`;
    if (!isRecord(raw)) fail(w);
    const id = str(raw.id, `${w}.id`, 1, 100);
    if (!ID_RE.test(id)) fail(`${w}.id pattern`);
    if (seen.has(id)) fail(`${w}: duplicate id ${id}`);
    seen.add(id);
    const floor = raw.floor;
    if (typeof floor !== 'number' || !Number.isInteger(floor) || floor < 0 || floor > 5) fail(`${w}.floor`);
    if (!isTier(raw.tier)) return fail(`${w}.tier`);
    const reportsTo = raw.reportsTo;
    if (reportsTo !== null && typeof reportsTo !== 'string') fail(`${w}.reportsTo`);
    if (typeof raw.independent !== 'boolean') fail(`${w}.independent`);
    const roleTr = str(raw.roleTr, `${w}.roleTr`, 1, 60);
    if (!Array.isArray(raw.phrasesTr) || raw.phrasesTr.length < 2 || raw.phrasesTr.length > 6) fail(`${w}.phrasesTr: 2-6 entries`);
    const phrasesTr = (raw.phrasesTr as unknown[]).map((p, k) => str(p, `${w}.phrasesTr[${k}]`, 1, 48));

    let card: CardSource;
    if (MANUAL_IDS.has(id)) {
      card = parseCard(raw.manual, `${w}.manual`);
    } else {
      if (raw.manual !== undefined) fail(`${w}: manual only for ceo and chief-of-staff`);
      const fromAgent = agents.get(id);
      if (!fromAgent) return fail(`overlay unit without roster agent: ${id}`);
      card = fromAgent;
    }
    units.push({
      id,
      name: id,
      floor,
      tier: raw.tier,
      reportsTo,
      independent: raw.independent,
      roleTr,
      phrasesTr,
      description: card.description,
      tools: card.tools,
      model: card.model,
    });
  }

  for (const name of agents.keys()) if (!seen.has(name)) fail(`roster agent without overlay entry: ${name}`);

  const byId = new Map(units.map((u) => [u.id, u]));
  if (units.filter((u) => u.tier === 'ceo').length !== 1) fail('exactly one ceo-tier unit required');
  for (const u of units) {
    if (u.reportsTo === null) {
      if (u.tier !== 'ceo') fail(`${u.id}: reportsTo null only for the ceo`);
    } else if (!byId.has(u.reportsTo)) {
      fail(`${u.id}: unknown reportsTo ${u.reportsTo}`);
    }
  }
  for (const u of units) {
    const visited = new Set<string>();
    let cur: Unit | undefined = u;
    while (cur && cur.reportsTo !== null) {
      if (visited.has(cur.id)) fail(`reporting cycle at ${cur.id}`);
      visited.add(cur.id);
      cur = byId.get(cur.reportsTo);
    }
  }
  return { floors, units };
}

export function loadData(roster: unknown, overlay: unknown): LoadResult {
  try {
    return { ok: true, data: validate(roster, overlay) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}
