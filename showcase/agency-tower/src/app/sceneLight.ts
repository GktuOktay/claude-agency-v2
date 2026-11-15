// Scene light source (Rev 35 P3): in Otomatik the light follows the office clock (on the 0002 simulation clock,
// so a global pause freezes it); Gündüz / Gece hold the 0001 day/night control. Pure: sceneApp reads it every
// frame and tests drive the same function.
import { isNightPhase, skyBrightness, type DayNight } from '../scene/daynight';

export interface SceneLight {
  isNight: boolean;
  /** Sky brightness 0..1 (1 at noon). */
  brightness: number;
  /** The office light phase used (Otomatik), or null when a fixed mode holds. */
  phase: number | null;
}

export function sceneLight(dayNight: Pick<DayNight, 'mode' | 'night' | 'brightness'>, office: { lightPhase(): number }): SceneLight {
  if (dayNight.mode() !== 'auto') return { isNight: dayNight.night(), brightness: dayNight.brightness(), phase: null };
  const phase = office.lightPhase();
  return { isNight: isNightPhase(phase), brightness: skyBrightness(phase), phase };
}
