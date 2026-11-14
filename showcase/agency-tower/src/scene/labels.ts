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

/** Screen rectangle in CSS px. */
export interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One overview floor label: the tower's east / west facade x and the floor's centre y on screen, label size. */
export interface FloorColumnItem {
  east: number;
  west: number;
  y: number;
  w: number;
  h: number;
}

/** Gap between floor labels in the overview column and between the column and the facade (px). */
export const FLOOR_COLUMN_GAP = 4;
export const FLOOR_COLUMN_OFFSET = 12;

/**
 * Overview floor labels in one column beside the tower (live preview: six department labels stacked over the
 * facade). Right of the tower when the column fits the viewport, else left of it (right-aligned), else clamped
 * inside. Each label sits at its floor's height, pushed down just enough to clear the one above, so the floor
 * order reads top to bottom and no two labels overlap. Returns the label rect per input.
 */
export function floorLabelColumn(items: readonly FloorColumnItem[], viewW: number, gap = FLOOR_COLUMN_GAP, offset = FLOOR_COLUMN_OFFSET, margin = 8): ScreenRect[] {
  if (!items.length) return [];
  const maxW = Math.max(...items.map((i) => i.w));
  const east = Math.max(...items.map((i) => i.east)) + offset;
  const west = Math.min(...items.map((i) => i.west)) - offset - maxW;
  const side: 'east' | 'west' | 'clamp' = east + maxW <= viewW - margin ? 'east' : west >= margin ? 'west' : 'clamp';
  const colX = side === 'east' ? east : side === 'west' ? west : Math.max(margin, viewW - margin - maxW);
  const order = items.map((_, i) => i).sort((a, b) => (items[a]?.y ?? 0) - (items[b]?.y ?? 0));
  const out = new Array<ScreenRect>(items.length);
  let prev: ScreenRect | null = null;
  for (const i of order) {
    const it = items[i]!;
    const y0 = Math.max(it.y - it.h / 2, prev ? prev.y1 + gap : -Infinity);
    const x0 = side === 'west' ? colX + maxW - it.w : colX;
    const r = { x0, y0, x1: x0 + it.w, y1: y0 + it.h };
    out[i] = r;
    prev = r;
  }
  return out;
}

/** Conservative speech bubble size (px) for `text`: 11 px text, max 28ch per line, 4 / 8 px padding. */
export function bubbleSize(text: string): { w: number; h: number } {
  const GLYPH = 6.4;
  const LINE = 28 * GLYPH;
  const textW = [...text].length * GLYPH;
  const lines = Math.max(1, Math.ceil(textW / LINE));
  return { w: Math.min(textW, LINE) + 16, h: lines * 15 + 8 };
}

/** A bubble anchored bottom-centre at (x, y) covers one of `fixed` (with `pad` px of air). */
export function bubbleCovers(x: number, y: number, size: { w: number; h: number }, fixed: readonly ScreenRect[], pad = 2): boolean {
  const b = { x0: x - size.w / 2, x1: x + size.w / 2, y0: y - size.h, y1: y };
  return fixed.some((r) => b.x0 < r.x1 + pad && r.x0 - pad < b.x1 && b.y0 < r.y1 + pad && r.y0 - pad < b.y1);
}
