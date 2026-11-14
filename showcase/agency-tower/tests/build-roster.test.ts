import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseAgentFile, buildRoster, serializeRoster, run } from '../scripts/build-roster.mjs';
import { tmpDir, writeTree, appRoot } from './helpers';

const FIX = join(appRoot, 'tests/fixtures/agents');
const SCRIPT = join(appRoot, 'scripts/build-roster.mjs');

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) out[f] = readFileSync(join(dir, f), 'utf8');
  return out;
}

function agentsDir(files: Record<string, string>): string {
  const d = tmpDir('agents-');
  writeTree(d, files);
  return d;
}

const BASE = '---\nname: x\ndescription: Does x.\ntools: Read, Write\nmodel: sonnet\n---\nbody\n';

describe('roster generator (AC-3)', () => {
  it('output is byte-equal on two runs', () => {
    expect(serializeRoster(buildRoster(FIX))).toBe(serializeRoster(buildRoster(FIX)));
  });

  it('sorts agents by name and emits exactly the four fields', () => {
    const r = buildRoster(FIX);
    expect(r.agents.map((a) => a.name)).toEqual(['alpha', 'beta']);
    for (const a of r.agents) expect(Object.keys(a)).toEqual(['name', 'description', 'tools', 'model']);
    expect(r.agents[1]).toEqual({
      name: 'beta',
      description: 'Second agent: with a colon, "quotes" and more.',
      tools: ['Read', 'Grep', 'Glob'],
      model: 'opus',
    });
    expect(r.agents[0]).toMatchObject({ tools: [], model: null });
    expect(r.schemaVersion).toBe(1);
    expect(r.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(serializeRoster(r)).not.toContain('SECRET-BODY-123');
    expect(serializeRoster(r)).not.toMatch(/timestamp|generated at/i);
  });

  it('ignores maxTurns, disallowedTools and multi-line skills', () => {
    const plain = '---\nname: x\ndescription: Does x.\ntools: Read, Write\nmodel: sonnet\n---\nbody\n';
    const noisy =
      '---\nname: x\ndescription: Does x.\ntools: Read, Write\ndisallowedTools: Edit\nmodel: sonnet\nmaxTurns: 9\neffort: high\nskills:\n  - a\n  - b\n---\nbody\n';
    const a = buildRoster(agentsDir({ 'x.md': plain }));
    const b = buildRoster(agentsDir({ 'x.md': noisy }));
    expect(serializeRoster(b)).toBe(serializeRoster(a));
  });

  it('hash changes with an extracted field, not with an ignored key or the body', () => {
    const h = (t: string) => buildRoster(agentsDir({ 'x.md': t })).sourceSha256;
    const base = h(BASE);
    expect(h(BASE.replace('Does x.', 'Does y.'))).not.toBe(base);
    expect(h(BASE.replace('sonnet', 'opus'))).not.toBe(base);
    expect(h(BASE.replace('Read, Write', 'Read'))).not.toBe(base);
    expect(h(BASE.replace('---\nbody', 'maxTurns: 5\n---\nother body'))).toBe(base);
    expect(h(BASE.replace('body\n', 'a completely different body\n'))).toBe(base);
  });

  it('handles CRLF files', () => {
    const lf = buildRoster(agentsDir({ 'x.md': BASE }));
    const crlf = buildRoster(agentsDir({ 'x.md': BASE.replace(/\n/g, '\r\n') }));
    expect(crlf.sourceSha256).toBe(lf.sourceSha256);
  });

  for (const [label, text] of [
    ['no name', '---\ndescription: d\n---\n'],
    ['no description', '---\nname: n\n---\n'],
    ['no frontmatter', 'just text\n'],
    ['unterminated frontmatter', '---\nname: n\ndescription: d\n'],
    ['unparseable line', '---\nname: n\nthis is not a key\ndescription: d\n---\n'],
  ] as const) {
    it(`parseAgentFile rejects: ${label}, naming the file`, () => {
      expect(() => parseAgentFile(text, 'bad.md')).toThrow(/bad\.md/);
    });
  }

  it('CLI exits 1 naming the file and writes nothing for invalid input; fixture untouched', () => {
    const dir = agentsDir({ 'good.md': BASE, 'broken.md': '---\ndescription: only\n---\n' });
    const before = snapshot(dir);
    const rosterPath = join(appRoot, 'src/data/roster.generated.json');
    const rosterBefore = existsSync(rosterPath) ? readFileSync(rosterPath, 'utf8') : null;
    const r = spawnSync(process.execPath, [SCRIPT, '--agents-dir', dir], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('broken.md');
    expect(existsSync(rosterPath) ? readFileSync(rosterPath, 'utf8') : null).toBe(rosterBefore);
    expect(snapshot(dir)).toEqual(before);
  });

  it('CLI exits 2 on usage errors', () => {
    expect(spawnSync(process.execPath, [SCRIPT, '--nope'], { encoding: 'utf8' }).status).toBe(2);
    expect(spawnSync(process.execPath, [SCRIPT, '--agents-dir'], { encoding: 'utf8' }).status).toBe(2);
  });

  it('run() writes only src/data/roster.generated.json; fixture dir byte-identical', () => {
    const root = tmpDir('root-');
    mkdirSync(join(root, 'src/data'), { recursive: true });
    const before = snapshot(FIX);
    const res = run({ root, agentsDir: FIX });
    expect(res.code).toBe(0);
    expect(readdirSync(join(root, 'src/data'))).toEqual(['roster.generated.json']);
    expect(readdirSync(root).sort()).toEqual(['src']);
    expect(readFileSync(join(root, 'src/data/roster.generated.json'), 'utf8')).toBe(serializeRoster(buildRoster(FIX)));
    expect(snapshot(FIX)).toEqual(before);
  });
});

describe('roster:check (AC-4)', () => {
  const overlay = (ids: string[]) =>
    JSON.stringify({ schemaVersion: 1, floors: [], units: ids.map((id) => (id === 'ceo' || id === 'chief-of-staff' ? { id, manual: {} } : { id })) });

  function setup(agentFiles: Record<string, string>, overlayIds: string[], regenerate = true) {
    const dir = agentsDir(agentFiles);
    const root = tmpDir('root-');
    mkdirSync(join(root, 'src/data'), { recursive: true });
    writeFileSync(join(root, 'src/data/hierarchy.json'), overlay(overlayIds));
    if (regenerate) run({ root, agentsDir: dir });
    return { dir, root };
  }

  it('passes when generated JSON is fresh and the overlay matches', () => {
    const { dir, root } = setup({ 'alpha.md': BASE.replace('name: x', 'name: alpha') }, ['alpha', 'ceo', 'chief-of-staff']);
    expect(run({ root, agentsDir: dir, check: true }).code).toBe(0);
  });

  it('check never writes', () => {
    const { dir, root } = setup({ 'alpha.md': BASE.replace('name: x', 'name: alpha') }, ['alpha'], false);
    expect(run({ root, agentsDir: dir, check: true }).code).toBe(1);
    expect(existsSync(join(root, 'src/data/roster.generated.json'))).toBe(false);
  });

  it('fails for an agent without an overlay entry', () => {
    const { dir, root } = setup({ 'alpha.md': BASE.replace('name: x', 'name: alpha') }, ['ceo']);
    const r = run({ root, agentsDir: dir, check: true });
    expect(r.code).toBe(1);
    expect(r.message).toContain('alpha');
  });

  it('fails for a non-manual overlay unit without an agent file', () => {
    const { dir, root } = setup({ 'alpha.md': BASE.replace('name: x', 'name: alpha') }, ['alpha', 'ghost']);
    const r = run({ root, agentsDir: dir, check: true });
    expect(r.code).toBe(1);
    expect(r.message).toContain('ghost');
  });

  it('fails for a stale hash', () => {
    const { dir, root } = setup({ 'alpha.md': BASE.replace('name: x', 'name: alpha') }, ['alpha']);
    writeFileSync(join(dir, 'alpha.md'), BASE.replace('name: x', 'name: alpha').replace('Does x.', 'Changed.'));
    const r = run({ root, agentsDir: dir, check: true });
    expect(r.code).toBe(1);
    expect(r.message).toMatch(/stale/i);
  });
});
