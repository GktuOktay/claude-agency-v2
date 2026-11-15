import { describe, it, expect } from 'vitest';
import { Scene, Raycaster } from 'three';

describe('scaffold proof (T-1)', () => {
  it('runs vitest with jsdom and imports three', () => {
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
    expect(new Scene().children).toHaveLength(0);
    expect(new Raycaster()).toBeDefined();
  });
});
