// "Olay akışı" toast (KARARLAR Rev 43 C2): the latest notable events in the bottom-right corner, at most 6 (3 on
// phones), each for FEED_TTL_S seconds of display time; a click hands the event to the app, which moves the camera.
// Sits under the robot card (z-index) and away from the floor panel rail (left column / top strip). Can be turned
// off in settings (stored); off, nothing is shown, the tab list still fills. Text nodes only (REQ-16).
import { trLive } from '../i18n/trLive';
import type { FeedItem } from '../sim/pulse';
import { el } from './dom';

export const FEED_MAX = 6;
export const FEED_TTL_S = 20;
export const FEED_KEY = 'agency-tower:feed';

export function readStoredFeed(): boolean {
  try {
    return globalThis.localStorage?.getItem(FEED_KEY) !== 'off';
  } catch {
    return true; // storage blocked: default on
  }
}

function writeStoredFeed(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(FEED_KEY, on ? 'on' : 'off');
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

export interface EventFeed {
  element: HTMLElement;
  /** "Olay akışı: açık / kapalı" for the settings menu. */
  toggle: HTMLButtonElement;
  push(items: readonly FeedItem[]): void;
  /** Ages the shown events by `dtSeconds` of display time. */
  tick(dtSeconds: number): void;
  /** The latest events (newest first, at most FEED_MAX), shown or not. */
  recent(): readonly FeedItem[];
  onChange(cb: (recent: readonly FeedItem[]) => void): void;
}

export interface EventFeedOptions {
  onActivate(item: FeedItem, opener: HTMLButtonElement): void;
  enabled: boolean;
}

export function itemButton(item: FeedItem, onActivate: (item: FeedItem, b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = el('button', { type: 'button', 'aria-label': trLive.feed.go(item.text) });
  b.append(el('span', { class: 'feed-time' }, item.time), el('span', { class: 'feed-text' }, item.text));
  b.addEventListener('click', () => onActivate(item, b));
  return b;
}

export function createEventFeed(o: EventFeedOptions): EventFeed {
  const t = trLive.feed;
  const element = el('section', { class: 'event-feed', 'aria-label': t.label });
  const list = el('ul');
  element.append(list);
  let on = o.enabled;
  let recent: FeedItem[] = [];
  let shown: { item: FeedItem; age: number }[] = [];
  let listener: ((r: readonly FeedItem[]) => void) | null = null;

  const toggle = el('button', { type: 'button', class: 'feed-toggle', 'aria-pressed': String(on) }, on ? t.on : t.off);

  const render = (): void => {
    list.replaceChildren(
      ...shown.map(({ item }) => {
        const li = el('li');
        li.append(itemButton(item, o.onActivate));
        return li;
      }),
    );
    element.hidden = !on || shown.length === 0;
  };

  toggle.addEventListener('click', () => {
    on = !on;
    writeStoredFeed(on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? t.on : t.off;
    render();
  });

  render();
  return {
    element,
    toggle,
    push(items) {
      if (!items.length) return;
      const fresh = [...items].reverse();
      recent = [...fresh, ...recent].slice(0, FEED_MAX);
      shown = [...fresh.map((item) => ({ item, age: 0 })), ...shown].slice(0, FEED_MAX);
      render();
      listener?.(recent);
    },
    tick(dt) {
      if (!shown.length) return;
      for (const s of shown) s.age += dt;
      const keep = shown.filter((s) => s.age < FEED_TTL_S);
      if (keep.length !== shown.length) {
        shown = keep;
        render();
      }
    },
    recent: () => recent,
    onChange: (cb) => void (listener = cb),
  };
}
