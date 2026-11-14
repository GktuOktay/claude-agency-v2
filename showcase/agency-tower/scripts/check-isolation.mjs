// Isolation check (REQ-2): scans src/, scripts/, index.html and vite.config.* for import
// specifiers and path strings. tests/, README.md and this file are not scanned.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DENIED_SEGMENTS = new Set(['harness', '.claude', 'site', 'templates']);
const ALLOWED_CONSTANT = '../../../.claude/agents';
const ALLOWED_FILE = 'scripts/build-roster.mjs';
const SELF = 'scripts/check-isolation.mjs';
const SCAN_EXT = /\.(?:ts|mts|cts|js|mjs|cjs|html)$/;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
}

function collectFiles(root) {
  const files = [];
  for (const top of ['src', 'scripts']) {
    try {
      walk(join(root, top), files);
    } catch {
      /* directory absent */
    }
  }
  for (const name of readdirSync(root)) {
    if (name === 'index.html' || /^vite\.config\./.test(name)) files.push(join(root, name));
  }
  return files
    .map((f) => relative(root, f).split(sep).join('/'))
    .filter((f) => SCAN_EXT.test(f) && f !== SELF);
}

// Returns [{ value, isImport }] for each string literal outside comments.
export function extractStrings(src) {
  const found = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const start = i;
      i++;
      let value = '';
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          value += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (src[i] === '\n' && c !== '`') break;
        value += src[i];
        i++;
      }
      i++;
      const before = src.slice(Math.max(0, start - 24), start);
      const isImport = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)$/.test(before);
      found.push({ value, isImport });
    } else {
      i++;
    }
  }
  return found;
}

function extractHtmlValues(src) {
  const found = [];
  const re = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(src)) !== null) found.push({ value: m[1] ?? m[2] ?? '', isImport: true });
  return found;
}

function segments(value) {
  return value.split(/[\\/]/);
}

export function checkIsolation(root) {
  const absRoot = resolve(root);
  const violations = [];
  for (const file of collectFiles(absRoot)) {
    const abs = join(absRoot, file);
    const src = readFileSync(abs, 'utf8');
    const items = file.endsWith('.html') ? extractHtmlValues(src) : extractStrings(src);
    for (const { value, isImport } of items) {
      const hasSep = /[\\/]/.test(value);
      if (file === ALLOWED_FILE && value === ALLOWED_CONSTANT) continue;
      if (isImport && /^(?:\.{1,2}[\\/]|\.{1,2}$)/.test(value)) {
        const target = resolve(dirname(abs), value);
        if (target !== absRoot && !target.startsWith(absRoot + sep)) {
          violations.push({ file, message: `import resolves outside the showcase: ${value}` });
          continue;
        }
      }
      if (isImport && /^[A-Za-z]:[\\/]/.test(value)) {
        violations.push({ file, message: `absolute path import: ${value}` });
        continue;
      }
      if (hasSep && /^(?:https?:)?\/\//.test(value) === false) {
        const bad = segments(value).find((s) => DENIED_SEGMENTS.has(s));
        if (bad) violations.push({ file, message: `path segment "${bad}" in string: ${value}` });
      }
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const violations = checkIsolation(root);
  if (violations.length) {
    for (const v of violations) console.error(`${v.file}: ${v.message}`);
    process.exit(1);
  }
  console.log('isolation OK');
}
