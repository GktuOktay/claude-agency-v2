import type { MeshBasicMaterial, Texture } from 'three';
import { CODE_LINES } from './codeLines';

const LINES_VISIBLE = 8;
const SCROLL_SPEED = 1.5; // lines per second

// Desk screen state: scrolling placeholder code while its robot works (REQ-21). Spec 0002 REQ-8: an
// overlay texture (build progress, lane-0 evidence) can replace the code view on the same face.
export class Screen {
  scrolling = false;
  /** Reduced motion: the screen holds still even while its robot works. */
  frozen = false;
  offset = 0;
  readonly lines = CODE_LINES;
  /** Texture shown instead of the code view; null = code view. */
  overlay: Texture | null = null;
  private material: MeshBasicMaterial | null = null;

  constructor(readonly texture: Texture | null = null) {}

  /** The monitor face material whose map this screen drives. */
  bind(material: MeshBasicMaterial): void {
    this.material = material;
    this.apply();
  }

  setOverlay(map: Texture | null): void {
    if (map === this.overlay) return;
    this.overlay = map;
    this.apply();
  }

  private apply(): void {
    const m = this.material;
    if (!m) return;
    const next = this.overlay ?? this.texture;
    if (m.map === next) return;
    if (!m.map !== !next) m.needsUpdate = true;
    m.map = next;
  }

  update(dtSeconds: number): void {
    if (!this.scrolling || this.frozen) return;
    this.offset = (this.offset + SCROLL_SPEED * dtSeconds) % this.lines.length;
    if (this.texture) this.texture.offset.y = -this.offset / this.lines.length;
  }
}

export { LINES_VISIBLE };
