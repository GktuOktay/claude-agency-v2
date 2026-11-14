import type { Texture } from 'three';
import { CODE_LINES } from './codeLines';

const LINES_VISIBLE = 8;
const SCROLL_SPEED = 1.5; // lines per second

// Desk screen state: scrolling placeholder code while its robot works (REQ-21).
export class Screen {
  scrolling = false;
  /** Reduced motion: the screen holds still even while its robot works. */
  frozen = false;
  offset = 0;
  readonly lines = CODE_LINES;

  constructor(private readonly texture: Texture | null = null) {}

  update(dtSeconds: number): void {
    if (!this.scrolling || this.frozen) return;
    this.offset = (this.offset + SCROLL_SPEED * dtSeconds) % this.lines.length;
    if (this.texture) this.texture.offset.y = -this.offset / this.lines.length;
  }
}

export { LINES_VISIBLE };
