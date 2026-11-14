import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot } from './helpers';

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (/\.(ts|css|json)$/.test(name)) out.push(full);
    else if (!name.includes('.')) walk(full, out);
  }
  return out;
}

describe('no HTML-injection sinks in src/ (AC-13)', () => {
  it('src/ contains no innerHTML, outerHTML, insertAdjacentHTML, eval( or new Function', () => {
    const hits: string[] = [];
    for (const f of walk(join(appRoot, 'src'), [])) {
      const text = readFileSync(f, 'utf8');
      for (const bad of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval(', 'new Function', 'dangerouslySetInnerHTML']) {
        if (text.includes(bad)) hits.push(`${f}: ${bad}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
