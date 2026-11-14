// Label and speech bubble legibility over the brighter city (art direction after Rev 38): every text colour on
// its pill reaches WCAG AA (>= 4.5:1), on an opaque pill so the scene behind can never lower it, and the white
// pills keep a hairline edge so they read against light stone and glass.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/style.css', 'utf8').replace(/\/\*[^]*?\*\//g, '');

const tokens = new Map<string, string>();
for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) if (!tokens.has(m[1] ?? '')) tokens.set(m[1] ?? '', (m[2] ?? '').trim());

/** Declarations of the first top-level rule whose selector list is exactly `selector`. */
function rule(selector: string): Map<string, string> {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`rule ${selector}`);
  const out = new Map<string, string>();
  for (const d of (m[1] ?? '').split(';')) {
    const i = d.indexOf(':');
    if (i > 0) out.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
  }
  return out;
}

const resolve = (v: string): string => {
  const m = /^var\((--[\w-]+)\)$/.exec(v.trim());
  return m ? resolve(tokens.get(m[1] ?? '') ?? v) : v.trim();
};

/** sRGB colour from #rgb / #rrggbb / rgb() / rgba(); alpha 1 unless given. */
function parse(v: string): { r: number; g: number; b: number; a: number } {
  const s = resolve(v);
  if (s === '#fff') return { r: 255, g: 255, b: 255, a: 1 };
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1] ?? '0', 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const [r = 0, g = 0, b = 0, a = 1] = (m[1] ?? '').split(',').map((x) => Number(x.trim()));
    return { r, g, b, a };
  }
  throw new Error(`colour ${v}`);
}

const lum = ({ r, g, b }: { r: number; g: number; b: number }): number => {
  const lin = (c: number): number => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
};

describe('label and bubble legibility', () => {
  const cases: [string, string, string][] = [
    ['.room-label', '.room-label', 'department pill'],
    ['.robot-label', '.robot-label', 'name pill'],
    ['.robot-label .tag', '.robot-label', 'name pill tag'],
    ['.bubble', '.bubble', 'speech bubble'],
  ];

  it.each(cases)('%s text reaches 4.5:1 on its pill', (textSel, bgSel, what) => {
    const fg = rule(textSel).get('color');
    const bg = rule(bgSel).get('background');
    if (!fg || !bg) throw new Error(what);
    const c = contrast(fg, bg);
    expect(c, `${what} ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['.room-label', '.robot-label', '.bubble'])('%s is opaque, so the city behind cannot lower the contrast', (sel) => {
    const bg = rule(sel).get('background');
    if (!bg) throw new Error(sel);
    expect(parse(bg).a).toBe(1);
  });

  it.each(['.robot-label', '.bubble'])('white %s keeps a hairline edge against light stone and glass', (sel) => {
    expect(rule(sel).get('box-shadow') ?? '').toMatch(/^0 0 0 1px rgba\(31, 35, 41, 0\.\d+\)/);
  });
});
