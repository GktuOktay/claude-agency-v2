// "Görünüm" section (Rev 35): Gündüz / Gece / Otomatik plus the "Görüntü kalitesi" selector.
// The choice goes to `onQuality(tier)` (sceneApp wires it to src/app/quality.ts once that exists;
// until then to the existing ?quality tiers via toLegacyQuality) and is kept in localStorage.
import { tr } from '../../i18n/tr';
import { el } from '../dom';
import { sectionBody, type SettingsSection } from './section';

export const QUALITY_TIERS = ['low', 'medium', 'high', 'ultra'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];
/** Callback the scene passes in; called on every user choice. */
export type OnQuality = (tier: QualityTier) => void;

export const QUALITY_KEY = 'agency-tower:quality';

export function isQualityTier(v: unknown): v is QualityTier {
  return typeof v === 'string' && (QUALITY_TIERS as readonly string[]).includes(v);
}

/** The stored tier, or null when none / unknown / storage blocked. */
export function readStoredQuality(): QualityTier | null {
  try {
    const v = globalThis.localStorage?.getItem(QUALITY_KEY);
    return isQualityTier(v) ? v : null;
  } catch {
    return null; // storage blocked (privacy mode): no stored choice
  }
}

function writeStoredQuality(t: QualityTier): void {
  try {
    globalThis.localStorage?.setItem(QUALITY_KEY, t);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

/** Fallback onto the existing two ?quality tiers until the quality engine exists. */
export function toLegacyQuality(t: QualityTier): 'low' | 'high' {
  return t === 'low' ? 'low' : 'high';
}

export interface AppearanceOptions {
  dayNight: HTMLElement;
  current: QualityTier;
  onQuality: OnQuality;
}

export function createAppearanceSection(o: AppearanceOptions): SettingsSection {
  const t = tr.settings;
  const body = sectionBody('view');
  const fs = el('fieldset', { class: 'quality' });
  fs.append(el('legend', {}, t.quality));
  let chosen: QualityTier = o.current;
  for (const tier of QUALITY_TIERS) {
    const id = `quality-${tier}`;
    const input = el('input', { type: 'radio', name: 'quality', id, value: tier });
    input.checked = tier === o.current;
    // 'change' (keyboard arrows) and 'click' (pointer; some engines skip 'change'), reported once per choice.
    const choose = (): void => {
      if (!input.checked || chosen === tier) return;
      chosen = tier;
      writeStoredQuality(tier);
      o.onQuality(tier);
    };
    input.addEventListener('change', choose);
    input.addEventListener('click', choose);
    const label = el('label', { class: 'quality-option', for: id });
    label.append(input, el('span', {}, t.qualityTiers[tier]));
    fs.append(label);
  }
  body.append(o.dayNight, fs);
  return { id: 'view', title: t.view, element: body };
}
