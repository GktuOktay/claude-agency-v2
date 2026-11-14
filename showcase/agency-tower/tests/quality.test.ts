import { describe, it, expect, vi } from 'vitest';
import { ACESFilmicToneMapping, DirectionalLight, Mesh, MeshStandardMaterial, NoToneMapping, PCFShadowMap, Scene, Texture, BoxGeometry, type ShadowMapType, type ToneMapping } from 'three';
import { parseParams } from '../src/app/params';
import {
  QUALITY_TIERS,
  RENDERER_OPTIONS,
  applyQuality,
  createQualityContext,
  initialTier,
  onQualityChange,
  tierConfig,
  type EnvironmentHandle,
  type QualityRenderer,
} from '../src/app/quality';

interface StubRenderer extends QualityRenderer {
  pixelRatio: number;
  setPixelRatio: ReturnType<typeof vi.fn> & ((v: number) => void);
}

function stubRenderer(): StubRenderer {
  const r: StubRenderer = {
    pixelRatio: 1,
    toneMapping: NoToneMapping as ToneMapping,
    shadowMap: { enabled: false, type: PCFShadowMap as ShadowMapType, needsUpdate: false },
    setPixelRatio: vi.fn((v: number) => {
      r.pixelRatio = v;
    }),
  };
  return r;
}

function setup(dpr = 3) {
  const renderer = stubRenderer();
  const scene = new Scene();
  const material = new MeshStandardMaterial();
  scene.add(new Mesh(new BoxGeometry(), material));
  const sun = new DirectionalLight();
  scene.add(sun);
  const envs: (EnvironmentHandle & { dispose: ReturnType<typeof vi.fn> })[] = [];
  const createEnvironment = vi.fn(() => {
    const h = { texture: new Texture(), dispose: vi.fn() };
    envs.push(h);
    return h;
  });
  const ctx = createQualityContext({ renderer, scene, shadowLights: [sun], devicePixelRatio: () => dpr, createEnvironment });
  return { renderer, scene, sun, material, envs, createEnvironment, ctx };
}

/** Puts a fake GPU shadow map on the light, as WebGLShadowMap would after a frame. */
function fakeShadowMap(sun: DirectionalLight): { dispose: ReturnType<typeof vi.fn> } {
  const map = { dispose: vi.fn() };
  Object.assign(sun.shadow, { map });
  return map;
}

describe('quality tiers (Rev 35)', () => {
  it('has four tiers in ascending order', () => {
    expect(QUALITY_TIERS).toEqual(['low', 'medium', 'high', 'ultra']);
  });

  it('low matches the old low: no shadows, no environment, DPR 1', () => {
    expect(tierConfig('low', 3)).toMatchObject({ tier: 'low', shadows: false, environment: false, pixelRatio: 1 });
  });

  it('medium: modest shadow map, DPR capped at 1.25, no environment', () => {
    const c = tierConfig('medium', 3);
    expect(c).toMatchObject({ shadows: true, environment: false, pixelRatio: 1.25 });
    expect(c.shadowMapSize).toBeLessThanOrEqual(1024);
  });

  it('high: soft, larger shadows, DPR capped at 1.5, filmic tone mapping, environment map', () => {
    const c = tierConfig('high', 3);
    expect(c).toMatchObject({ shadows: true, environment: true, pixelRatio: 1.5, toneMapping: ACESFilmicToneMapping });
    expect(c.shadowMapSize).toBeGreaterThan(tierConfig('medium', 3).shadowMapSize);
    expect(c.shadowRadius).toBeGreaterThan(tierConfig('medium', 3).shadowRadius);
  });

  it('ultra: everything in high, DPR capped at 2, the largest shadow map', () => {
    const c = tierConfig('ultra', 3);
    expect(c).toMatchObject({ shadows: true, environment: true, pixelRatio: 2 });
    expect(c.shadowMapSize).toBeGreaterThan(tierConfig('high', 3).shadowMapSize);
    expect(c.shadowRadius).toBeGreaterThanOrEqual(tierConfig('high', 3).shadowRadius);
  });

  it('never raises the pixel ratio above the device ratio (except low, fixed at 1)', () => {
    for (const t of QUALITY_TIERS) if (t !== 'low') expect(tierConfig(t, 1).pixelRatio).toBe(1);
    expect(tierConfig('ultra', 1.75).pixelRatio).toBe(1.75);
  });

  it('the context is created with MSAA (antialias) so ultra needs no new context', () => {
    expect(RENDERER_OPTIONS).toMatchObject({ antialias: true, alpha: true });
  });
});

describe('initial tier from ?quality and the pointer', () => {
  it('?quality=low and ?quality=high map to the low and high tiers', () => {
    expect(initialTier(parseParams('?quality=low'), false)).toBe('low');
    expect(initialTier(parseParams('?quality=high'), true)).toBe('high');
  });

  it('a coarse pointer starts on low, a fine pointer on high', () => {
    expect(initialTier(parseParams(''), true)).toBe('low');
    expect(initialTier(parseParams(''), false)).toBe('high');
  });

  it('invalid values are ignored', () => {
    expect(initialTier(parseParams('?quality=ultra'), true)).toBe('low');
  });
});

describe('applyQuality (runtime switching, renderer stub)', () => {
  it('applies low: shadows off, DPR 1, no environment', () => {
    const { renderer, scene, sun, ctx, createEnvironment } = setup();
    applyQuality(ctx, 'low');
    expect(renderer.shadowMap.enabled).toBe(false);
    expect(sun.castShadow).toBe(false);
    expect(renderer.pixelRatio).toBe(1);
    expect(scene.environment).toBeNull();
    expect(createEnvironment).not.toHaveBeenCalled();
    expect(ctx.tier).toBe('low');
  });

  it('applies high: shadows on with map size and radius, tone mapping, PMREM environment', () => {
    const { renderer, scene, sun, ctx, envs } = setup();
    applyQuality(ctx, 'high');
    const c = tierConfig('high', 3);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(PCFShadowMap);
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(c.shadowMapSize);
    expect(sun.shadow.radius).toBe(c.shadowRadius);
    expect(renderer.toneMapping).toBe(c.toneMapping);
    expect(renderer.pixelRatio).toBe(1.5);
    expect(envs).toHaveLength(1);
    expect(scene.environment).toBe(envs[0]?.texture);
  });

  it('switching down disposes the old shadow map and the environment render target', () => {
    const { scene, sun, ctx, envs } = setup();
    applyQuality(ctx, 'ultra');
    const map = fakeShadowMap(sun);
    applyQuality(ctx, 'low');
    expect(map.dispose).toHaveBeenCalledTimes(1);
    expect(sun.shadow.map).toBeNull();
    expect(envs[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(scene.environment).toBeNull();
  });

  it('a new shadow map size disposes the old map so three allocates the new size', () => {
    const { sun, ctx } = setup();
    applyQuality(ctx, 'medium');
    const map = fakeShadowMap(sun);
    applyQuality(ctx, 'high');
    expect(map.dispose).toHaveBeenCalledTimes(1);
    expect(sun.shadow.map).toBeNull();
    expect(sun.shadow.mapSize.x).toBe(tierConfig('high', 3).shadowMapSize);
  });

  it('high to ultra keeps the environment (no rebuild, no dispose)', () => {
    const { ctx, envs, createEnvironment } = setup();
    applyQuality(ctx, 'high');
    applyQuality(ctx, 'ultra');
    expect(createEnvironment).toHaveBeenCalledTimes(1);
    expect(envs[0]?.dispose).not.toHaveBeenCalled();
  });

  it('re-applying the same tier changes nothing and does not recompile materials', () => {
    const { ctx, material, sun, createEnvironment } = setup();
    applyQuality(ctx, 'high');
    const map = fakeShadowMap(sun);
    const v = material.version;
    applyQuality(ctx, 'high');
    expect(material.version).toBe(v);
    expect(map.dispose).not.toHaveBeenCalled();
    expect(createEnvironment).toHaveBeenCalledTimes(1);
  });

  it('a tier change flags scene materials for recompilation', () => {
    const { ctx, material } = setup();
    applyQuality(ctx, 'low');
    const v = material.version;
    applyQuality(ctx, 'medium');
    expect(material.version).toBeGreaterThan(v);
  });

  it('notifies subscribers with the applied tier; unsubscribe stops it', () => {
    const { ctx } = setup();
    const seen: string[] = [];
    const off = onQualityChange(ctx, (c) => seen.push(c.tier));
    applyQuality(ctx, 'medium');
    applyQuality(ctx, 'medium');
    applyQuality(ctx, 'ultra');
    off();
    applyQuality(ctx, 'low');
    expect(seen).toEqual(['medium', 'ultra']);
  });

  it('a failing environment build falls back to no environment instead of throwing', () => {
    const { scene, ctx } = setup();
    ctx.createEnvironment = () => {
      throw new Error('no float textures');
    };
    expect(() => applyQuality(ctx, 'high')).not.toThrow();
    expect(scene.environment).toBeNull();
    expect(ctx.tier).toBe('high');
  });
});
