// Day/night cycle (REQ-18) and the lighting it implies. Pure: no renderer.
export type DayNightMode = 'auto' | 'day' | 'night';

export const CYCLE_SECONDS = 90;
export const START_PHASE = 0.25; // noon

export const skyBrightness = (phase: number): number => 0.5 + 0.5 * Math.cos(2 * Math.PI * (phase - 0.25));
export const isNightPhase = (phase: number): boolean => phase >= 0.5 && phase < 1;

export interface DayNight {
  mode(): DayNightMode;
  phase(): number;
  /** Returns false when the mode is not available (Otomatik under reduced motion). */
  setMode(m: DayNightMode): boolean;
  step(dtSeconds: number): void;
  brightness(): number;
  night(): boolean;
  autoAvailable(): boolean;
  setReducedMotion(on: boolean): void;
  subscribe(cb: () => void): void;
}

export function createDayNight(): DayNight {
  let mode: DayNightMode = 'auto';
  let phase = START_PHASE;
  let reduced = false;
  const subs: (() => void)[] = [];
  const notify = (): void => subs.forEach((cb) => cb());

  return {
    mode: () => mode,
    phase: () => phase,
    setMode(m) {
      if (m === 'auto' && reduced) return false;
      if (m === 'auto' && mode !== 'auto') phase = START_PHASE;
      mode = m;
      notify();
      return true;
    },
    step(dt) {
      if (mode !== 'auto') return;
      phase = (phase + Math.max(0, dt) / CYCLE_SECONDS) % 1;
    },
    brightness: () => (mode === 'day' ? 1 : mode === 'night' ? 0 : skyBrightness(phase)),
    night: () => (mode === 'night' ? true : mode === 'day' ? false : isNightPhase(phase)),
    autoAvailable: () => !reduced,
    setReducedMotion(on) {
      reduced = on;
      if (on && mode === 'auto') mode = 'day'; // holds Gündüz
      notify();
    },
    subscribe(cb) {
      subs.push(cb);
    },
  };
}

export interface Lighting {
  sun: number;
  hemi: number;
  ambient: number;
  exposure: number;
  sunColor: number;
  /** Hemisphere fill: cool sky over warm ground by day, moonlit blue at night (Rev 35). */
  hemiSky: number;
  hemiGround: number;
  /** scene.environmentIntensity for the PMREM reflections (only used on tiers with an environment). */
  env: number;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  windowGlow: number; // emissive intensity of window frames
  lampGlow: number; // emissive intensity of lamps and ceiling lights
  interior: number; // warm interior fill light intensity
}

const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const mixRgb = (a: readonly number[], b: readonly number[], t: number): string =>
  hex((a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t, (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t, (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t);

const mixNum = (a: readonly number[], b: readonly number[], t: number): number => parseInt(mixRgb(a, b, t).slice(1), 16);

// Key light colour stops (Rev 35): cool moon → golden hour → warm daylight, blended without steps.
const MOON = [159, 178, 255] as const;
const GOLDEN = [255, 184, 128] as const;
const GOLDEN_AT = 0.35;
const SUN_DAY = [255, 232, 204] as const;
const sunColorFor = (b: number): number =>
  b < GOLDEN_AT ? mixNum(MOON, GOLDEN, b / GOLDEN_AT) : mixNum(GOLDEN, SUN_DAY, (b - GOLDEN_AT) / (1 - GOLDEN_AT));

const HEMI_DAY = { sky: [238, 243, 255], ground: [232, 220, 203] } as const;
const HEMI_NIGHT = { sky: [74, 88, 138], ground: [44, 40, 54] } as const;

const DAY = { top: [251, 250, 247], mid: [241, 238, 232], bottom: [230, 226, 218] } as const;
const NIGHT = { top: [22, 28, 48], mid: [34, 40, 66], bottom: [58, 52, 70] } as const;

/** `brightness` 0..1 (sky), `lightsOn` 0..1 (smoothed night flag). */
export function lightingFor(brightness: number, lightsOn: number): Lighting {
  const b = Math.min(1, Math.max(0, brightness));
  const dark = 1 - b;
  return {
    sun: 0.12 + 2.23 * b,
    hemi: 0.42 + 0.73 * b,
    ambient: 0.18 + 0.42 * b,
    exposure: 1.08 + 0.12 * dark,
    sunColor: sunColorFor(b),
    hemiSky: mixNum(HEMI_NIGHT.sky, HEMI_DAY.sky, b),
    hemiGround: mixNum(HEMI_NIGHT.ground, HEMI_DAY.ground, b),
    env: 0.08 + 0.27 * b,
    skyTop: mixRgb(NIGHT.top, DAY.top, b),
    skyMid: mixRgb(NIGHT.mid, DAY.mid, b),
    skyBottom: mixRgb(NIGHT.bottom, DAY.bottom, b),
    windowGlow: 0.05 + 1.1 * lightsOn,
    lampGlow: 0.5 + 2.2 * lightsOn,
    interior: 1.8 * lightsOn,
  };
}
