// Film name tags (KARARLAR Rev 45): "karakterlerin kim olduğu üstünde de yazmalı". Every character on screen
// (robots, the CEO, staff) gets a short tag above the head: the Turkish display name and a short role. Pure: the
// app hands in world head positions and a projector; this picks, fades and de-overlaps the tags.
import { Vector3, type PerspectiveCamera } from 'three';
import { stackLabels } from '../scene/labels';
import type { StaffRole } from '../sim/staffSim';

/** A tag on screen. `x`, `y` = bottom centre of the tag (CSS px relative to the canvas; the hook maps to canvas px). */
export interface FilmLabel {
  id: string;
  x: number;
  y: number;
  name: string;
  role: string;
  alpha: number;
}

/** A character the film may tag: id, world point above the head, Turkish name and short role. */
export interface FilmCharacter {
  id: string;
  head: Vector3;
  name: string;
  role: string;
}

/** At most this many tags at once (nearest first). */
export const MAX_FILM_LABELS = 14;
/** Tag height (CSS px) and the gap between the head and the tag. */
export const LABEL_H = 22;
export const LABEL_GAP = 4;
/** Full opacity up to FADE_NEAR world units from the camera, gone at FADE_FAR. */
export const FADE_NEAR = 30;
export const FADE_FAR = 55;
/** Relative fade: characters much further away than the shot's subject fade out (a deep room, a far floor). */
export const REL_FADE_FROM = 1.5;
export const REL_FADE_TO = 2.4;
/** Tags closer than this to the canvas edge are dropped (CSS px). */
const EDGE = 4;

/** Staff display names (Turkish) and the shared role. */
export const STAFF_NAME_TR: Readonly<Record<StaffRole, string>> = {
  cleaner: 'Temizlik Görevlisi',
  tea: 'Çaycı',
  'guard-desk': 'Güvenlik',
  'guard-patrol': 'Güvenlik',
};
export const STAFF_ROLE_TR = 'Personel';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Opacity of a tag `d` units from the camera when the shot's subject is `focus` units away. */
export function labelAlpha(d: number, focus: number): number {
  const abs = clamp01((FADE_FAR - d) / (FADE_FAR - FADE_NEAR));
  const rel = focus > 0 ? clamp01((REL_FADE_TO - d / focus) / (REL_FADE_TO - REL_FADE_FROM)) : 1;
  return Math.min(abs, rel);
}

/** Rough tag width (CSS px) for de-overlap: name and role in a 13 px font plus padding. */
export const labelWidth = (name: string, role: string): number => 18 + 7 * (name.length + role.length + 3);

const tmp = new Vector3();
const fwd = new Vector3();

/**
 * The tags for this frame: characters in front of the camera and inside the canvas, the nearest MAX_FILM_LABELS,
 * faded with distance, lifted where two would overlap. `width` / `height` = canvas CSS size.
 */
export function filmLabels(chars: readonly FilmCharacter[], camera: PerspectiveCamera, target: Vector3, width: number, height: number): FilmLabel[] {
  camera.updateMatrixWorld();
  camera.getWorldDirection(fwd);
  const focus = camera.position.distanceTo(target);
  const near: { c: FilmCharacter; d: number; x: number; y: number }[] = [];
  for (const c of chars) {
    tmp.copy(c.head).sub(camera.position);
    if (tmp.dot(fwd) <= camera.near) continue; // behind the camera
    const d = tmp.length();
    tmp.copy(c.head).project(camera);
    const x = ((tmp.x + 1) / 2) * width;
    const y = ((1 - tmp.y) / 2) * height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < EDGE || x > width - EDGE || y < EDGE + LABEL_H || y > height - EDGE) continue;
    near.push({ c, d, x, y });
  }
  near.sort((a, b) => a.d - b.d || (a.c.id < b.c.id ? -1 : 1));
  const picked = near.slice(0, MAX_FILM_LABELS).map((n) => ({ ...n, alpha: labelAlpha(n.d, focus) })).filter((n) => n.alpha > 0.01);
  const lifts = stackLabels(
    picked.map((n) => ({ x: n.x, y: n.y - LABEL_GAP, w: labelWidth(n.c.name, n.c.role) })),
    LABEL_H,
  );
  return picked.map((n, i) => ({ id: n.c.id, x: n.x, y: n.y - LABEL_GAP - (lifts[i] ?? 0), name: n.c.name, role: n.c.role, alpha: n.alpha }));
}

/** Where a speaker's bubble anchors: above its tag when it has one, else just above the head (CSS px). */
export function bubbleAnchorY(headY: number, label: FilmLabel | undefined): number {
  return label ? label.y - LABEL_H - LABEL_GAP : headY - 6;
}
