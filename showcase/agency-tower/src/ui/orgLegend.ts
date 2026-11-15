// Org-mode legend (REQ-17): names both line styles in text; the swatches are decorative.
import { tr } from '../i18n/tr';
import { el } from './dom';

export function createOrgLegend(): HTMLElement {
  const box = el('div', { class: 'org-legend', role: 'note', 'aria-label': tr.orgChart });
  box.append(el('p', { class: 'org-legend-title' }, tr.orgChart));
  for (const [cls, text] of [['solid', tr.legend.solid], ['dashed', tr.legend.dashed]] as const) {
    const row = el('p', { class: 'org-legend-row' });
    row.append(el('span', { class: `swatch ${cls}`, 'aria-hidden': 'true' }), el('span', {}, text));
    box.append(row);
  }
  return box;
}
