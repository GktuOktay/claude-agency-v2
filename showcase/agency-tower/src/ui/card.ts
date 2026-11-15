import type { Unit } from '../data/types';
import { tr } from '../i18n/tr';
import { modelLabel, toolLabel } from '../data/toolsTr';
import { el } from './dom';
import type { CardLines } from './nowLine';

export interface CardOptions {
  resolveName(id: string): string;
  onClose?: () => void;
  /** KARARLAR Rev 42 "Ajan gözü": scene only; adds a "Takip et" button to the card. */
  onFollow?: (unit: Unit) => void;
}

export interface CardController {
  element: HTMLElement;
  /** `lines` (0002 REQ-12) only in the scene; the fallback card has neither line. */
  open(unit: Unit, opener: HTMLElement | null, lines?: CardLines): void;
  close(): void;
  isOpen(): boolean;
}

export function createCard(parent: HTMLElement, opts: CardOptions): CardController {
  let panel: HTMLElement | null = null;
  let opener: HTMLElement | null = null;

  const close = (): void => {
    if (!panel) return;
    panel.remove();
    panel = null;
    const back = opener;
    opener = null;
    if (back?.isConnected) back.focus();
    opts.onClose?.();
  };

  return {
    get element() {
      return panel ?? parent;
    },
    isOpen: () => panel !== null,
    close,
    open(unit, from, lines) {
      if (panel) {
        panel.remove();
        panel = null;
      }
      opener = from;
      const p = el('aside', { role: 'dialog', 'aria-label': unit.nameTr, class: 'card' });
      const closeBtn = el('button', { type: 'button', 'aria-label': tr.close, class: 'card-close' }, '×');
      closeBtn.addEventListener('click', close);
      const title = el('h2', { class: 'card-title' }, unit.nameTr);
      const dl = el('dl');
      const row = (label: string, value: string): void => {
        dl.append(el('dt', {}, label), el('dd', {}, value));
      };
      row(tr.card.name, unit.name);
      if (lines) {
        row(tr.now.label, lines.now);
        if (lines.job) row(tr.now.job, lines.job);
      }
      row(tr.card.tier, tr.tiers[unit.tier]);
      row(tr.card.role, unit.roleTr);
      const descDd = el('dd', {}, unit.descriptionTr);
      const orig = el('details', { class: 'card-original' });
      orig.append(el('summary', {}, tr.card.original), el('p', {}, unit.description));
      descDd.append(orig);
      dl.append(el('dt', {}, tr.card.description), descDd);
      row(tr.card.tools, unit.tools.length ? unit.tools.map(toolLabel).join(', ') : tr.card.none);
      row(tr.card.model, unit.model ? modelLabel(unit.model) : tr.card.none);
      row(tr.card.reportsTo, unit.reportsTo ? opts.resolveName(unit.reportsTo) : tr.card.none);
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      });
      p.append(closeBtn, title);
      const onFollow = opts.onFollow;
      if (onFollow) {
        const follow = el('button', { type: 'button', class: 'card-follow', 'aria-label': tr.camera.followLabel(unit.nameTr) }, tr.camera.follow);
        follow.addEventListener('click', () => onFollow(unit));
        p.append(follow);
      }
      p.append(dl);
      parent.append(p);
      panel = p;
      closeBtn.focus();
    },
  };
}
