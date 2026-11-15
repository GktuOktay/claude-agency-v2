// "Nabız" section (KARARLAR Rev 43 C1 / C2): "Şirket nabzı" figures (live while the tab is open), the
// "Olay akışı" toggle and the recent events as buttons (a click moves the camera, as on the toast). Text only.
import { trLive } from '../../i18n/trLive';
import type { Busiest, FeedItem } from '../../sim/pulse';
import { el } from '../dom';
import { itemButton } from '../eventFeed';
import { sectionBody, type SettingsSection } from './section';

export interface PulseView {
  jobsDone: number;
  jobsActive: number;
  meetings: number;
  breaks: number;
  busiest: Busiest | null;
  /** Office clock "HH:MM". */
  officeTime: string;
  /** Simulation seconds since load. */
  simSeconds: number;
}

export interface PulseSectionOptions {
  feedToggle: HTMLElement;
  onEvent(item: FeedItem, opener: HTMLButtonElement): void;
}

export interface PulseSection extends SettingsSection {
  update(v: PulseView): void;
  setEvents(items: readonly FeedItem[]): void;
}

export function createPulseSection(o: PulseSectionOptions): PulseSection {
  const t = trLive.pulse;
  const body = sectionBody('pulse');
  const box = el('section', { class: 'pulse-box', 'aria-labelledby': 'pulse-title' });
  const dl = el('dl', { class: 'pulse' });
  const value = (label: string): HTMLElement => {
    const dd = el('dd', {}, '–');
    dl.append(el('dt', {}, label), dd);
    return dd;
  };
  const dd = {
    jobsDone: value(t.jobsDone),
    jobsActive: value(t.jobsActive),
    meetings: value(t.meetings),
    breaks: value(t.breaks),
    busiest: value(t.busiest),
    simTime: value(t.simTime),
  };
  box.append(el('h3', { id: 'pulse-title' }, t.title), el('p', { class: 'settings-note' }, t.note), dl);

  const controls = el('div', { class: 'settings-controls' });
  controls.append(o.feedToggle);
  const events = el('section', { class: 'pulse-events', 'aria-labelledby': 'pulse-events-title' });
  const list = el('ul');
  const empty = el('p', { class: 'settings-note' }, t.noEvents);
  events.append(el('h3', { id: 'pulse-events-title' }, t.events), empty, list);
  body.append(box, controls, events);

  const set = (e: HTMLElement, s: string): void => {
    if (e.textContent !== s) e.textContent = s;
  };
  return {
    id: 'pulse',
    title: t.tab,
    element: body,
    update(v) {
      set(dd.jobsDone, String(v.jobsDone));
      set(dd.jobsActive, String(v.jobsActive));
      set(dd.meetings, String(v.meetings));
      set(dd.breaks, String(v.breaks));
      set(dd.busiest, v.busiest ? t.busiestValue(v.busiest.name, v.busiest.count) : t.nobody);
      set(dd.simTime, t.simTimeValue(v.officeTime, v.simSeconds));
    },
    setEvents(items) {
      empty.hidden = items.length > 0;
      list.replaceChildren(
        ...items.map((item) => {
          const li = el('li');
          li.append(itemButton(item, o.onEvent));
          return li;
        }),
      );
    },
  };
}
