// Fixed-step film (KARARLAR Rev 45 Ruling): with `?film=1&fixed=1` the app runs no animation loop of its own; the
// recorder calls `window.__film.step()` per captured frame. Every frame advances the whole app by exactly 1/30 s
// (the film's day speed multiplies the simulation inside that frame as in real time), so the film no longer
// depends on how fast a 4K frame renders. Pure: the app hands in its frame function.

/** Frames per second of the recorded film. */
export const FILM_FPS = 30;
export const FILM_FRAME_S = 1 / FILM_FPS;
/** Seconds the recording keeps running after the film's onEnd (the camera settles on the overview). */
export const FILM_TAIL_S = 2.5;
export const FILM_TAIL_FRAMES = Math.round(FILM_TAIL_S * FILM_FPS);

/** `?film=1&fixed=1` asks for fixed-step film frames. */
export function filmFixedParam(search: string): boolean {
  const sp = new URLSearchParams(search);
  return sp.get('film') === '1' && sp.get('fixed') === '1';
}

export interface FixedStepDeps {
  /** One app frame: advance by `dt` seconds; draw only when `render` is true. `nowMs` = the fixed timeline. */
  frame(dt: number, nowMs: number, render: boolean): void;
  /** The film has ended (onEnd fired). */
  ended(): boolean;
  /** Starts the film if it has not started (the first step starts it; no wall-clock timer). */
  start(): void;
}

export interface FixedStepper {
  /** Advance `frames` frames (default 1) of exactly FILM_FRAME_S each, render once at the last; done after the tail. */
  step(frames?: number): { done: boolean };
  /** Frames stepped so far. */
  readonly frames: number;
}

export function createFixedStepper(d: FixedStepDeps): FixedStepper {
  let frames = 0;
  let tail = 0;
  const done = (): boolean => tail >= FILM_TAIL_FRAMES;
  return {
    step(n = 1) {
      const count = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
      if (frames === 0) d.start();
      let drawn = false;
      let moved = false;
      for (let k = 0; k < count; k++) {
        if (done()) break;
        frames++;
        moved = true;
        drawn = k === count - 1;
        // nowMs is derived from the frame count (not summed), so the timeline never drifts.
        d.frame(FILM_FRAME_S, (frames * 1000) / FILM_FPS, drawn);
        if (d.ended()) tail++;
      }
      // Stopped early at the end of the tail: draw the last state once (a zero-length frame changes nothing).
      if (moved && !drawn) d.frame(0, (frames * 1000) / FILM_FPS, true);
      return { done: done() };
    },
    get frames() {
      return frames;
    },
  };
}
