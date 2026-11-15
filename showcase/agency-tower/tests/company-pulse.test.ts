// KARARLAR Rev 43 C1 / C2: "Şirket nabzı" (counters derived from the engine events and the ambient breaks) and
// "Olay akışı" (notable events, at most 6 on screen, click moves the camera). Tests query by role and text.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFeedModel, createPulse, placeOf, type FeedItem } from '../src/sim/pulse';
import type { WfEvent } from '../src/sim/workflow';
import { createEventFeed, FEED_KEY, readStoredFeed } from '../src/ui/eventFeed';
import { createPulseSection } from '../src/ui/settings/pulse';
import { makeWorkflow, run } from './workflowHelpers';

const ev = (e: Partial<WfEvent> & Pick<WfEvent, 'type' | 'job'>): WfEvent => ({ t: 0, ...e });

describe('Şirket nabzı: counters from the simulation events', () => {
  it('counts finished jobs, meetings (meeting room taken) and break starts (rising edges only)', () => {
    const p = createPulse();
    p.ingest([ev({ type: 'job-done', job: 1 }), ev({ type: 'room-hold', job: 2 }), ev({ type: 'step-start', job: 2, kind: 'meeting', units: ['a'] })]);
    p.ingest([ev({ type: 'job-done', job: 2 })]);
    p.sampleBreaks([['a', true], ['b', false]]);
    p.sampleBreaks([['a', true], ['b', true]]);
    p.sampleBreaks([['a', false], ['b', true]]);
    p.sampleBreaks([['a', true], ['b', true]]);
    expect(p.counts()).toEqual({ jobsDone: 2, meetings: 1, breaks: 3 });
  });

  it('the busiest place is the one with most robots now, ties to the first seen; empty when nobody is around', () => {
    expect(placeOf(2, false, 'Kalite ve Güvenlik')).toEqual({ key: 'floor-2', name: 'Kalite ve Güvenlik' });
    expect(placeOf(1, true, 'x').key).toBe('wing-1');
    expect(placeOf(1, true, 'x').name).toBe('Spor & Oyun');
    expect(placeOf(3, true, 'x').name).toBe('Çatı bahçesi');
    const p = createPulse();
    expect(p.busiest([])).toBeNull();
    const a = placeOf(1, false, 'Mühendislik');
    const b = placeOf(0, true, '');
    expect(p.busiest([a, b, b, a, a])).toEqual({ name: 'Mühendislik', count: 3 });
    expect(p.busiest([b, a])).toEqual({ name: 'Yemekhane & Snack bar', count: 1 });
  });

  it('on a real engine run the finished-job count matches the job-done events', () => {
    const wf = makeWorkflow({ seed: 9 });
    const p = createPulse();
    run(wf, 600, (w) => p.ingest(w.drainEvents()));
    const done = wf.trace().filter((e) => e.type === 'job-done').length;
    expect(done).toBeGreaterThan(0);
    expect(p.counts().jobsDone).toBe(done);
    expect(p.counts().meetings).toBe(wf.trace().filter((e) => e.type === 'room-hold').length);
  });

  it('the Nabız tab lists the six figures in Turkish and updates live; empty event list says so', () => {
    const s = createPulseSection({ feedToggle: document.createElement('button'), onEvent: () => undefined });
    expect(s.title).toBe('Nabız');
    s.update({ jobsDone: 4, jobsActive: 2, meetings: 1, breaks: 7, busiest: { name: 'Mühendislik', count: 5 }, officeTime: '12:05', simSeconds: 125 });
    const rows = [...s.element.querySelectorAll('dt')].map((d) => `${d.textContent}: ${d.nextElementSibling?.textContent}`);
    expect(rows).toEqual([
      'Biten işler: 4',
      'Aktif işler: 2',
      'Yapılan toplantılar: 1',
      'Kahve ve molalar: 7',
      'En kalabalık yer: Mühendislik (5 kişi)',
      'Simülasyon saati: 12:05 · 2 dk 5 sn',
    ]);
    s.update({ jobsDone: 5, jobsActive: 1, meetings: 1, breaks: 7, busiest: null, officeTime: '12:06', simSeconds: 130 });
    expect(s.element.querySelector('dd')?.textContent).toBe('5');
    expect([...s.element.querySelectorAll('dd')][4]?.textContent).toBe('Kimse yok');
    expect(s.element.textContent).toContain('Henüz olay yok.');
  });
});

describe('Olay akışı: notable events from the engine', () => {
  it('maps spec imza, QA kırmızı, toplantı, iş bitti; ignores the rest; carries the job robot for the camera', () => {
    const f = createFeedModel();
    const out = f.ingest(
      [
        ev({ type: 'step-start', job: 3, kind: 'carry', units: ['pm'] }),
        ev({ type: 'step-start', job: 3, kind: 'sign', units: ['ceo'] }),
        ev({ type: 'handover', job: 3 }),
        ev({ type: 'step-start', job: 4, kind: 'meeting', units: ['ba', 'pm'] }),
        ev({ type: 'room-hold', job: 4 }),
        ev({ type: 'step-start', job: 5, kind: 'test', units: ['qa'] }),
        ev({ type: 'step-end', job: 5, kind: 'test', outcome: 'reject' }),
        ev({ type: 'step-end', job: 5, kind: 'test', outcome: 'pass' }),
        ev({ type: 'job-done', job: 3 }),
      ],
      '14:05',
    );
    expect(out.map((i) => i.text)).toEqual(['Spec imzaya hazır · İş #3', 'Toplantı başladı · İş #4', 'QA kırmızı · İş #5', 'İş bitti · İş #3']);
    expect(out.map((i) => i.unit)).toEqual(['ceo', 'ba', 'qa', 'ceo']);
    expect(out.every((i) => i.time === '14:05')).toBe(true);
    expect(new Set(out.map((i) => i.id)).size).toBe(4);
  });

  const items = (n: number): FeedItem[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, text: `Olay ${i + 1}`, time: '12:00', job: i + 1, unit: 'qa' }));

  it('shows at most 6 events, newest first, and drops them after their display time', () => {
    const feed = createEventFeed({ onActivate: () => undefined, enabled: true });
    feed.push(items(8));
    const shown = () => [...feed.element.querySelectorAll('button')].map((b) => b.textContent);
    expect(shown()).toHaveLength(6);
    expect(shown()[0]).toContain('Olay 8');
    expect(feed.element.getAttribute('aria-label')).toBe('Olay akışı');
    feed.tick(30);
    expect(shown()).toHaveLength(0);
    expect(feed.element.hidden).toBe(true);
    expect(feed.recent()).toHaveLength(6); // the tab keeps the latest ones
  });

  it('clicking an event activates it (the app moves the camera to the robot / floor)', () => {
    const onActivate = vi.fn();
    const feed = createEventFeed({ onActivate, enabled: true });
    feed.push(items(2));
    feed.element.querySelector('button')!.click();
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 2, unit: 'qa' }), expect.any(HTMLButtonElement));
  });

  it('can be switched off from settings (stored), default on; off shows nothing on screen', () => {
    localStorage.removeItem(FEED_KEY);
    expect(readStoredFeed()).toBe(true);
    const feed = createEventFeed({ onActivate: () => undefined, enabled: readStoredFeed() });
    const t = feed.toggle;
    expect(t.textContent).toBe('Olay akışı: açık');
    expect(t.getAttribute('aria-pressed')).toBe('true');
    t.click();
    expect(t.textContent).toBe('Olay akışı: kapalı');
    expect(readStoredFeed()).toBe(false);
    feed.push(items(2));
    expect(feed.element.hidden).toBe(true);
    expect(feed.recent()).toHaveLength(2);
    t.click();
    expect(feed.element.hidden).toBe(false);
    localStorage.removeItem(FEED_KEY);
  });

  it('the Nabız tab lists recent events as 44 px buttons that activate too', () => {
    const onEvent = vi.fn();
    const s = createPulseSection({ feedToggle: document.createElement('button'), onEvent });
    s.setEvents([...items(3)].reverse()); // newest first, as EventFeed.recent() hands them over
    const bs = [...s.element.querySelectorAll<HTMLButtonElement>('.pulse-events button')];
    expect(bs).toHaveLength(3);
    bs[0]!.click();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), bs[0]);
  });

  it('CSS: the toast sits in the bottom-right corner under the card, clear of the floor panel rail; 44 px targets; phones show 3', () => {
    const css = readFileSync('src/ui/style.css', 'utf8');
    const rule = css.match(/\.event-feed \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/right: var\(--space-4\)/);
    expect(rule).toMatch(/bottom: var\(--space-4\)/);
    expect(rule).not.toMatch(/\b(left|top):/);
    expect(rule).toMatch(/z-index: 11/); // card host is 12, the floor rail column is on the left
    expect(rule).toMatch(/max-width: min\(/);
    expect(css).toMatch(/\.event-feed button \{[^}]*min-height: var\(--touch\)/);
    expect(css).toMatch(/\.pulse-events button \{[^}]*min-height: var\(--touch\)/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{[^@]*\.event-feed li:nth-child\(n \+ 4\) \{ display: none; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^@]*\.event-feed li/);
  });
});
