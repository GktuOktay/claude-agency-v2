// Procedural canvas textures (browser only; drawn at start-up, no image files). Each returns null when
// a 2D canvas is unavailable, and the scene falls back to flat colours.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { CODE_LINES } from './codeLines';
import { HALF_DEPTH, HALF_WIDTH } from './model';
import { createRng } from './rng';
import { LINES_VISIBLE } from './screen';

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

/** Desk screen: placeholder code on a dark editor background (scrolls via texture offset). */
export function screenTexture(): Texture | null {
  const lineH = 18;
  const cv = canvas2d(256, CODE_LINES.length * lineH);
  if (!cv) return null;
  const { c, g } = cv;
  g.fillStyle = '#1e2430';
  g.fillRect(0, 0, c.width, c.height);
  const colors = ['#8fd6a8', '#8cc4f2', '#f2c48c', '#d7b4f2', '#e7eaf0'];
  g.font = '12px monospace';
  CODE_LINES.forEach((line, i) => {
    g.fillStyle = colors[i % colors.length] ?? '#e7eaf0';
    g.fillText(line, 8 + (i % 3) * 6, i * lineH + 13);
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1, LINES_VISIBLE / CODE_LINES.length);
  return t;
}
