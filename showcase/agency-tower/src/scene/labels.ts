// Which DOM labels are shown per view mode. Overview: department labels only (no clutter); floor view:
// every room and robot label of the focused floor. Hovered / focused / selected robots keep their label (R-5).
import type { ViewState } from './model';

export function roomLabelVisible(room: { floor: number; primary: boolean }, view: ViewState): boolean {
  return view.mode === 'overview' ? room.primary : room.floor === view.focusFloor;
}

export function robotLabelVisible(robot: { id: string; floor: number }, view: ViewState, highlighted: ReadonlySet<string>): boolean {
  if (view.mode === 'floor') {
    if (robot.floor > view.focusFloor) return false; // ghosted
    if (robot.floor === view.focusFloor) return true;
  }
  return highlighted.has(robot.id);
}

/** Speech bubbles (anchored to the head): any robot in overview (AC-18), the focused floor in floor view. */
export function bubbleVisible(robotFloor: number, view: ViewState): boolean {
  return view.mode === 'overview' || robotFloor === view.focusFloor;
}

export interface LabelBox {
  x: number; // anchor centre (px)
  y: number; // anchor bottom (px)
  w: number; // label width (px)
}

/**
 * Greedy de-overlap: labels nearest the viewer (lowest on screen) keep their anchor; a label that would
 * overlap an already placed one is lifted in steps of `h` px. Returns the lift per input label.
 */
export function stackLabels(items: readonly LabelBox[], h: number, gap = 2): number[] {
  const order = items.map((_, i) => i).sort((a, b) => (items[b]?.y ?? 0) - (items[a]?.y ?? 0));
  const lifts = new Array<number>(items.length).fill(0);
  const placed: { x: number; y: number; w: number }[] = [];
  for (const i of order) {
    const it = items[i];
    if (!it) continue;
    let y = it.y;
    for (let guard = 0; guard < 12; guard++) {
      const hit = placed.find((p) => Math.abs(p.x - it.x) < (p.w + it.w) / 2 + gap && Math.abs(p.y - y) < h + gap);
      if (!hit) break;
      y = hit.y - h - gap;
    }
    lifts[i] = it.y - y;
    placed.push({ x: it.x, y, w: it.w });
  }
  return lifts;
}
