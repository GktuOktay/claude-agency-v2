// Scene wiring: renderer, lights, camera, input, DOM overlays, render loop. Needs WebGL2 and a browser;
// the logic it composes is unit-tested separately (visual behaviour is verified by eye).
import {
  ACESFilmicToneMapping,
  Color,
  PointLight,
  type Group,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Ray,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { tr } from '../i18n/tr';
import { createActivitySim, createBubbleScheduler, type Bubble } from '../scene/activity';
import { CAMERA_FOV, CameraRig, FLOOR_TARGET_Y, classifyPointer, configureOrbit, setFrameAspect, setFrameInsets, setOrgInsets } from '../scene/camera';
import { createDayNight, lightingFor } from '../scene/daynight';
import { buildOrgLines, orgLines } from '../scene/org';
import { createDayNightControl } from '../ui/dayNightControl';
import { createOrgLegend } from '../ui/orgLegend';
import { bindReducedMotion, type MediaQueryLike } from './motion';
import { bubbleVisible, robotLabelVisible, roomLabelVisible, stackLabels, type LabelBox } from '../scene/labels';
import { FLOOR_HEIGHT, FLOOR_TOP, accentCss, buildTower, floorAccent, type RobotEntry } from '../scene/model';
import { ROBOT_BASE_SCALE, ROBOT_HEIGHT } from '../scene/robot';
import { blobTexture, hatchTexture, screenTexture, woodTexture } from '../scene/textures';
import { pickRobot } from '../scene/picking';
import { applyPose } from '../scene/pose';
import { createRng } from '../scene/rng';
import { createFloorPanel } from '../ui/floorPanel';
import { createKeyHandler } from '../ui/keymap';
import { el } from '../ui/dom';
import { createUnitList } from '../ui/unitList';
import { applyInitialCamera, projectToScreen } from './initialCamera';
import { createFpsMeter, createLoop } from './loop';
import { qualitySettings, resolveQuality, type Params } from './params';
import { createSelectionFlow } from './selection';
import type { SceneContext } from './bootstrap';

const SEED = 20261113;

/** Line colour for org mode: the department accent, lifted toward white so it glows softly. */
function brighten(floor: number): number {
  const c = new Color(floorAccent(floor));
  return c.lerp(new Color(0xffffff), 0.35).getHex();
}

export function startSceneApp(ctx: SceneContext, params: Params): void {
  const { root, data, card } = ctx;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const quality = qualitySettings(resolveQuality(params, coarse), window.devicePixelRatio || 1);

  const canvas = el('canvas', { class: 'tower-canvas', tabindex: '-1', 'aria-label': tr.title });
  root.prepend(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setClearColor(0x000000, 0); // the page's soft off-white gradient shows through
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Fixed day lighting (M1): warm key light, soft sky/ground fill, high ambient.
  const scene = new Scene();
  const hemi = new HemisphereLight(0xfff8ee, 0xe6dccd, 1.15);
  const ambient = new AmbientLight(0xffffff, 0.6);
  const interior = new PointLight(0xffc98a, 0, 16, 1.6); // warm room light at night (floor view)
  scene.add(hemi, ambient, interior);
  const sun = new DirectionalLight(0xfff0dc, 2.3);
  scene.add(sun, sun.target);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
  }
  let shadowMode: 'overview' | 'floor' | null = null;
  const placeSun = (): void => {
    const mode = model.view.mode;
    const focusY = mode === 'floor' ? model.view.focusFloor * FLOOR_HEIGHT : 0;
    const reach = mode === 'floor' ? 1 : 2.2;
    sun.target.position.set(0, focusY, 0);
    sun.position.set(7 * reach, focusY + 16 * reach, 10 * reach);
    sun.target.updateMatrixWorld();
    if (quality.shadows && shadowMode !== mode) {
      shadowMode = mode;
      const cam = sun.shadow.camera;
      const half = mode === 'floor' ? 10.5 : 24;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 0.5;
      cam.far = mode === 'floor' ? 45 : 110;
      cam.updateProjectionMatrix();
    }
  };

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures = { wood: woodTexture(), hatch: hatchTexture(), blob: blobTexture() };
  for (const t of [textures.wood, textures.hatch]) if (t) t.anisotropy = maxAniso;
  const baseScreen = screenTexture();
  const model = buildTower(data, {
    screenTexture: () => (baseScreen as Texture | null)?.clone() ?? null,
    textures,
  });
  scene.add(model.root);
  placeSun();

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.3, 400);
  const fitAspect = (): void => {
    const w = Math.max(1, root.clientWidth || window.innerWidth);
    const h = Math.max(1, root.clientHeight || window.innerHeight);
    setFrameAspect(w / h); // poses frame the tower / floor for this viewport
  };
  fitAspect();
  const rig = new CameraRig();
  const controls = new OrbitControls(camera, canvas);
  configureOrbit(controls);
  applyInitialCamera(rig, camera, controls);

  const sim = createActivitySim(
    model.robots.map((r) => ({ id: r.unit.id, home: r.homePoint, work: r.workPoint, coffee: r.coffeePoint })),
    SEED,
  );
  const bubbles = createBubbleScheduler(
    data.units.map((u) => ({ id: u.id, phrases: u.phrasesTr })),
    createRng(SEED + 1),
  );
  const robotById = new Map<string, RobotEntry>(model.robots.map((r) => [r.unit.id, r]));

  // ---- navigation and selection ----
  // ---- org-chart mode (REQ-17) ----
  let orgOn = false;
  let orgLinesGroup: Group | null = null;
  const legend = createOrgLegend();
  legend.hidden = true;
  const orgBtn = el('button', { type: 'button', 'aria-pressed': 'false', class: 'org-toggle' }, tr.orgChart);
  const clearOrg = (): void => {
    orgOn = false;
    if (orgLinesGroup) {
      orgLinesGroup.traverse((o) => {
        if ('geometry' in o && o.geometry && typeof o.geometry === 'object' && 'dispose' in o.geometry && typeof o.geometry.dispose === 'function') o.geometry.dispose();
      });
      orgLinesGroup.removeFromParent();
      orgLinesGroup = null;
    }
    legend.hidden = true;
    document.documentElement.classList.remove('is-org');
    orgBtn.setAttribute('aria-pressed', 'false');
  };
  /** Org framing keeps the name pills clear of the toolbar (top) and the legend (bottom). */
  function measureOrgInsets(): void {
    const h = Math.max(1, root.clientHeight || window.innerHeight);
    const tb = toolbar.getBoundingClientRect();
    const lg = legend.getBoundingClientRect();
    const topPx = tb.height && tb.top < h / 2 ? tb.bottom + 8 : 12;
    const bottomPx = Math.max(lg.height ? h - lg.top + 8 : 12, tb.height && tb.top >= h / 2 ? h - tb.top + 8 : 0);
    setOrgInsets(topPx / h, bottomPx / h);
  }
  /** Leave org mode without moving the camera (a selection or floor choice moves it next). */
  const dropOrg = (): void => {
    if (!orgOn) return;
    clearOrg();
    model.setOrg(false);
  };
  function enterOrg(): void {
    if (orgOn) return;
    closeCardQuiet();
    orgOn = true;
    model.setOrg(true);
    legend.hidden = false;
    document.documentElement.classList.add('is-org');
    measureOrgInsets();
    rig.goOrg();
    const positions = new Map(model.robots.map((r) => [r.unit.id, r.group.position.clone()]));
    const byId = new Map(model.robots.map((r) => [r.unit.id, r.floor]));
    orgLinesGroup = buildOrgLines(orgLines(data.units), positions, (from) => (from === 'internal-auditor' ? 0xffa94d : brighten(byId.get(from) ?? 0)));
    scene.add(orgLinesGroup);
    legend.hidden = false;
    orgBtn.setAttribute('aria-pressed', 'true');
  }
  function exitOrg(): void {
    if (!orgOn) return;
    clearOrg();
    model.setOrg(false);
    rig.exitOrg();
    panel.setCurrent(model.view.mode === 'floor' ? model.view.focusFloor : 'all');
  }
  orgBtn.addEventListener('click', () => (orgOn ? exitOrg() : enterOrg()));

  const flow = createSelectionFlow({ rig, sim, model, getCard: () => card, exitOrg: dropOrg });
  ctx.hooks.onCardClosed = () => flow.onCardClosed();
  const closeCard = (): void => {
    if (card.isOpen()) card.close();
  };
  function closeCardQuiet(): void {
    closeCard();
  }

  const panel = createFloorPanel(data.floors, (v) => {
    closeCard();
    dropOrg();
    if (v === 'all') goOverview();
    else goFloor(v);
  });
  panel.setCurrent('all');

  function goFloor(n: number): void {
    model.setView({ mode: 'floor', focusFloor: n });
    rig.goToFloor(n);
    panel.setCurrent(n);
  }
  function goOverview(): void {
    model.setView({ mode: 'overview', focusFloor: 0 });
    rig.goOverview();
    panel.setCurrent('all');
  }

  const keys = createKeyHandler({
    getState: () => ({ busy: rig.busy, cardOpen: card.isOpen(), mode: orgOn ? 'org' : rig.mode === 'org' ? 'overview' : rig.mode }),
    goFloor: (n) => {
      dropOrg();
      goFloor(n);
    },
    toggleOrg: () => (orgOn ? exitOrg() : enterOrg()),
    exitOrg,
    closeCard,
    orgEnabled: true,
  });
  window.addEventListener('keydown', (e) => keys.handle(e));

  const toolbar = el('div', { class: 'toolbar', role: 'toolbar', 'aria-label': tr.title });
  const shortcutBtn = el('button', { type: 'button', 'aria-pressed': 'true' }, tr.shortcutsOn);
  shortcutBtn.addEventListener('click', () => {
    const on = !keys.isEnabled();
    keys.setEnabled(on);
    shortcutBtn.setAttribute('aria-pressed', String(on));
    shortcutBtn.textContent = on ? tr.shortcutsOn : tr.shortcutsOff;
  });
  // ---- day / night (REQ-18) ----
  const dayNight = createDayNight();
  const dnControl = createDayNightControl(dayNight);
  toolbar.append(dnControl.element, orgBtn, shortcutBtn);

  // ---- reduced motion (REQ-20), on load and on live change ----
  const rmq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const mql: MediaQueryLike = {
    get matches() {
      return rmq?.matches ?? false;
    },
    addEventListener: (_type, cb) => rmq?.addEventListener('change', (e) => cb({ matches: e.matches })),
  };
  const motion = bindReducedMotion(mql, {
    rig,
    sim,
    dayNight,
    screens: model.robots.map((r) => r.screen),
    onChange: () => dnControl.refresh(),
  });

  const unitList = createUnitList(data.units, (u, opener) => flow.select(u, opener, { fromOrg: orgOn }), { visible: false });
  // DOM labels (textContent only): department pills per room, name pills per robot.
  const labels = el('div', { class: 'overlay', 'aria-hidden': 'true' });
  const pill = (cls: string, color: string, text: string, tag?: string): HTMLElement => {
    const e = el('div', { class: cls });
    const dot = el('span', { class: 'dot' });
    dot.style.background = color;
    e.append(dot, el('span', { class: 'text' }, text));
    if (tag) e.append(el('span', { class: 'tag' }, tag));
    e.hidden = true;
    labels.append(e);
    return e;
  };
  const roomEls = model.rooms.map((room) => ({ room, e: pill('room-label', accentCss(room.floor), room.text) }));
  const labelWidths = new WeakMap<HTMLElement, number>();
  const robotEls = new Map<string, HTMLElement>(
    model.robots.map((r) => [r.unit.id, pill('robot-label', accentCss(r.floor), r.unit.name, tr.tiers[r.unit.tier])]),
  );
  const fpsEl = el('div', { class: 'fps' }, '');
  fpsEl.hidden = !params.debug;
  root.append(toolbar, panel.element, unitList.element, labels, legend, fpsEl);

  let hoverId: string | null = null;
  let focusId: string | null = null;
  for (const u of data.units) {
    const b = unitList.buttonFor(u.id);
    b?.addEventListener('focus', () => (focusId = u.id));
    b?.addEventListener('blur', () => (focusId = null));
  }

  // ---- pointer: click vs drag ----
  let down: { x: number; y: number } | null = null;
  const ndc = new Vector2();
  const pick = (clientX: number, clientY: number): RobotEntry | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const dir = new Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(origin).normalize();
    model.root.updateMatrixWorld(true);
    return pickRobot(model, new Ray(origin, dir));
  };
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const kind = classifyPointer(down, { x: e.clientX, y: e.clientY });
    down = null;
    if (kind !== 'click') return;
    const hit = pick(e.clientX, e.clientY);
    if (hit) flow.select(hit.unit, canvas, { fromOrg: orgOn });
  });
  let hoverPending = false;
  canvas.addEventListener('pointermove', (e) => {
    if (hoverPending || e.buttons) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      hoverId = pick(e.clientX, e.clientY)?.unit.id ?? null;
    });
  });

  // Floor framing avoids the floor panel: a side column on desktop, a top strip on phones.
  function measureInsets(): void {
    const w = Math.max(1, root.clientWidth || window.innerWidth);
    const h = Math.max(1, root.clientHeight || window.innerHeight);
    const r = panel.element.getBoundingClientRect();
    if (!r.width) return;
    const strip = r.width > w * 0.6;
    setFrameInsets(strip ? 0 : Math.min(0.35, (r.right + 8) / w), strip ? Math.min(0.3, (r.bottom + 8) / h) : 0);
  }

  // ---- resize ----
  const resize = (): void => {
    const w = Math.max(1, root.clientWidth || window.innerWidth);
    const h = Math.max(1, root.clientHeight || window.innerHeight);
    fitAspect();
    measureInsets();
    if (orgOn) measureOrgInsets();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  // ---- per-frame ----
  const bubbleEls: HTMLElement[] = [];
  const fps = createFpsMeter();
  let last = 0;
  let wasBusy = false;
  let clock = 0;
  let lightsOn = 0;
  let lastSky = '';

  const project = (pos: Vector3): { x: number; y: number; visible: boolean } => {
    const r = canvas.getBoundingClientRect();
    return projectToScreen(pos, camera, r.width, r.height);
  };
  const headPos = (r: RobotEntry): Vector3 =>
    r.group.getWorldPosition(new Vector3()).add(new Vector3(0, (ROBOT_HEIGHT + 0.06 + r.parts.body.position.y * ROBOT_BASE_SCALE) * r.group.scale.y, 0));
  const show = (e: HTMLElement, on: boolean, x = 0, y = 0, lift = 0): void => {
    if (e.hidden === on) e.hidden = !on;
    if (on) e.style.transform = `translate(${x.toFixed(1)}px, ${(y - lift).toFixed(1)}px) translate(-50%, -100%)`;
  };

  const tick = (now: number): void => {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    clock += dt;

    if (!orgOn) sim.step(dt * 1000); // org mode: robots freeze in place
    const selected = flow.selectedId();
    const still = motion.active();
    for (const r of model.robots) {
      if (r.unit.id === selected) sim.faceToward(r.unit.id, camera.position.x, camera.position.z);
      const a = sim.get(r.unit.id);
      r.group.position.set(a.x, a.y, a.z);
      r.group.rotation.y = a.facing;
      if (orgOn) applyPose(r.parts, 'idle', 0, 0);
      else applyPose(r.parts, a.kind, still ? 0 : a.walkPhase, still ? 0 : clock + r.unit.id.length);
      r.screen.scrolling = a.kind === 'work';
      r.screen.update(dt);
    }

    rig.update(dt);
    if (Math.abs(camera.fov - rig.fov) > 1e-3) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
    if (rig.busy) {
      camera.position.copy(rig.position);
      controls.target.copy(rig.target);
      controls.enabled = false;
    } else {
      controls.enabled = true;
    }
    controls.update();
    if (!rig.busy) rig.position.copy(camera.position);
    if (wasBusy && !rig.busy) keys.onIdle();
    wasBusy = rig.busy;
    model.cabin.setHeight(rig.cabinY - FLOOR_TARGET_Y + FLOOR_TOP);
    model.cabin.setDoorsOpen(rig.doorsOpenness);

    // robot name pills: every robot of the focused floor in floor view; hovered / focused / selected otherwise
    const highlighted = new Set<string>();
    for (const id of [selected, focusId, hoverId]) if (id) highlighted.add(id);
    const labelShown = new Set<string>();
    const placed: { e: HTMLElement; box: LabelBox }[] = [];
    for (const r of model.robots) {
      const e = robotEls.get(r.unit.id);
      if (!e) continue;
      const on = orgOn || robotLabelVisible({ id: r.unit.id, floor: r.floor }, model.view, highlighted);
      const p = on ? project(headPos(r)) : null;
      if (!p?.visible) {
        show(e, false);
        continue;
      }
      if (e.hidden) e.hidden = false;
      let w = labelWidths.get(e);
      if (w === undefined) {
        w = e.offsetWidth || 90; // measured once, after first show
        labelWidths.set(e, w);
      }
      placed.push({ e, box: { x: p.x, y: p.y, w } });
      labelShown.add(r.unit.id);
      e.classList.toggle('is-active', highlighted.has(r.unit.id));
    }
    // each pill sits just above its own robot's head; close neighbours (e.g. at the coffee island) stack
    const lifts = stackLabels(placed.map((x) => x.box), 22);
    placed.forEach(({ e, box }, i) => show(e, true, box.x, box.y, lifts[i] ?? 0));

    // department / room pills
    for (const { room, e } of roomEls) {
      const on = !orgOn && roomLabelVisible(room, model.view) && !(selected && room.floor === model.view.focusFloor && !room.primary);
      if (!on) {
        show(e, false);
        continue;
      }
      const p = project(room.position);
      show(e, p.visible, p.x, p.y);
    }

    // speech bubbles (above the name pill when one is shown)
    const active: readonly Bubble[] = bubbles.step(dt);
    active.forEach((b, i) => {
      let e = bubbleEls[i];
      if (!e) {
        e = el('div', { class: 'bubble' });
        e.hidden = true;
        labels.append(e);
        bubbleEls[i] = e;
      }
      const r = robotById.get(b.unitId);
      if (!r) return;
      const p = project(headPos(r));
      if (e.textContent !== b.text) e.textContent = b.text;
      show(e, p.visible && !orgOn && bubbleVisible(r.floor, model.view), p.x, p.y, labelShown.has(b.unitId) ? 30 : 4);
    });
    for (let i = active.length; i < bubbleEls.length; i++) {
      const e = bubbleEls[i];
      if (e) e.hidden = true;
    }

    canvas.style.cursor = hoverId ? 'pointer' : '';
    // day / night: sky, sun, fill, window and floor-light glow (lights fade on over ~0.7 s, cut if reduced)
    dayNight.step(dt);
    const lightsGoal = dayNight.night() ? 1 : 0;
    lightsOn = still ? lightsGoal : lightsOn + (lightsGoal - lightsOn) * Math.min(1, dt * 1.5);
    const L = lightingFor(dayNight.brightness(), lightsOn);
    sun.intensity = L.sun;
    sun.color.setHex(L.sunColor);
    hemi.intensity = L.hemi;
    ambient.intensity = L.ambient;
    renderer.toneMappingExposure = L.exposure;
    model.setNight(lightsOn);
    const sky = `${L.skyTop}|${L.skyMid}|${L.skyBottom}`;
    if (sky !== lastSky) {
      lastSky = sky;
      const st = document.documentElement.style;
      st.setProperty('--bg-1', L.skyTop);
      st.setProperty('--bg-2', L.skyMid);
      st.setProperty('--bg-3', L.skyBottom);
      document.documentElement.classList.toggle('is-night', dayNight.brightness() < 0.35);
    }
    interior.intensity = model.view.mode === 'floor' && !orgOn ? L.interior * 6 : 0;
    if (interior.intensity > 0) interior.position.set(0, model.view.focusFloor * FLOOR_HEIGHT + 2.2, -0.5);

    placeSun();
    renderer.render(scene, camera);
    if (params.debug) fpsEl.textContent = `${fps.frame(now).toFixed(0)} fps · ${quality.quality}`;
  };

  const loop = createLoop({
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    doc: document,
    tick,
  });
  loop.start();
}
