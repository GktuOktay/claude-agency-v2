// HUD layout (KARARLAR Rev 31 UI pass, Rev 35). Only the floor panel stays on screen: it shares a flex
// column ("rail") with the org legend (shown in org mode only). The job strip and every control live in
// the corner settings menu, first in the tab order like the old toolbar.
import { el } from './dom';

export interface HudParts {
  menu: HTMLElement;
  panel: HTMLElement;
  legend: HTMLElement;
}

/** Appends the menu and the rail to `root` and returns the rail. */
export function mountHud(root: HTMLElement, parts: HudParts): HTMLElement {
  const rail = el('div', { class: 'hud-rail' });
  rail.append(parts.panel, parts.legend);
  root.append(parts.menu, rail);
  return rail;
}
