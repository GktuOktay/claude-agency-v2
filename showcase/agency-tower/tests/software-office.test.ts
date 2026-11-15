// Software-company interior (KARARLAR Rev 35): desk setups with domain screens, wall displays (CI/CD with
// icons, kanban, on-call board, release calendar), the floor-1 server room, the fictional YAZILIM EVİ signage, the
// lobby brand wall, welcome screen and award plaques, and premium details. Decoration only: robots, layouts
// and props stay where they were; footprints join `dressingFootprints`, so the flex-office clearance and the
// layout-scene coverage tests hold every floor-standing piece to the same rules.
import { describe, it, expect } from 'vitest';
import { Box3, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture, Vector3, type Object3D } from 'three';
import { FLOOR_COUNT, FLOOR_HEIGHT, FLOOR_TOP, HALF_DEPTH, HALF_WIDTH, PENTHOUSE } from '../src/sim/layout';
import { buildTower, type TowerModel } from '../src/scene/model';
import { dressingFootprints } from '../src/scene/flexOffice';
import { Kit, glassPartition, keyboard } from '../src/scene/furniture';
import { Screen, PANE_FRACTION } from '../src/scene/screen';
import {
  AWARDS,
  BRAND,
  CODE_LINES,
  KANBAN_COLUMNS,
  ONCALL,
  PIPELINE_RUNS,
  RELEASE_CALENDAR,
  SCREEN_LINES,
  SIDE_PANE_LINES,
  STATUS_ICON,
  WELCOME_LINES,
  screenDomain,
  type ScreenDomain,
} from '../src/scene/codeLines';
import { ATLAS_SIZE, ATLAS_TILES, softwareDecorFootprints } from '../src/scene/softwareLayout';
import { DECOR_PREFIX, buildSoftwareDecor } from '../src/scene/softwareDecor';
import { drawDecorAtlas, drawDomainScreen, type Draw2D } from '../src/scene/textures';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';
import type { TowerData } from '../src/data/types';

function data(): TowerData {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return r.data;
}

interface Fake extends Draw2D {
  texts: string[];
  fills: number;
}
function fakeCtx(): Fake {
  const g: Fake = {
    texts: [],
    fills: 0,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect() {
      g.fills++;
    },
    strokeRect() {},
    fillText(t: string) {
      g.texts.push(t);
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    stroke() {},
    fill() {
      g.fills++;
    },
  };
  return g;
}

const DOMAINS: ScreenDomain[] = ['engineering', 'quality', 'product', 'management'];
const REAL_BRANDS = ['google', 'microsoft', 'apple', 'amazon', 'meta', 'github', 'anthropic', 'claude', 'openai', 'oracle', 'ibm'];

function renderedVertices(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) n += (o.geometry.attributes.position?.count ?? 0) * (o instanceof InstancedMesh ? o.count : 1);
  });
  return n;
}
function meshCount(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) n++;
  });
  return n;
}
const named = (root: Object3D, name: string): Object3D[] => {
  const out: Object3D[] = [];
  root.traverse((o) => {
    if (o.name === name) out.push(o);
  });
  return out;
};

describe('desk screens show built-in content per floor domain', () => {
  it('maps floors to domains: engineering 1, QA/security 2, product/architecture 0 and 3, management 4 and 5', () => {
    expect([0, 1, 2, 3, 4, 5].map(screenDomain)).toEqual(['product', 'engineering', 'quality', 'product', 'management', 'management']);
  });

  it('every domain scrolls a list as long as the code list (same texture repeat); engineering is the code list itself', () => {
    expect(SCREEN_LINES.engineering).toBe(CODE_LINES);
    for (const d of DOMAINS) {
      expect(SCREEN_LINES[d].length, d).toBe(CODE_LINES.length);
      expect(SIDE_PANE_LINES[d].length, d).toBe(CODE_LINES.length);
    }
  });

  it('content matches the domain: test runner and vulnerability scan on QA, spec and diagrams on product, roadmap/burndown/KPI on management, a terminal on engineering', () => {
    const all = (d: ScreenDomain): string => [...SCREEN_LINES[d], ...SIDE_PANE_LINES[d]].join('\n');
    expect(all('quality')).toMatch(/Test koşusu/);
    expect(all('quality')).toMatch(/Zafiyet taraması/);
    expect(all('quality')).toMatch(/✓/);
    expect(all('quality')).toMatch(/✗/);
    expect(all('product')).toMatch(/Spec/);
    expect(all('product')).toMatch(/Kabul kriterleri/);
    expect(all('management')).toMatch(/Yol haritası/);
    expect(all('management')).toMatch(/burndown/);
    expect(all('management')).toMatch(/KPI/);
    expect(all('engineering')).toMatch(/\$ npm test/);
  });

  it('is built-in placeholder text only: no repository paths, URLs or real company names', () => {
    for (const d of DOMAINS) {
      for (const line of [...SCREEN_LINES[d], ...SIDE_PANE_LINES[d]]) {
        expect(line, d).not.toMatch(/src\/|\.claude|https?:|www\.|ClaudeAgency/i);
        for (const b of REAL_BRANDS) expect(line.toLowerCase(), `${d}: ${line}`).not.toMatch(new RegExp(`\\b${b}\\b`));
      }
    }
  });

  it('the painter draws each domain row as text with its status marker turned into an icon', () => {
    for (const d of DOMAINS) {
      const g = fakeCtx();
      drawDomainScreen(g, d, 384, CODE_LINES.length * 18);
      expect(g.texts.length, d).toBeGreaterThanOrEqual(CODE_LINES.length);
      expect(g.texts.some((t) => t.startsWith('✓') || t.startsWith('✗')), `${d} keeps markers as icons, not glyphs`).toBe(false);
    }
    const q = fakeCtx();
    drawDomainScreen(q, 'quality', 384, CODE_LINES.length * 18);
    expect(q.texts).toContain('iade akışı · 1 hata');
  });

  it('a screen switches domain and keeps scrolling; ultrawide shows the whole canvas, standard the editor pane', () => {
    const t = new Texture();
    const s = new Screen(t);
    expect(s.domain).toBe('engineering');
    expect(s.lines).toBe(CODE_LINES);
    s.setDomain('quality');
    expect(s.domain).toBe('quality');
    expect(s.lines).toBe(SCREEN_LINES.quality);
    s.scrolling = true;
    s.update(1);
    expect(s.offset).toBeGreaterThan(0);
    s.setWide(true);
    expect(t.repeat.x).toBe(1);
    s.setWide(false);
    expect(t.repeat.x).toBeCloseTo(PANE_FRACTION, 6);
  });

  it('overlays still swap in and restore the domain view after a domain change', () => {
    const t = new Texture();
    const mat = new MeshBasicMaterial({ map: t });
    const s = new Screen(t);
    s.setDomain('management');
    s.bind(mat);
    const overlay = new Texture();
    s.setOverlay(overlay);
    expect(mat.map).toBe(overlay);
    s.setOverlay(null);
    expect(mat.map).toBe(t);
  });
});

describe('wall displays and signage content', () => {
  it('CI/CD stages carry a text label and a distinct icon shape per status (never colour alone); the board shows a pass and a fail', () => {
    const icons = Object.values(STATUS_ICON);
    expect(new Set(icons).size).toBe(icons.length);
    const statuses = PIPELINE_RUNS.flatMap((r) => r.stages.map(([, s]) => s));
    expect(statuses).toContain('pass');
    expect(statuses).toContain('fail');
    for (const r of PIPELINE_RUNS) for (const [label] of r.stages) expect(label.length).toBeGreaterThan(0);
  });

  it('the atlas tiles fit the atlas and never overlap', () => {
    const tiles = Object.entries(ATLAS_TILES);
    for (const [n, t] of tiles) expect(t.x >= 0 && t.y >= 0 && t.x + t.w <= ATLAS_SIZE && t.y + t.h <= ATLAS_SIZE, n).toBe(true);
    tiles.forEach(([a, t], i) =>
      tiles.slice(i + 1).forEach(([b, u]) => expect(t.x < u.x + u.w && u.x < t.x + t.w && t.y < u.y + u.h && u.y < t.y + t.h, `${a}/${b}`).toBe(false)),
    );
  });

  it('the atlas draws the pipeline labels, kanban columns, on-call board, release calendar, welcome screen, plaques and the fictional YAZILIM EVİ sign', () => {
    const g = fakeCtx();
    drawDecorAtlas(g);
    const texts = g.texts.join('\n');
    for (const r of PIPELINE_RUNS) {
      expect(texts).toContain(r.label);
      for (const [label] of r.stages) expect(texts).toContain(label);
    }
    for (const c of KANBAN_COLUMNS) expect(texts).toContain(c);
    expect(texts).toContain(ONCALL.title);
    for (const [s] of ONCALL.services) expect(texts).toContain(s);
    expect(texts).toContain(RELEASE_CALENDAR.title);
    for (const [, v] of RELEASE_CALENDAR.releases) expect(texts).toContain(v);
    for (const w of WELCOME_LINES) expect(texts).toContain(w);
    for (const [a, b] of AWARDS) {
      expect(texts).toContain(a);
      expect(texts).toContain(b);
    }
    expect(BRAND).toEqual({ name: 'YAZILIM EVİ', tagline: 'Yazılım Atölyesi' });
    expect(g.texts).toContain('YAZILIM EVİ');
    expect(g.texts).toContain('Yazılım Atölyesi');
    for (const b of REAL_BRANDS) expect(texts.toLowerCase()).not.toMatch(new RegExp(`\\b${b}\\b`));
  });
});

describe('software-company interior in the tower', () => {
  const d = data();
  const model: TowerModel = buildTower(d);
  const bare = buildTower(d, { software: false });
  model.root.updateMatrixWorld(true);
  const floor = (f: number): Object3D => model.floors[f]!.group;

  it('every floor has a CI/CD board; floors 0-4 a kanban wall and acoustic panels; floor 2 the on-call board, floor 4 the release calendar', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const g = floor(f);
      expect(named(g, 'flex:ci-board'), `floor ${f}`).toHaveLength(1);
      expect(named(g, 'flex:kanban').length, `floor ${f}`).toBe(f < PENTHOUSE ? 1 : 0);
      expect(named(g, 'flex:acoustic-panels').length, `floor ${f}`).toBe(f < PENTHOUSE ? 1 : 0);
      expect(named(g, 'flex:status-board').length, `floor ${f}`).toBe(f === 2 ? 1 : 0);
      expect(named(g, 'flex:release-calendar').length, `floor ${f}`).toBe(f === 4 ? 1 : 0);
    }
  });

  it('floor 1 is a server room: glowing racks, cable trays and a cold aisle', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) expect(named(floor(f), `${DECOR_PREFIX}server-room`).length, `floor ${f}`).toBe(f === 1 ? 1 : 0);
    const room = named(floor(1), `${DECOR_PREFIX}server-room`)[0]!;
    for (const part of ['rack-glow', 'cable-tray', 'cold-aisle']) expect(named(room, part), part).toHaveLength(1);
  });

  it('the lobby has the brand wall (sign, plaques), a welcome screen and a slat ceiling; the crown carries the YAZILIM EVİ sign above the roof line', () => {
    const lobby = floor(0);
    expect(named(lobby, 'flex:brand-wall')).toHaveLength(1);
    expect(named(lobby, 'flex:welcome-screen')).toHaveLength(1);
    expect(named(lobby, 'awards')).toHaveLength(1);
    expect(named(lobby, `${DECOR_PREFIX}slat-ceiling`)).toHaveLength(1);
    for (let f = 1; f < FLOOR_COUNT; f++) expect(named(floor(f), 'flex:brand-wall'), `floor ${f}`).toHaveLength(0);
    const crown = named(floor(PENTHOUSE), `${DECOR_PREFIX}crown-sign`);
    expect(crown).toHaveLength(1);
    // The crown is built before mergeStatic: measure a fresh one.
    const k = new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });
    const fresh = buildSoftwareDecor(k, PENTHOUSE, 0x88aacc);
    const sign = named(fresh, `${DECOR_PREFIX}crown-sign`)[0]!;
    fresh.updateMatrixWorld(true);
    const box = new Box3().setFromObject(sign);
    expect(box.max.y).toBeGreaterThan(FLOOR_TOP + 1.8); // well above the 1.2 glass wall
    expect(box.min.y).toBeGreaterThan(FLOOR_TOP + 1.0);
  });

  it('Rev 37 executive finishes: stone reception (floor 0) and walnut boardroom table (floor 4) on the existing props, designer pendants on floors 0, 4 and 5, a double-height lobby feature wall', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      expect(named(floor(f), `${DECOR_PREFIX}prop-finish`), `floor ${f}`).toHaveLength(1);
      expect(named(floor(f), `${DECOR_PREFIX}pendants`).length, `floor ${f}`).toBe([0, 4, 5].includes(f) ? 1 : 0);
    }
    const k = new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });
    const lobby = buildSoftwareDecor(k, 0, 0x88aacc);
    lobby.updateMatrixWorld(true);
    const wall = new Box3().setFromObject(named(lobby, 'flex:brand-wall')[0]!);
    expect(wall.max.y - FLOOR_TOP).toBeGreaterThan(1.5);
    const lamps = new Box3().setFromObject(named(lobby, `${DECOR_PREFIX}pendants`)[0]!);
    expect(lamps.min.y - FLOOR_TOP).toBeGreaterThan(1.3); // above heads and screens
  });

  it('every desk gets a premium setup: dual monitors, ultrawides and laptops on stands are all present, the signing desk an executive setup', () => {
    const kinds = new Map<string, number>();
    for (const f of model.floors) {
      f.group.traverse((o) => {
        if (o.name.startsWith('desk-setup:')) kinds.set(o.name, (kinds.get(o.name) ?? 0) + 1);
      });
    }
    const total = [...kinds.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(model.robots.length);
    for (const k of ['desk-setup:dual', 'desk-setup:ultrawide', 'desk-setup:laptop', 'desk-setup:executive']) expect(kinds.get(k) ?? 0, k).toBeGreaterThan(0);
  });

  it('a mechanical keyboard: case, keycap rows, desk mat and mouse', () => {
    const k = new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });
    const kb = keyboard(k);
    expect(kb.name).toBe('mech-keyboard');
    expect(meshCount(kb)).toBeGreaterThanOrEqual(5);
  });

  it('glass partitions get a subtle frosted band over the clear pane', () => {
    const sinks = { contents: [], slab: [], tinted: [] as unknown[] };
    const k = new Kit(sinks as never, { wood: null, hatch: null, blob: null });
    const g = glassPartition(k, 0, 0, 2, 0);
    const tinted = new Set<unknown>();
    g.traverse((o) => {
      if (o instanceof Mesh && o.material instanceof MeshStandardMaterial && o.material.transparent) tinted.add(o.material);
    });
    expect(tinted.size).toBe(2);
  });

  it('each robot screen shows its floor domain and stays bound to its own monitor face', () => {
    for (const r of model.robots) expect(r.screen.domain, r.unit.id).toBe(screenDomain(r.floor));
    for (const r of bare.robots) expect(r.screen.domain).toBe('engineering');
  });

  it('screens keep their texture binding with app-provided textures (props overlays still work)', () => {
    const m = buildTower(d, { screenTexture: () => new Texture() });
    const faces = new Map<unknown, MeshBasicMaterial>();
    m.root.traverse((o) => {
      if (o instanceof Mesh && o.material instanceof MeshBasicMaterial && o.material.map) faces.set(o.material.map, o.material);
    });
    for (const r of m.robots) expect(faces.get(r.screen.texture), r.unit.id).toBeDefined();
  });

  it('decor footprints are part of the dressing footprints (same clearance and coverage tests)', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const all = dressingFootprints(f);
      for (const r of softwareDecorFootprints(f)) expect(all, `floor ${f} ${r.name}`).toContainEqual(r);
    }
  });

  it('decor stays inside its storey and the shell; only the crown sign rises above it, outside the north facade', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const k = new Kit({ contents: [], slab: [], tinted: [] }, { wood: null, hatch: null, blob: null });
      const g = buildSoftwareDecor(k, f, 0x88aacc);
      g.updateMatrixWorld(true);
      const crown = named(g, `${DECOR_PREFIX}crown-sign`)[0];
      let bad = 0;
      let seen = 0;
      const v = new Vector3();
      g.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        let inCrown = false;
        for (let p: Object3D | null = o; p; p = p.parent) if (p === crown) inCrown = true;
        const pos = o.geometry.attributes.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          seen++;
          const h = v.y - FLOOR_TOP;
          if (inCrown) {
            if (Math.abs(v.x) > HALF_WIDTH || v.z > -HALF_DEPTH - 0.06 || h > FLOOR_HEIGHT) bad++;
          } else if (h < -0.01 || h > FLOOR_HEIGHT - FLOOR_TOP - 0.005 || Math.abs(v.x) > HALF_WIDTH || Math.abs(v.z) > HALF_DEPTH) bad++;
        }
      });
      expect(seen, `floor ${f}`).toBeGreaterThan(100);
      expect(bad, `floor ${f}`).toBe(0);
    }
  });

  it('leaves robots, layouts and floor props where they were', () => {
    expect(model.layouts).toEqual(bare.layouts);
    expect(model.robots.map((r) => [r.homePoint.toArray(), r.workPoint.toArray(), r.coffeePoint.toArray()])).toEqual(bare.robots.map((r) => [r.homePoint.toArray(), r.workPoint.toArray(), r.coffeePoint.toArray()]));
    for (const f of model.floors) {
      const prop = f.group.children.find((c) => c.name.startsWith('floor-prop:'));
      expect(prop?.position.toArray()).toEqual(bare.floors[f.id]!.group.children.find((c) => c.name.startsWith('floor-prop:'))?.position.toArray());
    }
  });

  it('render budget: the software decor adds at most 60 000 rendered vertices and 40 meshes', () => {
    const dv = renderedVertices(model.root) - renderedVertices(bare.root);
    const dm = meshCount(model.root) - meshCount(bare.root);
    console.info(`[budget] software decor: +${dv} rendered vertices, +${dm} meshes; total vertices=${renderedVertices(model.root)} meshes=${meshCount(model.root)}`);
    expect(dv).toBeGreaterThan(5_000);
    expect(dv).toBeLessThanOrEqual(60_000);
    expect(dm).toBeGreaterThan(0);
    expect(dm).toBeLessThanOrEqual(40);
  });
});
