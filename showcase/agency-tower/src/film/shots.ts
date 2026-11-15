// Film place shots: the tour's own establishing shots (scene/tour.ts), re-timed for the film. The finale pulls back
// from the roof garden to the overview in golden-hour light (the tour player ramps the light on `finale`).
import { tourPlan, type TourPlace, type TourPose, type TourSegment } from '../scene/tour';
import { FILM_REF_ASPECT, PLACE_FIT, aspectFit, pullBack } from './framing';
import type { FilmPlace } from './script';

/** Orbit segments frame the whole campus through overviewPose(), which already fits the window's aspect. */
const ASPECT_FITTED: ReadonlySet<TourPlace> = new Set(['overview', 'finale']);

/** An interior shot composed for 16:9, refit for `aspect` (Rev 45: 9:16 keeps the room's width in view). */
export function fitShotPose(pose: TourPose, aspect: number): TourPose {
  const f = aspectFit(pose.fov, aspect, PLACE_FIT);
  return { pos: pullBack(pose.pos, pose.target, f.distScale), target: pose.target.clone(), fov: f.fov };
}

const PLAN: Readonly<Record<FilmPlace, readonly (readonly [TourPlace, number])[]>> = {
  overview: [['overview', 6]],
  lobby: [['lobby', 3]],
  meeting: [['meeting', 4]],
  engineering: [['engineering', 5]],
  rnd: [['rnd', 5.5]],
  gym: [['gym', 6]],
  finale: [['roof', 2.5], ['finale', 3.5]],
};

/**
 * Tour segments for a film place (path segments only; built now, so the overview fits the current window). `aspect`
 * = canvas width / height: interior shots are refit for frames narrower than 16:9.
 */
export function filmShotPlan(place: FilmPlace, aspect = FILM_REF_ASPECT): TourSegment[] {
  const tour = tourPlan();
  const out: TourSegment[] = [];
  for (const [name, duration] of PLAN[place]) {
    const seg = tour.find((s) => s.name === name);
    if (!seg || seg.kind !== 'path') continue;
    const poses = ASPECT_FITTED.has(name) ? seg.poses : seg.poses.map((p) => fitShotPose(p, aspect));
    out.push({ ...seg, duration, poses });
  }
  return out;
}
