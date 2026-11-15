// prefers-reduced-motion (REQ-20): applied on load and on live change.
export interface MediaQueryLike {
  matches: boolean;
  addEventListener(type: 'change', cb: (e: { matches: boolean }) => void): void;
}

export interface MotionTargets {
  rig: { reducedMotion: boolean };
  sim: { setStatic(on: boolean): void };
  dayNight: { setReducedMotion(on: boolean): void };
  screens: readonly { frozen: boolean }[];
  onChange?: (on: boolean) => void;
}

export function bindReducedMotion(mql: MediaQueryLike, t: MotionTargets): { active(): boolean } {
  let on = false;
  const apply = (v: boolean): void => {
    on = v;
    t.rig.reducedMotion = v;
    t.sim.setStatic(v);
    t.dayNight.setReducedMotion(v);
    for (const s of t.screens) s.frozen = v;
    t.onChange?.(v);
  };
  apply(mql.matches);
  mql.addEventListener('change', (e) => apply(e.matches));
  return { active: () => on };
}
