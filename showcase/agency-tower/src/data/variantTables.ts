// Spec 0002 §7.2 variant tables, transcribed row by row (P-9). The validator compares every
// scenario in scenarios.json with these rows; keep the column format identical to the spec so a
// reviewer can diff the two. Columns: id | kind | actors | place | to / escort | prop | durationS | next | reject / loop
// Kind cell: `meeting N` carries the whiteboard section count. Next cell of a call: `join <id>`.
// "loop row" marks rows reachable only through a `loop` edge (derived from the graph, not stored).

export interface VariantTable {
  id: string;
  lane: 0 | 1 | 2 | 3;
  weight: number;
  boundS: number;
  rows: string[];
}

const L2_BASE_ROWS = [
  'intake | intake | ceo, chief-of-staff | signing-desk | — | envelope | 2–3 | c-ba |',
  'c-ba | carry | chief-of-staff | — | → business-analyst | envelope | — | meet |',
  'meet | meeting 6 | business-analyst, react-engineer, qa-engineer | meeting-room | — | — | 12–20 | c-sc |',
  'c-sc | carry | business-analyst | — | → spec-critic | spec-paper | — | rev-sc |',
  'rev-sc | review | spec-critic | desk | escort business-analyst | — | 4–8 | c-sign | 0.3, loop → back-sc, max 1',
  'c-sign | carry | business-analyst | — | → ceo | spec-paper | — | sign |',
  'sign | sign | ceo, business-analyst | signing-desk | — | — | 2–3 | c-eng |',
  'c-eng | carry | business-analyst | — | → react-engineer | spec-stamped | — | build |',
  'build | build | react-engineer | desk | — | — | 8–14 | c-qa |',
  'c-qa | carry | react-engineer | — | → qa-engineer | build-tablet | — | test |',
  'test | test | qa-engineer | desk | — | — | 4–6 | c-ia | 0.35, loop → back-qa, max 2',
  'c-ia | carry | qa-engineer | — | → internal-auditor | build-tablet | — | rev-ia |',
  'rev-ia | review | internal-auditor | desk | — | — | 4–6 | c-ev |',
  'c-ev | carry | internal-auditor | — | → chief-of-staff | evidence | — | done |',
  'done | done | chief-of-staff | desk | — | — | 1–2 | null |',
  'back-sc | carry | spec-critic | — | → business-analyst | spec-paper | — | rework | loop row',
  'rework | work | business-analyst | desk | — | — | 5–8 | c-sc | loop row',
  'back-qa | carry | qa-engineer | — | → react-engineer | build-tablet | — | rebuild | loop row',
  'rebuild | build | react-engineer | desk | — | — | 5–8 | c-qa | loop row',
];

const REPLACED_IN_L2 = ['c-sc', 'rev-sc', 'back-sc', 'rework'];
const l2With = (rows: string[]): string[] => {
  const ids = new Set(rows.map((r) => r.split('|')[0]!.trim()));
  return [...L2_BASE_ROWS.filter((r) => { const id = r.split('|')[0]!.trim(); return !REPLACED_IN_L2.includes(id) && !ids.has(id); }), ...rows];
};

export const VARIANT_TABLES: readonly VariantTable[] = [
  {
    id: 'l0-direct',
    lane: 0,
    weight: 1,
    boundS: 90,
    rows: [
      'intake | intake | ceo, chief-of-staff | signing-desk | — | envelope | 2–3 | fix |',
      'fix | work | chief-of-staff | desk | — | — | 6–10 | evidence |',
      'evidence | test | chief-of-staff | desk | — | — | 3–5 | done |',
      'done | done | chief-of-staff | desk | — | — | 1–2 | null |',
    ],
  },
  {
    id: 'l1-quick',
    lane: 1,
    weight: 1,
    boundS: 260,
    rows: [
      'intake | intake | ceo, chief-of-staff | signing-desk | — | envelope | 2–3 | c-ba |',
      'c-ba | carry | chief-of-staff | — | → business-analyst | envelope | — | spec |',
      'spec | work | business-analyst | desk | — | — | 6–10 | c-sign |',
      'c-sign | carry | business-analyst | — | → ceo | spec-paper | — | sign |',
      'sign | sign | ceo, business-analyst | signing-desk | — | — | 2–3 | c-eng |',
      'c-eng | carry | business-analyst | — | → react-engineer | spec-stamped | — | build |',
      'build | build | react-engineer | desk | — | — | 8–14 | c-qa |',
      'c-qa | carry | react-engineer | — | → qa-engineer | build-tablet | — | test |',
      'test | test | qa-engineer | desk | — | — | 4–6 | c-ev | 0.35, loop → back-qa, max 2',
      'c-ev | carry | qa-engineer | — | → chief-of-staff | evidence | — | done |',
      'done | done | chief-of-staff | desk | — | — | 1–2 | null |',
      'back-qa | carry | qa-engineer | — | → react-engineer | build-tablet | — | rebuild | loop row',
      'rebuild | build | react-engineer | desk | — | — | 5–8 | c-qa | loop row',
    ],
  },
  { id: 'l2-base', lane: 2, weight: 3, boundS: 360, rows: L2_BASE_ROWS },
  {
    id: 'l2-input',
    lane: 2,
    weight: 1,
    boundS: 360,
    rows: l2With([
      'c-sc | carry | business-analyst | — | → spec-critic → appsec | spec-paper | — | gates |',
      'gates | call | business-analyst | — | — | — | — | join c-sign | parallel g-sc, g-as; loop → rework, max 1',
      'g-sc | review | spec-critic | desk | — | — | 4–8 | c-sign | 0.3',
      'g-as | review | appsec | desk | — | — | 4–8 | c-sign | 0.2',
      'rework | work | business-analyst | desk | — | — | 5–8 | c-sc | loop row',
    ]),
  },
  {
    id: 'l2-dependency',
    lane: 2,
    weight: 1,
    boundS: 380,
    // Spec gap (reported): §7.2 says "l2-base with these rows replacing c-sc, rev-sc, back-sc, rework",
    // which keeps meet → c-sc and leaves c-ab reachable only through the rework loop, yet c-ab is not
    // a loop row and AC-5 requires a reject-free run to produce the table's rows in order. The meet
    // row therefore points at c-ab here (Ruling, cheap to undo: one cell here and in scenarios.json).
    rows: l2With([
      'meet | meeting 6 | business-analyst, react-engineer, qa-engineer | meeting-room | — | — | 12–20 | c-ab |',
      'c-ab | carry | business-analyst | — | → architecture-board | spec-paper | — | c-sc |',
      'c-sc | carry | business-analyst | — | → spec-critic | spec-paper | — | gates |',
      'gates | call | business-analyst | — | — | — | — | join c-sign | parallel g-sc, g-ab; loop → rework, max 1',
      'g-sc | review | spec-critic | desk | — | — | 4–8 | c-sign | 0.3',
      'g-ab | review | architecture-board | desk | — | — | 4–8 | c-sign | 0.2',
      'rework | work | business-analyst | desk | — | — | 5–8 | c-ab | loop row',
    ]),
  },
  {
    id: 'l3-full',
    lane: 3,
    weight: 1,
    boundS: 480,
    rows: [
      'intake | intake | ceo, chief-of-staff | signing-desk | — | envelope | 2–3 | c-ar |',
      'c-ar | carry | chief-of-staff | — | → software-architect | envelope | — | design |',
      'design | work | software-architect | desk | — | — | 8–12 | meet |',
      'meet | meeting 8 | business-analyst, software-architect, product-manager | meeting-room | — | — | 14–20 | gates |',
      'gates | call | business-analyst | — | — | — | — | join sign | parallel g-sc, g-as, g-ab; loop → rework, max 1',
      'g-sc | review | spec-critic | meeting-room | — | — | 5–8 | sign | 0.25',
      'g-as | review | appsec | meeting-room | — | — | 5–8 | sign | 0.2',
      'g-ab | review | architecture-board | meeting-room | — | — | 5–8 | sign | 0.2',
      'sign | sign | ceo, business-analyst | meeting-room | — | — | 2–3 | c-dm |',
      'c-dm | carry | business-analyst | — | → delivery-manager | spec-stamped | — | plan |',
      'plan | work | delivery-manager | desk | — | — | 6–10 | c-eng |',
      'c-eng | carry | delivery-manager | — | → react-engineer | spec-stamped | — | build |',
      'build | build | dotnet-engineer, react-engineer | pair-desk | — | — | 10–16 | c-qa |',
      'c-qa | carry | react-engineer | — | → qa-engineer | build-tablet | — | test |',
      'test | test | qa-engineer | desk | — | — | 4–6 | c-as | 0.35, loop → back-qa, max 2',
      'c-as | carry | qa-engineer | — | → appsec | build-tablet | — | rev-as |',
      'rev-as | review | appsec | desk | — | — | 4–6 | c-ia |',
      'c-ia | carry | appsec | — | → internal-auditor | build-tablet | — | rev-ia |',
      'rev-ia | review | internal-auditor | desk | — | — | 4–6 | c-qo |',
      'c-qo | carry | internal-auditor | — | → quality-office | build-tablet | — | rev-qo |',
      'rev-qo | review | quality-office | desk | — | — | 4–6 | c-ev |',
      'c-ev | carry | quality-office | — | → chief-of-staff | evidence | — | done |',
      'done | done | chief-of-staff | desk | — | — | 1–2 | null |',
      'rework | work | business-analyst | meeting-room | — | — | 6–10 | gates | loop row',
      'back-qa | carry | qa-engineer | — | → react-engineer | build-tablet | — | rebuild | loop row',
      'rebuild | build | dotnet-engineer, react-engineer | pair-desk | — | — | 6–10 | c-qa | loop row',
    ],
  },
];
