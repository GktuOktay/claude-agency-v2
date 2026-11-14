// Meeting-room whiteboard (spec 0002 REQ-15, R-6, AC-14; REQ-19/AC-16). The board fills section by
// section with placeholder headings from the built-in list (`tr.whiteboard`, never repository
// content) and procedural scribble lines while a meeting step runs, on the simulation clock (it
// reads the engine's step progress, so it pauses with it). Lane 2: erased when the meeting ends
// (the room is released); lane 3: stays filled until the room is released after the sign step.
// The logic is pure; only `createWhiteboardTexture` touches the DOM (a 2D canvas).
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import type { ScenarioSet } from '../data/scenarios';
import { tr } from '../i18n/tr';
import type { WfEvent, Workflow } from '../sim/workflow';
import { createRng } from './rng';

/** What the board shows: `filled` sections (fractional while a section is being written). */
export interface BoardState {
  job: number | null;
  step: string | null;
  sections: number;
  filled: number;
}

const EMPTY: BoardState = { job: null, step: null, sections: 0, filled: 0 };
/** Scribble lines per section; the normal board gains them one by one. */
export const LINES_PER_SECTION = 4;
const DEFAULT_SECTIONS = 6;

export interface WhiteboardController {
  /** Feed every drained engine event (in order). */
  ingest(events: readonly WfEvent[]): void;
  /** Current board; `reduced` (prefers-reduced-motion) shows whole sections only. */
  state(wf: Pick<Workflow, 'stepProgress'>, reduced: boolean): BoardState;
}

export function createWhiteboard(set: ScenarioSet): WhiteboardController {
  const variantOf = new Map<number, string>();
  let board: { job: number; step: string; sections: number; done: boolean } | null = null;
  const sectionsOf = (job: number, step: string): number => {
    const sc = set.scenarios.find((s) => s.id === variantOf.get(job));
    return sc?.steps.find((s) => s.id === step)?.sections ?? DEFAULT_SECTIONS;
  };
  return {
    ingest(events) {
      for (const e of events) {
        if (e.type === 'job-start' && e.variant) variantOf.set(e.job, e.variant);
        else if (e.type === 'step-start' && e.kind === 'meeting' && e.step) board = { job: e.job, step: e.step, sections: sectionsOf(e.job, e.step), done: false };
        else if (e.type === 'step-end' && e.kind === 'meeting' && board && board.job === e.job && board.step === e.step) board.done = true;
        else if ((e.type === 'room-release' || e.type === 'job-done') && board && board.job === e.job) board = null;
        if (e.type === 'job-done') variantOf.delete(e.job);
      }
    },
    state(wf, reduced) {
      if (!board) return EMPTY;
      const { job, step, sections } = board;
      if (board.done) return { job, step, sections, filled: sections };
      const f = wf.stepProgress(job, step) ?? 0;
      // Normal: line by line; reduced motion: whole sections only (AC-16).
      const unit = reduced ? 1 : 1 / LINES_PER_SECTION;
      const filled = Math.min(sections, Math.floor((f * sections) / unit + 1e-9) * unit);
      return { job, step, sections, filled };
    },
  };
}

/** The subset of a 2D canvas context the board draws with (tests pass a recorder). */
export type BoardCtx = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'font' | 'textBaseline' | 'lineCap' | 'fillRect' | 'strokeRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'stroke' | 'fillText'
>;

// Marker inks match the three markers on the board's tray (model.ts).
const INK = ['#3b6fd1', '#2b2f36', '#d94c4c'] as const;
const PAPER = '#fbfbf8';
const GRID = '#d7dbe0';

/** Draws `s` on a w×h board: a 2-row grid of sections, each a heading plus scribble lines. */
export function drawBoard(g: BoardCtx, w: number, h: number, s: BoardState): void {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, w, h);
  if (s.job === null || s.sections <= 0) return;
  const cols = Math.ceil(s.sections / 2);
  const pad = w * 0.03;
  const cw = (w - pad * (cols + 1)) / cols;
  const ch = (h - pad * 3) / 2;
  g.lineCap = 'round';
  g.textBaseline = 'top';
  for (let k = 0; k < s.sections; k++) {
    const x = pad + (k % cols) * (cw + pad);
    const y = pad + Math.floor(k / cols) * (ch + pad);
    g.strokeStyle = GRID;
    g.lineWidth = Math.max(1, w / 512);
    g.strokeRect(x, y, cw, ch);
    const part = Math.min(1, s.filled - k);
    if (part <= 0) continue;
    const heading = tr.whiteboard[k % tr.whiteboard.length]!;
    g.fillStyle = INK[k % INK.length]!;
    g.font = `600 ${Math.round(ch * 0.17)}px system-ui, sans-serif`;
    g.fillText(heading, x + cw * 0.06, y + ch * 0.08, cw * 0.88);
    const lines = Math.round(part * LINES_PER_SECTION);
    const rng = createRng(0x77b0 + k * 131);
    g.strokeStyle = INK[1];
    g.lineWidth = Math.max(1, ch * 0.025);
    for (let i = 0; i < lines; i++) {
      const ly = y + ch * (0.42 + i * 0.14);
      const len = cw * (0.55 + rng() * 0.33);
      g.beginPath();
      g.moveTo(x + cw * 0.06, ly);
      const steps = 5;
      for (let j = 1; j <= steps; j++) {
        const px = x + cw * 0.06 + (len * j) / steps;
        g.quadraticCurveTo(px - len / steps / 2, ly + (rng() - 0.5) * ch * 0.05, px, ly);
      }
      g.stroke();
    }
  }
}

export interface WhiteboardTexture {
  texture: Texture;
  /** Redraws only when what is shown changes. */
  render(s: BoardState): void;
}

/** Canvas texture of §7.7 size; null without a 2D canvas (the board stays plain white). */
export function createWhiteboardTexture(size: { width: number; height: number }): WhiteboardTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = size.width;
  c.height = size.height;
  const g = c.getContext('2d');
  if (!g) return null;
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  let key = '';
  const render = (s: BoardState): void => {
    const k = `${s.job ?? '-'}:${s.step ?? ''}:${s.sections}:${s.filled}`;
    if (k === key) return;
    key = k;
    drawBoard(g, c.width, c.height, s);
    texture.needsUpdate = true;
  };
  render(EMPTY);
  return { texture, render };
}
