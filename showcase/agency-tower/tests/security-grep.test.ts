import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot } from './helpers';

/** Every file under `dir`, whatever its extension (.ts, .js, .mjs, .html, .css, .json, ...); dotted dirs too. */
function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** The scanned sources: all of src/ plus the page shell (index.html). */
const sources = (): string[] => [...walk(join(appRoot, 'src'), []), join(appRoot, 'index.html')];

const SINKS = ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval(', 'new Function', 'dangerouslySetInnerHTML'];

/** Network after load (0001 REQ-16): dynamic import (also with comments / whitespace before the paren), fetch, ... */
const NETWORK: readonly [string, RegExp][] = [
  ['import(', /\bimport\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*\(/],
  ['import.meta.glob', /import\s*\.\s*meta\s*\.\s*glob/],
  ['fetch(', /\bfetch\s*\(/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['new WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
];

const networkHits = (text: string): string[] => NETWORK.filter(([, re]) => re.test(text)).map(([name]) => name);

describe('no HTML-injection sinks in src/ (AC-13)', () => {
  it('the walk covers every extension in src/ (not only .ts / .css / .json)', () => {
    const files = sources();
    expect(files.some((f) => f.endsWith('.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('index.html'))).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(walk(join(appRoot, 'src'), []).length + 1);
  });

  it('src/ contains no innerHTML, outerHTML, insertAdjacentHTML, eval( or new Function', () => {
    const hits: string[] = [];
    for (const f of sources()) {
      const text = readFileSync(f, 'utf8');
      for (const bad of SINKS) {
        if (text.includes(bad)) hits.push(`${f}: ${bad}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('src/ makes no request after page load: no dynamic import(), import.meta.glob, fetch(, sendBeacon, XMLHttpRequest, WebSocket or EventSource (0001 REQ-16)', () => {
    const hits: string[] = [];
    for (const f of sources()) for (const bad of networkHits(readFileSync(f, 'utf8'))) hits.push(`${f}: ${bad}`);
    expect(hits).toEqual([]);
  });

  it('the network patterns catch the QA r2A evasions (planted samples)', () => {
    const planted: [string, string][] = [
      ["const m = import('./nav');", 'import('],
      ["const m = import /*c*/ ('./nav');", 'import('],
      ["const m = import /* a\n b */ /*c*/ ('./nav');", 'import('],
      ["const m = import // c\n ('./nav');", 'import('],
      ["const m = import\n\t('./nav');", 'import('],
      ["const all = import.meta.glob('./*.ts');", 'import.meta.glob'],
      ["navigator.sendBeacon('/x', d);", 'sendBeacon'],
      ["fetch ('/x');", 'fetch('],
      ['new WebSocket(url);', 'new WebSocket'],
    ];
    for (const [code, name] of planted) expect(networkHits(code), code).toContain(name);
    // Static imports and words that merely contain the names stay clean.
    expect(networkHits("import { a } from './a';\nimport b from './b';\nconst prefetch = 1; // refetching")).toEqual([]);
  });
});
