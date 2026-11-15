// KARARLAR Rev 42 camera modes, DOM part: the "İçeride gez" entry (floor views) and the mode bar with its
// always-visible exit button ("Takibi bırak" / "Çık"). Text only, no HTML from data.
import { tr } from '../i18n/tr';
import { el } from './dom';

export interface CameraModeUiOptions {
  onWalk(): void;
  onExit(): void;
  /** Coarse pointer: the walk hint names touch gestures. */
  touch: boolean;
}

export interface CameraModeUi {
  walkButton: HTMLButtonElement;
  bar: HTMLElement;
  /** Offer "İçeride gez" (a floor view where walking is possible), naming the place in the accessible name. */
  setWalkAvailable(on: boolean, place?: string): void;
  showFollow(name: string): void;
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
  bar.append(text, exit);
  bar.hidden = true;

  let available = false;
  let active = false;
  const root = document.documentElement;

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
    showFollow(name) {
      show('follow', tr.camera.following(name), tr.camera.followHint, tr.camera.stopFollow, tr.camera.stopFollow);
    },
    showWalk(place) {
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
