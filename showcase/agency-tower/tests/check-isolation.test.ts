import { describe, it, expect } from 'vitest';
import { checkIsolation } from '../scripts/check-isolation.mjs';
import { tmpDir, writeTree, appRoot } from './helpers';

const ALLOWED = "const DEFAULT_AGENTS_DIR = '../../../.claude/agents';\n";

function plant(files: Record<string, string>): string {
  const root = tmpDir();
  writeTree(root, {
    'index.html': '<script type="module" src="/src/main.ts"></script>',
    'src/main.ts': "import { a } from './a';\nexport const b = a;\n",
    'src/a.ts': 'export const a = 1;\n',
    'scripts/build-roster.mjs': ALLOWED,
    'vite.config.ts': "export default { base: './' };\n",
    ...files,
  });
  return root;
}

describe('check-isolation (AC-1)', () => {
  it('passes on a clean tree', () => {
    expect(checkIsolation(plant({}))).toEqual([]);
  });

  it('passes on the real showcase', () => {
    expect(checkIsolation(appRoot)).toEqual([]);
  });

  it('fails on an import resolving outside the folder', () => {
    const v = checkIsolation(plant({ 'src/bad.ts': "import x from '../../outside/thing';\n" }));
    expect(v.some((x) => x.file === 'src/bad.ts')).toBe(true);
  });

  it('fails on dynamic import and require outside the folder', () => {
    const v = checkIsolation(
      plant({ 'src/bad.ts': "const m = import('../../../x');\n", 'scripts/r.mjs': "require('../../y');\n" }),
    );
    expect(v.map((x) => x.file).sort()).toEqual(['scripts/r.mjs', 'src/bad.ts']);
  });

  for (const seg of ['harness', '.claude', 'site', 'templates']) {
    it(`fails on a path string with a "${seg}" segment`, () => {
      const v = checkIsolation(plant({ 'src/p.ts': `export const p = 'data/${seg}/file.txt';\n` }));
      expect(v.some((x) => x.file === 'src/p.ts')).toBe(true);
    });
  }

  it('does not fail on a string merely containing such a word', () => {
    const v = checkIsolation(
      plant({ 'src/ok.ts': "export const u = 'https://website.example/templates-list/x';\nexport const w = 'a/website/b';\n" }),
    );
    expect(v.filter((x) => x.file === 'src/ok.ts')).toEqual([]);
  });

  it('fails on the allow-listed constant in any other file', () => {
    const v = checkIsolation(plant({ 'src/p.ts': "export const d = '../../../.claude/agents';\n" }));
    expect(v.some((x) => x.file === 'src/p.ts')).toBe(true);
  });

  it('fails when a path-separator-less word equals a denied segment only inside a path', () => {
    const v = checkIsolation(plant({ 'src/p.ts': "export const s = 'site';\n" }));
    expect(v).toEqual([]);
  });

  it('ignores planted violations in tests/ and README.md', () => {
    const v = checkIsolation(
      plant({
        'tests/x.ts': "import y from '../../../harness/z'; const s = 'harness/a';\n",
        'README.md': 'see harness/bin and ../../outside\n',
      }),
    );
    expect(v).toEqual([]);
  });

  it('does not misread apostrophes in comments', () => {
    const v = checkIsolation(plant({ 'src/c.ts': "// don't 'harness/x\n/* it's */\nexport const k = 1;\n" }));
    expect(v).toEqual([]);
  });

  it('checks index.html src/href attributes', () => {
    const v = checkIsolation(plant({ 'index.html': '<script src="../../harness/x.js"></script>' }));
    expect(v.some((x) => x.file === 'index.html')).toBe(true);
  });

  it('checks vite.config.*', () => {
    const v = checkIsolation(plant({ 'vite.config.ts': "export default { root: '../../site/x' };\n" }));
    expect(v.some((x) => x.file === 'vite.config.ts')).toBe(true);
  });
});
