import type { MeshBasicMaterial, Texture } from 'three';
import { CODE_LINES, SCREEN_LINES, type ScreenDomain } from './codeLines';

const LINES_VISIBLE = 8;
const SCROLL_SPEED = 1.5; // lines per second
/** Desk screen canvases are 384 px wide: a 256 px main pane plus a side pane only ultrawide monitors show. */
export const SCREEN_CANVAS_W = 384;
export const PANE_FRACTION = 256 / SCREEN_CANVAS_W;

// Desk screen state: scrolling placeholder content while its robot works (REQ-21). Spec 0002 REQ-8: an
// overlay texture (build progress, lane-0 evidence) can replace the content view on the same face.
// KARARLAR Rev 35: the content follows the floor domain (code, tests and scans, specs, plans).
export class Screen {
  scrolling = false;
  /** Reduced motion: the screen holds still even while its robot works. */
  frozen = false;
  offset = 0;
  domain: ScreenDomain = 'engineering';
  lines: readonly string[] = CODE_LINES;
  /** Texture shown instead of the content view; null = content view. */
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

  /** Content domain of this screen (the texture image is swapped by the scene, see softwareDecor.ts). */
  setDomain(domain: ScreenDomain): void {
    this.domain = domain;
    this.lines = SCREEN_LINES[domain];
    this.offset %= this.lines.length;
  }

  /** Ultrawide monitors show the whole canvas (main and side pane); standard ones the main pane. */
  setWide(wide: boolean): void {
    if (this.texture) this.texture.repeat.x = wide ? 1 : PANE_FRACTION;
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
