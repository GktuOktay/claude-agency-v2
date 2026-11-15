// Aspect-aware film framing (KARARLAR Rev 45: 16:9 and 9:16 film). The shots are composed for a 16:9 frame; a
// narrower frame (9:16 portrait) keeps the subject's horizontal width in view by widening the vertical lens up to a
// cap and pulling the camera back along its view line for the rest. Pure: three.js math only, no renderer.
import { Vector3 } from 'three';

/** The aspect the film shots were composed for (16:9). */
export const FILM_REF_ASPECT = 16 / 9;

export interface AspectFitOptions {
  /** Share of the 16:9 horizontal coverage that must stay in view (1 = the whole width). */
  coverage?: number;
  /** Widest vertical lens the fit may use (degrees); beyond it the camera pulls back instead. */
  maxFov?: number;
  refAspect?: number;
}

export interface AspectFit {
  /** Vertical field of view (degrees). */
  fov: number;
  /** Camera-to-target distance multiplier (≥ 1). */
  distScale: number;
}

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** Interior place shots: the whole 16:9 width, lens up to 62°. */
export const PLACE_FIT: Readonly<Required<Omit<AspectFitOptions, 'refAspect'>>> = { coverage: 1, maxFov: 62 };
/** Follow shots: one robot and its desk (70 % of the 16:9 width), lens up to 72°, little pull-back (walls). */
export const FOLLOW_FIT: Readonly<Required<Omit<AspectFitOptions, 'refAspect'>>> = { coverage: 0.7, maxFov: 72 };

/**
 * Lens and distance for a shot composed at `fovRef` (vertical, 16:9) shown at `aspect` (width / height). At the
 * reference aspect or wider nothing changes (the vertical framing stays; a wider frame only adds side room).
 */
export function aspectFit(fovRef: number, aspect: number, o: AspectFitOptions = {}): AspectFit {
  const ref = o.refAspect ?? FILM_REF_ASPECT;
  const coverage = o.coverage ?? 1;
  const maxFov = Math.max(fovRef, o.maxFov ?? 62);
  if (!(aspect > 0) || aspect >= ref) return { fov: fovRef, distScale: 1 };
  // Horizontal half-width (tan) the 16:9 shot shows, times the share we must keep.
  const tanH = Math.tan(rad(fovRef) / 2) * ref * coverage;
  // Never narrower than the 16:9 lens (coverage < 1 must not zoom in).
  const needTanV = Math.max(Math.tan(rad(fovRef) / 2), tanH / aspect);
  const fov = Math.min(maxFov, deg(2 * Math.atan(needTanV)));
  const tanV = Math.tan(rad(fov) / 2);
  return { fov, distScale: Math.max(1, needTanV / tanV) };
}

/** `pos` pulled back from `target` along the view line by `distScale`. */
export function pullBack(pos: Vector3, target: Vector3, distScale: number): Vector3 {
  return target.clone().add(pos.clone().sub(target).multiplyScalar(distScale));
}
