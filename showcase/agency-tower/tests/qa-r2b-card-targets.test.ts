// QA round 2B reproduction: every control meets the 44 px touch token (--touch). The card close button
// inherits the base 34 px min-height and sets min-width 34px; the Rev 33 "Özgün metin" disclosure
// (.card-original summary) sets no size at all. CSS read as text, like settings-sections.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/style.css', 'utf8');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(^|\\n)\\s*${esc} \\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join(';');
};

describe('QA r2B: card controls meet the 44 px touch token', () => {
  it('.card-close has min-width and min-height of var(--touch)', () => {
    const r = rule('.card-close');
    expect(r).toMatch(/min-width: var\(--touch\)/);
    expect(r).toMatch(/min-height: var\(--touch\)/);
  });
  it('.card-original summary ("Özgün metin") has min-height var(--touch)', () => {
    expect(rule('.card-original summary')).toMatch(/min-height: var\(--touch\)/);
  });
});
