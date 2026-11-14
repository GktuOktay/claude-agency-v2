import { describe, it, expect, vi, beforeEach } from 'vitest';
import { boot, type BootDeps } from '../src/app/bootstrap';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import { sortUnits } from '../src/ui/unitList';
import { loadData } from '../src/data/loader';

function makeDeps(over: Partial<BootDeps> = {}): { deps: BootDeps; root: HTMLElement; startScene: ReturnType<typeof vi.fn> } {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const startScene = vi.fn();
  const deps: BootDeps = {
    root,
    loadRaw: () => Promise.resolve({ roster, overlay: hierarchy }),
    hasWebGL2: () => true,
    startScene,
    ...over,
  };
  return { deps, root, startScene };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('app states (AC-5)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('shows the loading text while the loader is delayed', async () => {
    let release: (v: { roster: unknown; overlay: unknown }) => void = () => undefined;
    const { deps, root } = makeDeps({ loadRaw: () => new Promise((r) => (release = r)) });
    const p = boot(deps);
    expect(root.textContent).toContain('Kule yükleniyor…');
    release({ roster, overlay: hierarchy });
    await p;
    expect(root.textContent).not.toContain('Kule yükleniyor…');
  });

  it('invalid data and no WebGL2: data error only, no fallback, no scene', async () => {
    const probe = vi.fn(() => false);
    const { deps, root, startScene } = makeDeps({
      loadRaw: () => Promise.resolve({ roster: { schemaVersion: 9 }, overlay: hierarchy }),
      hasWebGL2: probe,
    });
    expect(await boot(deps)).toBe('data-error');
    expect(root.textContent).toContain('Kadro verisi okunamadı.');
    expect(root.textContent).not.toContain('3B görünümü desteklemiyor');
    expect(root.querySelector('button')).toBeNull();
    expect(startScene).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
  });

  it('invalid data with WebGL2 present: data error, no scene', async () => {
    const { deps, root, startScene } = makeDeps({ loadRaw: () => Promise.resolve({ roster: null, overlay: null }) });
    expect(await boot(deps)).toBe('data-error');
    expect(root.textContent).toContain('Kadro verisi okunamadı.');
    expect(startScene).not.toHaveBeenCalled();
  });

  it('a rejected loader is a data error', async () => {
    const { deps, root } = makeDeps({ loadRaw: () => Promise.reject(new Error('boom')) });
    expect(await boot(deps)).toBe('data-error');
    expect(root.textContent).toContain('Kadro verisi okunamadı.');
    expect(root.textContent).not.toContain('boom');
  });

  it('valid data, no WebGL2: fallback message and unit list; list button opens the card; no scene', async () => {
    const { deps, root, startScene } = makeDeps({ hasWebGL2: () => false });
    expect(await boot(deps)).toBe('fallback');
    expect(root.textContent).toContain('Bu tarayıcı 3B görünümü desteklemiyor.');
    expect(startScene).not.toHaveBeenCalled();
    const buttons = root.querySelectorAll<HTMLButtonElement>('ul button');
    expect(buttons).toHaveLength(20);
    const target = [...buttons].find((b) => b.textContent?.includes('qa-engineer'));
    target?.click();
    const card = root.querySelector('[role="dialog"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('qa-engineer');
    expect(card?.textContent).toContain('Bağlı olduğu');
  });

  it('valid data with WebGL2: starts the scene with the validated data', async () => {
    const { deps, startScene } = makeDeps();
    expect(await boot(deps)).toBe('scene');
    expect(startScene).toHaveBeenCalledTimes(1);
    const ctx = startScene.mock.calls[0]?.[0] as { data: { units: unknown[] } };
    expect(ctx.data.units).toHaveLength(20);
    await tick();
  });
});

describe('unit list order (REQ-13)', () => {
  it('orders by floor 5 to 0, then tier, then name', () => {
    const r = loadData(roster, hierarchy);
    if (!r.ok) throw new Error('data');
    const sorted = sortUnits(r.data.units);
    const floors = sorted.map((u) => u.floor);
    expect(floors).toEqual([...floors].sort((a, b) => b - a));
    expect(sorted[0]?.id).toBe('ceo');
    const f3 = sorted.filter((u) => u.floor === 3).map((u) => u.id);
    expect(f3).toEqual(['product-manager', 'software-architect', 'architecture-board', 'business-analyst', 'scout']);
  });
});
