// HUD layout (KARARLAR Rev 31 UI pass). The floor panel, the org legend and the job strip share one
// flex column ("rail"), so the strip can never sit on top of the panel: a left column on desktop, the
// full screen height on phones (panel on top, legend and strip at the bottom). The settings menu sits
// in the top-right corner, first in the tab order like the old toolbar.
import { el } from './dom';

export interface HudParts {
  menu: HTMLElement;
  panel: HTMLElement;
  legend: HTMLElement;
  strip: HTMLElement;
}

/** Appends the menu and the rail to `root` and returns the rail. */
export function mountHud(root: HTMLElement, parts: HudParts): HTMLElement {
  const rail = el('div', { class: 'hud-rail' });
  rail.append(parts.panel, parts.legend, parts.strip);
  root.append(parts.menu, rail);
  return rail;
}
