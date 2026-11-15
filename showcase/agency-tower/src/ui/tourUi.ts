// "Tanıtım turu" DOM part (KARARLAR Rev 43): the start button (placed in the settings "Ofis" controls) and the
// small "Turu bitir" button that is the only control left on screen during the tour. Film mode (`?film=1`) hides
// every control, the exit button too, for a clean recording. Text only.
import { tr } from '../i18n/tr';
import { el } from './dom';

export interface TourUiOptions {
  onStart(): void;
  onEnd(): void;
  film: boolean;
}

export interface TourUi {
  startButton: HTMLButtonElement;
  exitButton: HTMLButtonElement;
  /** The tour runs: hide the HUD (html.is-tour), offer "Turu bitir" (not in film mode). */
  show(): void;
  hide(): void;
}

export function createTourUi(o: TourUiOptions): TourUi {
  const startButton = el('button', { type: 'button', class: 'tour-start', 'aria-label': tr.tour.startLabel }, tr.tour.start);
  startButton.addEventListener('click', () => o.onStart());
  const exitButton = el('button', { type: 'button', class: 'tour-exit' }, tr.tour.exit);
  exitButton.hidden = true;
  exitButton.addEventListener('click', () => o.onEnd());
  const root = document.documentElement;
  // Film mode keeps the screen clean from load to the end of the recording.
  if (o.film) root.classList.add('is-film');
  return {
    startButton,
    exitButton,
    show() {
      root.classList.add('is-tour');
      root.classList.toggle('is-film', o.film);
      exitButton.hidden = o.film;
      if (!o.film) exitButton.focus();
    },
    hide() {
      root.classList.remove('is-tour');
      if (!o.film) root.classList.remove('is-film');
      exitButton.hidden = true;
    },
  };
}
