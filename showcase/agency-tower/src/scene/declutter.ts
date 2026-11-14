// Screen-space label de-cluttering (KARARLAR Rev 38 polish). Zone / floor / room labels are fixed obstacles
// with priority; robot name pills nudge up past what they hit, or fade when the climb would be too far; speech
// bubbles sit above the resolved pill. All buffers are allocated once (capacity fixed at creation): a pass
// allocates nothing. The app runs a pass every DECLUTTER_EVERY frames and reuses the result in between.

/** Frames between two de-clutter passes (the pills still follow their robots every frame). */
export const DECLUTTER_EVERY = 4;
export const declutterDue = (frame: number): boolean => frame % DECLUTTER_EVERY === 0;

/** Gap between two boxes, px. */
const GAP = 2;
/** A pill climbs at most this many pill heights; further than that it fades on its robot instead. */
const MAX_CLIMB = 2.5;
/** Collision tries per pill (each lifts past one hit). */
const TRIES = 6;

/** Bubble lift above the head point when the robot shows a pill (pill height + gap), and without one. */
export const BUBBLE_ABOVE_PILL = 30;
export const BUBBLE_NO_PILL = 4;
export const bubbleLift = (pillShown: boolean, pillLift: number): number => (pillShown ? pillLift + BUBBLE_ABOVE_PILL : BUBBLE_NO_PILL);

export interface Declutter {
  /** Starts a pass (drops the previous items; buffers are kept). */
  begin(): void;
  /** A label that never moves (zone, floor, room). Anchor: centre x, bottom y. Returns its index or -1 (full). */
  addFixed(x: number, y: number, w: number, h: number): number;
  /** A robot pill. Anchor: centre x, bottom y. `hot`: selected / hovered / focused (placed first, never faded). */
  addPill(x: number, y: number, w: number, h: number, hot: boolean): number;
  solve(): void;
  /** Upward shift of pill `i`, px (0 for a faded pill). */
  lift(i: number): number;
  fade(i: number): boolean;
  /** The preallocated buffers (identity is stable across passes). */
  buffers(): readonly ArrayBufferView[];
}

export function createDeclutter(maxPills: number, maxFixed: number): Declutter {
  const fx = new Float32Array(maxFixed);
  const fy = new Float32Array(maxFixed);
  const fw = new Float32Array(maxFixed);
  const fh = new Float32Array(maxFixed);
  const px = new Float32Array(maxPills);
  const py = new Float32Array(maxPills);
  const pw = new Float32Array(maxPills);
  const ph = new Float32Array(maxPills);
  const hot = new Uint8Array(maxPills);
  const out = new Float32Array(maxPills); // lift
  const faded = new Uint8Array(maxPills);
  const placedY = new Float32Array(maxPills); // resolved bottom y of placed pills
  const placed = new Uint8Array(maxPills);
  const order = new Int16Array(maxPills);
  let nf = 0;
  let np = 0;

  /** Pill i at bottom y: the first box it hits (fixed first), as the y of that box's top, or NaN. */
  const hitTop = (i: number, y: number): number => {
    const x = px[i]!;
    const w = pw[i]!;
    const h = ph[i]!;
    for (let k = 0; k < nf; k++) {
      if (Math.abs(fx[k]! - x) < (fw[k]! + w) / 2 + GAP && y > fy[k]! - fh[k]! - GAP && y - h < fy[k]! + GAP) return fy[k]! - fh[k]!;
    }
    for (let k = 0; k < np; k++) {
      if (!placed[k] || k === i) continue;
      const ky = placedY[k]!;
      if (Math.abs(px[k]! - x) < (pw[k]! + w) / 2 + GAP && y > ky - ph[k]! - GAP && y - h < ky + GAP) return ky - ph[k]!;
    }
    return Number.NaN;
  };

  const before = (a: number, b: number): boolean => (hot[a] !== hot[b] ? hot[a]! > hot[b]! : py[a]! > py[b]!);

  return {
    begin() {
      nf = 0;
      np = 0;
    },
    addFixed(x, y, w, h) {
      if (nf >= maxFixed) return -1;
      fx[nf] = x;
      fy[nf] = y;
      fw[nf] = w;
      fh[nf] = h;
      return nf++;
    },
    addPill(x, y, w, h, isHot) {
      if (np >= maxPills) return -1;
      px[np] = x;
      py[np] = y;
      pw[np] = w;
      ph[np] = h;
      hot[np] = isHot ? 1 : 0;
      return np++;
    },
    solve() {
      // Order: hot pills first, then nearest the viewer (lowest on screen) first. Insertion sort, in place.
      for (let i = 0; i < np; i++) {
        order[i] = i;
        placed[i] = 0;
        faded[i] = 0;
        out[i] = 0;
      }
      for (let i = 1; i < np; i++) {
        const v = order[i]!;
        let j = i - 1;
        while (j >= 0 && before(v, order[j]!)) {
          order[j + 1] = order[j]!;
          j--;
        }
        order[j + 1] = v;
      }
      for (let n = 0; n < np; n++) {
        const i = order[n]!;
        let y = py[i]!;
        let clear = false;
        for (let t = 0; t < TRIES; t++) {
          const top = hitTop(i, y);
          if (Number.isNaN(top)) {
            clear = true;
            break;
          }
          y = top - GAP;
        }
        const climb = py[i]! - y;
        if (!hot[i] && (!clear || climb > MAX_CLIMB * ph[i]!)) {
          faded[i] = 1; // stays on its robot, does not block the others
          continue;
        }
        out[i] = climb;
        placedY[i] = y;
        placed[i] = 1;
      }
    },
    lift: (i) => (i >= 0 && i < np ? out[i]! : 0),
    fade: (i) => i >= 0 && i < np && faded[i] === 1,
    buffers: () => [fx, fy, fw, fh, px, py, pw, ph, hot, out, faded, placedY, placed, order],
  };
}
