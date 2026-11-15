// Film place shots: the tour's own establishing shots (scene/tour.ts), re-timed for the film. The finale pulls back
// from the roof garden to the overview in golden-hour light (the tour player ramps the light on `finale`).
import { tourPlan, type TourPlace, type TourSegment } from '../scene/tour';
import type { FilmPlace } from './script';

const PLAN: Readonly<Record<FilmPlace, readonly (readonly [TourPlace, number])[]>> = {
  overview: [['overview', 10]],
  lobby: [['lobby', 4.5]],
  meeting: [['meeting', 4]],
  engineering: [['engineering', 5]],
  rnd: [['rnd', 8]],
  gym: [['gym', 10]],
  finale: [['roof', 4], ['finale', 6]],
};

/** Tour segments for a film place (path segments only; built now, so the overview fits the current window). */
export function filmShotPlan(place: FilmPlace): TourSegment[] {
  const tour = tourPlan();
  const out: TourSegment[] = [];
  for (const [name, duration] of PLAN[place]) {
    const seg = tour.find((s) => s.name === name);
    if (seg && seg.kind === 'path') out.push({ ...seg, duration });
  }
  return out;
}
