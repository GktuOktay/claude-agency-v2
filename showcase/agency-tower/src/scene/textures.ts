// Procedural canvas textures (browser only; drawn at start-up, no image files). Each returns null when
// a 2D canvas is unavailable, and the scene falls back to flat colours.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { HALF_DEPTH, HALF_WIDTH } from '../sim/layout';
import {
  AWARDS,
  BRAND,
  CODE_LINES,
  KANBAN_COLUMNS,
  ONCALL,
  PIPELINE_RUNS,
  RELEASE_CALENDAR,
  SCREEN_LINES,
  SIDE_PANE_LINES,
  STATUS_ICON,
  STATUS_LABEL,
  WELCOME_LINES,
  type ScreenDomain,
  type StageStatus,
} from './codeLines';
import { createRng } from './rng';
import { LINES_VISIBLE, PANE_FRACTION, SCREEN_CANVAS_W } from './screen';
import { ATLAS_SIZE, ATLAS_TILES, type Tile } from './softwareLayout';

function canvas2d(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  return g ? { c, g } : null;
}

function finish(c: HTMLCanvasElement, repeatX: number, repeatY: number): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

/** Light-oak planks: rows of staggered boards with soft tone variation, grain and thin seams. */
export function woodTexture(): Texture | null {
  const size = 512;
  const cv = canvas2d(size, size);
  if (!cv) return null;
  const { c, g } = cv;
  const rng = createRng(4242);
  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -Math.floor(rng() * 200);
    while (x < size) {
      const len = 180 + Math.floor(rng() * 220);
      const l = 78 + rng() * 6;
      g.fillStyle = `hsl(${32 + rng() * 5}, ${48 + rng() * 10}%, ${l}%)`;
      g.fillRect(x, r * rowH, len, rowH);
      for (let k = 0; k < 7; k++) {
        const y = r * rowH + 4 + rng() * (rowH - 8);
        g.strokeStyle = `rgba(150, 105, 60, ${0.05 + rng() * 0.07})`;
        g.lineWidth = 1 + rng();
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (rng() - 0.5) * 6, x + len * 0.7, y + (rng() - 0.5) * 6, x + len, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(140, 100, 60, 0.35)';
      g.fillRect(x, r * rowH, 1.5, rowH);
      x += len;
    }
    g.fillStyle = 'rgba(140, 100, 60, 0.3)';
    g.fillRect(0, r * rowH, size, 1.5);
  }
  return finish(c, (HALF_WIDTH * 2) / 4, (HALF_DEPTH * 2) / 4);
}

/** Corridor floor: pale herringbone tiles. */
export function hatchTexture(): Texture | null {
  const size = 128;
  const cv = canvas2d(size, size);
  if (!cv) return null;
  const { c, g } = cv;
  g.fillStyle = '#eee9e1';
  g.fillRect(0, 0, size, size);
  const cell = 32;
  g.strokeStyle = 'rgba(160, 145, 125, 0.45)';
  g.lineWidth = 1.5;
  for (let y = -cell; y < size + cell; y += cell / 2) {
    for (let x = 0; x < size; x += cell) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + cell / 2, y + cell / 2);
      g.lineTo(x + cell, y);
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(255, 255, 255, 0.25)';
  for (let x = 0; x < size; x += cell) g.fillRect(x, 0, cell / 2, size);
  return finish(c, HALF_WIDTH * 2 - 0.1, 1.4);
}

/** Soft radial blob used for contact shadows under furniture, robots and the tower. */
export function blobTexture(): Texture | null {
  const size = 128;
  const cv = canvas2d(size, size);
  if (!cv) return null;
  const { c, g } = cv;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- software-company screens (KARARLAR Rev 35)

/** The part of a 2D context the screen and atlas painters use (tests pass a recording fake). */
export interface Draw2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  stroke(): void;
  fill(): void;
}

type IconKind = StageStatus | 'warn';
const ICON_COLOR: Readonly<Record<IconKind, string>> = { pass: '#3fae6e', fail: '#d9534f', run: '#3d8fd6', wait: '#c9952e', warn: '#e0a12e' };

/** Status icon: coloured disc plus a white shape (check, cross, play, pause, warning bar), so shape alone carries the status. */
function icon(g: Draw2D, kind: IconKind, cx: number, cy: number, r: number): void {
  g.fillStyle = ICON_COLOR[kind];
  g.beginPath();
  if (kind === 'warn') {
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy + r * 0.8);
    g.lineTo(cx - r, cy + r * 0.8);
    g.closePath();
  } else g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineWidth = Math.max(1.5, r * 0.3);
  const shape = kind === 'warn' ? 'warn' : STATUS_ICON[kind];
  g.beginPath();
  if (shape === 'check') {
    g.moveTo(cx - r * 0.45, cy);
    g.lineTo(cx - r * 0.1, cy + r * 0.38);
    g.lineTo(cx + r * 0.5, cy - r * 0.38);
    g.stroke();
  } else if (shape === 'cross') {
    g.moveTo(cx - r * 0.4, cy - r * 0.4);
    g.lineTo(cx + r * 0.4, cy + r * 0.4);
    g.moveTo(cx + r * 0.4, cy - r * 0.4);
    g.lineTo(cx - r * 0.4, cy + r * 0.4);
    g.stroke();
  } else if (shape === 'play') {
    g.moveTo(cx - r * 0.3, cy - r * 0.45);
    g.lineTo(cx + r * 0.5, cy);
    g.lineTo(cx - r * 0.3, cy + r * 0.45);
    g.closePath();
    g.fill();
  } else if (shape === 'pause') {
    g.fillRect(cx - r * 0.38, cy - r * 0.42, r * 0.26, r * 0.84);
    g.fillRect(cx + r * 0.12, cy - r * 0.42, r * 0.26, r * 0.84);
  } else {
    g.fillRect(cx - r * 0.1, cy - r * 0.35, r * 0.2, r * 0.6);
    g.fillRect(cx - r * 0.1, cy + r * 0.38, r * 0.2, r * 0.2);
  }
}

interface Row {
  kind: IconKind | 'head' | 'cmd' | null;
  text: string;
  pct: number | null;
}
const MARKERS: readonly (readonly [string, IconKind])[] = [['✓ ', 'pass'], ['✗ ', 'fail'], ['▶ ', 'run'], ['! ', 'warn']];

/** Splits a content row into its status marker, text and an optional trailing percentage. */
function parseRow(line: string): Row {
  let kind: Row['kind'] = null;
  let text = line;
  for (const [m, k] of MARKERS) {
    if (line.startsWith(m)) {
      kind = k;
      text = line.slice(m.length);
    }
  }
  if (line.startsWith('# ')) {
    kind = 'head';
    text = line.slice(2);
  } else if (line.startsWith('$ ')) kind = 'cmd';
  const pm = /\s(\d{1,3})%$/.exec(text);
  const pct = pm && kind !== 'head' ? Number(pm[1]) : null;
  return { kind, text, pct };
}

interface Theme {
  bg: string;
  pane: string;
  text: string;
  dim: string;
  head: string;
  bar: string;
  track: string;
}
const THEMES: Readonly<Record<ScreenDomain, Theme>> = {
  engineering: { bg: '#1e2430', pane: '#161b24', text: '#e7eaf0', dim: '#6f7a8c', head: '#8cc4f2', bar: '#8fd6a8', track: '#2c3442' },
  quality: { bg: '#1b2529', pane: '#141c1f', text: '#e4ece9', dim: '#76888a', head: '#8fd6c2', bar: '#5fc48d', track: '#2a3639' },
  product: { bg: '#f6f3ee', pane: '#e9e4dc', text: '#3a3f47', dim: '#9a9488', head: '#4f7fc0', bar: '#6d9a63', track: '#dcd5ca' },
  management: { bg: '#20263a', pane: '#181d2d', text: '#e8eaf2', dim: '#7a809a', head: '#f2c48c', bar: '#8cc4f2', track: '#2e3550' },
};

/** Draws `lines` as rows from y0 (icon + text, headings, trailing percentage bars) inside [x, x + w]. */
function drawRows(g: Draw2D, lines: readonly string[], x: number, y0: number, w: number, lineH: number, t: Theme, size = 12): void {
  const code = (i: number): string => ['#8fd6a8', '#8cc4f2', '#f2c48c', '#d7b4f2', '#e7eaf0'][i % 5] ?? t.text;
  lines.forEach((line, i) => {
    const y = y0 + i * lineH;
    const mid = y + lineH / 2;
    const r = parseRow(line);
    let tx = x + 4;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    if (r.kind === 'head') {
      g.fillStyle = t.track;
      g.fillRect(x, y + 1, w, lineH - 2);
      g.fillStyle = t.head;
      g.font = `bold ${size}px sans-serif`;
      g.fillText(r.text, tx, mid);
      return;
    }
    if (r.kind && r.kind !== 'cmd') {
      icon(g, r.kind, tx + lineH * 0.3, mid, lineH * 0.3);
      tx += lineH * 0.75;
    }
    g.font = `${size}px ${r.kind === 'cmd' || r.kind === null ? 'monospace' : 'sans-serif'}`;
    g.fillStyle = r.kind === 'cmd' ? t.head : r.kind === null && t === THEMES.engineering ? code(i) : t.text;
    g.fillText(r.text, tx, mid);
    if (r.pct !== null) {
      const bw = Math.min(70, w * 0.3);
      const bx = x + w - bw - 6;
      g.fillStyle = t.track;
      g.fillRect(bx, mid - 3, bw, 6);
      g.fillStyle = t.bar;
      g.fillRect(bx, mid - 3, (bw * Math.min(100, r.pct)) / 100, 6);
    }
  });
}

/** Paints one desk-screen canvas for `domain`: the 256 px main pane plus the side pane (ultrawide only). */
export function drawDomainScreen(g: Draw2D, domain: ScreenDomain, w: number, h: number): void {
  const t = THEMES[domain];
  const lines = SCREEN_LINES[domain];
  const lineH = h / lines.length;
  const main = Math.round(w * PANE_FRACTION);
  g.fillStyle = t.bg;
  g.fillRect(0, 0, w, h);
  let x = 0;
  if (domain === 'engineering') {
    // Editor gutter with line numbers.
    g.fillStyle = t.pane;
    g.fillRect(0, 0, 24, h);
    g.font = '10px monospace';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = t.dim;
    lines.forEach((_, i) => g.fillText(String(i + 1), 20, i * lineH + lineH / 2));
    x = 24;
  }
  drawRows(g, lines, x + 2, 0, main - x - 4, lineH, t);
  g.fillStyle = t.pane;
  g.fillRect(main, 0, w - main, h);
  g.fillStyle = t.track;
  g.fillRect(main, 0, 2, h);
  drawRows(g, SIDE_PANE_LINES[domain], main + 4, 0, w - main - 8, lineH, t, 11);
}

function finishScreen(c: HTMLCanvasElement): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapT = RepeatWrapping;
  t.repeat.set(PANE_FRACTION, LINES_VISIBLE / CODE_LINES.length);
  return t;
}

const screenPool = new Map<ScreenDomain, Texture | null>();
/**
 * Pooled desk-screen texture per domain (drawn once; every desk of the domain shares its image through
 * clones, so each domain uploads once). Scrolls via texture offset; null without a 2D canvas.
 */
export function domainScreenTexture(domain: ScreenDomain): Texture | null {
  if (screenPool.has(domain)) return screenPool.get(domain) ?? null;
  const cv = canvas2d(SCREEN_CANVAS_W, CODE_LINES.length * 18);
  const t = cv ? (drawDomainScreen(cv.g, domain, cv.c.width, cv.c.height), finishScreen(cv.c)) : null;
  screenPool.set(domain, t);
  return t;
}

/** Desk screen: the engineering editor (code, gutter, terminal side pane); scrolls via texture offset. */
export function screenTexture(): Texture | null {
  return domainScreenTexture('engineering');
}

// ---------------------------------------------------------------- decor atlas

function panel(g: Draw2D, t: Tile, bg: string, title?: string, fg = '#e7eaf0'): void {
  g.fillStyle = bg;
  g.fillRect(t.x, t.y, t.w, t.h);
  if (!title) return;
  g.font = 'bold 13px sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(title, t.x + 10, t.y + 13);
}

function text(g: Draw2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left'): void {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

function polyline(g: Draw2D, pts: readonly (readonly [number, number])[], color: string, width: number): void {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
}

function pipelineTile(g: Draw2D, t: Tile): void {
  panel(g, t, '#1c2330', 'CI/CD · Dağıtım hattı');
  const labelW = 104;
  const n = PIPELINE_RUNS[0]?.stages.length ?? 6;
  const sw = (t.w - labelW - 12) / n;
  PIPELINE_RUNS.forEach((run, ri) => {
    const y = t.y + 34 + ri * 52;
    text(g, run.label, t.x + 10, y + 20, 'bold 12px sans-serif', '#e7eaf0');
    run.stages.forEach(([label, s], si) => {
      const x = t.x + labelW + si * sw;
      g.fillStyle = s === 'fail' ? '#3a2326' : s === 'pass' ? '#1f3328' : '#262d3b';
      g.fillRect(x + 2, y, sw - 4, 44);
      g.fillStyle = ICON_COLOR[s];
      g.fillRect(x + 2, y + 41, sw - 4, 3);
      icon(g, s, x + 14, y + 14, 8);
      text(g, label, x + 26, y + 14, 'bold 10px sans-serif', '#e7eaf0');
      text(g, STATUS_LABEL[s], x + 8, y + 32, '9px sans-serif', '#aab3c2');
      if (si < n - 1) polyline(g, [[x + sw - 3, y + 22], [x + sw + 3, y + 22]], '#5a6475', 2);
    });
  });
}

function statusTile(g: Draw2D, t: Tile): void {
  panel(g, t, '#17202a', ONCALL.title);
  ONCALL.services.forEach(([name, s], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = t.x + 14 + col * 250;
    const y = t.y + 46 + row * 36;
    g.fillStyle = '#212c38';
    g.fillRect(x - 4, y - 14, 236, 30);
    icon(g, s, x + 10, y + 1, 9);
    text(g, name, x + 26, y + 1, 'bold 13px sans-serif', '#e7eaf0');
    text(g, STATUS_LABEL[s], x + 222, y + 1, '11px sans-serif', '#aab3c2', 'right');
  });
  text(g, ONCALL.uptime, t.x + 264, t.y + 46 + 2 * 36 + 1, 'bold 13px sans-serif', '#8fd6a8');
  text(g, ONCALL.incidents, t.x + 264, t.y + 46 + 2 * 36 + 24, '12px sans-serif', '#f2c48c');
}

function calendarTile(g: Draw2D, t: Tile): void {
  const c = RELEASE_CALENDAR;
  panel(g, t, '#f6f3ee', c.title, '#3a3f47');
  const days = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
  const cw = (t.w - 20) / 7;
  const top = t.y + 30;
  days.forEach((d, i) => text(g, d, t.x + 10 + i * cw + cw / 2, top + 6, 'bold 10px sans-serif', '#9a9488', 'center'));
  const ch = 30;
  for (let day = 1; day <= c.days; day++) {
    const cell = c.firstWeekday + day - 1;
    const x = t.x + 10 + (cell % 7) * cw;
    const y = top + 14 + Math.floor(cell / 7) * ch;
    g.fillStyle = '#ece6dc';
    g.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    if (day === c.today) {
      g.strokeStyle = '#3a3f47';
      g.lineWidth = 2;
      g.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
    }
    text(g, String(day), x + 5, y + 9, '9px sans-serif', '#5a616b');
    const rel = c.releases.find(([d]) => d === day);
    if (rel) {
      // Release marker: a diamond plus the version label.
      g.fillStyle = '#4f7fc0';
      g.beginPath();
      g.moveTo(x + 10, y + 14);
      g.lineTo(x + 15, y + 19);
      g.lineTo(x + 10, y + 24);
      g.lineTo(x + 5, y + 19);
      g.closePath();
      g.fill();
      text(g, rel[1], x + 18, y + 19, 'bold 10px sans-serif', '#2f5f9e');
    }
  }
}

function welcomeTile(g: Draw2D, t: Tile): void {
  panel(g, t, '#22304a');
  g.fillStyle = '#e3b08f';
  g.fillRect(t.x, t.y + t.h - 8, t.w, 8);
  const [hello, brand, ...rest] = WELCOME_LINES;
  text(g, hello ?? '', t.x + t.w / 2, t.y + 62, 'bold 38px sans-serif', '#ffffff', 'center');
  text(g, brand ?? '', t.x + t.w / 2, t.y + 110, '20px sans-serif', '#f2c48c', 'center');
  rest.forEach((l, i) => text(g, l, t.x + t.w / 2, t.y + 150 + i * 24, '15px sans-serif', '#c9d3e3', 'center'));
}

function signTile(g: Draw2D, t: Tile): void {
  panel(g, t, '#f7f5f1');
  g.fillStyle = '#b98d5e';
  g.fillRect(t.x + 40, t.y + 86, t.w - 80, 2);
  text(g, BRAND.name, t.x + t.w / 2, t.y + 48, 'bold 64px sans-serif', '#3a3f47', 'center');
  text(g, BRAND.tagline, t.x + t.w / 2, t.y + 106, '20px sans-serif', '#7a6a58', 'center');
}

function awardTile(g: Draw2D, t: Tile, title: string, sub: string): void {
  panel(g, t, '#8a6a46');
  g.fillStyle = '#d8c39a';
  g.fillRect(t.x + 8, t.y + 8, t.w - 16, t.h - 16);
  // Trophy: cup, stem and base.
  g.fillStyle = '#b98d3e';
  g.beginPath();
  g.arc(t.x + t.w / 2, t.y + 44, 18, 0, Math.PI);
  g.fill();
  g.fillRect(t.x + t.w / 2 - 18, t.y + 30, 36, 14);
  g.fillRect(t.x + t.w / 2 - 3, t.y + 60, 6, 14);
  g.fillRect(t.x + t.w / 2 - 14, t.y + 74, 28, 6);
  text(g, title, t.x + t.w / 2, t.y + 104, 'bold 13px serif', '#3a2e22', 'center');
  text(g, sub, t.x + t.w / 2, t.y + 124, '12px serif', '#3a2e22', 'center');
}

function kanbanHead(g: Draw2D, t: Tile): void {
  panel(g, t, '#3a3f47');
  const cw = t.w / KANBAN_COLUMNS.length;
  KANBAN_COLUMNS.forEach((c, i) => text(g, c, t.x + i * cw + cw / 2, t.y + t.h / 2, 'bold 18px sans-serif', '#f7f5f1', 'center'));
}

function deskTiles(g: Draw2D): void {
  const T = ATLAS_TILES;
  const dark = THEMES.engineering;
  panel(g, T.terminal, '#161b24', 'Terminal', '#8cc4f2');
  drawRows(g, SIDE_PANE_LINES.engineering.slice(0, 7), T.terminal.x + 8, T.terminal.y + 28, T.terminal.w - 16, 18, dark);
  panel(g, T.tests, '#1b2529', 'Test koşucusu', '#8fd6c2');
  drawRows(g, SCREEN_LINES.quality.slice(1, 8), T.tests.x + 8, T.tests.y + 28, T.tests.w - 16, 18, THEMES.quality);
  panel(g, T.vuln, '#1b2529', 'Zafiyet taraması', '#8fd6c2');
  drawRows(g, SCREEN_LINES.quality.slice(9, 16), T.vuln.x + 8, T.vuln.y + 28, T.vuln.w - 16, 18, THEMES.quality);
  // QA dashboard: pass rate and a week of runs.
  const q = T.qa;
  panel(g, q, '#1b2529', 'Kalite paneli', '#8fd6c2');
  text(g, '94%', q.x + 16, q.y + 62, 'bold 34px sans-serif', '#5fc48d');
  text(g, 'geçme oranı', q.x + 16, q.y + 92, '11px sans-serif', '#aab3c2');
  [70, 82, 76, 90, 88, 94, 94].forEach((v, i) => {
    g.fillStyle = i === 2 ? ICON_COLOR.fail : '#5fc48d';
    g.fillRect(q.x + 130 + i * 16, q.y + 140 - v, 11, v);
  });
  icon(g, 'pass', q.x + 24, q.y + 128, 8);
  text(g, 'kapı açık', q.x + 38, q.y + 128, '11px sans-serif', '#e4ece9');
  // Burndown: ideal and actual lines.
  const b = T.burndown;
  panel(g, b, '#20263a', 'Sprint 23 · burndown', '#f2c48c');
  polyline(g, [[b.x + 20, b.y + 34], [b.x + 20, b.y + 140], [b.x + 240, b.y + 140]], '#7a809a', 1.5);
  polyline(g, [[b.x + 20, b.y + 40], [b.x + 236, b.y + 138]], '#7a809a', 1);
  polyline(g, [[b.x + 20, b.y + 40], [b.x + 50, b.y + 52], [b.x + 80, b.y + 50], [b.x + 110, b.y + 78], [b.x + 140, b.y + 88], [b.x + 170, b.y + 104]], '#8cc4f2', 3);
  // KPI cards.
  const k = T.kpi;
  panel(g, k, '#20263a', 'KPI', '#f2c48c');
  ([['Memnuniyet', '92%'], ['Teslim', '88%'], ['Hata kaçağı', '3%'], ['Uptime', '99,9%']] as const).forEach(([l, v], i) => {
    const x = k.x + 10 + (i % 2) * 120;
    const y = k.y + 30 + Math.floor(i / 2) * 62;
    g.fillStyle = '#2e3550';
    g.fillRect(x, y, 114, 56);
    text(g, v, x + 8, y + 22, 'bold 20px sans-serif', '#e8eaf2');
    text(g, l, x + 8, y + 44, '10px sans-serif', '#aab0c8');
  });
  // Roadmap: Gantt bars.
  const r = T.roadmap;
  panel(g, r, '#20263a', 'Yol haritası · Q4', '#f2c48c');
  ([['Ödeme v2', 0, 0.6], ['Mobil', 0.25, 0.85], ['Raporlama', 0.1, 0.45], ['Arama 2.0', 0.55, 1]] as const).forEach(([l, a, z], i) => {
    const y = r.y + 34 + i * 30;
    text(g, l, r.x + 8, y + 9, '11px sans-serif', '#e8eaf2');
    g.fillStyle = '#2e3550';
    g.fillRect(r.x + 86, y + 2, 160, 14);
    g.fillStyle = ['#8cc4f2', '#f2c48c', '#8fd6a8', '#d7b4f2'][i] ?? '#8cc4f2';
    g.fillRect(r.x + 86 + a * 160, y + 2, (z - a) * 160, 14);
  });
  // Architecture diagram: boxes and arrows.
  const d = T.diagram;
  panel(g, d, '#f6f3ee', 'Mimari · Ödeme v2', '#3a3f47');
  const box = (l: string, x: number, y: number): void => {
    g.fillStyle = '#dbe8f7';
    g.fillRect(d.x + x, d.y + y, 70, 30);
    g.strokeStyle = '#4f7fc0';
    g.lineWidth = 1.5;
    g.strokeRect(d.x + x, d.y + y, 70, 30);
    text(g, l, d.x + x + 35, d.y + y + 15, '10px sans-serif', '#2f5f9e', 'center');
  };
  box('İstemci', 12, 40);
  box('API', 94, 40);
  box('Kuyruk', 176, 40);
  box('Ödeme', 94, 104);
  box('Veri', 176, 104);
  polyline(g, [[d.x + 82, d.y + 55], [d.x + 94, d.y + 55]], '#4f7fc0', 2);
  polyline(g, [[d.x + 164, d.y + 55], [d.x + 176, d.y + 55]], '#4f7fc0', 2);
  polyline(g, [[d.x + 129, d.y + 70], [d.x + 129, d.y + 104]], '#4f7fc0', 2);
  polyline(g, [[d.x + 164, d.y + 119], [d.x + 176, d.y + 119]], '#4f7fc0', 2);
  // Spec document and reception visitor list.
  const s = T.spec;
  panel(g, s, '#ffffff');
  drawRows(g, SCREEN_LINES.product.slice(0, 8), s.x + 8, s.y + 6, s.w - 16, 18.5, THEMES.product, 11);
  const rc = T.reception;
  panel(g, rc, '#22304a', 'Ziyaretçiler · bugün', '#f2c48c');
  drawRows(g, ['✓ 09:30 müşteri toplantısı', '✓ 10:15 kargo', '▶ 11:00 aday görüşmesi', '! 14:00 teknik servis', '# Toplantı odaları', '✓ Kat 3 · boş'], rc.x + 8, rc.y + 30, rc.w - 16, 20, THEMES.management, 11);
}

/** Paints the whole decor atlas (wall boards, desk side screens, plaques, signs). */
export function drawDecorAtlas(g: Draw2D): void {
  const T = ATLAS_TILES;
  deskTiles(g);
  pipelineTile(g, T.pipeline);
  statusTile(g, T.status);
  calendarTile(g, T.calendar);
  welcomeTile(g, T.welcome);
  signTile(g, T.sign);
  kanbanHead(g, T['kanban-head']);
  const plaques = [T['award-a'], T['award-b'], T['award-c']];
  AWARDS.forEach(([a, b], i) => {
    const t = plaques[i];
    if (t) awardTile(g, t, a, b);
  });
}

let atlas: Texture | null | undefined;
/** The shared, static decor atlas (drawn and uploaded once); null without a 2D canvas. */
export function decorAtlas(): Texture | null {
  if (atlas !== undefined) return atlas;
  const cv = canvas2d(ATLAS_SIZE, ATLAS_SIZE);
  if (cv) {
    drawDecorAtlas(cv.g);
    const t = new CanvasTexture(cv.c);
    t.colorSpace = SRGBColorSpace;
    atlas = t;
  } else atlas = null;
  return atlas;
}
