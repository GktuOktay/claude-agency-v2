// Single-key shortcuts (REQ-14, §4 key-by-state matrix).
export interface KeyState {
  busy: boolean; // a ride or camera move is in progress
  cardOpen: boolean;
  mode: 'overview' | 'floor' | 'org';
}

export interface KeyDeps {
  getState(): KeyState;
  goFloor(n: number): void;
  toggleOrg(): void;
  exitOrg(): void;
  closeCard(): void;
  orgEnabled: boolean;
}

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

type Request = { kind: 'floor'; n: number } | { kind: 'org' };

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
      if (!enabled || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || isTextField(e.target)) return;
      const s = deps.getState();
      let req: Request | null = null;
      if (/^[0-5]$/.test(e.key)) req = { kind: 'floor', n: Number(e.key) };
      else if (e.key === 'o' || e.key === 'O') req = deps.orgEnabled ? { kind: 'org' } : null;
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
