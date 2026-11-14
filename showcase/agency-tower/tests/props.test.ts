// Spec 0002 T-6 visible layer (AC-6 waiting marker, AC-7 meshes; R-5 current-floor ghosting):
// src/scene/props.ts draws what the director decides. Logic is tested in director/handoff tests.
import { describe, it, expect } from 'vitest';
import { Mesh, MeshBasicMaterial, Object3D, Texture, type Material } from 'three';
import { buildTower, type TowerModel } from '../src/scene/model';
import { createStaff } from '../src/scene/staff';
import { Screen } from '../src/scene/screen';
import { tr } from '../src/i18n/tr';
import type { LampState, Marker, PropCopy, ScreenView } from '../src/scene/director';
import type { PropKind } from '../src/data/scenarios';
import {
  createProps,
  drawEvidence,
  drawProgress,
  drawStampMark,
  floorVisible,
  propRobotsOf,
  type Ctx2D,
  type PropsSource,
  type PropRobot,
} from '../src/scene/props';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

interface FakeCtx extends Ctx2D {
  texts: string[];
  rects: { x: number; y: number; w: number; h: number; style: string }[];
}

function fakeCtx(): FakeCtx {
  const g: FakeCtx = {
    texts: [],
    rects: [],
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect(x, y, w, h) {
      g.rects.push({ x, y, w, h, style: String(g.fillStyle) });
    },
    strokeRect() {},
    clearRect() {},
    fillText(t) {
      g.texts.push(t);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    stroke() {},
  };
  return g;
}

const ctxLog: FakeCtx[] = [];
const fakeCanvas = (w: number, h: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = fakeCtx();
  ctxLog.push(g);
  return { canvas, g };
};

function tower(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

function copy(key: string, kind: PropKind, holder: string | null, tray: string | null = null, stamped = false): PropCopy {
  return { key, job: 1, step: 's', kind, copy: 0, holder, tray, stamped };
}

function source(over: Partial<{ copies: PropCopy[]; lamps: Record<string, LampState>; screens: Record<string, ScreenView> }> = {}): PropsSource & {
  copiesList: PropCopy[];
  lamps: Record<string, LampState>;
  screens: Record<string, ScreenView>;
} {
  const s = {
    copiesList: over.copies ?? [],
    lamps: over.lamps ?? {},
    screens: over.screens ?? {},
    copies: () => s.copiesList,
    lamp: (u: string): LampState => s.lamps[u] ?? 'off',
    screen: (u: string): ScreenView => s.screens[u] ?? { mode: 'code' },
    lampUnits: Object.keys(over.lamps ?? {}),
    screenUnits: Object.keys(over.screens ?? {}),
  };
  return s;
}

const overview = { mode: 'overview' as const, focusFloor: 0 };
const rv = (floor: number, marker: Marker = null, stamp = false) => ({ floor, marker, stamp });

function meshesIn(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

function named(root: Object3D, prefix: string): Mesh[] {
  return meshesIn(root).filter((m) => m.name.startsWith(prefix));
}

function setup(canvas: typeof fakeCanvas | null = fakeCanvas) {
  const model = tower();
  const robots = propRobotsOf(model);
  const props = createProps({ robots, model, canvas });
  return { model, robots, props, byId: new Map(robots.map((r) => [r.id, r])) };
}

describe('waiting and call markers (AC-6)', () => {
  it('shows the hourglass exactly while the view says so, and the call marker by a different shape', () => {
    const s = setup();
    const id = 'scout';
    const r = s.byId.get(id)!;
    s.props.robot(id, rv(3, 'hourglass'), overview, false);
    const hg = named(r.group, 'marker:hourglass');
    expect(hg).toHaveLength(1);
    expect(hg[0]!.visible).toBe(true);
    const hgGeo = hg[0]!.geometry;
    s.props.robot(id, rv(3, 'call'), overview, false);
    const call = named(r.group, 'marker:call');
    expect(call).toHaveLength(1);
    expect(call[0]!.visible).toBe(true);
    expect(named(r.group, 'marker:hourglass').filter((m) => m.visible)).toHaveLength(0);
    // grayscale-readable: the two markers differ in geometry, not only in colour
    expect(call[0]!.geometry).not.toBe(hgGeo);
    expect(call[0]!.geometry.attributes.position!.count).not.toBe(hgGeo.attributes.position!.count);
    s.props.robot(id, rv(3, null), overview, false);
    expect(meshesIn(r.group).filter((m) => m.name.startsWith('marker:') && m.visible)).toHaveLength(0);
  });

  it('reuses one marker mesh per robot over many frames', () => {
    const s = setup();
    const before = s.props.meshCount();
    for (let i = 0; i < 200; i++) s.props.robot('scout', rv(3, i % 3 === 0 ? 'hourglass' : i % 3 === 1 ? 'call' : null), overview, false);
    expect(s.props.meshCount() - before).toBe(1);
  });
});

describe('carried props (AC-6, AC-7)', () => {
  it('puts every held copy in its holder hand, one mesh per copy, by kind', () => {
    const s = setup();
    const src = source({ copies: [copy('a', 'envelope', 'scout'), copy('b', 'spec-paper', 'scout'), copy('c', 'build-tablet', 'qa-engineer'), copy('d', 'evidence', 'qa-engineer')] });
    s.props.frame(src, overview, false);
    const hand = s.byId.get('scout')!.hand;
    expect(named(hand, 'prop:envelope').filter((m) => m.visible)).toHaveLength(1);
    expect(named(hand, 'prop:spec-paper').filter((m) => m.visible)).toHaveLength(1);
    const qa = s.byId.get('qa-engineer')!.hand;
    expect(named(qa, 'prop:build-tablet')).toHaveLength(1);
    expect(named(qa, 'prop:evidence')).toHaveLength(1);
  });

  it('a stamped paper has a stamp-mark mesh with the ONAY canvas text', () => {
    ctxLog.length = 0;
    const s = setup();
    s.props.frame(source({ copies: [copy('a', 'spec-paper', 'ceo', null, true)] }), overview, false);
    const paper = named(s.byId.get('ceo')!.hand, 'prop:spec-paper')[0]!;
    const mark = paper.getObjectByName('stamp-mark');
    expect(mark).toBeInstanceOf(Mesh);
    expect(mark!.visible).toBe(true);
    expect(mark!.userData.text).toBe(tr.places.stamp);
    expect(ctxLog.some((g) => g.texts.includes('ONAY'))).toBe(true);
    const mat = (mark as Mesh).material as MeshBasicMaterial;
    expect(mat.map).toBeInstanceOf(Texture);
  });

  it('an unstamped paper hides its stamp mark; the stamp mark draws text and ring without a canvas too', () => {
    const s = setup(null);
    s.props.frame(source({ copies: [copy('a', 'spec-paper', 'ceo', null, false)] }), overview, false);
    const paper = named(s.byId.get('ceo')!.hand, 'prop:spec-paper')[0]!;
    expect(paper.getObjectByName('stamp-mark')!.visible).toBe(false);
    s.props.frame(source({ copies: [copy('a', 'spec-stamped', 'ceo')] }), overview, false);
    expect(paper.getObjectByName('stamp-mark')!.visible).toBe(true);
  });

  it('a tray copy lies on the recipient desk of the tray floor and follows that floor visibility', () => {
    const s = setup();
    s.props.frame(source({ copies: [copy('a', 'spec-paper', null, 'scout')] }), { mode: 'floor', focusFloor: 3 }, false);
    const floor3 = s.model.floors[3]!.group;
    const tray = named(floor3, 'prop:spec-paper');
    expect(tray).toHaveLength(1);
    expect(tray[0]!.visible).toBe(true);
    s.props.frame(source({ copies: [copy('a', 'spec-paper', null, 'scout')] }), { mode: 'floor', focusFloor: 1 }, false);
    expect(tray[0]!.visible).toBe(false);
  });

  it('pools prop meshes: copies that come and go reuse meshes, and gone copies are hidden', () => {
    const s = setup();
    const src = source();
    for (let i = 0; i < 4; i++) src.copiesList = [copy(`w${i}`, 'spec-paper', 'scout'), copy(`x${i}`, 'spec-paper', 'scout'), copy(`y${i}`, 'envelope', 'qa-engineer')];
    s.props.frame(src, overview, false);
    const warm = s.props.meshCount();
    for (let i = 0; i < 300; i++) {
      src.copiesList = [copy(`a${i}`, 'spec-paper', i % 2 ? 'scout' : null, i % 2 ? null : 'scout'), copy(`b${i}`, 'spec-paper', 'qa-engineer'), copy(`c${i}`, 'envelope', 'scout')];
      s.props.frame(src, overview, false);
    }
    expect(s.props.meshCount()).toBe(warm);
    src.copiesList = [];
    s.props.frame(src, overview, false);
    expect(meshesIn(s.model.root).filter((m) => m.name.startsWith('prop:') && m.visible && m.parent)).toHaveLength(0);
  });
});

describe('CEO stamp tool (AC-7)', () => {
  it('appears in the CEO hand only during stamp-raise / stamp-press', () => {
    const s = setup();
    const hand = s.byId.get('ceo')!.hand;
    s.props.robot('ceo', rv(5, null, true), overview, false);
    expect(named(hand, 'prop:stamp')[0]!.visible).toBe(true);
    s.props.robot('ceo', rv(5, null, false), overview, false);
    expect(named(hand, 'prop:stamp')[0]!.visible).toBe(false);
  });
});

describe('QA lamp (AC-7)', () => {
  it('pass shows the check icon, fail the cross icon, off neither; head colour changes too', () => {
    const s = setup();
    const src = source({ lamps: { 'qa-engineer': 'off' } });
    s.props.frame(src, overview, false);
    const lamp = s.model.root.getObjectByName('qa-lamp:qa-engineer')!;
    expect(lamp).toBeTruthy();
    const icon = (n: string) => lamp.getObjectByName(n)!;
    const head = lamp.getObjectByName('qa-lamp-head') as Mesh;
    expect(icon('lamp-icon:pass').visible).toBe(false);
    expect(icon('lamp-icon:fail').visible).toBe(false);
    const offMat = head.material;
    src.lamps['qa-engineer'] = 'pass';
    s.props.frame(src, overview, false);
    expect(icon('lamp-icon:pass').visible).toBe(true);
    expect(icon('lamp-icon:fail').visible).toBe(false);
    const passMat = head.material;
    src.lamps['qa-engineer'] = 'fail';
    s.props.frame(src, overview, false);
    expect(icon('lamp-icon:fail').visible).toBe(true);
    expect(icon('lamp-icon:pass').visible).toBe(false);
    expect(new Set([offMat, passMat, head.material]).size).toBe(3);
    // shape, not colour alone: the two icons are different geometry
    expect((icon('lamp-icon:pass') as Mesh).geometry).not.toBe((icon('lamp-icon:fail') as Mesh).geometry);
  });

  it('sits on the QA desk floor', () => {
    const s = setup();
    s.props.frame(source({ lamps: { 'qa-engineer': 'pass' } }), overview, false);
    const qaFloor = s.byId.get('qa-engineer')!.homeFloor;
    expect(s.model.floors[qaFloor]!.group.getObjectByName('qa-lamp:qa-engineer')).toBeTruthy();
  });
});

describe('engineer screen overlays (AC-7)', () => {
  it('draws an integer percentage and a proportional bar', () => {
    const g = fakeCtx();
    drawProgress(g, 256, 128, 42);
    expect(g.texts).toContain('42 %');
    const bars = g.rects.filter((r) => r.h < 128 && r.w > 0);
    const full = Math.max(...bars.map((b) => b.w));
    const fill = bars.find((b) => Math.abs(b.w / full - 0.42) < 0.02);
    expect(fill).toBeTruthy();
  });

  it('the lane-0 evidence screen shows a check and "Kanıt: test çıktısı"', () => {
    const g = fakeCtx();
    drawEvidence(g, 256, 128);
    expect(g.texts).toContain('✓');
    expect(g.texts).toContain(tr.strip.evidence);
    expect(tr.strip.evidence).toBe('Kanıt: test çıktısı');
  });

  it('the stamp mark draws ONAY', () => {
    const g = fakeCtx();
    drawStampMark(g, 128);
    expect(g.texts).toEqual(['ONAY']);
  });

  it('swaps the desk screen texture for the overlay and restores the code view', () => {
    const base = new Texture();
    const mat = new MeshBasicMaterial({ map: base });
    const screen = new Screen(base);
    screen.bind(mat);
    const host = new Object3D();
    const arm = new Object3D();
    host.add(arm);
    const robots: PropRobot[] = [{ id: 'react-engineer', homeFloor: 2, group: host, hand: arm, screen }];
    const props = createProps({ robots, canvas: fakeCanvas });
    const src = source({ screens: { 'react-engineer': { mode: 'progress', pct: 0 } } });
    ctxLog.length = 0;
    props.frame(src, overview, false);
    const progressTex = mat.map;
    expect(progressTex).not.toBe(base);
    expect(ctxLog.some((g) => g.texts.includes('0 %'))).toBe(true);
    src.screens['react-engineer'] = { mode: 'progress', pct: 57 };
    props.frame(src, overview, false);
    expect(mat.map).toBe(progressTex);
    expect(ctxLog.some((g) => g.texts.includes('57 %'))).toBe(true);
    const draws = ctxLog.reduce((n, g) => n + g.texts.filter((t) => t.endsWith(' %')).length, 0);
    props.frame(src, overview, false); // same pct: no redraw
    expect(ctxLog.reduce((n, g) => n + g.texts.filter((t) => t.endsWith(' %')).length, 0)).toBe(draws);
    src.screens['react-engineer'] = { mode: 'evidence' };
    props.frame(src, overview, false);
    expect(mat.map).not.toBe(base);
    expect(mat.map).not.toBe(progressTex);
    src.screens['react-engineer'] = { mode: 'code' };
    props.frame(src, overview, false);
    expect(mat.map).toBe(base);
  });
});

describe('R-5: robots take the visibility of the floor they are on', () => {
  it('floorVisible: overview and org show all; floor view shows the focused floor only', () => {
    expect(floorVisible(2, overview, false)).toBe(true);
    expect(floorVisible(2, { mode: 'floor', focusFloor: 2 }, false)).toBe(true);
    expect(floorVisible(4, { mode: 'floor', focusFloor: 2 }, false)).toBe(false);
    expect(floorVisible(1, { mode: 'floor', focusFloor: 2 }, false)).toBe(false);
    expect(floorVisible(1, { mode: 'floor', focusFloor: 2 }, true)).toBe(true);
  });

  it('a robot from a ghosted upper floor visiting the focused floor is shown opaque; home again it uses its floor materials', () => {
    const s = setup();
    const id = 'ceo'; // home floor 5
    const r = s.byId.get(id)!;
    const originals = new Map(meshesIn(r.group).map((m) => [m, m.material]));
    s.model.setView({ mode: 'floor', focusFloor: 3 }); // floor 5 robots' materials are ghosted
    s.props.robot(id, rv(3), s.model.view, false);
    expect(r.group.visible).toBe(true);
    for (const m of meshesIn(r.group)) {
      if (!originals.has(m)) continue;
      const mat = m.material as Material;
      if (m.name === 'contact-shadow') continue;
      expect(mat.opacity).toBe(1);
      expect(mat.visible).toBe(true);
    }
    // a robot of the focused floor that left for floor 5 is hidden with floor 5
    s.props.robot('scout', rv(5), s.model.view, false);
    expect(s.byId.get('scout')!.group.visible).toBe(false);
    // home again: shared floor materials, hidden like the rest of floor 5
    s.props.robot(id, rv(5), s.model.view, false);
    expect(r.group.visible).toBe(false);
    for (const [m, mat] of originals) expect(m.material).toBe(mat);
  });

  it('clones a robot materials once, not per frame', () => {
    const s = setup();
    s.model.setView({ mode: 'floor', focusFloor: 3 });
    const r = s.byId.get('ceo')!;
    s.props.robot('ceo', rv(3), s.model.view, false);
    const first = meshesIn(r.group).map((m) => m.material);
    for (let i = 0; i < 50; i++) s.props.robot('ceo', rv(i % 2 ? 3 : 5), s.model.view, false);
    s.props.robot('ceo', rv(3), s.model.view, false);
    expect(meshesIn(r.group).map((m) => m.material)).toEqual(first);
  });
});

describe('render budget with props (AC-7, §9)', () => {
  it('tower + staff + a full prop load stay under 700k vertices and 1000 meshes', () => {
    const s = setup();
    const staff = createStaff({ layouts: s.model.layouts, seed: 1 });
    const ids = s.robots.map((r) => r.id);
    const kinds: PropKind[] = ['envelope', 'spec-paper', 'spec-stamped', 'build-tablet', 'evidence'];
    const copies: PropCopy[] = [];
    for (let j = 0; j < 3; j++) for (let k = 0; k < 6; k++) copies.push(copy(`j${j}k${k}`, kinds[k % kinds.length]!, ids[(j * 6 + k) % ids.length]!, null, k === 2));
    const lamps: Record<string, LampState> = { 'qa-engineer': 'pass', appsec: 'fail' };
    const screens: Record<string, ScreenView> = { 'react-engineer': { mode: 'progress', pct: 50 }, 'chief-of-staff': { mode: 'evidence' } };
    s.props.frame(source({ copies, lamps, screens }), overview, false);
    for (const r of s.robots) s.props.robot(r.id, rv(r.homeFloor, 'hourglass', r.id === 'ceo'), overview, false);
    let verts = 0;
    let meshes = 0;
    for (const root of [s.model.root, staff.group])
      root.traverse((o) => {
        if (o instanceof Mesh) {
          meshes++;
          verts += o.geometry.attributes.position?.count ?? 0;
        }
      });
    console.info(`[budget] tower+staff+props meshes=${meshes} vertices=${verts}; props meshes=${s.props.meshCount()}`);
    expect(verts).toBeLessThan(700_000);
    expect(meshes).toBeLessThan(1000);
  });
});
