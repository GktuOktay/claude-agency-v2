// App states (REQ-7): loading → validate data → (data error | WebGL2 check → fallback | scene).
import { loadData } from '../data/loader';
import type { TowerData } from '../data/types';
import { tr } from '../i18n/tr';
import { createCard, type CardController } from '../ui/card';
import { el } from '../ui/dom';
import { createUnitList } from '../ui/unitList';

export interface SceneContext {
  root: HTMLElement;
  data: TowerData;
  card: CardController;
  nameOf(id: string): string;
  hooks: { onCardClosed?: () => void };
}

export interface BootDeps {
  root: HTMLElement;
  loadRaw(): Promise<{ roster: unknown; overlay: unknown }>;
  hasWebGL2(): boolean;
  startScene(ctx: SceneContext): void;
}

export type BootState = 'data-error' | 'fallback' | 'scene';

export async function boot(deps: BootDeps): Promise<BootState> {
  const { root } = deps;
  root.replaceChildren(el('p', { role: 'status', class: 'state-message' }, tr.loading));

  let data: TowerData;
  try {
    const raw = await deps.loadRaw();
    const result = loadData(raw.roster, raw.overlay);
    if (!result.ok) throw new Error('invalid data');
    data = result.data;
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
  deps.startScene({ root, data, card, nameOf, hooks });
  return 'scene';
}
