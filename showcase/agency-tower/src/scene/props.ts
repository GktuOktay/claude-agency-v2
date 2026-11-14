// Visible layer of the director (spec 0002 T-6; REQ-6, 7, 8; AC-6 marker, AC-7 meshes; R-5): waiting and
// call markers, carried and tray copies, the CEO stamp tool and its "ONAY" mark, the QA lamp and the
// engineer screen overlays. The director decides; this file only draws. Every mesh is created once
// (lazily) and pooled; the per-frame calls only move, show, hide and re-parent existing objects.
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PropKind } from '../data/scenarios';
import { tr } from '../i18n/tr';
import { FLOOR_TOP } from '../sim/layout';
import type { LampState, Marker, PropCopy, ScreenView } from './director';
import type { TowerModel, ViewState } from './model';
import { ROBOT_HEIGHT } from './robot';
import type { Screen } from './screen';

/** The subset of a 2D canvas context the overlays draw with (a fake one in tests). */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  stroke(): void;
}
export type CanvasFactory = (w: number, h: number) => { canvas: HTMLCanvasElement; g: Ctx2D } | null;

const browserCanvas: CanvasFactory = (w, h) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  return g ? { canvas, g } : null;
};

export const SCREEN_W = 256;
export const SCREEN_H = 128;
const STAMP_PX = 128;
const BUILD_TITLE = 'Derleme';

/** Build progress: title, framed bar filled to `pct` (an integer 0–100), and "NN %". */
export function drawProgress(g: Ctx2D, w: number, h: number, pct: number): void {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  g.fillStyle = '#1e2430';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e7eaf0';
  g.font = `bold ${Math.round(h * 0.16)}px sans-serif`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(BUILD_TITLE, w * 0.08, h * 0.22);
  const bx = w * 0.08;
  const bw = w * 0.84;
  const by = h * 0.42;
  const bh = h * 0.18;
  g.fillStyle = '#3a4252';
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#8fd6a8';
  g.fillRect(bx, by, (bw * p) / 100, bh);
  g.strokeStyle = '#e7eaf0';
  g.lineWidth = 2;
  g.strokeRect(bx, by, bw, bh);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(h * 0.22)}px sans-serif`;
  g.textAlign = 'center';
  g.fillText(`${p} %`, w / 2, h * 0.8);
}

/** Lane-0 test step on the chief-of-staff's screen: a big check and "Kanıt: test çıktısı". */
export function drawEvidence(g: Ctx2D, w: number, h: number): void {
  g.fillStyle = '#1e2430';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8fd6a8';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(w * 0.18, h * 0.5, h * 0.28, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#8fd6a8';
  g.font = `bold ${Math.round(h * 0.4)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('✓', w * 0.18, h * 0.52);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(h * 0.13)}px sans-serif`;
  g.textAlign = 'left';
  g.fillText(tr.strip.evidence, w * 0.36, h * 0.5);
}

/** The CEO's stamp mark: a double ring and "ONAY" in dark ink (reads in grayscale on white paper). */
export function drawStampMark(g: Ctx2D, size: number): void {
  g.clearRect(0, 0, size, size);
  g.strokeStyle = '#a3201a';
  g.lineWidth = size * 0.06;
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = size * 0.025;
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#a3201a';
  g.font = `bold ${Math.round(size * 0.24)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tr.places.stamp, size / 2, size / 2);
}

/**
 * R-5: is an object on `floor` shown? Overview and org mode show every floor; the floor view shows the
 * focused floor only (floors above keep just their ghosted slab, floors below are hidden), like 0001.
 */
export function floorVisible(floor: number, view: ViewState, org: boolean): boolean {
  return org || view.mode === 'overview' || floor === view.focusFloor;
}

export interface PropRobot {
  id: string;
  homeFloor: number;
  group: Object3D;
  /** Carried props and the stamp tool ride here (the right arm pivot). */
  hand: Object3D;
  screen: Screen;
}

export function propRobotsOf(model: TowerModel): PropRobot[] {
  return model.robots.map((r) => ({ id: r.unit.id, homeFloor: r.floor, group: r.group, hand: r.parts.armR, screen: r.screen }));
}

/** What the props layer reads from the director once per frame. */
export interface PropsSource {
  copies(): readonly PropCopy[];
  lamp(unit: string): LampState;
  screen(unit: string): ScreenView;
  readonly lampUnits: readonly string[];
  readonly screenUnits: readonly string[];
}

export interface RobotPropView {
  marker: Marker;
  stamp: boolean;
  /** The floor the robot is on now (R-5), not its home floor. */
  floor: number;
}

export interface PropsOptions {
  robots: readonly PropRobot[];
  /** Floor groups (tray copies, QA lamps) and desk places; absent: no tray copies and no lamps. */
  model?: Pick<TowerModel, 'floors' | 'layouts'>;
  /** Canvas for the stamp mark and screen overlays; null: none (flat stand-ins). Default: the DOM. */
  canvas?: CanvasFactory | null;
}

export interface PropsLayer {
  /** Per robot and frame: marker, stamp tool and current-floor visibility (R-5). */
  robot(id: string, v: RobotPropView, view: ViewState, org: boolean): void;
  /** Once per frame: carried and tray copies, QA lamps and screen overlays. */
  frame(src: PropsSource, view: ViewState, org: boolean): void;
  /** Meshes this layer has created (pooled: it never shrinks, and stops growing once warm). */
  meshCount(): number;
}

type Group4 = 'envelope' | 'paper' | 'tablet' | 'evidence';
const GROUP_OF: Record<PropKind, Group4> = { envelope: 'envelope', 'spec-paper': 'paper', 'spec-stamped': 'paper', 'build-tablet': 'tablet', evidence: 'evidence' };
const NAME_OF: Record<PropKind, string> = { envelope: 'prop:envelope', 'spec-paper': 'prop:spec-paper', 'spec-stamped': 'prop:spec-stamped', 'build-tablet': 'prop:build-tablet', evidence: 'prop:evidence' };

function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error('props: geometry merge failed');
  return g;
}

/** A bar from (x1, y1) to (x2, y2) in the xy plane (icon strokes). */
function stroke(x1: number, y1: number, x2: number, y2: number, t: number, d: number): BufferGeometry {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return new BoxGeometry(len + t, t, d)
    .rotateZ(Math.atan2(y2 - y1, x2 - x1))
    .translate((x1 + x2) / 2, (y1 + y2) / 2, 0);
}

function buildGeometry() {
  const hourglass = new LatheGeometry(
    [
      [0.001, 0],
      [0.055, 0],
      [0.055, 0.014],
      [0.012, 0.075],
      [0.055, 0.136],
      [0.055, 0.15],
      [0.001, 0.15],
    ].map(([x, y]) => new Vector2(x, y)),
    10,
  );
  const call = merged([new CapsuleGeometry(0.024, 0.075, 3, 8).translate(0, 0.105, 0), new SphereGeometry(0.03, 8, 6).translate(0, 0.02, 0)]);
  const check = merged([stroke(-0.5, 0.05, -0.15, -0.35, 0.22, 0.12), stroke(-0.15, -0.35, 0.55, 0.45, 0.22, 0.12)]);
  const cross = merged([stroke(-0.42, -0.42, 0.42, 0.42, 0.22, 0.12), stroke(-0.42, 0.42, 0.42, -0.42, 0.22, 0.12)]);
  return {
    hourglass,
    call,
    check,
    cross,
    envelope: new BoxGeometry(0.15, 0.1, 0.01),
    paper: new BoxGeometry(0.09, 0.125, 0.004),
    mark: new PlaneGeometry(0.06, 0.06),
    tablet: new BoxGeometry(0.14, 0.1, 0.012),
    stamp: merged([
      new BoxGeometry(0.05, 0.018, 0.035).translate(0, 0.009, 0),
      new CylinderGeometry(0.011, 0.014, 0.06, 8).translate(0, 0.048, 0),
      new SphereGeometry(0.02, 8, 6).translate(0, 0.088, 0),
    ]),
    lampBase: merged([new CylinderGeometry(0.04, 0.046, 0.016, 12).translate(0, 0.008, 0), new CylinderGeometry(0.01, 0.01, 0.13, 8).translate(0, 0.08, 0)]),
    lampHead: new SphereGeometry(0.045, 14, 10),
  };
}

interface Slot {
  r: PropRobot;
  meshes: Mesh[];
  shared: (Material | Material[])[];
  own: (Material | Material[])[] | null;
  away: boolean;
  marker: Mesh | null;
  markerKind: Marker;
  stamp: Mesh | null;
  held: number;
  tray: number;
  shadowView: ViewState | null;
  shadowFloor: number;
  shadowOrg: boolean;
  progress: { tex: Texture; g: Ctx2D; pct: number } | null;
}

interface Lamp {
  group: Object3D;
  head: Mesh;
  pass: Mesh;
  fail: Mesh;
  floor: number;
  state: LampState | null;
}

/** A robot material made opaque for a robot away from its home floor (its floor's ghosting is not its own). */
function ownCopy(m: Material): Material {
  const c = m.clone();
  const base: unknown = m.userData.baseOpacity;
  if (typeof base === 'number') {
    c.opacity = base;
    c.transparent = true;
    c.depthWrite = false;
  } else {
    c.opacity = 1;
    c.transparent = false;
    c.depthWrite = true;
  }
  c.visible = true;
  return c;
}

export function createProps(o: PropsOptions): PropsLayer {
  const canvas = o.canvas === undefined ? browserCanvas : o.canvas;
  const geo = buildGeometry();
  let created = 0;
  const mesh = (g: BufferGeometry, m: Material | Material[], name: string): Mesh => {
    const x = new Mesh(g, m);
    x.name = name;
    x.castShadow = false;
    x.receiveShadow = false;
    x.userData.shadow = 'none';
    created++;
    return x;
  };

  const std = (color: number, emissive = 0, intensity = 0): MeshStandardMaterial =>
    new MeshStandardMaterial({ color, roughness: 0.55, emissive, emissiveIntensity: intensity });
  const mats = {
    hourglass: std(0xf2a93b, 0xf2a93b, 0.35),
    call: std(0x2f6fd6, 0x2f6fd6, 0.35),
    envelope: std(0xd9b77e),
    paper: std(0xfafafa),
    evidenceCheck: std(0x1f7a3d),
    tablet: std(0x2b2f36),
    tabletFace: new MeshBasicMaterial({ color: 0x8cc4f2, toneMapped: false }),
    stamp: std(0x3a2a22),
    lampBase: std(0x40444c),
    lampOff: std(0x8a9099),
    lampPass: std(0x2fae5a, 0x2fae5a, 0.9),
    lampFail: std(0xd23b3b, 0xd23b3b, 0.9),
    icon: new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    mark: (() => {
      const cv = canvas ? canvas(STAMP_PX, STAMP_PX) : null;
      if (!cv) return new MeshBasicMaterial({ color: 0xa3201a, side: DoubleSide });
      drawStampMark(cv.g, STAMP_PX);
      const t = new CanvasTexture(cv.canvas);
      t.colorSpace = SRGBColorSpace;
      return new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: DoubleSide });
    })(),
  };
  const tabletMats: Material[] = [mats.tablet, mats.tablet, mats.tablet, mats.tablet, mats.tabletFace, mats.tablet];

  const slots = new Map<string, Slot>();
  const slotList: Slot[] = [];
  for (const r of o.robots) {
    const meshes: Mesh[] = [];
    r.group.traverse((x) => {
      if (x instanceof Mesh) meshes.push(x);
    });
    const s: Slot = {
      r,
      meshes,
      shared: meshes.map((m) => m.material),
      own: null,
      away: false,
      marker: null,
      markerKind: null,
      stamp: null,
      held: 0,
      tray: 0,
      shadowView: null,
      shadowFloor: -1,
      shadowOrg: false,
      progress: null,
    };
    slots.set(r.id, s);
    slotList.push(s);
  }

  const desks = new Map<string, { floor: number; x: number; z: number }>();
  for (const l of o.model?.layouts ?? []) for (const d of l.desks) desks.set(d.owner, { floor: l.floor, x: d.x, z: d.z });
  const floorGroup = (f: number): Object3D | null => o.model?.floors[f]?.group ?? null;

  // ---- robots: markers, stamp tool, current-floor visibility ----
  function setAway(s: Slot, away: boolean): void {
    if (away === s.away) return;
    s.away = away;
    if (away && !s.own) s.own = s.shared.map((m) => (Array.isArray(m) ? m.map(ownCopy) : ownCopy(m)));
    const set = away ? s.own : s.shared;
    if (!set) return;
    for (let i = 0; i < s.meshes.length; i++) {
      const m = set[i];
      const x = s.meshes[i];
      if (m && x) x.material = m;
    }
  }

  function robot(id: string, v: RobotPropView, view: ViewState, org: boolean): void {
    const s = slots.get(id);
    if (!s) return;
    const r = s.r;
    if (v.marker) {
      if (!s.marker) {
        s.marker = mesh(geo.hourglass, mats.hourglass, 'marker:hourglass');
        s.marker.position.set(0.32, ROBOT_HEIGHT * 0.82, 0);
        r.group.add(s.marker);
      }
      if (s.markerKind !== v.marker) {
        const hg = v.marker === 'hourglass';
        s.marker.geometry = hg ? geo.hourglass : geo.call;
        s.marker.material = hg ? mats.hourglass : mats.call;
        s.marker.name = hg ? 'marker:hourglass' : 'marker:call';
      }
      s.marker.visible = true;
    } else if (s.marker) s.marker.visible = false;
    s.markerKind = v.marker;

    if (v.stamp && !s.stamp) {
      s.stamp = mesh(geo.stamp, mats.stamp, 'prop:stamp');
      s.stamp.position.set(0, -0.27, 0.01);
      r.hand.add(s.stamp);
    }
    if (s.stamp) s.stamp.visible = v.stamp;

    setAway(s, v.floor !== r.homeFloor);
    const vis = floorVisible(v.floor, view, org);
    if (r.group.visible !== vis) r.group.visible = vis;
    if (s.shadowView !== view || s.shadowFloor !== v.floor || s.shadowOrg !== org) {
      s.shadowView = view;
      s.shadowFloor = v.floor;
      s.shadowOrg = org;
      const cast = !org && view.mode === 'floor' && view.focusFloor === v.floor;
      for (const x of s.meshes) x.castShadow = cast && x.name !== 'contact-shadow';
    }
  }

  // ---- copies: pooled per shape group, matched to copies by key ----
  const pools: Record<Group4, Mesh[]> = { envelope: [], paper: [], tablet: [], evidence: [] };
  const active: Mesh[] = [];
  let frameNo = 0;

  function make(group: Group4): Mesh {
    switch (group) {
      case 'envelope':
        return mesh(geo.envelope, mats.envelope, 'prop:envelope');
      case 'tablet':
        return mesh(geo.tablet, tabletMats, 'prop:build-tablet');
      case 'evidence': {
        const m = mesh(geo.paper, mats.paper, 'prop:evidence');
        const tick = mesh(geo.check, mats.evidenceCheck, 'evidence-check');
        tick.scale.setScalar(0.06);
        tick.position.set(0, 0.01, 0.004);
        m.add(tick);
        return m;
      }
      case 'paper': {
        const m = mesh(geo.paper, mats.paper, 'prop:spec-paper');
        const mark = mesh(geo.mark, mats.mark, 'stamp-mark');
        mark.userData.text = tr.places.stamp;
        mark.position.set(0.008, -0.02, 0.0035);
        mark.visible = false;
        m.add(mark);
        return m;
      }
    }
  }

  function acquire(kind: PropKind, key: string): Mesh {
    const group = GROUP_OF[kind];
    const m = pools[group].pop() ?? make(group);
    m.userData.key = key;
    m.userData.group = group;
    active.push(m);
    return m;
  }

  function release(i: number): void {
    const m = active[i];
    if (!m) return;
    m.removeFromParent();
    m.visible = false;
    const group: unknown = m.userData.group;
    if (group === 'envelope' || group === 'paper' || group === 'tablet' || group === 'evidence') pools[group].push(m);
    const lastM = active[active.length - 1];
    if (lastM && i < active.length - 1) active[i] = lastM;
    active.length -= 1;
  }

  function findActive(key: string): Mesh | null {
    for (let i = 0; i < active.length; i++) if (active[i]!.userData.key === key) return active[i]!;
    return null;
  }

  function place(c: PropCopy, view: ViewState, org: boolean): boolean {
    if (c.holder) {
      const s = slots.get(c.holder);
      if (!s) return false;
      const m = findActive(c.key) ?? acquire(c.kind, c.key);
      const n = s.held++;
      if (m.parent !== s.r.hand) s.r.hand.add(m);
      m.position.set(0, -0.2 - n * 0.006, 0.06 + n * 0.012);
      m.rotation.set(0, 0, 0);
      m.visible = true;
      finish(m, c);
      return true;
    }
    if (c.tray) {
      const s = slots.get(c.tray);
      const d = desks.get(c.tray);
      const fg = d ? floorGroup(d.floor) : null;
      if (!s || !d || !fg) return false;
      const m = findActive(c.key) ?? acquire(c.kind, c.key);
      const n = s.tray++;
      if (m.parent !== fg) fg.add(m);
      m.position.set(d.x - 0.3, FLOOR_TOP + 0.372 + n * 0.006, d.z + 0.12);
      m.rotation.set(-Math.PI / 2, 0, 0.15 * n);
      m.visible = floorVisible(d.floor, view, org);
      finish(m, c);
      return true;
    }
    return false;
  }

  function finish(m: Mesh, c: PropCopy): void {
    m.userData.frame = frameNo;
    const name = NAME_OF[c.kind];
    if (m.name !== name) m.name = name;
    if (GROUP_OF[c.kind] === 'paper') {
      const mark = m.children[0];
      if (mark) mark.visible = c.stamped || c.kind === 'spec-stamped';
    }
  }

  // ---- QA lamps ----
  const lamps = new Map<string, Lamp>();
  function lampFor(u: string): Lamp | null {
    const have = lamps.get(u);
    if (have) return have;
    const d = desks.get(u);
    const fg = d ? floorGroup(d.floor) : null;
    if (!d || !fg) return null;
    const base = mesh(geo.lampBase, mats.lampBase, 'qa-lamp-base');
    const group = base; // the base is the lamp's root: head and icons ride on it
    group.name = `qa-lamp:${u}`;
    const head = mesh(geo.lampHead, mats.lampOff, 'qa-lamp-head');
    head.position.y = 0.19;
    const pass = mesh(geo.check, mats.icon, 'lamp-icon:pass');
    const fail = mesh(geo.cross, mats.icon, 'lamp-icon:fail');
    for (const i of [pass, fail]) {
      i.scale.setScalar(0.055);
      i.position.set(0, 0.19, 0.05);
      i.visible = false;
    }
    group.add(head, pass, fail);
    group.position.set(d.x + 0.47, FLOOR_TOP + 0.365, d.z - 0.15);
    fg.add(group);
    const l: Lamp = { group, head, pass, fail, floor: d.floor, state: null };
    lamps.set(u, l);
    return l;
  }

  // ---- screens ----
  let evidenceTex: Texture | null | undefined;
  const evidence = (): Texture | null => {
    if (evidenceTex !== undefined) return evidenceTex;
    const cv = canvas ? canvas(SCREEN_W, SCREEN_H) : null;
    if (cv) {
      drawEvidence(cv.g, SCREEN_W, SCREEN_H);
      const t = new CanvasTexture(cv.canvas);
      t.colorSpace = SRGBColorSpace;
      evidenceTex = t;
    } else evidenceTex = null;
    return evidenceTex;
  };
  function progressOf(s: Slot, pct: number): Texture | null {
    if (!s.progress) {
      const cv = canvas ? canvas(SCREEN_W, SCREEN_H) : null;
      if (!cv) return null;
      const t = new CanvasTexture(cv.canvas);
      t.colorSpace = SRGBColorSpace;
      s.progress = { tex: t, g: cv.g, pct: -1 };
    }
    const p = s.progress;
    if (p.pct !== pct) {
      p.pct = pct;
      drawProgress(p.g, SCREEN_W, SCREEN_H, pct);
      p.tex.needsUpdate = true;
    }
    return p.tex;
  }

  function frame(src: PropsSource, view: ViewState, org: boolean): void {
    frameNo++;
    for (const s of slotList) {
      s.held = 0;
      s.tray = 0;
    }
    const list = src.copies();
    // Pass 1: copies that already own a mesh keep it; pass 2 frees the rest; pass 3 places new copies.
    for (let i = 0; i < list.length; i++) {
      const c = list[i]!;
      const m = findActive(c.key);
      if (m && m.userData.group === GROUP_OF[c.kind] && (c.holder || c.tray)) m.userData.frame = frameNo;
    }
    for (let i = active.length - 1; i >= 0; i--) if (active[i]!.userData.frame !== frameNo) release(i);
    for (let i = 0; i < list.length; i++) {
      const c = list[i]!;
      if (place(c, view, org)) continue;
      const m = findActive(c.key);
      if (m) m.userData.frame = -1; // holder or tray gone from the scene: freed below
    }
    for (let i = active.length - 1; i >= 0; i--) if (active[i]!.userData.frame !== frameNo) release(i);

    for (const u of src.lampUnits) {
      const l = lampFor(u);
      if (!l) continue;
      const st = src.lamp(u);
      if (st !== l.state) {
        l.state = st;
        l.head.material = st === 'pass' ? mats.lampPass : st === 'fail' ? mats.lampFail : mats.lampOff;
        l.pass.visible = st === 'pass';
        l.fail.visible = st === 'fail';
      }
      l.group.visible = floorVisible(l.floor, view, org);
    }

    for (const u of src.screenUnits) {
      const s = slots.get(u);
      if (!s) continue;
      const sv = src.screen(u);
      if (sv.mode === 'progress') s.r.screen.setOverlay(progressOf(s, sv.pct));
      else if (sv.mode === 'evidence') s.r.screen.setOverlay(evidence());
      else s.r.screen.setOverlay(null);
    }
  }

  return { robot, frame, meshCount: () => created };
}
