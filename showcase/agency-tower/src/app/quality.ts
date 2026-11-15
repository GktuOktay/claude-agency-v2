// Render-quality engine (KARARLAR Rev 35): four tiers, switchable at runtime without a reload.
// Pure config + a small stateful context; the renderer is typed structurally so tests use a stub.
// applyQuality never renders: the loop (loop.ts) stays the only caller of render, so a hidden tab stays paused.
import {
  ACESFilmicToneMapping,
  Material,
  PCFShadowMap,
  PMREMGenerator,
  type DirectionalLight,
  type Object3D,
  type Scene,
  type ShadowMapType,
  type Texture,
  type ToneMapping,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { resolveQuality, type Params } from './params';

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra'];

/**
 * WebGL context options. MSAA (antialias) is fixed when the context is created and cannot be toggled
 * later, so it is on for every tier (as before Rev 35); ultra relies on it together with DPR 2.
 */
export const RENDERER_OPTIONS = { antialias: true, alpha: true } as const;

export interface TierConfig {
  tier: QualityTier;
  pixelRatio: number;
  shadows: boolean;
  /** Square shadow-map size in texels (0 when shadows are off). */
  shadowMapSize: number;
  /** PCF filter radius in texels; larger is softer. */
  shadowRadius: number;
  toneMapping: ToneMapping;
  /** RoomEnvironment PMREM as scene.environment (reflections on glass and metal). */
  environment: boolean;
}

interface TierSpec {
  maxDpr: number;
  shadowMapSize: number;
  shadowRadius: number;
  environment: boolean;
}

const TIERS: Record<QualityTier, TierSpec> = {
  low: { maxDpr: 1, shadowMapSize: 0, shadowRadius: 0, environment: false },
  medium: { maxDpr: 1.25, shadowMapSize: 1024, shadowRadius: 1, environment: false },
  high: { maxDpr: 1.5, shadowMapSize: 2048, shadowRadius: 3, environment: true },
  ultra: { maxDpr: 2, shadowMapSize: 4096, shadowRadius: 4, environment: true },
};

export function tierConfig(tier: QualityTier, devicePixelRatio: number): TierConfig {
  const s = TIERS[tier];
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    tier,
    pixelRatio: tier === 'low' ? 1 : Math.min(dpr, s.maxDpr),
    shadows: s.shadowMapSize > 0,
    shadowMapSize: s.shadowMapSize,
    shadowRadius: s.shadowRadius,
    // ACES on every tier: the lighting and material colours are tuned for it (AgX is one line here).
    toneMapping: ACESFilmicToneMapping,
    environment: s.environment,
  };
}

/** Start tier: `?quality=low|high` wins (REQ-15 strict parse); otherwise coarse pointer → low, else high. */
export function initialTier(params: Params, coarsePointer: boolean): QualityTier {
  return resolveQuality(params, coarsePointer);
}

/** The renderer surface applyQuality touches; WebGLRenderer satisfies it. */
export interface QualityRenderer {
  setPixelRatio(value: number): void;
  toneMapping: ToneMapping;
  shadowMap: { enabled: boolean; type: ShadowMapType; needsUpdate: boolean };
}

export interface EnvironmentHandle {
  texture: Texture;
  dispose(): void;
}

export interface QualityDeps {
  renderer: QualityRenderer;
  scene: Pick<Scene, 'environment' | 'traverse'>;
  shadowLights: readonly DirectionalLight[];
  devicePixelRatio: () => number;
  createEnvironment: () => EnvironmentHandle;
}

export interface QualityContext extends QualityDeps {
  tier: QualityTier | null;
  config: TierConfig | null;
  env: EnvironmentHandle | null;
  listeners: Set<(c: TierConfig) => void>;
}

export function createQualityContext(deps: QualityDeps): QualityContext {
  return { ...deps, tier: null, config: null, env: null, listeners: new Set() };
}

export function onQualityChange(ctx: QualityContext, cb: (c: TierConfig) => void): () => void {
  ctx.listeners.add(cb);
  return () => {
    ctx.listeners.delete(cb);
  };
}

/** PMREM environment from three's RoomEnvironment; the generator and the room are freed at once. */
export function roomEnvironment(renderer: WebGLRenderer): () => EnvironmentHandle {
  return () => {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      const target = pmrem.fromScene(room, 0.04);
      return { texture: target.texture, dispose: () => target.dispose() };
    } finally {
      room.dispose();
      pmrem.dispose();
    }
  };
}

function freeShadowMap(light: DirectionalLight): void {
  light.shadow.dispose();
  light.shadow.map = null; // three allocates a new map (at the new size) on the next shadow pass
  light.shadow.mapPass = null;
}

function flagMaterials(o: Object3D): void {
  if (!('material' in o)) return;
  const m: unknown = o.material;
  for (const x of Array.isArray(m) ? m : [m]) if (x instanceof Material) x.needsUpdate = true;
}

/** Applies `tier` to the renderer, lights and scene. Idempotent; returns the applied config. */
export function applyQuality(ctx: QualityContext, tier: QualityTier): TierConfig {
  const next = tierConfig(tier, ctx.devicePixelRatio());
  const prev = ctx.config;
  ctx.renderer.setPixelRatio(next.pixelRatio); // also re-run when the tier is unchanged: the monitor DPR may differ
  if (prev && prev.tier === next.tier) {
    ctx.config = next;
    return next;
  }

  // shadows
  ctx.renderer.shadowMap.enabled = next.shadows;
  ctx.renderer.shadowMap.type = PCFShadowMap; // PCFSoftShadowMap was removed in three r18x; radius gives softness
  for (const light of ctx.shadowLights) {
    const sizeChanged = light.shadow.mapSize.x !== next.shadowMapSize || light.shadow.mapSize.y !== next.shadowMapSize;
    if (!next.shadows || (sizeChanged && light.shadow.map)) freeShadowMap(light);
    light.castShadow = next.shadows;
    if (next.shadows) {
      light.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
      light.shadow.radius = next.shadowRadius;
    }
  }
  ctx.renderer.shadowMap.needsUpdate = true;
  ctx.renderer.toneMapping = next.toneMapping;

  // environment (PMREM render target)
  if (next.environment && !ctx.env) {
    try {
      ctx.env = ctx.createEnvironment();
    } catch {
      ctx.env = null; // no float/half-float render targets: run without reflections rather than fail
    }
  } else if (!next.environment && ctx.env) {
    ctx.env.dispose();
    ctx.env = null;
  }
  ctx.scene.environment = ctx.env ? ctx.env.texture : null;

  // shader defines depend on shadow and tone-mapping state: recompile once, on the switch
  ctx.scene.traverse(flagMaterials);

  ctx.tier = next.tier;
  ctx.config = next;
  for (const cb of ctx.listeners) cb(next);
  return next;
}
