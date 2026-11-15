// Single-key shortcuts (REQ-14, §4 key-by-state matrix). `K` cycles the campus wing levels (Rev 31 UI pass).
export interface KeyState {
  busy: boolean; // a ride or camera move is in progress
  cardOpen: boolean;
  mode: 'overview' | 'floor' | 'org';
  /** KARARLAR Rev 42: an active camera mode; only Esc (leave it) is handled while one runs (Rev 43: plus Tab in
   *  follow, and the tour). */
  camera?: 'follow' | 'walk' | 'tour' | null;
}

export interface KeyDeps {
  getState(): KeyState;
  goFloor(n: number): void;
  toggleOrg(): void;
  exitOrg(): void;
  closeCard(): void;
  /** `K`: next campus area (wing level / roof garden); absent = key unused. */
  cycleCampus?(): void;
  /** Esc in a camera mode (follow / walk): back to the previous camera. */
  exitCamera?(): void;
  /** Rev 43, Tab / Shift+Tab in follow: the next (+1) / previous (-1) robot. */
  stepFollow?(dir: 1 | -1): void;
  /** Rev 43, `T`: start the "Tanıtım turu" camera tour; absent = key unused. */
  startTour?(): void;
  orgEnabled: boolean;
}

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  /** Rev 43: Tab in follow mode replaces the browser's focus move. */
  preventDefault?(): void;
}

type Request = { kind: 'floor'; n: number } | { kind: 'org' } | { kind: 'campus' } | { kind: 'tour' };

function isTextField(t: EventTarget | null): boolean {
  if (!t || typeof (t as Element).tagName !== 'string') return false;
  const el = t as HTMLElement;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}

export interface KeyHandler {
  handle(e: KeyEventLike): void;
  onIdle(): void;
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
}

export function createKeyHandler(deps: KeyDeps): KeyHandler {
  let enabled = true;
  let queued: Request | null = null;

  const apply = (req: Request): void => {
    const s = deps.getState();
    if (req.kind === 'floor') {
      if (s.cardOpen) deps.closeCard();
      if (s.mode === 'org') deps.exitOrg();
      deps.goFloor(req.n);
    } else if (req.kind === 'campus') {
      if (s.cardOpen) deps.closeCard();
      if (s.mode === 'org') deps.exitOrg();
      deps.cycleCampus?.();
    } else if (req.kind === 'tour') {
      if (s.cardOpen) deps.closeCard();
      if (s.mode === 'org') deps.exitOrg();
      deps.startTour?.();
    } else {
      if (!deps.orgEnabled) return;
      if (s.cardOpen) deps.closeCard();
      if (s.mode === 'org') deps.exitOrg();
      else deps.toggleOrg();
    }
  };

  return {
    setEnabled(on) {
      enabled = on;
      if (!on) queued = null;
    },
    isEnabled: () => enabled,
    onIdle() {
      const q = queued;
      queued = null;
      if (q) apply(q);
    },
    handle(e) {
      if (!enabled || e.ctrlKey || e.altKey || e.metaKey || isTextField(e.target)) return;
      const s = deps.getState();
      if (e.key === 'Tab' && s.camera === 'follow' && deps.stepFollow) {
        e.preventDefault?.();
        deps.stepFollow(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.shiftKey) return;
      if (s.camera) {
        if (e.key === 'Escape') deps.exitCamera?.();
        return;
      }
      let req: Request | null = null;
      if (/^[0-5]$/.test(e.key)) req = { kind: 'floor', n: Number(e.key) };
      else if (e.key === 'o' || e.key === 'O') req = deps.orgEnabled ? { kind: 'org' } : null;
      else if (e.key === 'k' || e.key === 'K') req = deps.cycleCampus ? { kind: 'campus' } : null;
      else if (e.key === 't' || e.key === 'T') req = deps.startTour ? { kind: 'tour' } : null;
      else if (e.key === 'Escape') {
        if (s.busy) return;
        if (s.cardOpen) deps.closeCard();
        else if (s.mode === 'org') deps.exitOrg();
        return;
      }
      if (!req) return;
      if (s.busy) {
        queued = req;
        return;
      }
      apply(req);
    },
  };
}
