// "Senaryo" section (Rev 35): the read-only seed, lane weights and active-job limits (simulation data).
import { tr } from '../../i18n/tr';
import { el } from '../dom';
import type { SettingsSection } from './section';

export interface ScenarioInfo {
  seed: number;
  laneWeights: readonly number[];
  quality: 'low' | 'high';
  maxJobs: { low: number; high: number };
}

/** Read-only scenario facts from the loaded data (labelled as a simulation). */
export function createScenarioInfo(s: ScenarioInfo): HTMLElement {
  const t = tr.settings;
  const section = el('section', { class: 'settings-scenario', 'aria-labelledby': 'settings-scenario-title' });
  section.append(el('h3', { id: 'settings-scenario-title' }, t.scenario), el('p', { class: 'settings-note' }, t.readOnly));
  const dl = el('dl');
  const list = (items: readonly string[]): HTMLElement => {
    const ul = el('ul');
    ul.append(...items.map((x) => el('li', {}, x)));
    return ul;
  };
  const row = (term: string, value: HTMLElement): void => {
    const dd = el('dd');
    dd.append(value);
    dl.append(el('dt', {}, term), dd);
  };
  row(t.seed, el('span', { class: 'settings-seed' }, String(s.seed)));
  row(t.laneWeights, list(s.laneWeights.map((w, i) => `${tr.strip.lane} ${i} · %${w}`)));
  const tiers = (['low', 'high'] as const).map((q) => `${t.tiers[q]}: ${t.maxJobs(s.maxJobs[q])}${q === s.quality ? ` ${t.current}` : ''}`);
  row(t.limit, list(tiers));
  section.append(dl);
  return section;
}

export function createScenarioSection(s: ScenarioInfo): SettingsSection {
  return { id: 'scenario', title: tr.settings.scenario, element: createScenarioInfo(s) };
}
