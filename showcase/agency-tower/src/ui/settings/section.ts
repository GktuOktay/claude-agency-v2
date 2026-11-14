// A settings section module (KARARLAR Rev 35): one self-contained file per section under src/ui/settings/.
// The menu shell turns each into a tab plus a tab panel; `element` is the panel content.
import { el } from '../dom';

export interface SettingsSection {
  /** Stable id (DOM ids are derived from it). */
  id: string;
  /** Tab label, Turkish. */
  title: string;
  element: HTMLElement;
  /** Called each time the section's tab is shown (e.g. refresh a clock line). */
  onShow?(): void;
}

/** Section body; the tab panel around it is labelled by its tab, so no extra heading. */
export function sectionBody(id: string): HTMLElement {
  return el('div', { class: `settings-section settings-${id}` });
}
