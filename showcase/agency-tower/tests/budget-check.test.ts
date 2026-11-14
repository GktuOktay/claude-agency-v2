// Spec 0002 AC-17 / R-10: `npm run budget:check` logic on fixtures (no build needed; not a build step).
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { BUDGET_BYTES, checkBudget } from '../scripts/budget-check.mjs';
import { tmpDir, writeTree, appRoot } from './helpers';

const INDEX = (src: string): string =>
  `<!doctype html><html><head>\n<script type="module" crossorigin src="${src}"></script>\n<link rel="stylesheet" crossorigin href="./assets/index-x.css">\n</head><body></body></html>\n`;

function fixture(bytes: number, extra: Record<string, string> = {}): string {
  const root = tmpDir('budget-');
  writeTree(root, {
    'index.html': INDEX('./assets/index-abc123.js'),
    'assets/index-abc123.js': 'a'.repeat(bytes),
    'assets/index-x.css': 'b'.repeat(2_000_000), // other assets never count
    ...extra,
  });
  return root;
}

describe('budget-check (AC-17, R-10)', () => {
  it('the ceiling is 900 000 bytes (Rev 31 campus scope; 1 kB = 1000 bytes, raw minified)', () => {
    expect(BUDGET_BYTES).toBe(900_000);
  });

  it('passes on an entry chunk of exactly 900 000 bytes', () => {
    const r = checkBudget(fixture(900_000));
    expect(r.ok).toBe(true);
    expect(r.bytes).toBe(900_000);
    expect(r.file).toBe('assets/index-abc123.js');
  });

  it('fails on an entry chunk of 901 000 bytes', () => {
    const r = checkBudget(fixture(901_000));
    expect(r.ok).toBe(false);
    expect(r.bytes).toBe(901_000);
    expect(r.message).toMatch(/901000/);
  });

  it('measures only the chunk referenced by index.html, not other JS files', () => {
    const r = checkBudget(fixture(10, { 'assets/vendor-big.js': 'c'.repeat(900_000) }));
    expect(r.ok).toBe(true);
    expect(r.bytes).toBe(10);
  });

  it('accepts a root-relative or bare src as well as ./', () => {
    for (const src of ['/assets/index-abc123.js', 'assets/index-abc123.js']) {
      const root = fixture(5, { 'index.html': INDEX(src) });
      expect(checkBudget(root).ok).toBe(true);
    }
  });

  it('fails clearly when there is no build output', () => {
    const r = checkBudget(join(tmpDir('budget-empty-'), 'dist'));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/npm run build/);
  });

  it('fails when index.html has no module script, or the chunk file is missing', () => {
    const noScript = fixture(5, { 'index.html': '<html><head></head></html>' });
    expect(checkBudget(noScript).ok).toBe(false);
    const missing = fixture(5, { 'index.html': INDEX('./assets/index-gone.js') });
    expect(checkBudget(missing).ok).toBe(false);
  });

  it('CLI: exit 0 at 900 000 bytes, exit 1 at 901 000 bytes', () => {
    const script = join(appRoot, 'scripts', 'budget-check.mjs');
    const pass = spawnSync(process.execPath, [script, fixture(900_000)], { encoding: 'utf8' });
    expect(pass.status).toBe(0);
    expect(pass.stdout).toMatch(/budget OK/);
    const fail = spawnSync(process.execPath, [script, fixture(901_000)], { encoding: 'utf8' });
    expect(fail.status).toBe(1);
    expect(fail.stderr).toMatch(/over budget/);
  });
});
