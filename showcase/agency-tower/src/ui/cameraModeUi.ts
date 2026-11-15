// KARARLAR Rev 42 camera modes, DOM part: the "İçeride gez" entry (floor views) and the mode bar with its
// always-visible exit button ("Takibi bırak" / "Çık"). Rev 43: in "Ajan gözü" the bar also switches robots
// (◀ ▶ and a compact picker). Text only, no HTML from data.
import { tr } from '../i18n/tr';
import { el } from './dom';

export interface CameraModeUiOptions {
  onWalk(): void;
  onExit(): void;
  /** Rev 43: ◀ (-1) / ▶ (+1) in follow mode; absent = no switching controls. */
  onStep?(dir: 1 | -1): void;
  /** Rev 43: a robot chosen in the picker. */
  onPick?(id: string): void;
  /** Coarse pointer: the walk hint names touch gestures. */
  touch: boolean;
}

/** One picker entry: the robot's Turkish name and the floor it is on now. */
export interface FollowAgent {
  id: string;
  name: string;
  floor: string;
}

export interface FollowList {
  agents: readonly FollowAgent[];
  current: string;
}

export interface CameraModeUi {
  walkButton: HTMLButtonElement;
  bar: HTMLElement;
  /** Offer "İçeride gez" (a floor view where walking is possible), naming the place in the accessible name. */
  setWalkAvailable(on: boolean, place?: string): void;
  showFollow(name: string, list?: FollowList): void;
  /** Rev 43: another robot is followed now; title and picker update, focus stays where it is. */
  updateFollow(name: string, list?: FollowList): void;
  showWalk(place: string): void;
  hide(): void;
}

export function createCameraModeUi(o: CameraModeUiOptions): CameraModeUi {
  const walkButton = el('button', { type: 'button', class: 'walk-enter', 'aria-label': tr.camera.walk }, tr.camera.walk);
  walkButton.hidden = true;
  walkButton.addEventListener('click', () => o.onWalk());

  const bar = el('div', { class: 'camera-mode', role: 'group', 'aria-label': tr.camera.walk });
  const status = el('p', { class: 'camera-mode-title', role: 'status' });
  const hint = el('p', { class: 'camera-mode-hint' });
  const exit = el('button', { type: 'button', class: 'camera-mode-exit' });
  exit.addEventListener('click', () => o.onExit());
  const text = el('div', { class: 'camera-mode-text' });
  text.append(status, hint);

  const prev = el('button', { type: 'button', class: 'camera-mode-step', 'aria-label': tr.camera.prevAgent }, '◀');
  const next = el('button', { type: 'button', class: 'camera-mode-step', 'aria-label': tr.camera.nextAgent }, '▶');
  prev.addEventListener('click', () => o.onStep?.(-1));
  next.addEventListener('click', () => o.onStep?.(1));
  const pick = el('select', { class: 'camera-mode-pick', 'aria-label': tr.camera.pickAgent });
  pick.addEventListener('change', () => o.onPick?.(pick.value));
  // Second row: ◀ [picker] ▶. After the exit button in the DOM, so Esc's twin stays the first stop.
  const row = el('div', { class: 'camera-mode-switch' });
  row.append(prev, pick, next);
  const switching = [row, prev, pick, next];
  for (const c of switching) c.hidden = true;
  bar.append(text, exit, row);
  bar.hidden = true;

  let available = false;
  let active = false;
  let listKey = '';
  const root = document.documentElement;

  const setList = (list: FollowList | undefined): void => {
    const on = !!list && list.agents.length > 1 && !!(o.onStep || o.onPick);
    for (const c of switching) c.hidden = !on;
    if (!list || !on) return;
    const key = list.agents.map((a) => `${a.id}|${a.name}|${a.floor}`).join('\n');
    if (key !== listKey) {
      listKey = key;
      pick.replaceChildren(...list.agents.map((a) => el('option', { value: a.id }, tr.camera.agentOption(a.name, a.floor))));
    }
    pick.value = list.current;
  };

  const show = (kind: 'follow' | 'walk', title: string, hintText: string, exitText: string, exitLabel: string): void => {
    active = true;
    status.textContent = title;
    hint.textContent = hintText;
    exit.textContent = exitText;
    exit.setAttribute('aria-label', exitLabel);
    bar.setAttribute('aria-label', title);
    bar.hidden = false;
    walkButton.hidden = true;
    root.classList.toggle('is-follow', kind === 'follow');
    root.classList.toggle('is-walk', kind === 'walk');
    exit.focus();
  };

  return {
    walkButton,
    bar,
    setWalkAvailable(on, place) {
      available = on;
      walkButton.setAttribute('aria-label', place ? tr.camera.walkLabel(place) : tr.camera.walk);
      walkButton.hidden = !available || active;
    },
    showFollow(name, list) {
      setList(list);
      const switchable = !prev.hidden;
      show('follow', tr.camera.following(name), switchable ? tr.camera.followSwitchHint : tr.camera.followHint, tr.camera.stopFollow, tr.camera.stopFollow);
    },
    updateFollow(name, list) {
      setList(list);
      status.textContent = tr.camera.following(name);
      bar.setAttribute('aria-label', tr.camera.following(name));
    },
    showWalk(place) {
      setList(undefined);
      show('walk', tr.camera.walking(place), o.touch ? tr.camera.walkHintTouch : tr.camera.walkHint, tr.camera.exitWalk, tr.camera.exitWalkLabel);
    },
    hide() {
      active = false;
      bar.hidden = true;
      root.classList.remove('is-follow', 'is-walk');
      walkButton.hidden = !available;
    },
  };
}
