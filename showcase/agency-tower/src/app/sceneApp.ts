// Scene wiring: renderer, lights, camera, input, DOM overlays, render loop. Needs WebGL2 and a browser;
// the logic it composes is unit-tested separately (visual behaviour is verified by eye).
import {
  Color,
  PointLight,
  type Group,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  MeshBasicMaterial,
  Mesh,
  Plane,
  Ray,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { tr } from '../i18n/tr';
import { appCampusOptions, createActivitySim, BREAK_QUEUE_MAX, createBubbleScheduler, type ActivityView, type BreakMovement, type Bubble } from '../scene/activity';
import { CAMERA_FOV, CameraRig, FLOOR_TARGET_Y, classifyPointer, configureOrbit, setFrameAspect, setFrameInsets, setOrgInsets, setSheetInset, setZoomSheetInset } from '../scene/camera';
import { createDayNight, lightingFor } from '../scene/daynight';
import { buildOrgLines, orgLines } from '../scene/org';
import { createDayNightControl } from '../ui/dayNightControl';
import { createOrgLegend } from '../ui/orgLegend';
import { bindReducedMotion, type MediaQueryLike } from './motion';
import { bubbleCovers, bubbleSize, bubbleVisible, floorLabelAt, floorLabelColumn, robotLabelVisible, roomLabelVisible, type FloorColumnItem, type ScreenRect } from '../scene/labels';
import { bubbleLift, createDeclutter, declutterDue } from '../scene/declutter';
import { FLOOR_HEIGHT, FLOOR_TOP, accentCss, buildTower, floorAccent, type RobotEntry, type ViewState } from '../scene/model';
import { ROBOT_BASE_SCALE, ROBOT_HEIGHT, tierStyle } from '../scene/robot';
import { FOLLOW_FOV, createFollower, cycleFollow, followBounds, followOrder, type Follower } from '../scene/follow';
import { createTourPlayer, installTourHook, tourParams, tourPlan, type TourPlayer } from '../scene/tour';
import { WALK_FOV, createWalker, isWalkKey, walkInputFromKeys, type Walker } from '../scene/walk';
import { buildCampusGraph, type CampusGraph } from '../sim/nav';
import { createCameraModeUi, type FollowList } from '../ui/cameraModeUi';
import { createTourUi } from '../ui/tourUi';
import type { Unit } from '../data/types';
import { blobTexture, hatchTexture, screenTexture, woodTexture } from '../scene/textures';
import { pickRobot } from '../scene/picking';
import { applyPose } from '../scene/pose';
import { createRng } from '../scene/rng';
import { createFloorPanel } from '../ui/floorPanel';
import { CAMPUS_ITEMS, campusItem, nextCampus, type CampusKey } from '../ui/campusNav';
import { createKeyHandler } from '../ui/keymap';
import { el } from '../ui/dom';
import { mountHud } from '../ui/hudLayout';
import { createUnitList } from '../ui/unitList';
import { applyInitialCamera, projectToScreen } from './initialCamera';
import { createFpsMeter, createLoop } from './loop';
import { maxJobsFor, qualitySettings, resolveQuality, type Params } from './params';
import { createSettingsMenu } from '../ui/settingsMenu';
import { createAppearanceSection, readStoredQuality, toLegacyQuality, type OnQuality, type QualityTier } from '../ui/settings/appearance';
import { createActiveJobsSection } from '../ui/settings/activeJobs';
import { createOfficeSection } from '../ui/settings/office';
import { breakPeriodAt, createOfficeSchedule, type OfficeClock } from '../sim/schedule';
import { createScenarioSection } from '../ui/settings/scenario';
import { createAccessibilitySection } from '../ui/settings/accessibility';
import { RENDERER_OPTIONS, applyQuality, createQualityContext, initialTier, roomEnvironment } from './quality';
import { MASTER_SEED, type WfEvent } from '../sim/workflow';
import { framePose, shouldStepSim } from './frameUpdate';
import { createSelectionFlow } from './selection';
import { sceneLight } from './sceneLight';
import { createSimRuntime } from './simRuntime';
import { breakKeyOf } from '../ui/nowLine';
import { syncStaffCabinFrom } from './elevatorView';
import { createDirector, type Director, type RobotView } from '../scene/director';
import { createProps, propRobotsOf } from '../scene/props';
import { createWhiteboard, createWhiteboardTexture } from '../scene/whiteboard';
import { HALF_DEPTH, SHAFT_X, STAFF_SHAFT, WING_LEVELS, floorY, whiteboardTextureSize } from '../sim/layout';
import { isNavMovement, type NavMovement } from '../sim/navMovement';
import { createStaffRuntime, type StaffRuntime } from './staffRuntime';
import { createStaff, type StaffModel } from '../scene/staff';
import { createRoomLife, frameRoomLife } from '../scene/roomLife';
import { createRobotActions } from './robotActions';
import { rideToFloor } from './stripActivation';
import type { SceneContext } from './bootstrap';
import { LUNCH_AT, createOfficeTime } from '../sim/dayControl';
import { createFeedModel, createPulse, placeOf, type FeedItem, type Place } from '../sim/pulse';
import { createEventFeed, readStoredFeed } from '../ui/eventFeed';
import { createScreenshotButton, flattenOnPage } from '../ui/screenshot';
import { createDaySpeedControl, createLunchButton } from '../ui/settings/daySpeed';
import { createBreakButtons } from '../ui/settings/breakButton';
import { createBreakOverride } from '../sim/breakOverride';
import { createPulseSection } from '../ui/settings/pulse';
import { HALF_WIDTH } from '../sim/layout';

const SEED = 20261113;
/** Rev 43 tour finale: sky brightness of golden hour (the key light is golden around 0.35, lightingFor). */
const GOLDEN_BRIGHTNESS = 0.38;

/** Render view of an ambient-only robot (no director). */
const ambientView = (a: ActivityView): Pick<RobotView, 'x' | 'y' | 'z' | 'facing' | 'walkPhase' | 'pose' | 'screenScroll'> => ({
  x: a.x,
  y: a.y,
  z: a.z,
  facing: a.facing,
  walkPhase: a.walkPhase,
  pose: a.kind,
  screenScroll: a.kind === 'work',
});

/** Line colour for org mode: the department accent, lifted toward white so it glows softly. */
function brighten(floor: number): number {
  const c = new Color(floorAccent(floor));
  return c.lerp(new Color(0xffffff), 0.35).getHex();
}

export function startSceneApp(ctx: SceneContext, params: Params): void {
  const { root, data, card, scenarios, titles } = ctx;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  // Rev 35: a stored "Görüntü kalitesi" choice applies when the URL has no ?quality (mapped onto the
  // existing tiers until src/app/quality.ts exists).
  const storedTier = readStoredQuality();
  const legacy = params.quality ?? (storedTier ? toLegacyQuality(storedTier) : null);
  const quality = qualitySettings(resolveQuality({ ...params, quality: legacy }, coarse), window.devicePixelRatio || 1);
  const currentTier: QualityTier = params.quality ?? storedTier ?? quality.quality; // the selector's initial mark

  const canvas = el('canvas', { class: 'tower-canvas', tabindex: '-1', 'aria-label': tr.title });
  root.prepend(canvas);
  const renderer = new WebGLRenderer({ canvas, ...RENDERER_OPTIONS });
  renderer.setClearColor(0x000000, 0); // the page's soft off-white gradient shows through
  renderer.toneMappingExposure = lightingFor(1, 0).exposure; // the frame loop follows the day / night light

  // Fixed day lighting (M1): warm key light, soft sky/ground fill, high ambient.
  const scene = new Scene();
  const hemi = new HemisphereLight(0xfff8ee, 0xe6dccd, 1.15);
  const ambient = new AmbientLight(0xffffff, 0.6);
  const interior = new PointLight(0xffc98a, 0, 16, 1.6); // warm room light at night (floor view)
  scene.add(hemi, ambient, interior);
  const sun = new DirectionalLight(0xfff0dc, 2.3);
  scene.add(sun, sun.target);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // Render quality (Rev 35): pixel ratio, shadows, tone mapping, environment; switchable at runtime.
  const qualityCtx = createQualityContext({
    renderer,
    scene,
    shadowLights: [sun],
    devicePixelRatio: () => window.devicePixelRatio || 1,
    createEnvironment: roomEnvironment(renderer),
  });
  applyQuality(qualityCtx, params.quality ? initialTier(params, coarse) : (storedTier ?? initialTier(params, coarse)));
  let shadowMode: 'overview' | 'floor' | null = null;
  const placeSun = (): void => {
    const mode = model.view.mode;
    const focusY = mode === 'floor' ? model.view.focusFloor * FLOOR_HEIGHT : 0;
    const reach = mode === 'floor' ? 1 : 2.2;
    sun.target.position.set(0, focusY, 0);
    sun.position.set(7 * reach, focusY + 16 * reach, 10 * reach);
    sun.target.updateMatrixWorld();
    if (shadowMode !== mode) {
      shadowMode = mode;
      const cam = sun.shadow.camera;
      const half = mode === 'floor' ? 10.5 : 24;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 0.5;
      cam.far = mode === 'floor' ? 90 : 110; // 90: city ground must not end in a visible edge in floor views
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

  // Campus breaks (KARARLAR rev 31) walk through the engine's nav movement, bound once the runtime exists.
  let breakNav: NavMovement | null = null;
  const breakMovement: BreakMovement = {
    moveTo: (u, t) => breakNav?.moveTo(u, t),
    isAt: (u, t) => breakNav?.isAt(u, t) ?? false,
    phase: (u) => breakNav?.phase(u) ?? 'still',
    renderPosition: (u, reduced) => breakNav?.renderPosition(u, reduced) ?? { x: 0, y: 0, z: 0 },
  };
  // Rev 35 P3: the office day runs on the 0002 simulation clock (bound lazily: the runtime is created below).
  // Rev 43 C3: the office reads simulation time + the "Öğle arasına atla" offset (the engine never sees it).
  const officeTime = createOfficeTime({
    get time() {
      return runtime.clock.time;
    },
  });
  const office: OfficeClock = createOfficeSchedule(officeTime);
  // Rev 44: "Molaya çık" / "Molayı bitir" override the break logic's period until the next scheduled transition.
  const breakOverride = createBreakOverride(() => office.breakPeriod());
  const sim = createActivitySim(
    model.robots.map((r) => ({ id: r.unit.id, home: r.homePoint, work: r.workPoint, coffee: r.coffeePoint })),
    SEED,
    {
      // Rev 35 P3: breaks follow the office schedule; Rev 35: social areas for everyone (the director latches the
      // current floor on an interrupt); Rev 39: the occupancy director keeps every zone and Ar-Ge in use.
      campus: appCampusOptions({
        movement: breakMovement,
        floors: new Map(data.units.map((u) => [u.id, u.floor])),
        period: () => breakOverride.period(),
        override: () => breakOverride.mode(),
        periodAhead: (s) => breakPeriodAt(officeTime.time + s),
        paused: () => runtime.clock.paused,
        queued: () => breakNav?.elevator.queue().length ?? BREAK_QUEUE_MAX,
      }),
    },
  );
  const bubbles = createBubbleScheduler(
    data.units.map((u) => ({ id: u.id, phrases: u.phrasesTr })),
    createRng(SEED + 1),
  );
  /** The bubbles shown now; stepped in the runtime's ambient hook (frozen while paused). */
  let activeBubbles: readonly Bubble[] = [];
  const robotById = new Map<string, RobotEntry>(model.robots.map((r) => [r.unit.id, r]));

  // ---- 0002: simulation clock, workflow engine (nav + staff elevator movement), director, job strip ----
  let director: Director | null = null;
  const narrowMq = typeof matchMedia === 'function' ? matchMedia('(max-width: 767px)') : null;
  const reducedMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  // T-8: meeting-room whiteboard, filled from the engine's meeting progress (§7.7 texture size per tier).
  const board = createWhiteboard(scenarios);
  const boardTex = createWhiteboardTexture(whiteboardTextureSize(quality.quality));
  if (boardTex) model.meetingRoom.setWhiteboardTexture(boardTex.texture);
  const runtime = createSimRuntime({
    scenarios,
    units: new Map(data.units.map((u) => [u.id, u.floor])),
    titles,
    maxJobs: maxJobsFor(quality.quality),
    unitName: ctx.nameOf,
    // AC-15: the ambient cycle and the bubbles advance on the simulation dt; the runtime skips this hook while a
    // global reason (org / user / hidden) pauses the clock, so they freeze with no draws.
    onAmbient: (dt) => {
      if (shouldStepSim(orgOn)) sim.step(dt * 1000); // org mode: robots freeze in place
      activeBubbles = bubbles.step(dt);
    },
    onStep: (dt, events) => {
      director?.ingest(events);
      board.ingest(events);
      director?.update(dt, runtime.workflow);
      onLiveEvents(events); // Rev 43 C1 / C2
    },
    isNarrow: () => narrowMq?.matches ?? false,
    reducedMotion: () => reducedMq?.matches ?? false,
    rideTo: (floor) =>
      rideToFloor(
        { cardOpen: () => card.isOpen(), closeCard: () => closeCard(), orgOn: () => orgOn, leaveOrg: () => dropOrg(), goFloor: (f) => goFloor(f) },
        floor,
      ),
  });
  {
    // T-6: robots reserved by a job step leave the ambient cycle and follow the engine's movement.
    const mv = runtime.workflow.movement;
    if (isNavMovement(mv)) breakNav = mv;
    director = createDirector({
      scenarios,
      layouts: model.layouts,
      homeFloors: new Map(data.units.map((u) => [u.id, u.floor])),
      ambient: sim,
      position: isNavMovement(mv) ? (u) => mv.renderPosition(u, reducedMq?.matches ?? false) : undefined,
      still: () => reducedMq?.matches ?? false,
    });
  }
  // T-6 visible layer: markers, carried copies, stamp, QA lamps, screen overlays (src/scene/props.ts).
  {
    const faceOf = new Map<unknown, MeshBasicMaterial>();
    model.root.traverse((o) => {
      if (o instanceof Mesh && o.material instanceof MeshBasicMaterial && o.material.map) faceOf.set(o.material.map, o.material);
    });
    for (const r of model.robots) {
      const face = r.screen.texture ? faceOf.get(r.screen.texture) : undefined;
      if (face) r.screen.bind(face);
    }
  }
  const props = createProps({ robots: propRobotsOf(model), model });
  // Rev 43 B: cups, dumbbells, trays, phones, markers in the robots' hands (five shared instanced meshes).
  const actions = createRobotActions(model.robots);
  model.root.add(actions.group);
  /** R-5: the floor each robot is on now (labels, bubbles, picking), refreshed every frame. */
  const floorNow = new Map<string, number>(model.robots.map((r) => [r.unit.id, r.floor]));
  const floorOf = (r: RobotEntry): number => floorNow.get(r.unit.id) ?? r.floor;
  document.addEventListener('visibilitychange', () => runtime.setHidden(document.hidden));
  runtime.setHidden(document.hidden);

  // Staff NPCs: static import, no request after page load (0001 REQ-16; budget per KARARLAR Rev 31).
  let staff: StaffModel | null = null;
  let staffRt: StaffRuntime | null = null;
  // Room life (Rev 39): the wider team in every room; not units, never pickable. Synced with the staff.
  const roomLife = createRoomLife({ seed: 1, officeTime: office.minutes() });
  model.root.add(roomLife.group);
  function syncStaff(): void {
    staff?.setView(model.view);
    staff?.setOrg(orgOn);
    roomLife.setView(model.view);
    roomLife.setOrg(orgOn);
  }
  {
    const st = createStaff({ layouts: model.layouts, seed: 1, reducedMotion: false }); // synced right after `motion` is bound
    model.root.add(st.group);
    staff = st;
    staffRt = createStaffRuntime({ staff: st, clock: runtime.clock });
  }

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
    runtime.setOrg(false);
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
    syncStaff();
  };
  function enterOrg(): void {
    if (orgOn) return;
    exitCameraMode(false);
    closeCardQuiet();
    orgOn = true;
    runtime.setOrg(true);
    model.setOrg(true);
    syncStaff();
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
    syncStaff();
    rig.exitOrg();
    panel.setCurrent(campusAt ?? (model.view.mode === 'floor' ? model.view.focusFloor : 'all'));
  }
  orgBtn.addEventListener('click', () => (orgOn ? exitOrg() : enterOrg()));

  const flow = createSelectionFlow({
    rig,
    sim,
    model,
    getCard: () => card,
    exitOrg: dropOrg,
    linesFor: (id) => {
      const kind = sim.get(id).kind;
      // Rev 38: a break names its venue (or the tea / coffee slot at the floor station).
      return runtime.cardLinesFor(id, kind, breakKeyOf({ spot: sim.onBreak(id), phase: sim.breakPhase(id), kind, period: breakOverride.period() }));
    },
    onSelect: (id) => runtime.select(id),
    onRelease: (id) => runtime.release(id),
    renderPosition: (id) => {
      const v = director?.view(id);
      return v ? { x: v.x, y: v.y, z: v.z, floor: v.floor } : null;
    },
  });
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
  }, {
    items: CAMPUS_ITEMS,
    onSelect: (k) => {
      closeCard();
      dropOrg();
      goCampus(k);
    },
  });
  panel.setCurrent('all');

  let campusAt: CampusKey | null = null;
  function goCampus(k: CampusKey): void {
    exitCameraMode(false);
    const c = campusItem(k);
    model.setView({ mode: 'floor', focusFloor: c.focusFloor }); // ghosting follows the same tower floor
    syncStaff();
    rig.goToWing(c.level, c.focusFloor);
    panel.setCurrent((campusAt = k));
  }
  function goFloor(n: number): void {
    exitCameraMode(false);
    campusAt = null;
    model.setView({ mode: 'floor', focusFloor: n });
    syncStaff();
    rig.goToFloor(n);
    panel.setCurrent(n);
  }
  function goOverview(): void {
    exitCameraMode(false);
    campusAt = null;
    model.setView({ mode: 'overview', focusFloor: 0 });
    syncStaff();
    rig.goOverview();
    panel.setCurrent('all');
  }

  const keys = createKeyHandler({
    getState: () => ({ busy: rig.busy, cardOpen: card.isOpen(), mode: orgOn ? 'org' : rig.mode === 'org' ? 'overview' : rig.mode, camera: tour ? 'tour' : (camMode?.kind ?? null) }),
    exitCamera: () => (tour ? endTour() : exitCameraMode(true)),
    stepFollow: (d) => stepFollow(d),
    startTour: () => startTour(),
    goFloor: (n) => {
      dropOrg();
      goFloor(n);
    },
    toggleOrg: () => (orgOn ? exitOrg() : enterOrg()),
    exitOrg,
    closeCard,
    cycleCampus: () => goCampus(nextCampus(campusAt)),
    orgEnabled: true,
  });
  window.addEventListener('keydown', (e) => keys.handle(e));

  // ---- day / night (REQ-18); the former toolbar lives in the corner settings menu ----
  const dayNight = createDayNight();
  const dnControl = createDayNightControl(dayNight);
  // Rev 35: runtime quality switch (src/app/quality.ts); job limit and whiteboard size follow the start tier.
  const onQuality: OnQuality = (tier) => {
    applyQuality(qualityCtx, tier);
    resize();
  };
  // Rev 35 P3: live office clock on the simulation clock (src/sim/schedule.ts).
  // ---- Rev 43 C: Şirket nabzı, Olay akışı, Gün hızı, Ekran görüntüsü ----
  const pulse = createPulse();
  const feedModel = createFeedModel();
  const unitById = new Map(data.units.map((u) => [u.id, u]));
  const pad2 = (n: number): string => String(n).padStart(2, '0');
  const officeHm = (): string => {
    const n = office.now();
    return `${pad2(n.hh)}:${pad2(n.mm)}`;
  };
  /** A feed event: zoom to its robot (selection flow), else ride to the job's floor. */
  const goToEvent = (item: FeedItem, opener: HTMLButtonElement): void => {
    const fromMenu = settings.panel.contains(opener);
    settings.close(false);
    const u = item.unit ? unitById.get(item.unit) : undefined;
    if (u) {
      exitCameraMode(false);
      flow.select(u, fromMenu ? settings.button : opener, { fromOrg: orgOn });
      return;
    }
    const floor = runtime.workflow.stripFloor(item.job);
    if (floor !== null) rideToFloor({ cardOpen: () => card.isOpen(), closeCard: () => closeCard(), orgOn: () => orgOn, leaveOrg: () => dropOrg(), goFloor: (f) => goFloor(f) }, floor);
  };
  const feed = createEventFeed({ onActivate: goToEvent, enabled: readStoredFeed() });
  const pulseSection = createPulseSection({ feedToggle: feed.toggle, onEvent: goToEvent });
  feed.onChange((recent) => pulseSection.setEvents(recent));
  function onLiveEvents(events: readonly WfEvent[]): void {
    if (!events.length) return;
    pulse.ingest(events);
    feed.push(feedModel.ingest(events, officeHm()));
  }
  const places: Place[] = [];
  const refreshPulse = (): void => {
    places.length = 0;
    for (const r of model.robots) {
      const v = director?.view(r.unit.id);
      const floor = v ? v.floor : r.unit.floor;
      const x = v ? v.x : sim.get(r.unit.id).x;
      places.push(placeOf(floor, x < -HALF_WIDTH, data.floors.find((f) => f.id === floor)?.nameTr ?? `${tr.floorShort} ${floor}`));
    }
    const c = pulse.counts();
    pulseSection.update({
      ...c,
      jobsActive: runtime.workflow.jobs().filter((j) => !j.done).length,
      busiest: pulse.busiest(places),
      officeTime: officeHm(),
      simSeconds: runtime.clock.time,
    });
  };
  const daySpeed = createDaySpeedControl({ current: runtime.speed(), onSpeed: (n) => runtime.setSpeed(n) });
  const lunch = createLunchButton({
    onJump: () => {
      const d = officeTime.jumpTo(LUNCH_AT, { skipIf: 'lunch' });
      officeSection.refresh();
      return d > 0 ? 'jumped' : 'already';
    },
  });
  const screenshot = createScreenshotButton({
    capture: () => {
      renderer.render(scene, camera); // same task as the read: no preserveDrawingBuffer needed
      return flattenOnPage(canvas).toDataURL('image/png'); // opaque: the sky gradient is CSS, not in the canvas
    },
  });
  const viewExtras = el('div', { class: 'view-extras' });
  viewExtras.append(dnControl.element, screenshot.element);

  // Rev 43 "Tanıtım turu": the start button joins the "Ofis" controls (no new tab); `?film=1` records without UI.
  const tourOpts = tourParams(window.location.search);
  const tourUi = createTourUi({ onStart: () => startTour(), onEnd: () => endTour(), film: tourOpts.film });
  const breakButtons = createBreakButtons({ override: breakOverride, paused: () => runtime.clock.paused });
  const officeSection = createOfficeSection({ controls: [runtime.pauseButton, orgBtn, daySpeed.element, lunch.element, breakButtons.section, tourUi.startButton], schedule: office });
  const settings = createSettingsMenu({
    sections: [
      createAppearanceSection({ dayNight: viewExtras, current: currentTier, onQuality }),
      createActiveJobsSection({ strip: runtime.strip.element }),
      { ...pulseSection, onShow: refreshPulse },
      officeSection,
      createScenarioSection({ seed: MASTER_SEED, laneWeights: scenarios.laneWeights, quality: quality.quality, maxJobs: { low: maxJobsFor('low'), high: maxJobsFor('high') } }),
      createAccessibilitySection({ keys }),
    ],
    // Rev 38: on phones the open settings sheet is a bottom inset for floor / wing framing.
    onToggle: (on) => frameAboveSheet(on),
  });
  runtime.strip.onCount((n) => settings.setBadge(n));
  const toolbar = settings.element; // org framing keeps the name pills clear of the corner button

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
    onChange: (on) => {
      staff?.setReducedMotion(on);
      roomLife.setReducedMotion(on);
      model.city?.setReducedMotion(on);
      dnControl.refresh();
    },
  });
  staff?.setReducedMotion(motion.active());
  roomLife.setReducedMotion(motion.active());
  model.city?.setReducedMotion(motion.active());
  syncStaff();

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
  const labelHeights = new WeakMap<HTMLElement, number>();
  /** Label size, measured once after its first show. */
  const widthOf = (e: HTMLElement): number => {
    let w = labelWidths.get(e);
    if (w === undefined) {
      w = e.offsetWidth || 90;
      labelWidths.set(e, w);
    }
    return w;
  };
  const heightOf = (e: HTMLElement): number => {
    let h = labelHeights.get(e);
    if (h === undefined) {
      h = e.offsetHeight || 21;
      labelHeights.set(e, h);
    }
    return h;
  };
  // Rev 38 de-clutter state, allocated once (no per-frame allocation in the label pass).
  const PILL_H = 22;
  const clutter = createDeclutter(model.robots.length, roomEls.length);
  const robotIndex = new Map<string, number>(model.robots.map((r, i) => [r.unit.id, i]));
  const pillX = new Float32Array(model.robots.length);
  const pillY = new Float32Array(model.robots.length);
  const pillLift = new Float32Array(model.robots.length);
  const pillFade = new Uint8Array(model.robots.length);
  const pillOn = new Uint8Array(model.robots.length);
  const pillSlot = new Int16Array(model.robots.length);
  const highlighted = new Set<string>();
  const labelShown = new Set<string>();
  let frameNo = 0;
  const robotEls = new Map<string, HTMLElement>(
    model.robots.map((r) => [r.unit.id, pill('robot-label', accentCss(r.floor), r.unit.nameTr, tr.tiers[r.unit.tier])]),
  );
  const fpsEl = el('div', { class: 'fps' }, '');
  fpsEl.hidden = !params.debug;
  // Tab order: settings button, floor panel, then the rest. Rev 35: the strip lives in the settings menu.
  // ---- camera modes (KARARLAR Rev 42): "Ajan gözü" follow and "Gezinti" walk ----
  type CamMode = { kind: 'follow'; id: string; follower: Follower; scale: number } | { kind: 'walk'; walker: Walker };
  let camMode: CamMode | null = null;
  /** The view to return to when the mode ends. */
  let camPrev: { view: ViewState; campus: CampusKey | null } | null = null;
  const walkKeys = new Set<string>();
  const NEAR = camera.near;
  const graphs = new Map<number, CampusGraph>();
  const graphFor = (level: number): CampusGraph | null => {
    const layout = model.layouts[level];
    if (!layout) return null;
    let g = graphs.get(level);
    if (!g) graphs.set(level, (g = buildCampusGraph(layout)));
    return g;
  };
  const floorName = (n: number): string => `${tr.floorShort} ${n} · ${data.floors.find((f) => f.id === n)?.nameTr ?? ''}`;
  /** Walkable level of the current floor view (tower floor or wing level 0-2; not the roof garden), or null. */
  const walkLevel = (): number | null => {
    if (orgOn || model.view.mode !== 'floor') return null;
    if (campusAt) {
      const c = campusItem(campusAt);
      return WING_LEVELS.includes(c.level) ? c.level : null;
    }
    return model.view.focusFloor;
  };
  const walkPlace = (): string => (campusAt ? campusItem(campusAt).label : floorName(model.view.focusFloor));
  const modeUi = createCameraModeUi({
    onWalk: () => startWalk(),
    onExit: () => exitCameraMode(true),
    onStep: (d) => stepFollow(d),
    onPick: (id) => switchFollow(id),
    touch: coarse,
  });
  // Rev 43: "Ajan gözü" switching order (home floor, then id) and the picker list (floor the robot is on now).
  const followIds = followOrder(model.robots.map((r) => ({ id: r.unit.id, floor: r.floor })));
  const followList = (current: string): FollowList => ({
    current,
    agents: followIds.flatMap((id) => {
      const r = robotById.get(id);
      return r ? [{ id, name: r.unit.nameTr, floor: `${tr.floorShort} ${floorOf(r)}` }] : [];
    }),
  });
  let followListAt = 0;
  /** Stop any rig move: the mode drives the camera directly from now on. */
  const holdRig = (): void => {
    rig.run([]);
    rig.doors = 'open';
  };
  const rememberView = (): void => {
    if (!camMode) camPrev = { view: { ...model.view }, campus: campusAt };
  };
  function startFollow(u: Unit): void {
    if (!robotById.has(u.id)) return;
    closeCard(); // releases the selection; its return-to-floor move is replaced below
    if (orgOn) dropOrg();
    rememberView();
    holdRig();
    camMode = { kind: 'follow', id: u.id, follower: createFollower(camera.position, controls.target), scale: tierStyle(u.tier).scale };
    walkKeys.clear();
    hoverId = null;
    modeUi.showFollow(u.nameTr, followList(u.id));
  }
  /** Rev 43: follow another robot; the same follower eases over (cuts with reduced motion). */
  function switchFollow(id: string): void {
    const r = robotById.get(id);
    if (camMode?.kind !== 'follow' || !r || camMode.id === id) return;
    camMode = { ...camMode, id, scale: tierStyle(r.unit.tier).scale };
    modeUi.updateFollow(r.unit.nameTr, followList(id));
  }
  function stepFollow(dir: 1 | -1): void {
    if (camMode?.kind !== 'follow') return;
    const next = cycleFollow(followIds, camMode.id, dir);
    if (next) switchFollow(next);
  }
  ctx.hooks.onFollow = (u) => startFollow(u);
  function startWalk(): void {
    const level = walkLevel();
    if (camMode || level === null) return;
    const g = graphFor(level);
    if (!g) return;
    const place = walkPlace();
    closeCard();
    rememberView();
    holdRig();
    const t = controls.target;
    const yaw = Math.atan2(t.x - camera.position.x, t.z - camera.position.z);
    camMode = { kind: 'walk', walker: createWalker({ graph: g, footprints: g.layout.footprints, floor: level, start: { x: t.x, z: t.z }, yaw }) };
    walkKeys.clear();
    camera.near = 0.05; // eye height next to low partitions
    camera.updateProjectionMatrix();
    hoverId = null;
    modeUi.showWalk(place);
  }
  /** Leave follow / walk back to the remembered view (a move, or a cut with reduced motion). */
  function exitCameraMode(focus: boolean): void {
    const was = camMode;
    if (!was) return;
    camMode = null;
    walkKeys.clear();
    camera.near = NEAR;
    camera.updateProjectionMatrix();
    modeUi.hide();
    // The rig starts from where the mode left the camera.
    rig.position.copy(camera.position);
    rig.target.copy(controls.target);
    rig.fov = camera.fov;
    const prev = camPrev;
    camPrev = null;
    if (prev && prev.view.mode === 'floor' && rig.mode === 'floor') {
      campusAt = prev.campus;
      model.setView(prev.view);
      syncStaff();
      rig.returnToFloor();
      panel.setCurrent(prev.campus ?? prev.view.focusFloor);
    } else {
      campusAt = null;
      model.setView({ mode: 'overview', focusFloor: 0 });
      syncStaff();
      rig.goOverview();
      panel.setCurrent('all');
    }
    refreshWalkOffer();
    if (!focus) return;
    if (was.kind === 'walk' && !modeUi.walkButton.hidden) modeUi.walkButton.focus();
    else canvas.focus();
  }
  let walkOffer = '-';
  /** "İçeride gez" follows the view (floor views only, not org, not while a mode runs). */
  function refreshWalkOffer(): void {
    const level = camMode ? null : walkLevel();
    const k = level === null ? '' : `${level}|${walkPlace()}`;
    if (k === walkOffer) return;
    walkOffer = k;
    modeUi.setWalkAvailable(level !== null, level === null ? undefined : walkPlace());
  }
  const normKey = (k: string): string => (k.length === 1 ? k.toLowerCase() : k);
  window.addEventListener('keydown', (e) => {
    if (camMode?.kind !== 'walk' || e.ctrlKey || e.altKey || e.metaKey || !isWalkKey(e.key)) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    walkKeys.add(normKey(e.key));
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => walkKeys.delete(normKey(e.key)));
  window.addEventListener('blur', () => walkKeys.clear());
  const walkPlane = new Plane(new Vector3(0, 1, 0), 0);
  const walkHit = new Vector3();
  const walkNdc = new Vector2();
  /** Floor point under the pointer on the walked level, or null. */
  const floorPointAt = (clientX: number, clientY: number, level: number): { x: number; z: number } | null => {
    const r = canvas.getBoundingClientRect();
    walkNdc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const dir = new Vector3(walkNdc.x, walkNdc.y, 0.5).unproject(camera).sub(origin).normalize();
    walkPlane.constant = -floorY(level);
    const hit = new Ray(origin, dir).intersectPlane(walkPlane, walkHit);
    return hit ? { x: hit.x, z: hit.z } : null;
  };
  /** Applies the active mode to the camera for this frame. */
  function frameCameraMode(dt: number, still: boolean): void {
    const m = camMode;
    if (!m) return;
    let pose: { pos: Vector3; target: Vector3 };
    let fov: number;
    if (m.kind === 'follow') {
      const r = robotById.get(m.id);
      if (!r) {
        exitCameraMode(true);
        return;
      }
      // Follow across floors (elevator): the view ghosts the floor the robot is on now.
      const f = floorOf(r);
      if (model.view.mode !== 'floor' || model.view.focusFloor !== f) {
        model.setView({ mode: 'floor', focusFloor: f });
        syncStaff();
        panel.setCurrent(f);
      }
      pose = m.follower.update(r.group.position, r.group.rotation.y, dt, still, m.scale, followBounds(r.group.position));
      fov = FOLLOW_FOV;
      // The picker names the floor each robot is on now (refreshed once a second, not while it is in use).
      followListAt += dt;
      if (followListAt >= 1 && document.activeElement?.tagName !== 'SELECT') {
        followListAt = 0;
        modeUi.updateFollow(r.unit.nameTr, followList(m.id));
      }
    } else {
      m.walker.update(dt, walkInputFromKeys(walkKeys), still);
      pose = m.walker.pose();
      fov = WALK_FOV;
    }
    controls.enabled = false;
    camera.position.copy(pose.pos);
    controls.target.copy(pose.target);
    camera.lookAt(pose.target);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  // ---- "Tanıtım turu" (KARARLAR Rev 43): a cinematic camera tour; only Esc / "Turu bitir" while it runs ----
  let tour: { player: TourPlayer; follow: { id: string; follower: Follower; scale: number } | null; golden: number } | null = null;
  const tourEnded: (() => void)[] = [];
  /** A robot at work on the engineering floor for the follow shot (not on a break), else the first robot. */
  const workingRobot = (): RobotEntry | null => {
    const ids = followIds.filter((id) => {
      const r = robotById.get(id);
      return !!r && floorOf(r) === 1 && !sim.onBreak(id);
    });
    const id = ids[0] ?? followIds[0];
    return id ? (robotById.get(id) ?? null) : null;
  };
  function startTour(): void {
    if (tour) return;
    exitCameraMode(false);
    closeCard();
    if (orgOn) dropOrg();
    if (settings.isOpen()) settings.close(false);
    holdRig();
    hoverId = null;
    tour = { player: createTourPlayer(tourPlan(), motion.active()), follow: null, golden: 0 };
    tourUi.show();
  }
  /** Ends the tour (finished, Esc or "Turu bitir"): the overview, from wherever the camera is now. */
  function endTour(): void {
    if (!tour) return;
    tour.player.stop();
    tour = null;
    tourUi.hide();
    controls.enabled = true;
    rig.position.copy(camera.position);
    rig.target.copy(controls.target);
    rig.fov = camera.fov;
    campusAt = null;
    model.setView({ mode: 'overview', focusFloor: 0 });
    syncStaff();
    rig.goOverview();
    panel.setCurrent('all');
    refreshWalkOffer();
    canvas.focus();
    for (const cb of tourEnded) cb();
  }
  const tourView = (focusFloor: number, campus: CampusKey | null): void => {
    campusAt = campus;
    model.setView({ mode: 'floor', focusFloor });
    syncStaff();
    panel.setCurrent(campus ?? focusFloor);
  };
  function frameTour(dt: number, still: boolean): void {
    const t = tour;
    if (!t) return;
    const f = t.player.update(dt, { pos: camera.position, target: controls.target, fov: camera.fov });
    t.golden = f.golden;
    const seg = f.segment;
    if (f.entered) {
      t.follow = null;
      if (seg.kind === 'follow') {
        const r = workingRobot();
        if (r) t.follow = { id: r.unit.id, follower: createFollower(camera.position, controls.target), scale: tierStyle(r.unit.tier).scale };
      } else if (seg.view === null) {
        campusAt = null;
        model.setView({ mode: 'overview', focusFloor: 0 });
        syncStaff();
        panel.setCurrent('all');
      } else if ('campus' in seg.view) tourView(campusItem(seg.view.campus).focusFloor, seg.view.campus);
      else tourView(seg.view.floor, null);
    }
    let pose = f.pose;
    let fov = pose?.fov ?? camera.fov;
    const fr = t.follow ? robotById.get(t.follow.id) : undefined;
    if (!pose && t.follow && fr) {
      const fl = floorOf(fr);
      if (model.view.mode !== 'floor' || model.view.focusFloor !== fl || campusAt) tourView(fl, null);
      const p = t.follow.follower.update(fr.group.position, fr.group.rotation.y, dt, still, t.follow.scale, followBounds(fr.group.position));
      pose = { pos: p.pos, target: p.target, fov: FOLLOW_FOV };
      fov = FOLLOW_FOV;
    }
    controls.enabled = false;
    if (pose) {
      camera.position.copy(pose.pos);
      controls.target.copy(pose.target);
      camera.lookAt(pose.target);
    }
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (t.player.done) endTour();
  }
  // Recording hook: `?tour=1` / `?film=1` only; `?film=1` hides all UI and starts after 3 s.
  installTourHook(window, { start: () => startTour(), onEnd: (cb) => tourEnded.push(cb) }, tourOpts);
  if (tourOpts.film) window.setTimeout(() => startTour(), 3000);

  const rail = mountHud(root, { menu: toolbar, panel: panel.element, legend });
  rail.append(modeUi.walkButton, breakButtons.screen);
  root.append(unitList.element, labels, fpsEl, modeUi.bar, feed.element, tourUi.exitButton);

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
    return pickRobot(model, new Ray(origin, dir), floorOf);
  };
  let dragAt: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    dragAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    // Walk mode: drag (mouse or finger) looks around.
    if (camMode?.kind !== 'walk' || !e.buttons || !dragAt) return;
    camMode.walker.look(e.clientX - dragAt.x, e.clientY - dragAt.y);
    dragAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    dragAt = null;
    if (!down) return;
    const kind = classifyPointer(down, { x: e.clientX, y: e.clientY });
    down = null;
    if (kind !== 'click' || tour) return;
    if (camMode) {
      // Walk: a click / tap on the floor walks there along the graph. Follow: the scene is not pickable.
      if (camMode.kind === 'walk') {
        const p = floorPointAt(e.clientX, e.clientY, camMode.walker.floor);
        if (p) camMode.walker.walkTo(p, motion.active());
      }
      return;
    }
    // Overview: a floor label in the column beside the tower zooms to its floor (KARARLAR Rev 42).
    if (model.view.mode === 'overview' && !orgOn) {
      const r = canvas.getBoundingClientRect();
      const f = floorLabelAt(floorRects, floorColFloors, e.clientX - r.left, e.clientY - r.top);
      if (f !== null) {
        closeCard();
        goFloor(f);
        return;
      }
    }
    const hit = pick(e.clientX, e.clientY);
    if (hit) flow.select(hit.unit, canvas, { fromOrg: orgOn });
  });
  let hoverPending = false;
  let hoverLabel = false;
  canvas.addEventListener('pointermove', (e) => {
    if (hoverPending || e.buttons || camMode || tour) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      if (camMode) return;
      hoverId = pick(e.clientX, e.clientY)?.unit.id ?? null;
      const r = canvas.getBoundingClientRect();
      hoverLabel = model.view.mode === 'overview' && !orgOn && floorLabelAt(floorRects, floorColFloors, e.clientX - r.left, e.clientY - r.top) !== null;
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

  /** Rev 38: fit the floor / wing view above the phone settings sheet while it is open, and back on close. */
  function frameAboveSheet(open: boolean): void {
    const h = Math.max(1, root.clientHeight || window.innerHeight);
    const narrow = narrowMq?.matches ?? false;
    const sheet = open && narrow ? settings.panel.getBoundingClientRect().height : 0;
    setSheetInset(sheet > 0 ? (sheet + 8) / h : 0);
    if (narrow && rig.mode === 'floor' && !flow.selectedId() && !orgOn) rig.returnToFloor();
  }

  /** Expected card sheet share on phones (CSS max 60vh; most cards are shorter). */
  const ZOOM_SHEET_PHONE = 0.5;
  // ---- resize ----
  const resize = (): void => {
    const w = Math.max(1, root.clientWidth || window.innerWidth);
    const h = Math.max(1, root.clientHeight || window.innerHeight);
    fitAspect();
    measureInsets();
    // Rev 38: the robot card is a bottom sheet on phones (up to 60 % of the height): the close-up sits above it.
    setZoomSheetInset(narrowMq?.matches ? ZOOM_SHEET_PHONE : 0);
    if (orgOn) measureOrgInsets();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  // The overview fits the campus right of the measured floor panel (or below the phone strip): re-frame the boot
  // camera now that the panel has been measured.
  applyInitialCamera(rig, camera, controls);

  // ---- per-frame ----
  const bubbleEls: HTMLElement[] = [];
  // Overview floor label column (rebuilt every frame) and the rects bubbles must keep clear of.
  const floorCol: FloorColumnItem[] = [];
  const floorColEls: HTMLElement[] = [];
  /** Floor of each overview column label, parallel to floorColEls / floorRects (label click, Rev 42). */
  const floorColFloors: number[] = [];
  let floorRects: ScreenRect[] = [];
  const colAnchor = new Vector3();
  const fps = createFpsMeter();
  let last = 0;
  let wasBusy = false;
  let clock = 0;
  let lightsOn = 0;
  let lastSky = '';
  let officeTick = 0;

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

    // Simulation clock (≤ 100 ms steps, frozen by org / user / hidden), then on its dt: the ambient cycle and the
    // bubbles (onAmbient), the engine, the director and the strip.
    runtime.frame(dt * 1000);
    syncStaffCabinFrom(runtime.workflow.movement, model.staffCabin);
    boardTex?.render(board.state(runtime.workflow, motion.active()));
    staffRt?.frame(dt); // staff NPCs: paused with the clock's global reasons (org / user / hidden)
    if (!runtime.clock.paused) model.city?.step(dt); // city life: same global pause reasons
    frameRoomLife(roomLife, runtime.clock, dt, office.minutes()); // room life: office clock, same pause reasons
    const selected = flow.selectedId();
    const still = motion.active();
    actions.begin(sim, still, orgOn, staff?.drainEvents() ?? []);
    for (const r of model.robots) {
      if (r.unit.id === selected) sim.faceToward(r.unit.id, camera.position.x, camera.position.z);
      const dv = director ? director.view(r.unit.id) : null;
      const v = dv ?? ambientView(sim.get(r.unit.id));
      const act = actions.get(r.unit.id); // Rev 43 B: object activity (render overlay), null = as before
      r.group.position.set(v.x + (act?.dx ?? 0), v.y + (act?.dy ?? 0), v.z + (act?.dz ?? 0));
      r.group.rotation.y = act ? act.facing : v.facing;
      // A robot on a campus break shows its amenity pose (the director reports the ambient kind).
      const breakPose = sim.isReserved(r.unit.id) ? undefined : sim.get(r.unit.id).pose;
      const fp = act ? { kind: act.pose, walkPhase: act.walkPhase, timeSec: act.timeSec } : framePose(orgOn, breakPose ?? v.pose, v.walkPhase, clock, still, r.unit.id.length);
      applyPose(r.parts, fp.kind, fp.walkPhase, fp.timeSec);
      actions.attach(r, act);
      r.screen.scrolling = v.screenScroll;
      r.screen.update(dt);
      if (dv) {
        floorNow.set(r.unit.id, dv.floor);
        props.robot(r.unit.id, dv, model.view, orgOn); // marker, stamp, current-floor visibility (R-5)
      }
    }
    actions.end();
    if (director) props.frame(director, model.view, orgOn);

    rig.update(dt);
    if (tour) frameTour(dt, still);
    else if (camMode) frameCameraMode(dt, still);
    else {
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
    }
    refreshWalkOffer();
    if (wasBusy && !rig.busy) keys.onIdle();
    wasBusy = rig.busy;
    model.cabin.setHeight(rig.cabinY - FLOOR_TARGET_Y + FLOOR_TOP);
    model.cabin.setDoorsOpen(rig.doorsOpenness);

    // Rev 38 de-clutter: zone / floor / room pills are fixed obstacles with priority; robot pills nudge up past
    // them or fade. A pass runs every DECLUTTER_EVERY frames; in between the pills reuse their lift / fade.
    const pass = declutterDue(frameNo++);
    if (pass) clutter.begin();
    floorCol.length = 0;
    floorColEls.length = 0;
    floorColFloors.length = 0;
    const columnOn = model.view.mode === 'overview';
    for (const { room, e } of roomEls) {
      const on = !orgOn && roomLabelVisible(room, model.view) && !(selected && room.floor === model.view.focusFloor && !room.primary);
      if (!on) {
        show(e, false);
        continue;
      }
      if (columnOn && room.primary) {
        // Overview: the floor labels go to one column beside the tower (placed below), not over the facade.
        const mid = room.floor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
        const pe = project(colAnchor.set(STAFF_SHAFT.x + 0.9, mid, HALF_DEPTH));
        const pw = project(colAnchor.set(SHAFT_X - 0.9, mid, HALF_DEPTH));
        if (!pe.visible || !pw.visible) {
          show(e, false);
          continue;
        }
        if (e.hidden) e.hidden = false; // measured shown (widthOf caches its first reading); placed below this frame
        floorCol.push({ east: pe.x, west: pw.x, y: (pe.y + pw.y) / 2, w: widthOf(e), h: heightOf(e) });
        floorColEls.push(e);
        floorColFloors.push(room.floor);
        continue;
      }
      const p = project(room.position);
      show(e, p.visible, p.x, p.y);
      if (pass && p.visible) clutter.addFixed(p.x, p.y, widthOf(e), heightOf(e));
    }
    floorRects = floorLabelColumn(floorCol, canvas.getBoundingClientRect().width);
    floorRects.forEach((r, k) => {
      const e = floorColEls[k]!;
      const x = (r.x0 + r.x1) / 2;
      show(e, true, x, r.y1);
      if (pass) clutter.addFixed(x, r.y1, r.x1 - r.x0, r.y1 - r.y0);
    });

    // robot name pills: every robot of the focused floor in floor view; hovered / focused / selected otherwise
    highlighted.clear();
    if (selected) highlighted.add(selected);
    if (focusId) highlighted.add(focusId);
    if (hoverId) highlighted.add(hoverId);
    labelShown.clear();
    for (let i = 0; i < model.robots.length; i++) {
      const r = model.robots[i]!;
      pillOn[i] = 0;
      const e = robotEls.get(r.unit.id);
      if (!e) continue;
      const on = orgOn || robotLabelVisible({ id: r.unit.id, floor: floorOf(r) }, model.view, highlighted);
      const p = on ? project(headPos(r)) : null;
      if (!p?.visible) {
        show(e, false);
        pillLift[i] = 0;
        pillFade[i] = 0;
        continue;
      }
      if (e.hidden) e.hidden = false;
      pillOn[i] = 1;
      pillX[i] = p.x;
      pillY[i] = p.y;
      const hot = highlighted.has(r.unit.id);
      if (pass) pillSlot[i] = clutter.addPill(p.x, p.y, widthOf(e), PILL_H, hot);
      labelShown.add(r.unit.id);
      e.classList.toggle('is-active', hot);
    }
    if (pass) {
      clutter.solve();
      for (let i = 0; i < model.robots.length; i++) {
        if (!pillOn[i]) continue;
        pillLift[i] = clutter.lift(pillSlot[i]!);
        pillFade[i] = clutter.fade(pillSlot[i]!) ? 1 : 0;
      }
    }
    for (let i = 0; i < model.robots.length; i++) {
      if (!pillOn[i]) continue;
      const e = robotEls.get(model.robots[i]!.unit.id);
      if (!e) continue;
      show(e, true, pillX[i]!, pillY[i]!, pillLift[i]!);
      e.classList.toggle('is-faded', pillFade[i] === 1);
    }

    // speech bubbles (above the name pill when one is shown)
    const active: readonly Bubble[] = activeBubbles;
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
      const lift = bubbleLift(labelShown.has(b.unitId), pillLift[robotIndex.get(b.unitId) ?? -1] ?? 0);
      // A bubble never covers an overview floor label.
      show(e, p.visible && !orgOn && bubbleVisible(floorOf(r), model.view) && !bubbleCovers(p.x, p.y - lift, bubbleSize(b.text), floorRects), p.x, p.y, lift);
    });
    const staffActive = staffRt?.bubbles(active.length) ?? [];
    staffActive.forEach((b, j) => {
      const i = active.length + j;
      let e = bubbleEls[i];
      if (!e) {
        e = el('div', { class: 'bubble' });
        e.hidden = true;
        labels.append(e);
        bubbleEls[i] = e;
      }
      const hp = staff?.headPosition(b.staffId);
      if (!hp) return;
      const p = project(hp);
      if (e.textContent !== b.text) e.textContent = b.text;
      show(e, p.visible && !orgOn && bubbleVisible(b.floor, model.view) && !bubbleCovers(p.x, p.y - 4, bubbleSize(b.text), floorRects), p.x, p.y, 4);
    });
    for (let i = active.length + staffActive.length; i < bubbleEls.length; i++) {
      const e = bubbleEls[i];
      if (e) e.hidden = true;
    }

    canvas.style.cursor = camMode?.kind === 'walk' ? 'grab' : hoverId || hoverLabel ? 'pointer' : '';
    // day / night: sky, sun, fill, window and floor-light glow (lights fade on over ~0.7 s, cut if reduced)
    dayNight.step(dt);
    // Rev 35 P3: in Otomatik the light follows the office clock (dark after hours); Gündüz / Gece hold.
    const base = sceneLight(dayNight, office);
    // Rev 43: the tour finale pulls back to the overview in golden-hour light.
    const golden = tour?.golden ?? 0;
    const isNight = golden > 0 ? false : base.isNight;
    const brightness = golden > 0 ? base.brightness + (GOLDEN_BRIGHTNESS - base.brightness) * golden : base.brightness;
    const lightsGoal = isNight ? 1 : 0;
    lightsOn = still ? lightsGoal : lightsOn + (lightsGoal - lightsOn) * Math.min(1, dt * 1.5);
    const L = lightingFor(brightness, lightsOn);
    sun.intensity = L.sun;
    sun.color.setHex(L.sunColor);
    hemi.intensity = L.hemi;
    hemi.color.setHex(L.hemiSky);
    hemi.groundColor.setHex(L.hemiGround);
    scene.environmentIntensity = L.env;
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
      document.documentElement.classList.toggle('is-night', brightness < 0.35);
    }
    interior.intensity = model.view.mode === 'floor' && !orgOn ? L.interior * 6 : 0;
    if (interior.intensity > 0) interior.position.set(0, model.view.focusFloor * FLOOR_HEIGHT + 2.2, -0.5);

    // Live office clock in the settings "Ofis" tab (4 refreshes per second of wall time).
    officeTick += dt;
    if (officeTick >= 0.25) {
      officeTick = 0;
      officeSection.refresh();
      breakButtons.refresh();
      // Rev 43 C1: break starts sampled 4× a second (stays last seconds); the Nabız figures refresh while open.
      pulse.sampleBreaks(model.robots.map((r) => [r.unit.id, sim.onBreak(r.unit.id) !== null || sim.get(r.unit.id).kind === 'coffee'] as const));
      if (settings.isOpen()) refreshPulse();
    }
    feed.tick(dt); // toast display time (wall seconds)

    placeSun();
    renderer.render(scene, camera);
    if (params.debug) fpsEl.textContent = `${fps.frame(now).toFixed(0)} fps · ${qualityCtx.tier ?? quality.quality}`;
  };

  const loop = createLoop({
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    doc: document,
    tick,
  });
  loop.start();
}
