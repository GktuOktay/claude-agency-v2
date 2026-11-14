// Job strip "Aktif işler — simülasyon" (spec 0002 REQ-11, §4, §7.8). Keyed DOM reconciliation per
// frame; every dynamic string goes through textContent (0001 REQ-16). Not an aria-live region.
import type { StepMark } from '../sim/workflow';
import { tr } from '../i18n/tr';
import { el } from './dom';

export interface StripEntry {
  n: number;
  lane: number;
  title: string;
  label: string;
  loops: number;
  done: boolean;
  /** §7.8 pause text, or null. */
  pause: string | null;
  steps: readonly { id: string; label: string; mark: StepMark }[];
}

export interface JobStripOptions {
  onActivate(n: number): void;
  /** Below 768 px: newest entry plus "+n diğer". */
  isNarrow(): boolean;
  /** Reduced motion: every step list expanded by default (REQ-19). */
  expandByDefault(): boolean;
}

export interface JobStrip {
  element: HTMLElement;
  header: HTMLElement;
  update(entries: readonly StripEntry[]): void;
}

interface Row {
  li: HTMLElement;
  done: boolean;
  head: HTMLElement;
  line1: HTMLElement;
  line2: HTMLElement;
  loops: HTMLElement | null;
  pause: HTMLElement | null;
  toggle: HTMLButtonElement | null;
  list: HTMLOListElement | null;
  stepsKey: string;
}

const setText = (e: HTMLElement, t: string): void => {
  if (e.textContent !== t) e.textContent = t;
};

export function headLine(e: Pick<StripEntry, 'n' | 'lane' | 'title'>): string {
  return `#${e.n} · ${tr.strip.lane} ${e.lane} · ${e.title}`;
}

export function stepItem(mark: StepMark, label: string): string {
  const m = tr.strip.marks[mark];
  return `${m.symbol} ${m.word} · ${label}`;
}

export function createJobStrip(opts: JobStripOptions): JobStrip {
  const section = el('section', { class: 'job-strip', 'aria-labelledby': 'job-strip-heading' });
  const header = el('h2', { id: 'job-strip-heading', tabindex: '-1' }, tr.strip.heading);
  const empty = el('p', { class: 'job-empty' }, tr.strip.empty);
  const list = el('ul', { class: 'job-list' });
  const more = el('button', { type: 'button', class: 'job-more', 'aria-expanded': 'false' });
  section.append(header, empty, list, more);

  const rows = new Map<number, Row>();
  const expanded = new Map<number, boolean>();
  let showAll = false;
  more.addEventListener('click', () => {
    showAll = !showAll;
    more.setAttribute('aria-expanded', String(showAll));
    applyNarrow();
  });

  let order: number[] = [];
  function applyNarrow(): void {
    const narrow = opts.isNarrow();
    const hiddenCount = narrow ? Math.max(0, order.length - 1) : 0;
    order.forEach((n, i) => {
      const r = rows.get(n);
      if (r) r.li.hidden = narrow && !showAll && i > 0;
    });
    more.hidden = hiddenCount === 0;
    if (hiddenCount === 0) showAll = false;
    setText(more, hiddenCount ? tr.strip.more(hiddenCount) : '');
    more.setAttribute('aria-expanded', String(showAll && hiddenCount > 0));
  }

  function buildRow(e: StripEntry): Row {
    const li = el('li', { class: 'job', 'data-job': String(e.n) });
    const line1 = el('span', { class: 'job-head' });
    const line2 = el('span', { class: 'job-step' });
    if (e.done) {
      const head = el('p', { class: 'job-entry is-done' });
      head.append(line1, line2);
      li.append(head);
      return { li, done: true, head, line1, line2, loops: null, pause: null, toggle: null, list: null, stepsKey: '' };
    }
    const head = el('button', { type: 'button', class: 'job-entry' });
    head.append(line1, line2);
    head.addEventListener('click', () => opts.onActivate(e.n));
    const toggle = el('button', { type: 'button', class: 'job-steps-toggle', 'aria-expanded': 'false', 'aria-controls': `job-steps-${e.n}` }, tr.strip.steps);
    const ol = el('ol', { class: 'job-steps', id: `job-steps-${e.n}` });
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-expanded') !== 'true';
      expanded.set(e.n, on);
      toggle.setAttribute('aria-expanded', String(on));
      ol.hidden = !on;
    });
    li.append(head, toggle, ol);
    return { li, done: false, head, line1, line2, loops: null, pause: null, toggle, list: ol, stepsKey: '' };
  }

  function optional(r: Row, key: 'loops' | 'pause', cls: string, text: string | null): void {
    const cur = r[key];
    if (text === null) {
      if (cur) cur.remove();
      r[key] = null;
      return;
    }
    let node = cur;
    if (!node) {
      node = el('span', { class: cls });
      r.head.append(node);
      r[key] = node;
    }
    setText(node, text);
  }

  function fill(r: Row, e: StripEntry): void {
    setText(r.line1, headLine(e));
    setText(r.line2, e.done ? tr.strip.done : e.label);
    optional(r, 'loops', 'job-loops', !e.done && e.loops > 0 ? `${tr.strip.loops} ${e.loops}` : null);
    optional(r, 'pause', 'job-pause', e.pause);
    if (r.toggle && r.list) {
      const on = expanded.get(e.n) ?? opts.expandByDefault();
      if (r.toggle.getAttribute('aria-expanded') !== String(on)) r.toggle.setAttribute('aria-expanded', String(on));
      r.list.hidden = !on;
      const key = e.steps.map((s) => `${s.mark}:${s.label}`).join('|');
      if (key !== r.stepsKey) {
        r.stepsKey = key;
        r.list.replaceChildren(...e.steps.map((s) => el('li', { class: `mark-${s.mark}` }, stepItem(s.mark, s.label))));
      }
    }
  }

  return {
    element: section,
    header,
    update(entries) {
      const active = document.activeElement;
      const hadFocus = active instanceof HTMLElement && section.contains(active) && active !== header;
      // Newest first: below 768 px the first one is the one shown.
      const sorted = [...entries].sort((a, b) => b.n - a.n);
      const seen = new Set<number>();
      for (const e of sorted) {
        seen.add(e.n);
        let r = rows.get(e.n);
        if (r && r.done !== e.done) {
          r.li.remove();
          r = undefined;
        }
        if (!r) {
          r = buildRow(e);
          rows.set(e.n, r);
        }
        fill(r, e);
      }
      for (const [n, r] of rows) {
        if (!seen.has(n)) {
          r.li.remove();
          rows.delete(n);
          expanded.delete(n);
        }
      }
      order = sorted.map((e) => e.n);
      // Keep DOM order equal to `order` without touching nodes already in place (focus stays).
      order.forEach((n, i) => {
        const li = rows.get(n)!.li;
        if (list.children[i] !== li) list.insertBefore(li, list.children[i] ?? null);
      });
      empty.hidden = entries.length > 0;
      applyNarrow();
      if (hadFocus && (!active.isConnected || active.closest('[hidden]'))) header.focus();
    },
  };
}
