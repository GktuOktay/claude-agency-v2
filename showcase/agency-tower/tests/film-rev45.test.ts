// KARARLAR Rev 45: film name tags, 16:9 and 9:16 framing, recorder layout, fixed-step frames.
import { PerspectiveCamera, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FILM_REF_ASPECT, FOLLOW_FIT, PLACE_FIT, aspectFit, pullBack } from '../src/film/framing';
import { filmShotPlan } from '../src/film/shots';
import { FILM_PLACES } from '../src/film/script';
import { MAX_FILM_LABELS, LABEL_H, STAFF_NAME_TR, STAFF_ROLE_TR, bubbleAnchorY, filmLabels, labelAlpha, type FilmCharacter } from '../src/film/labels';
import { createFilmOverlay, filmLayout, labelToCanvasPixels } from '../src/film/overlay';
import { FILM_FRAME_S, FILM_TAIL_FRAMES, createFixedStepper, filmFixedParam } from '../src/film/fixedStep';
import { overviewFocusPoints, overviewPose, setFrameAspect } from '../src/scene/camera';
import { FOLLOW_FOV, followPose } from '../src/scene/follow';
import { tr } from '../src/i18n/tr';
import type { TourPose } from '../src/scene/tour';

const PORTRAIT = 9 / 16;

function cam(pose: { pos: Vector3; target: Vector3; fov: number }, aspect: number): PerspectiveCamera {
  const c = new PerspectiveCamera(pose.fov, aspect, 0.3, 400);
  c.position.copy(pose.pos);
  c.lookAt(pose.target);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

/** Points left and right of the target spanning `share` of the 16:9 frame's width at the target's depth. */
function subjectPoints(pose: TourPose, share: number): Vector3[] {
  const fwd = pose.target.clone().sub(pose.pos);
  const d = fwd.length();
  const right = new Vector3().crossVectors(fwd.normalize(), new Vector3(0, 1, 0)).normalize();
  const half = Math.tan((pose.fov * Math.PI) / 360) * FILM_REF_ASPECT * d * share;
  return [pose.target.clone(), pose.target.clone().addScaledVector(right, half), pose.target.clone().addScaledVector(right, -half)];
}

const inFrame = (c: PerspectiveCamera, p: Vector3): boolean => {
  const n = p.clone().project(c);
  return Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && n.z < 1;
};

describe('aspect-aware film framing (Rev 45: 16:9 and 9:16)', () => {
  it('leaves 16:9 (and wider) shots exactly as composed', () => {
    expect(aspectFit(36, FILM_REF_ASPECT)).toEqual({ fov: 36, distScale: 1 });
    expect(aspectFit(36, 21 / 9)).toEqual({ fov: 36, distScale: 1 });
  });

  it('portrait widens the lens up to the cap and pulls back for the rest', () => {
    const f = aspectFit(36, PORTRAIT, PLACE_FIT);
    expect(f.fov).toBeGreaterThan(36);
    expect(f.fov).toBeLessThanOrEqual(PLACE_FIT.maxFov + 1e-9);
    expect(f.distScale).toBeGreaterThan(1);
    // Horizontal coverage (tan of the half angle × distance) equals the 16:9 one.
    const ref = Math.tan((36 * Math.PI) / 360) * FILM_REF_ASPECT;
    const got = Math.tan((f.fov * Math.PI) / 360) * PORTRAIT * f.distScale;
    expect(got).toBeCloseTo(ref, 9);
  });

  it('every film place shot keeps the subject width inside the frame at 16:9 and at 9:16', () => {
    for (const place of FILM_PLACES) {
      if (place === 'overview') continue;
      const wide = filmShotPlan(place, FILM_REF_ASPECT);
      const tall = filmShotPlan(place, PORTRAIT);
      expect(tall.length, place).toBe(wide.length);
      wide.forEach((seg, i) => {
        if (seg.kind !== 'path' || seg.name === 'finale') return;
        const t = tall[i]!;
        if (t.kind !== 'path') throw new Error('kind');
        seg.poses.forEach((pose, k) => {
          const pts = subjectPoints(pose, 0.9);
          const c16 = cam(pose, FILM_REF_ASPECT);
          for (const p of pts) expect(inFrame(c16, p), `${place} 16:9 pose ${k}`).toBe(true);
          // Without the fit a 9:16 frame cuts the subject off (the test bites).
          const raw = cam(pose, PORTRAIT);
          expect(pts.every((p) => inFrame(raw, p)), `${place} unfitted`).toBe(false);
          const c9 = cam(t.poses[k]!, PORTRAIT);
          for (const p of pts) expect(inFrame(c9, p), `${place} 9:16 pose ${k}`).toBe(true);
          expect(t.poses[k]!.target.equals(pose.target)).toBe(true);
        });
      });
    }
  });

  it('the follow shot keeps the robot and 70 % of the 16:9 width in a 9:16 frame', () => {
    const p = followPose({ x: 0, y: 3, z: 0 }, 0);
    const pose: TourPose = { pos: p.pos, target: p.target, fov: FOLLOW_FOV };
    const fit = aspectFit(FOLLOW_FOV, PORTRAIT, FOLLOW_FIT);
    const fitted = { pos: pullBack(pose.pos, pose.target, fit.distScale), target: pose.target, fov: fit.fov };
    const c9 = cam(fitted, PORTRAIT);
    for (const q of subjectPoints(pose, 0.7 * 0.98)) expect(inFrame(c9, q)).toBe(true);
    expect(inFrame(c9, new Vector3(0, 3 + 1.2, 0))).toBe(true); // the robot's head
    expect(fit.fov).toBeLessThanOrEqual(FOLLOW_FIT.maxFov + 1e-9);
  });

  it('the overview fits the whole campus in a 9:16 frame as well', () => {
    for (const aspect of [FILM_REF_ASPECT, PORTRAIT]) {
      setFrameAspect(aspect);
      const o = overviewPose();
      const c = cam({ pos: o.pos, target: o.target, fov: o.fov ?? 32 }, aspect);
      for (const p of overviewFocusPoints()) expect(inFrame(c, p), `aspect ${aspect}`).toBe(true);
    }
    setFrameAspect(FILM_REF_ASPECT);
  });
});

describe('film name tags (Rev 45)', () => {
  const camera = (): PerspectiveCamera => {
    const c = new PerspectiveCamera(40, 16 / 9, 0.3, 400);
    c.position.set(0, 2, 10);
    c.lookAt(0, 1, 0);
    c.updateMatrixWorld();
    return c;
  };
  const ch = (id: string, x: number, z: number, name = id, role = 'Uzman'): FilmCharacter => ({ id, head: new Vector3(x, 1.2, z), name, role });

  it('tags characters on screen, drops those behind the camera and off screen', () => {
    const tags = filmLabels([ch('a', 0, 0, 'QA Mühendisi'), ch('behind', 0, 20), ch('off', 60, 0)], camera(), new Vector3(0, 1, 0), 1920, 1080);
    expect(tags.map((t) => t.id)).toEqual(['a']);
    expect(tags[0]).toMatchObject({ name: 'QA Mühendisi', role: 'Uzman', alpha: 1 });
    expect(tags[0]!.x).toBeCloseTo(960, 0);
  });

  it(`keeps at most ${MAX_FILM_LABELS}, the nearest first, and fades distant ones`, () => {
    const many = Array.from({ length: 30 }, (_, i) => ch(`r${String(i).padStart(2, '0')}`, (i % 6) - 3, -i * 1.5));
    const tags = filmLabels(many, camera(), new Vector3(0, 1, 0), 1920, 1080);
    expect(tags.length).toBeLessThanOrEqual(MAX_FILM_LABELS);
    expect(tags.map((t) => t.id)).toContain('r00');
    expect(tags.map((t) => t.id)).not.toContain('r29');
    expect(labelAlpha(5, 10)).toBe(1);
    expect(labelAlpha(60, 60)).toBe(0);
    expect(labelAlpha(20, 8)).toBeLessThan(labelAlpha(12, 8));
  });

  it('lifts a tag that would overlap another and puts the speaker bubble above its tag', () => {
    const tags = filmLabels([ch('a', 0, 0), ch('b', 0.05, -0.3)], camera(), new Vector3(0, 1, 0), 1920, 1080);
    expect(tags).toHaveLength(2);
    expect(Math.abs(tags[0]!.y - tags[1]!.y)).toBeGreaterThanOrEqual(LABEL_H);
    expect(bubbleAnchorY(500, tags[0])).toBeLessThan(tags[0]!.y - LABEL_H + 1e-9);
    expect(bubbleAnchorY(500, undefined)).toBe(494);
  });

  it('names staff in Turkish with the "Personel" role; robots use the tier names', () => {
    expect(STAFF_NAME_TR.tea).toBe('Çaycı');
    expect(STAFF_NAME_TR['guard-desk']).toBe('Güvenlik');
    expect(STAFF_NAME_TR.cleaner).toBe('Temizlik Görevlisi');
    expect(STAFF_ROLE_TR).toBe('Personel');
    expect([tr.tiers.ceo, tr.tiers.lead, tr.tiers.specialist]).toEqual(['CEO', 'Takım lideri', 'Uzman']);
  });

  it('the DOM overlay shows each tag with name and role (role omitted when it repeats the name)', () => {
    const o = createFilmOverlay();
    o.update(null, [], [
      { id: 'ceo', x: 10, y: 20, name: 'CEO', role: 'CEO', alpha: 1 },
      { id: 'staff:tea', x: 30, y: 40, name: 'Çaycı', role: 'Personel', alpha: 0.5 },
    ]);
    const els = [...o.element.querySelectorAll<HTMLElement>('.film-label')];
    expect(els).toHaveLength(2);
    expect(els[0]!.querySelector('.film-label-name')?.textContent).toBe('CEO');
    expect((els[0]!.querySelector('.film-label-role') as HTMLElement).hidden).toBe(true);
    expect(els[1]!.textContent).toBe('ÇaycıPersonel');
    expect(Number(els[1]!.style.opacity)).toBe(0.5);
    o.update(null, [], []);
    expect(els.every((e) => e.hidden)).toBe(true);
  });

  it('maps tags to canvas pixels for the recorder', () => {
    expect(labelToCanvasPixels({ id: 'a', x: 10, y: 20, name: 'n', role: 'r', alpha: 1 }, 1920, 1080, 3840, 2160)).toEqual({ id: 'a', x: 20, y: 40, name: 'n', role: 'r', alpha: 1 });
  });
});

describe('recorder layout (Rev 45: 3840×2160 and 2160×3840)', () => {
  it('keeps the caption box inside the safe margins near the bottom, same type size in both formats', () => {
    const wide = filmLayout(3840, 2160, 2);
    const tall = filmLayout(2160, 3840, 2);
    expect(wide.portrait).toBe(false);
    expect(tall.portrait).toBe(true);
    for (const l of [wide, tall]) {
      const c = l.caption;
      expect(c.x).toBeGreaterThanOrEqual(l.safe.left);
      expect(c.x + c.w).toBeLessThanOrEqual(l.width - l.safe.right);
      expect(c.y).toBeGreaterThanOrEqual(l.safe.top);
      expect(c.y + c.h).toBeLessThanOrEqual(l.height - l.safe.bottom);
      expect(c.y + c.h).toBeGreaterThan(l.height * 0.75); // lower part of the frame
      expect(c.h).toBeGreaterThanOrEqual(c.padding * 2 + c.lineHeight * c.maxLines);
      expect(l.label.height).toBe(44);
    }
    expect(tall.caption.fontPx).toBeGreaterThanOrEqual(wide.caption.fontPx);
    expect(tall.safe.bottom).toBeGreaterThan(tall.height * 0.1);
  });
});

describe('fixed-step film frames (Rev 45 Ruling)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is on only with ?film=1&fixed=1', () => {
    expect(filmFixedParam('?film=1&fixed=1')).toBe(true);
    expect(filmFixedParam('?film=1')).toBe(false);
    expect(filmFixedParam('?fixed=1')).toBe(false);
  });

  it('advances exactly 1/30 s per frame, starts the film once, renders once per call', () => {
    const frames: [number, number, boolean][] = [];
    const start = vi.fn();
    const s = createFixedStepper({ frame: (dt, now, draw) => void frames.push([dt, now, draw]), ended: () => false, start });
    expect(s.step()).toEqual({ done: false });
    expect(s.step(4)).toEqual({ done: false });
    expect(start).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(5);
    for (const [dt] of frames) expect(dt).toBe(FILM_FRAME_S);
    expect(frames.map((f) => f[2])).toEqual([true, false, false, false, true]);
    expect(frames[4]![1]).toBeCloseTo((5 * 1000) / 30, 9);
    expect(s.frames).toBe(5);
  });

  it(`keeps recording ${FILM_TAIL_FRAMES} frames (2.5 s) after onEnd, then reports done`, () => {
    let ended = false;
    let n = 0;
    const s = createFixedStepper({ frame: (dt) => void (n += dt > 0 ? 1 : 0), ended: () => ended, start: () => undefined });
    s.step(10);
    ended = true;
    let r = { done: false };
    let k = 0;
    while (!r.done && k < 1000) {
      r = s.step();
      k++;
    }
    expect(k).toBe(FILM_TAIL_FRAMES);
    expect(n).toBe(10 + FILM_TAIL_FRAMES);
    expect(s.step()).toEqual({ done: true });
    expect(n).toBe(10 + FILM_TAIL_FRAMES);
  });

  it('is deterministic: the same steps give the same timeline', () => {
    const run = (): number[] => {
      const out: number[] = [];
      const s = createFixedStepper({ frame: (_dt, now) => void out.push(now), ended: () => false, start: () => undefined });
      for (let i = 0; i < 50; i++) s.step(i % 3 === 0 ? 2 : 1);
      return out;
    };
    expect(run()).toEqual(run());
  });
});
