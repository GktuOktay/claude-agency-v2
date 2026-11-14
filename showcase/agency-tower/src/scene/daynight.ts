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

const DAY = { top: [251, 250, 247], mid: [241, 238, 232], bottom: [230, 226, 218] } as const;
const NIGHT = { top: [22, 28, 48], mid: [34, 40, 66], bottom: [58, 52, 70] } as const;

/** `brightness` 0..1 (sky), `lightsOn` 0..1 (smoothed night flag). */
export function lightingFor(brightness: number, lightsOn: number): Lighting {
  const b = Math.min(1, Math.max(0, brightness));
  const dark = 1 - b;
  return {
    sun: 0.15 + 2.15 * b,
    hemi: 0.35 + 0.8 * b,
    ambient: 0.22 + 0.38 * b,
    exposure: 1.08 + 0.12 * dark,
    sunColor: b > 0.5 ? 0xfff0dc : b > 0.25 ? 0xffc89a : 0x9fb2ff,
    skyTop: mixRgb(NIGHT.top, DAY.top, b),
    skyMid: mixRgb(NIGHT.mid, DAY.mid, b),
    skyBottom: mixRgb(NIGHT.bottom, DAY.bottom, b),
    windowGlow: 0.05 + 1.1 * lightsOn,
    lampGlow: 0.5 + 2.2 * lightsOn,
    interior: 1.8 * lightsOn,
  };
}
