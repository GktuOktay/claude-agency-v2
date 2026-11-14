// App states (REQ-7): loading → validate data → (data error | WebGL2 check → fallback | scene).
import { loadJobTitles } from '../data/jobTitles';
import { loadData } from '../data/loader';
import { loadScenarios, type ScenarioSet } from '../data/scenarios';
import type { TowerData } from '../data/types';
import { tr } from '../i18n/tr';
import { createCard, type CardController } from '../ui/card';
import { el } from '../ui/dom';
import { createUnitList } from '../ui/unitList';

export interface SceneContext {
  root: HTMLElement;
  data: TowerData;
  scenarios: ScenarioSet;
  /** Validated job titles (0002 §7.3). */
  titles: readonly string[];
  card: CardController;
  nameOf(id: string): string;
  hooks: { onCardClosed?: () => void };
}

export interface BootDeps {
  root: HTMLElement;
  loadRaw(): Promise<{ roster: unknown; overlay: unknown; scenarios: unknown; jobTitles: unknown }>;
  hasWebGL2(): boolean;
  startScene(ctx: SceneContext): void;
}

export type BootState = 'data-error' | 'fallback' | 'scene';

export async function boot(deps: BootDeps): Promise<BootState> {
  const { root } = deps;
  root.replaceChildren(el('p', { role: 'status', class: 'state-message' }, tr.loading));

  let data: TowerData;
  let scenarios: ScenarioSet;
  let titles: readonly string[];
  try {
    const raw = await deps.loadRaw();
    const result = loadData(raw.roster, raw.overlay);
    if (!result.ok) throw new Error('invalid data');
    data = result.data;
    // 0002/REQ-2: scenarios are validated before the WebGL2 check; any failure is the data-error state.
    const scen = loadScenarios(raw.scenarios, new Map(data.units.map((u) => [u.id, u.floor])));
    if (!scen.ok) throw new Error('invalid scenarios');
    scenarios = scen.data;
    // 0002/REQ-3: invalid job-title data is the data-error state too.
    const jt = loadJobTitles(raw.jobTitles);
    if (!jt.ok) throw new Error('invalid job titles');
    titles = jt.data;
  } catch {
    root.replaceChildren(el('p', { role: 'alert', class: 'state-message' }, tr.dataError));
    return 'data-error';
  }

  const names = new Map(data.units.map((u) => [u.id, u.name]));
  const nameOf = (id: string): string => names.get(id) ?? id;

  if (!deps.hasWebGL2()) {
    const main = el('main', { class: 'fallback' });
    const cardHost = el('div', { class: 'card-host' });
    const card = createCard(cardHost, { resolveName: nameOf });
    const list = createUnitList(data.units, (u, opener) => card.open(u, opener));
    main.append(el('p', { role: 'alert', class: 'state-message' }, tr.noWebgl), list.element, cardHost);
    root.replaceChildren(main);
    return 'fallback';
  }

  root.replaceChildren();
  const hooks: SceneContext['hooks'] = {};
  const cardHost = el('div', { class: 'card-host' });
  const card = createCard(cardHost, { resolveName: nameOf, onClose: () => hooks.onCardClosed?.() });
  root.append(cardHost);
  deps.startScene({ root, data, scenarios, titles, card, nameOf, hooks });
  return 'scene';
}
