// Bundle budget (spec 0002 REQ-20, R-10): the raw minified size of the entry chunk referenced by
// dist/index.html entry chunk must stay at or below 1 000 000 bytes (1 kB = 1000 bytes; not gzip). Spec 0002 set 748 000; raised for the CEO-authorized campus scope, docs/KARARLAR.md Rev 31, raised again in Rev 35.
// Run after `npm run build`; deliberately not part of `npm test` (tests must not depend on a build).
// Usage: node scripts/budget-check.mjs [distDir]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUDGET_BYTES = 1_000_000;

// <script ... type=module ... src=X>, quotes written as escapes so the isolation scanner reads no strings here.
const MODULE_SCRIPT = /<script\b[^>]*\btype\s*=\s*[\x22\x27]?module[\x22\x27]?[^>]*>/i;
const SRC_ATTR = /\bsrc\s*=\s*(?:\x22([^\x22]*)\x22|\x27([^\x27]*)\x27|([^\s>]+))/i;

/** Returns { ok, file, bytes, limit, message } for the entry chunk in `distDir`. */
export function checkBudget(distDir, limit = BUDGET_BYTES) {
  const dist = resolve(distDir);
  const index = join(dist, 'index.html');
  const fail = (message, file = null, bytes = null) => ({ ok: false, file, bytes, limit, message });
  if (!existsSync(index)) return fail(`no build output at ${index}; run npm run build first`);
  const tag = readFileSync(index, 'utf8').match(MODULE_SCRIPT);
  const src = tag ? tag[0].match(SRC_ATTR) : null;
  const ref = src ? (src[1] ?? src[2] ?? src[3] ?? '') : '';
  if (!ref) return fail('index.html references no module entry script');
  const file = ref.replace(/^\.?[/]/, '');
  const full = join(dist, file);
  if (!existsSync(full)) return fail(`entry chunk ${file} referenced by index.html does not exist`, file);
  const bytes = statSync(full).size;
  if (bytes > limit) return fail(`entry chunk ${file} is ${bytes} bytes, over budget by ${bytes - limit} (limit ${limit})`, file, bytes);
  return { ok: true, file, bytes, limit, message: `budget OK: ${file} ${bytes} bytes <= ${limit} (${((bytes / limit) * 100).toFixed(1)} %)` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const r = checkBudget(dist);
  if (!r.ok) {
    console.error(`budget-check: ${r.message}`);
    process.exit(1);
  }
  console.log(r.message);
}
