// URL parameters (REQ-15, REQ-16): strict parse, invalid values ignored.
export type Quality = 'low' | 'high';

export interface Params {
  quality: Quality | null;
  debug: boolean;
}

export function parseParams(search: string): Params {
  const sp = new URLSearchParams(search);
  const q = sp.get('quality');
  return {
    quality: q === 'low' || q === 'high' ? q : null,
    debug: sp.get('debug') === '1',
  };
}

export interface QualitySettings {
  quality: Quality;
  shadows: boolean;
  pixelRatio: number;
}

export function resolveQuality(params: Params, coarsePointer: boolean): Quality {
  return params.quality ?? (coarsePointer ? 'low' : 'high');
}

export function qualitySettings(quality: Quality, devicePixelRatio: number): QualitySettings {
  if (quality === 'low') return { quality, shadows: false, pixelRatio: 1 };
  return { quality, shadows: true, pixelRatio: Math.min(devicePixelRatio, 1.5) };
}
