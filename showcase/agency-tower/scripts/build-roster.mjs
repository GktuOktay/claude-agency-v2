// Roster generator (REQ-4, REQ-5). Reads agent files read-only, extracts name, description,
// tools and model from the frontmatter block only, and writes src/data/roster.generated.json.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
// The single allow-listed path string pointing outside the showcase (REQ-2).
export const DEFAULT_AGENTS_DIR = '../../../.claude/agents';

export class RosterError extends Error {}

export function parseAgentFile(text, file) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0] !== '---') throw new RosterError(`${file}: no frontmatter block`);
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new RosterError(`${file}: frontmatter block is not closed`);
  const fields = new Map();
  for (const line of lines.slice(1, end)) {
    if (line.trim() === '' || /^\s/.test(line) || line.startsWith('#')) continue; // blank, indented list item, comment
    const idx = line.indexOf(':');
    if (idx <= 0) throw new RosterError(`${file}: cannot parse frontmatter line: ${line}`);
    const key = line.slice(0, idx).trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) throw new RosterError(`${file}: cannot parse frontmatter line: ${line}`);
    fields.set(key, line.slice(idx + 1).trim());
  }
  const unquote = (v) => v.replace(/^(["'])(.*)\1$/, '$2');
  const name = unquote(fields.get('name') ?? '');
  const description = unquote(fields.get('description') ?? '');
  if (!name) throw new RosterError(`${file}: missing name`);
  if (!description) throw new RosterError(`${file}: missing description`);
  const toolsRaw = unquote(fields.get('tools') ?? '');
  const tools = toolsRaw === '' ? [] : toolsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  const modelRaw = unquote(fields.get('model') ?? '');
  return { name, description, tools, model: modelRaw === '' ? null : modelRaw };
}

export function buildRoster(agentsDir) {
  const files = readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort();
  const agents = files.map((f) => parseAgentFile(readFileSync(join(agentsDir, f), 'utf8'), f));
  agents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const canonical = JSON.stringify(
    agents.map((a) => ({ name: a.name, description: a.description, tools: a.tools, model: a.model })),
  );
  const sourceSha256 = createHash('sha256').update(canonical).digest('hex');
  return { schemaVersion: 1, sourceSha256, agents };
}

export function serializeRoster(roster) {
  return JSON.stringify(roster, null, 2) + '\n';
}

export function run({ root, agentsDir, check = false }) {
  const dir = agentsDir ?? resolve(HERE, DEFAULT_AGENTS_DIR);
  let roster;
  try {
    roster = buildRoster(dir);
  } catch (e) {
    return { code: 1, message: e instanceof Error ? e.message : String(e) };
  }
  const outPath = join(root, 'src/data/roster.generated.json');
  const next = serializeRoster(roster);
  if (!check) {
    writeFileSync(outPath, next);
    return { code: 0, message: `wrote ${roster.agents.length} agents` };
  }
  const problems = [];
  const committed = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
  if (committed !== next) problems.push('roster.generated.json is stale: run node scripts/build-roster.mjs');
  const overlayPath = join(root, 'src/data/hierarchy.json');
  if (!existsSync(overlayPath)) {
    problems.push('src/data/hierarchy.json is missing');
  } else {
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
    const units = Array.isArray(overlay.units) ? overlay.units : [];
    const unitIds = new Set(units.map((u) => u.id));
    const agentNames = new Set(roster.agents.map((a) => a.name));
    for (const n of agentNames) if (!unitIds.has(n)) problems.push(`agent without overlay entry: ${n}`);
    for (const u of units) if (!u.manual && !agentNames.has(u.id)) problems.push(`overlay unit without agent file: ${u.id}`);
  }
  return problems.length ? { code: 1, message: problems.join('\n') } : { code: 0, message: 'roster OK' };
}

function main(argv) {
  let agentsDir;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--agents-dir') {
      agentsDir = argv[++i];
      if (!agentsDir) return usage();
    } else return usage();
  }
  const res = run({ root: resolve(HERE, '..'), agentsDir: agentsDir ? resolve(agentsDir) : undefined, check });
  (res.code === 0 ? console.log : console.error)(res.message);
  return res.code;
}

function usage() {
  console.error('usage: node scripts/build-roster.mjs [--agents-dir <path>] [--check]');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
