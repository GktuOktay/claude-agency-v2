import type { Unit } from '../data/types';
import { tr } from '../i18n/tr';
import { el } from './dom';

export interface CardOptions {
  resolveName(id: string): string;
  onClose?: () => void;
}

export interface CardController {
  element: HTMLElement;
  open(unit: Unit, opener: HTMLElement | null): void;
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
    open(unit, from) {
      if (panel) {
        panel.remove();
        panel = null;
      }
      opener = from;
      const p = el('aside', { role: 'dialog', 'aria-label': unit.name, class: 'card' });
      const closeBtn = el('button', { type: 'button', 'aria-label': tr.close, class: 'card-close' }, '×');
      closeBtn.addEventListener('click', close);
      const dl = el('dl');
      const row = (label: string, value: string): void => {
        dl.append(el('dt', {}, label), el('dd', {}, value));
      };
      row(tr.card.name, unit.name);
      row(tr.card.tier, tr.tiers[unit.tier]);
      row(tr.card.role, unit.roleTr);
      row(tr.card.description, unit.description);
      row(tr.card.tools, unit.tools.length ? unit.tools.join(', ') : tr.card.none);
      row(tr.card.model, unit.model ?? tr.card.none);
      row(tr.card.reportsTo, unit.reportsTo ? opts.resolveName(unit.reportsTo) : tr.card.none);
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      });
      p.append(closeBtn, dl);
      parent.append(p);
      panel = p;
      closeBtn.focus();
    },
  };
}
