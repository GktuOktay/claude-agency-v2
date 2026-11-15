// Render loop that does not run while the tab is hidden (REQ-15).
export interface LoopDeps {
  raf: (cb: (t: number) => void) => number;
  caf: (id: number) => void;
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
  tick: (nowMs: number) => void;
}

export interface Loop {
  start(): void;
  stop(): void;
  running(): boolean;
}

export function createLoop(deps: LoopDeps): Loop {
  let id: number | null = null;
  let wanted = false;

  const frame = (t: number): void => {
    id = null;
    if (!wanted || deps.doc.hidden) return;
    deps.tick(t);
    id = deps.raf(frame);
  };
  const schedule = (): void => {
    if (id === null && wanted && !deps.doc.hidden) id = deps.raf(frame);
  };
  const onVisibility = (): void => {
    if (deps.doc.hidden) {
      if (id !== null) deps.caf(id);
      id = null;
    } else {
      schedule();
    }
  };

  return {
    start() {
      if (wanted) return;
      wanted = true;
      deps.doc.addEventListener('visibilitychange', onVisibility);
      schedule();
    },
    stop() {
      wanted = false;
      deps.doc.removeEventListener('visibilitychange', onVisibility);
      if (id !== null) deps.caf(id);
      id = null;
    },
    running() {
      return id !== null;
    },
  };
}

export function createFpsMeter(): { frame(nowMs: number): number } {
  let windowStart = -1;
  let frames = 0;
  let fps = 0;
  return {
    frame(nowMs) {
      if (windowStart < 0) windowStart = nowMs;
      frames++;
      if (nowMs - windowStart >= 500) {
        fps = (frames * 1000) / (nowMs - windowStart);
        frames = 0;
        windowStart = nowMs;
      }
      return fps;
    },
  };
}
