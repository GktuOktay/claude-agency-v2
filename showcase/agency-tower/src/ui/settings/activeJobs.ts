// "Aktif işler" section (Rev 35): the job strip (step lists "Adımlar", pause text) moved into the menu.
// The active-job badge on the settings button is driven by JobStrip.onCount -> SettingsMenu.setBadge.
import { tr } from '../../i18n/tr';
import { sectionBody, type SettingsSection } from './section';

export interface ActiveJobsOptions {
  strip: HTMLElement;
}

export function createActiveJobsSection(o: ActiveJobsOptions): SettingsSection {
  const body = sectionBody('jobs');
  body.append(o.strip);
  return { id: 'jobs', title: tr.settings.jobs, element: body };
}
