// "Ofis" section (Rev 35): Hareketi durdur, Organizasyon şeması and the "Mola saatleri" schedule view.
// The schedule data comes from src/sim/schedule.ts (live office clock on the simulation clock); this file
// defines the contract it meets (OfficeSchedule). The placeholder stays for tests and as a fallback.
import { tr } from '../../i18n/tr';
import { el } from '../dom';
import { sectionBody, type SettingsSection } from './section';

export type ScheduleKind = 'start' | 'work' | 'coffee' | 'lunch' | 'tea' | 'end';

export interface ScheduleSlot {
  /** "HH:MM", 24 h. */
  start: string;
  /** "HH:MM", 24 h; the slot is current while start <= now < end. */
  end: string;
  labelTr: string;
  kind: ScheduleKind;
}

export interface OfficeNow {
  hh: number;
  mm: number;
  /** What the office is doing now, Turkish (e.g. "Kahve molası"). */
  label: string;
}

/** Contract for src/sim/schedule.ts. */
export interface OfficeSchedule {
  now(): OfficeNow;
  slots: readonly ScheduleSlot[];
}

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const pad = (n: number): string => String(n).padStart(2, '0');

const PLACEHOLDER_SLOTS: readonly ScheduleSlot[] = [
  { start: '09:00', end: '09:15', labelTr: 'Mesai başlar', kind: 'start' },
  { start: '10:30', end: '10:45', labelTr: 'Kahve molası', kind: 'coffee' },
  { start: '12:30', end: '13:30', labelTr: 'Öğle yemeği', kind: 'lunch' },
  { start: '15:30', end: '15:45', labelTr: 'Çay molası', kind: 'tea' },
  { start: '18:00', end: '18:15', labelTr: 'Mesai biter', kind: 'end' },
];

/** Placeholder until src/sim/schedule.ts exists: fixed slots, the local wall clock as "now". */
export const PLACEHOLDER_SCHEDULE: OfficeSchedule & { placeholder: true } = {
  placeholder: true,
  slots: PLACEHOLDER_SLOTS,
  now() {
    const d = new Date();
    const hh = d.getHours();
    const mm = d.getMinutes();
    const at = hh * 60 + mm;
    const slot = PLACEHOLDER_SLOTS.find((s) => minutes(s.start) <= at && at < minutes(s.end));
    const label = slot?.labelTr ?? (at >= minutes('09:00') && at < minutes('18:00') ? 'Mesai' : 'Mesai dışı');
    return { hh, mm, label };
  },
};

export interface ScheduleView {
  element: HTMLElement;
  refresh(): void;
}

export function createScheduleView(schedule: OfficeSchedule): ScheduleView {
  const t = tr.settings;
  const box = el('section', { class: 'schedule-box', 'aria-labelledby': 'schedule-title' });
  const now = el('p', { class: 'schedule-now' });
  const list = el('ul', { class: 'schedule' });
  box.append(el('h3', { id: 'schedule-title' }, t.schedule), now, list);
  if ('placeholder' in schedule) box.append(el('p', { class: 'settings-note' }, t.scheduleSample));
  const rows = schedule.slots.map((s) => {
    const li = el('li', { class: `schedule-slot kind-${s.kind}` });
    const text = el('span', { class: 'schedule-text' }, `${s.start} ${s.labelTr}`);
    const mark = el('span', { class: 'schedule-mark' });
    li.append(text, mark);
    list.append(li);
    return { s, li, mark };
  });
  const refresh = (): void => {
    const n = schedule.now();
    now.textContent = t.scheduleNow(pad(n.hh), pad(n.mm), n.label);
    const at = n.hh * 60 + n.mm;
    for (const r of rows) {
      const on = minutes(r.s.start) <= at && at < minutes(r.s.end);
      if (on) r.li.setAttribute('aria-current', 'true');
      else r.li.removeAttribute('aria-current');
      r.mark.textContent = on ? ` ${t.current}` : '';
    }
  };
  refresh();
  return { element: box, refresh };
}

export interface OfficeOptions {
  /** Hareketi durdur, Organizasyon şeması (owned by the scene). */
  controls: readonly HTMLElement[];
  schedule: OfficeSchedule;
}

/** The office section; `refresh` re-reads the schedule (the scene calls it while the menu is open). */
export function createOfficeSection(o: OfficeOptions): SettingsSection & { refresh(): void } {
  const t = tr.settings;
  const body = sectionBody('office');
  const controls = el('div', { class: 'settings-controls' });
  controls.append(...o.controls);
  const view = createScheduleView(o.schedule);
  body.append(controls, view.element);
  return { id: 'office', title: t.office, element: body, onShow: () => view.refresh(), refresh: () => view.refresh() };
}
