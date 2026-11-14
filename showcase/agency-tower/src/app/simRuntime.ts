// Simulation runtime (spec 0002 T-7): one simulation clock (§7.8 reasons), the workflow engine on the
// timed movement stand-in, the job strip, the "Hareketi durdur" toggle and the card lines. DOM only;
// no WebGL, so it is unit-tested in jsdom. The director (T-6) will consume the drained events.
import { createTitleSequence } from '../data/jobTitles';
import type { ScenarioSet, UnitFloors } from '../data/scenarios';
import { tr } from '../i18n/tr';
import type { ActivityKind } from '../scene/activity';
import { createRng } from '../scene/rng';
import { createSimClock, pauseText, type SimClock } from '../sim/clock';
import { createWorkflow, MASTER_SEED, streamSeed, type WfEvent, type Workflow, type WorkflowOptions } from '../sim/workflow';
import { el } from '../ui/dom';
import { createJobStrip, type JobStrip } from '../ui/jobStrip';
import { cardLines, type CardLines } from '../ui/nowLine';

export interface SimRuntimeOptions {
  scenarios: ScenarioSet;
  units: UnitFloors;
  titles: readonly string[];
  maxJobs: number;
  seed?: number;
  isNarrow(): boolean;
  reducedMotion(): boolean;
  /** Ride to the §7.6b floor of an activated entry (card/org rules applied by the caller). */
  rideTo(floor: number): void;
  /** Display name for a unit id in the card now-line (Rev 31); defaults to the id. */
  unitName?: (id: string) => string;
  /** Extra engine options (tests). */
  workflow?: Partial<WorkflowOptions>;
  /** Receives the events drained every frame (T-6 director). */
  onEvents?: (events: WfEvent[]) => void;
}

export interface SimRuntime {
  clock: SimClock;
  workflow: Workflow;
  strip: JobStrip;
  pauseButton: HTMLButtonElement;
  /** One frame of `frameMs`; advances the clock (≤ 100 ms, 0 while paused), the engine and the strip. */
  frame(frameMs: number): void;
  setOrg(on: boolean): void;
  setHidden(on: boolean): void;
  select(unit: string): void;
  release(unit: string): void;
  /** Card lines for a robot, from its state now (call before the selection gesture starts). */
  cardLinesFor(unit: string, ambient: ActivityKind): CardLines;
}

export function createSimRuntime(o: SimRuntimeOptions): SimRuntime {
  const seed = o.seed ?? MASTER_SEED;
  const clock = createSimClock();
  const titles = createTitleSequence(o.titles, createRng(streamSeed(seed, 'titles')));
  const workflow = createWorkflow({
    scenarios: o.scenarios,
    units: o.units,
    maxJobs: o.maxJobs,
    seed,
    isSelected: (u) => clock.isSelected(u),
    titles: () => titles.next(),
    ...o.workflow,
  });

  const strip = createJobStrip({
    onActivate: (n) => {
      const floor = workflow.stripFloor(n);
      if (floor !== null) o.rideTo(floor);
    },
    isNarrow: o.isNarrow,
    expandByDefault: o.reducedMotion,
  });

  const pauseButton = el('button', { type: 'button', class: 'motion-toggle', 'aria-pressed': 'false' }, tr.motionPause);
  pauseButton.addEventListener('click', () => {
    const on = pauseButton.getAttribute('aria-pressed') !== 'true';
    clock.setReason('user', on);
    pauseButton.setAttribute('aria-pressed', String(on));
    pauseButton.textContent = on ? tr.motionResume : tr.motionPause;
    render();
  });

  function render(): void {
    strip.update(
      workflow.jobs().map((j) => ({
        n: j.n,
        lane: j.lane,
        title: j.title,
        label: j.label,
        loops: j.loops,
        done: j.done,
        pause: pauseText(clock, !j.done && j.pausedBySelection),
        steps: j.steps,
      })),
    );
  }

  return {
    clock,
    workflow,
    strip,
    pauseButton,
    frame(frameMs) {
      const dt = clock.tick(frameMs);
      if (dt > 0) workflow.step(dt);
      const events = workflow.drainEvents();
      if (events.length) o.onEvents?.(events);
      render();
    },
    setOrg: (on) => clock.setReason('org', on),
    setHidden: (on) => clock.setReason('hidden', on),
    select: (u) => clock.select(u),
    release: (u) => clock.release(u),
    cardLinesFor(unit, ambient) {
      const st = workflow.unitState(unit);
      const job = st ? workflow.jobs().find((j) => j.n === st.job) : undefined;
      return cardLines(st, ambient, job ? { n: job.n, title: job.title, lane: job.lane } : null, workflow.movement.floorOf(unit), o.unitName);
    },
  };
}
