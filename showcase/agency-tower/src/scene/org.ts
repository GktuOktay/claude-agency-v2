// Org-chart mode (REQ-17): static reporting lines between robots, solid or dashed (independent unit).
import { AdditiveBlending, CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, TubeGeometry, Vector3 } from 'three';
import type { Unit } from '../data/types';

export interface OrgLine {
  from: string; // the unit
  to: string; // its reports-to
  dashed: boolean;
}

export function orgLines(units: readonly Unit[]): OrgLine[] {
  const ids = new Set(units.map((u) => u.id));
  return units.filter((u) => u.reportsTo !== null && ids.has(u.reportsTo)).map((u) => ({ from: u.id, to: u.reportsTo ?? '', dashed: u.independent }));
}

const LIFT = 0.55; // anchor at robot chest
const CORE = 0.075; // bright line
const HALO = 0.2; // soft additive glow around it

/** Soft glowing tubes along a gentle arc; dashed lines are a row of short tube segments. */
export function buildOrgLines(lines: readonly OrgLine[], positions: ReadonlyMap<string, Vector3>, colorOf: (from: string) => number): Group {
  const g = new Group();
  g.name = 'org-lines';
  const mats = new Map<string, MeshBasicMaterial>();
  const mat = (c: number, halo = false): MeshBasicMaterial => {
    const key = `${c}:${halo}`;
    let m = mats.get(key);
    if (!m) {
      m = halo
        ? new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, depthTest: false, depthWrite: false, blending: AdditiveBlending, toneMapped: false })
        : new MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthTest: false, toneMapped: false });
      mats.set(key, m);
    }
    return m;
  };
  for (const l of lines) {
    const a = positions.get(l.from);
    const b = positions.get(l.to);
    if (!a || !b) continue;
    const p0 = a.clone().add(new Vector3(0, LIFT, 0));
    const p2 = b.clone().add(new Vector3(0, LIFT, 0));
    const mid = p0.clone().lerp(p2, 0.5).add(new Vector3(0, 0.6 + p0.distanceTo(p2) * 0.08, 0.8));
    const curve = new CatmullRomCurve3([p0, mid, p2]);
    const color = colorOf(l.from);
    const m = mat(color);
    const halo = mat(color, true);
    const tag = (mesh: Mesh): Mesh => {
      mesh.name = l.dashed ? 'org-dash' : 'org-line';
      mesh.userData = { from: l.from, to: l.to, dashed: l.dashed };
      mesh.renderOrder = 10;
      mesh.raycast = () => undefined;
      g.add(mesh);
      return mesh;
    };
    if (!l.dashed) {
      tag(new Mesh(new TubeGeometry(curve, 48, CORE, 8, false), m));
      tag(new Mesh(new TubeGeometry(curve, 48, HALO, 8, false), halo)).renderOrder = 9;
    } else {
      const n = Math.max(6, Math.round(curve.getLength() / 0.45));
      for (let i = 0; i < n; i += 2) {
        const pts = [i / n, (i + 0.5) / n, (i + 1) / n].map((t) => curve.getPointAt(Math.min(1, t)));
        const seg = new CatmullRomCurve3(pts);
        tag(new Mesh(new TubeGeometry(seg, 4, CORE, 8, false), m));
        tag(new Mesh(new TubeGeometry(seg, 4, HALO, 8, false), halo)).renderOrder = 9;
      }
    }
  }
  return g;
}
