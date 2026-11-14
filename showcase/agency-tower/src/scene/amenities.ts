// Campus wing amenities (KARARLAR rev 31): cafeteria, snack bar and terrace (level 0); gym and game room
// (level 1); nap pods, R&D lab and the project archive (level 2); greenery on every level. Procedural
// geometry with the floor's kit; repeats are instanced (green-wall leaves, archive boxes). Positions follow
// the footprints in src/sim/layout.ts (wingFurniture) so the nav graph keeps clear of everything.
import { BoxGeometry, BufferAttribute, CanvasTexture, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace, Vector3, type BufferGeometry, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, bistroTable, fridge, plant, stool, type Kit } from './furniture';
import type { FloorMaterials } from './model';
import { AMENITY_SPOTS, FLOOR_TOP, LAB_STATIONS, wingX, type AmenityKind } from '../sim/layout';
import { CODE_LINES } from './codeLines';
import { clumpGeometry } from './greenery';

/** Closed projects in the archive (fictional names; one label per box, cycled). */
export const PROJECT_ARCHIVE: readonly string[] = [
  'Kuzey Yıldızı', 'Mavi Liman', 'Proje Atlas', 'Kervan', 'Poyraz', 'Yakamoz', 'Anka', 'Sirius', 'Lodos', 'Meltem',
  'Karayel', 'Gökbilge', 'Pusula', 'Fener', 'Çınar', 'Defne', 'Zeytin', 'Kaşif', 'Orion', 'Vega',
  'Halley', 'Mercan', 'Lale', 'Sedef', 'Kumru', 'Toros', 'Ilgaz', 'Kaçkar', 'Datça', 'Alaçatı',
  'Nova', 'Kuasar', 'Pulsar', 'Nebula', 'Galata', 'Kapadokya', 'Efes', 'Truva', 'Bergama', 'Sardes',
  'Mira', 'Altair', 'Deneb', 'Rigel', 'Lyra', 'Andromeda', 'Kalkan', 'Bozcaada',
];

const COLS = 4;
const ROWS = 12;
const X = wingX;
const Y = FLOOR_TOP;

/** Label atlas: one cell per project name (canvas text); null when no 2D canvas exists (tests, old browsers). */
export function archiveLabelTexture(): Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 768;
  const g = c.getContext('2d');
  if (!g) return null;
  const cw = c.width / COLS;
  const ch = c.height / ROWS;
  PROJECT_ARCHIVE.forEach((name, i) => {
    const x = (i % COLS) * cw;
    const y = Math.floor(i / COLS) * ch;
    g.fillStyle = '#fbf8f2';
    g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    g.fillStyle = '#3a3f47';
    g.font = 'bold 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name.toLocaleUpperCase('tr-TR'), x + cw / 2, y + ch * 0.42, cw - 16);
    g.font = '15px system-ui, sans-serif';
    g.fillStyle = '#7a7f87';
    g.fillText(`KAPANDI · ${2019 + (i % 7)}`, x + cw / 2, y + ch * 0.78, cw - 16);
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function at<T extends Group>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

/**
 * Moves an instanced mesh's origin to x = `ox` (instances keep their placement), so its base geometry
 * sits in the wing rather than at the tower centre (layout tests read raw geometry).
 */
export function anchorInstances(mesh: InstancedMesh, ox: number): void {
  const m = new Matrix4();
  const shift = new Matrix4().makeTranslation(-ox, 0, 0);
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    mesh.setMatrixAt(i, m.premultiply(shift));
  }
  mesh.position.x += ox;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

const spotsOf = (floor: number, kind: AmenityKind) => AMENITY_SPOTS.filter((s) => s.floor === floor && s.kind === kind);

/**
 * Material keys the tower kit already uses (desks, chairs, books, rugs, floor lights): wing parts made of
 * them merge into the floor's existing meshes (mergeStatic), so they add vertices but no draw calls.
 */
function paints(k: Kit) {
  return {
    white: k.m(PALETTE.white),
    oak: k.m(PALETTE.oak, { roughness: 0.6 }),
    oakDark: k.m(PALETTE.oakDark),
    dark: k.m(PALETTE.charcoal, { roughness: 0.5 }),
    steel: k.m(PALETTE.graphite, { metalness: 0.4, roughness: 0.4 }),
    leaf: k.m(PALETTE.leaf, { roughness: 0.85 }),
    leafDark: k.m(PALETTE.leafDark, { roughness: 0.85 }),
    pot: k.m(PALETTE.pot, { roughness: 0.9 }),
    fabric: k.m(PALETTE.fabricBlue, { roughness: 0.95 }),
    offWhite: k.m(PALETTE.offWhite),
    glass: k.tint(0xbcd9e6, 0.38),
    warm: k.glow(0xfff1d6, 0xffcf8a, 0.15, 3.5),
    screen: k.glow(0x9ce8ff, 0x7fe3ff, 0.8, 1.6),
    rugLight: k.m(0xefe6d8, { roughness: 1 }),
    rugDark: k.m(0xdccbb3, { roughness: 1 }),
    /** Book colours: 0 coral, 1 blue, 2 yellow, 3 green, 4 lilac, 5 cream. */
    book: (i: number) => k.m(PALETTE.books[i % PALETTE.books.length] ?? PALETTE.white, { roughness: 0.8 }),
  };
}
type Paints = ReturnType<typeof paints>;
const CORAL = PALETTE.books[0];
const BLUE = PALETTE.books[1];
const YELLOW = PALETTE.books[2];

/** Instanced leaf clusters on a wall-mounted planting panel (green wall) along z at x = `x`, facing +x. */
/** Green-wall leaf clump radius (the shared clump is a unit ball). */
const LEAF_R = 0.14;

function greenWall(k: Kit, p: Paints, parent: Group, x: number, z0: number, z1: number, name: string): void {
  k.box(parent, 0.08, 1.1, z1 - z0, 0, p.leafDark, x, Y, (z0 + z1) / 2);
  const cols = Math.round((z1 - z0) / 0.32);
  const rows = 5;
  const leaves = new InstancedMesh(clumpGeometry(), k.m(0xffffff, { roughness: 0.85 }), cols * rows) // shared 12-vertex clump (Rev 40);
  const m = new Matrix4();
  const q = new Quaternion();
  const tones = [new Color(PALETTE.leaf), new Color(PALETTE.leafDark), new Color(0x86b86a), new Color(0x5f9157)];
  let i = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const s = 0.8 + ((c * 7 + r * 3) % 5) * 0.1;
      m.compose(new Vector3(x + 0.08, Y + 0.15 + r * 0.22 + (c % 2) * 0.08, z0 + 0.16 + c * 0.32), q, new Vector3(s * 0.7 * LEAF_R, s * LEAF_R, s * LEAF_R));
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, tones[(c + r * 2) % tones.length] ?? new Color(PALETTE.leaf));
      i++;
    }
  }
  leaves.name = name;
  leaves.userData.shadow = 'object';
  anchorInstances(leaves, x);
  parent.add(leaves);
}

/** Long planter box with low shrubs. */
function planter(k: Kit, p: Paints, parent: Group, x0: number, z0: number, x1: number, z1: number): void {
  const w = x1 - x0;
  const d = z1 - z0;
  k.box(parent, w, 0.3, d, 0.03, p.white, (x0 + x1) / 2, Y, (z0 + z1) / 2);
  const n = Math.max(1, Math.round(Math.max(w, d) / 0.7));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    k.ball(parent, 0.22, i % 2 ? p.leafDark : p.leaf, w >= d ? x0 + w * t : (x0 + x1) / 2, Y + 0.4, w >= d ? (z0 + z1) / 2 : z0 + d * t, true);
  }
}

// ---------------------------------------------------------------- level 0: cafeteria, snack bar, terrace

function level0(k: Kit, g: Group): void {
  const p = paints(k);
  // Serving counter (cafeteria line) with a sneeze guard, food trays and a kitchen pass behind it.
  k.box(g, 4.2, 0.4, 0.6, 0.03, p.white, X(-2.5), Y, -3.325);
  k.box(g, 4.3, 0.04, 0.66, 0, p.steel, X(-2.5), Y + 0.4, -3.325);
  k.box(g, 4.0, 0.22, 0.012, 0, p.glass, X(-2.5), Y + 0.46, -3.08, 'none');
  for (let i = 0; i < 8; i++) k.box(g, 0.36, 0.05, 0.28, 0, p.book(i), X(-4.2 + i * 0.48), Y + 0.44, -3.4);
  k.box(g, 4.6, 0.8, 0.5, 0.03, p.white, X(-2.55), Y, -5.1);
  k.box(g, 4.6, 0.04, 0.55, 0, p.steel, X(-2.55), Y + 0.8, -5.1);
  k.box(g, 2.0, 0.5, 0.04, 0, p.dark, X(-2.55), Y + 0.88, -5.36);
  for (let i = 0; i < 4; i++) k.box(g, 0.36, 0.05, 0.012, 0, p.warm, X(-3.2 + i * 0.44), Y + 1.18, -5.33, 'none');
  // Snack bar: coral counter, stools, glass-front fridges and snack shelves.
  k.box(g, 2.9, 0.42, 0.45, 0, p.book(0), X(2.9), Y, -3.1);
  k.box(g, 3.0, 0.04, 0.5, 0, p.white, X(2.9), Y + 0.42, -3.1);
  for (let i = 0; i < 5; i++) k.cyl(g, 0.06, 0.05, 0.08, p.book(i + 1), X(1.8 + i * 0.55), Y + 0.46, -3.15, 12);
  for (const s of spotsOf(0, 'snack')) g.add(at(stool(k, YELLOW ?? PALETTE.white), s.x, Y, s.z));
  for (const lx of [1.6, 2.4, 3.2]) g.add(at(fridge(k), X(lx), Y, -5.17));
  k.box(g, 1.2, 1.0, 0.45, 0.02, p.white, X(4.2), Y, -5.17);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) k.box(g, 0.2, 0.14, 0.2, 0, p.book(r + i), X(3.8 + i * 0.27), Y + 0.1 + r * 0.3, -5.05);
  // Long tables: oak top, white panel legs, a bench on the far side, stools on the spot side.
  for (const [lx0, lx1, z] of [[-4.6, -0.1, 0.65], [1.7, 4.5, 0.65], [-4.6, -0.1, 3.65], [1.7, 4.5, 3.65]] as const) {
    const cx = X((lx0 + lx1) / 2);
    const len = lx1 - lx0;
    k.box(g, len, 0.045, 0.8, 0.02, p.oak, cx, Y + 0.34, z);
    for (const dx of [-len / 2 + 0.2, len / 2 - 0.2]) k.box(g, 0.06, 0.34, 0.6, 0, p.white, cx + dx, Y, z);
    k.box(g, len - 0.2, 0.05, 0.25, 0.02, p.oak, cx, Y + 0.2, z + 0.625);
    for (const dx of [-len / 2 + 0.25, len / 2 - 0.25]) k.box(g, 0.05, 0.2, 0.2, 0, p.white, cx + dx, Y, z + 0.625);
    for (let i = 0; i < Math.floor(len / 1.4); i++) {
      k.cyl(g, 0.06, 0.05, 0.1, p.pot, cx - len / 2 + 0.7 + i * 1.4, Y + 0.385, z, 16);
      k.ball(g, 0.08, p.leaf, cx - len / 2 + 0.7 + i * 1.4, Y + 0.54, z, true);
    }
  }
  for (const s of spotsOf(0, 'dining')) g.add(at(stool(k, BLUE ?? PALETTE.white), s.x, Y, s.z));
  // Greenery: green wall on the west wall, planters along the south glass.
  greenWall(k, p, g, X(-5.4), -4.6, 4.6, 'green-wall-0');
  planter(k, p, g, X(-4.7), 4.7, X(-1.6), 5.4);
  planter(k, p, g, X(4.6), 4.7, X(5.4), 5.4);
  g.add(at(plant(k, 1.4), X(5.0), Y, -2.2));
  // Terrace: oak deck, bistro tables with parasols and stools, a planter strip.
  k.box(g, 10.0, 0.02, 2.8, 0, p.oakDark, X(0), Y, 6.9);
  for (const s of spotsOf(0, 'terrace')) {
    g.add(at(bistroTable(k), s.x, Y, 7.33));
    g.add(at(stool(k, CORAL ?? PALETTE.white), s.x, Y, s.z));
    k.cyl(g, 0.015, 0.015, 1.15, p.steel, s.x, Y + 0.41, 7.33, 8);
    k.cyl(g, 0.02, 0.7, 0.22, p.book(0), s.x, Y + 1.5, 7.33, 16);
  }
  planter(k, p, g, X(-5.0), 7.9, X(5.0), 8.3);
  for (const lx of [-3.8, -2.4]) g.add(at(plant(k, 1.1), X(lx), Y, 7.0));
}

// ---------------------------------------------------------------- level 1: gym, game room

function level1(k: Kit, g: Group): void {
  const p = paints(k);
  // Gym: rubber floor, treadmills facing the north glass, dumbbell rack, weight bench, mats.
  k.box(g, 10.8, 0.008, 4.1, 0, k.m(0x5f6670, { roughness: 1 }), X(0), Y, -3.35, 'surface');
  for (const s of spotsOf(1, 'treadmill')) {
    k.box(g, 0.66, 0.1, 1.5, 0, p.dark, s.x, Y, -4.0);
    k.box(g, 0.5, 0.012, 1.3, 0, p.steel, s.x, Y + 0.1, -3.95);
    for (const dx of [-0.3, 0.3]) k.box(g, 0.05, 1.0, 0.05, 0, p.steel, s.x + dx, Y, -4.85);
    k.box(g, 0.64, 0.16, 0.2, 0, p.dark, s.x, Y + 0.95, -4.9);
    k.box(g, 0.3, 0.08, 0.012, 0, p.screen, s.x, Y + 1.0, -4.79, 'none');
  }
  k.box(g, 3.2, 0.5, 0.45, 0, p.steel, X(3.0), Y, -5.15);
  for (let i = 0; i < 10; i++) for (const dz of [-0.06, 0.06]) k.cyl(g, 0.05, 0.05, 0.08, p.dark, X(1.6 + i * 0.31), Y + 0.5, -5.15 + dz, 8);
  k.box(g, 0.32, 0.1, 1.0, 0, p.book(1), X(2.8), Y + 0.25, -3.9);
  for (const dz of [-0.4, 0.4]) k.box(g, 0.06, 0.25, 0.06, 0, p.steel, X(2.8), Y, -3.9 + dz);
  for (const dx of [-0.2, 0.2]) k.box(g, 0.05, 0.9, 0.05, 0, p.steel, X(2.8 + dx), Y, -4.35);
  const bar = k.cyl(g, 0.015, 0.015, 1.3, p.steel, X(2.8), Y, -4.35, 8);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = Y + 0.85;
  for (const dx of [-0.55, 0.55]) {
    const plate = k.cyl(g, 0.14, 0.14, 0.05, p.dark, X(2.8 + dx), Y, -4.35, 16);
    plate.rotation.z = Math.PI / 2;
    plate.position.y = Y + 0.85;
  }
  spotsOf(1, 'mat').forEach((s, i) => k.box(g, 1.0, 0.012, 0.55, 0, p.book(i * 2), s.x, Y + 0.008, s.z));
  k.ball(g, 0.25, p.book(3), X(4.9), Y + 0.25, -2.4);
  greenWall(k, p, g, X(-5.4), -5.2, -1.6, 'green-wall-1');
  planter(k, p, g, X(4.7), -1.5, X(5.4), -1.3);
  // Game room: rug, ping-pong, foosball, arcade cabinets, bean bags.
  k.box(g, 7.4, 0.008, 5.2, 0.004, p.rugDark, X(-1.3), Y + 0.002, 2.6, 'surface');
  k.box(g, 7.24, 0.008, 5.04, 0.004, p.rugLight, X(-1.3), Y + 0.004, 2.6, 'surface');
  k.box(g, 1.5, 0.04, 0.84, 0, p.book(1), X(-3.0), Y + 0.36, 2.2);
  k.box(g, 1.5, 0.004, 0.02, 0, p.white, X(-3.0), Y + 0.4, 2.2);
  k.box(g, 0.02, 0.08, 0.9, 0, p.white, X(-3.0), Y + 0.4, 2.2);
  for (const dx of [-0.6, 0.6]) for (const dz of [-0.34, 0.34]) k.box(g, 0.04, 0.36, 0.04, 0, p.dark, X(-3.0 + dx), Y, 2.2 + dz);
  for (const dx of [-0.6, 0.6]) k.cyl(g, 0.06, 0.06, 0.012, p.book(0), X(-3.0 + dx), Y + 0.4, 2.4, 12);
  k.box(g, 1.1, 0.25, 0.65, 0.03, p.oak, X(0.6), Y + 0.3, 1.2);
  k.box(g, 0.95, 0.006, 0.52, 0, p.book(3), X(0.6), Y + 0.55, 1.2);
  for (const dx of [-0.45, 0.45]) for (const dz of [-0.25, 0.25]) k.box(g, 0.05, 0.3, 0.05, 0, p.dark, X(0.6 + dx), Y, 1.2 + dz);
  for (let i = 0; i < 6; i++) {
    const x = X(0.6 - 0.4 + i * 0.16);
    const rod = k.cyl(g, 0.01, 0.01, 0.85, p.steel, x, Y, 1.2, 8);
    rod.rotation.x = Math.PI / 2;
    rod.position.y = Y + 0.5;
    k.box(g, 0.04, 0.08, 0.03, 0, p.book(i % 2 ? 0 : 1), x, Y + 0.46, 1.2);
  }
  for (const lx of [3.7, 4.5]) {
    k.box(g, 0.6, 1.15, 0.55, 0, p.dark, X(lx), Y, 5.05);
    k.box(g, 0.48, 0.38, 0.012, 0, p.screen, X(lx), Y + 0.68, 4.77, 'none');
    k.box(g, 0.56, 0.1, 0.012, 0, p.warm, X(lx), Y + 1.02, 4.77, 'none');
    k.box(g, 0.56, 0.06, 0.2, 0, p.book(4), X(lx), Y + 0.5, 4.7);
  }
  spotsOf(1, 'bean-bag').forEach((s, i) => {
    const bag = k.place(g, new SphereGeometry(0.3, 12, 8), p.book([0, 3, 2][i % 3] ?? 0), s.x, Y + 0.16, s.z);
    bag.scale.set(1, 0.55, 1);
  });
  planter(k, p, g, X(-5.4), 4.8, X(-4.6), 5.4);
  planter(k, p, g, X(4.85), 0.0, X(5.4), 1.4);
}

// ---------------------------------------------------------------- level 2: nap pods, R&D lab, archive

function archive(k: Kit, p: Paints, g: Group, materials: FloorMaterials): void {
  const perLevel = 12;
  const levels = 4;
  const rows = [1.1, 2.7, 4.3];
  const cx = X(-2.4);
  for (const z of rows) {
    for (const dx of [-2.0, 2.0]) k.box(g, 0.04, 1.2, 0.42, 0, p.steel, cx + dx, Y, z);
    for (let l = 0; l <= levels; l++) k.box(g, 4.0, 0.025, 0.42, 0, p.white, cx, Y + 0.02 + l * 0.285, z);
  }
  const count = rows.length * levels * perLevel;
  const boxes = new InstancedMesh(new BoxGeometry(0.3, 0.22, 0.36), k.m(0xffffff, { roughness: 0.9 }), count);
  const tones = [new Color(0xd8b98a), new Color(0xc9a87a), new Color(0xe8dcc4), new Color(0xf3eee6), new Color(0xb79ad0), new Color(0x9cc4ef)];
  const labels: BufferGeometry[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  let i = 0;
  rows.forEach((z, r) => {
    for (let l = 0; l < levels; l++) {
      for (let b = 0; b < perLevel; b++) {
        const x = cx - 1.815 + b * 0.33;
        const y = Y + 0.045 + l * 0.285 + 0.11;
        m.compose(new Vector3(x, y, z), q, one);
        boxes.setMatrixAt(i, m);
        boxes.setColorAt(i, tones[(b * 5 + l * 3 + r) % tones.length] ?? new Color(0xd8b98a));
        // Label plane on the +z face, mapped to one atlas cell (one project name).
        const cell = (i * 7 + r * 11) % PROJECT_ARCHIVE.length;
        const u0 = (cell % COLS) / COLS;
        const v1 = 1 - Math.floor(cell / COLS) / ROWS;
        const v0 = v1 - 1 / ROWS;
        const plane = new PlaneGeometry(0.26, 0.09);
        const uv = plane.attributes.uv;
        if (uv) {
          // PlaneGeometry uv order: (0,1) (1,1) (0,0) (1,0).
          const us = [u0, u0 + 1 / COLS, u0, u0 + 1 / COLS];
          const vs = [v1, v1, v0, v0];
          for (let c = 0; c < 4; c++) uv.setXY(c, us[c] ?? 0, vs[c] ?? 0);
        }
        labels.push(plane.translate(x, y, z + 0.182));
        i++;
      }
    }
  });
  boxes.name = 'archive-boxes';
  boxes.userData.shadow = 'object';
  anchorInstances(boxes, cx);
  g.add(boxes);
  // The atlas is drawn only where the scene has canvas textures (the browser); tests get plain labels.
  const labelMat = new MeshBasicMaterial({ color: 0xffffff, map: k.textures.wood ? archiveLabelTexture() : null, toneMapped: false });
  materials.contents.push(labelMat);
  const merged = mergeGeometries(labels);
  for (const pl of labels) pl.dispose();
  if (merged) {
    const mesh = new Mesh(merged, labelMat);
    mesh.name = 'archive-labels';
    mesh.userData.shadow = 'none';
    g.add(mesh);
  }
}

function level2(k: Kit, g: Group, materials: FloorMaterials): void {
  const p = paints(k);
  // Nap pods: white capsules open to the south with a mattress, pillow and a warm reading light.
  k.box(g, 4.6, 0.008, 3.4, 0.004, p.rugLight, X(-2.95), Y + 0.004, -3.75, 'surface');
  for (const s of spotsOf(2, 'pod')) {
    k.box(g, 1.0, 0.95, 0.5, 0.05, p.white, s.x, Y, -5.2);
    for (const dx of [-0.45, 0.45]) k.box(g, 0.1, 0.95, 1.4, 0.03, p.white, s.x + dx, Y, -4.25);
    k.box(g, 1.0, 0.1, 1.4, 0.04, p.white, s.x, Y + 0.85, -4.25);
    k.box(g, 0.78, 0.14, 1.36, 0.06, p.fabric, s.x, Y + 0.02, -4.25);
    k.box(g, 0.4, 0.08, 0.22, 0, p.offWhite, s.x, Y + 0.16, -4.75);
    k.box(g, 0.2, 0.04, 0.02, 0, p.warm, s.x, Y + 0.78, -4.94, 'none');
  }
  rndLab(k, p, g, materials);
  archive(k, p, g, materials);
}

// ---------------------------------------------------------------- level 2: R&D lab ("AR-GE ★", rev 35)
// The campus showpiece of a software company: a curved LED video wall (animated code, graphs and a
// model-training curve), workstations, a prototype bench with a robot arm, a device-lab wall, an
// architecture whiteboard, a glass GPU cluster and collaboration pods, on a polished warm floor with brass
// accents. Every display face is one atlas-mapped mesh ('rnd-displays'); the polished floor and brass trims
// are one vertex-coloured mesh ('rnd-polished'); everything else uses the floor's existing materials.

/** Video-wall redraw rate (frames per second): low on purpose, the wall is ambient. */
export const LAB_WALL_HZ = 2;

/** Returns a clock check that is true at most `hz` times per second (now in seconds). */
export function createLabWallTicker(hz: number): (now: number) => boolean {
  let last = -Infinity;
  return (now) => {
    if (now - last < 1 / hz - 1e-9) return false;
    last = now;
    return true;
  };
}

/** Built-in code lines shown on the wall at time t (scrolling through CODE_LINES; never repo content). */
export function labWallCode(t: number, count: number): string[] {
  const start = Math.floor(Math.max(0, t) * 1.5);
  return Array.from({ length: count }, (_, i) => CODE_LINES[(start + i) % CODE_LINES.length] ?? '');
}

/** Training loss of the simulated model at a step (monotonically decreasing, positive). */
export const trainingLoss = (step: number): number => 0.08 + 2.2 * Math.exp(-Math.max(0, step) / 45);

const ATLAS_W = 1024;
const ATLAS_H = 512;
type Cell = readonly [x: number, y: number, w: number, h: number];
const CELL = {
  wall: [0, 0, 1024, 224],
  board: [0, 232, 512, 184],
  phone: [520, 232, 112, 184],
  tablet: [640, 232, 240, 184],
  ledGreen: [896, 232, 56, 56],
  ledBlue: [960, 232, 56, 56],
  pod: [520, 424, 240, 88],
} as const satisfies Record<string, Cell>;

/** Maps a geometry's 0..1 uvs into an atlas cell (canvas y down; textures flip y). */
function inCell(geo: BufferGeometry, [x, y, w, h]: Cell): BufferGeometry {
  const uv = geo.attributes.uv;
  if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / ATLAS_W, 1 - (y + (1 - uv.getY(i)) * h) / ATLAS_H);
  return geo;
}

/** Vertex colour for the polished mesh. */
function painted(geo: BufferGeometry, color: number): BufferGeometry {
  const c = new Color(color);
  const n = geo.attributes.position?.count ?? 0;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

/** Bends a geometry along x onto an arc of radius r (concave toward +z). */
function bend(geo: BufferGeometry, r: number): BufferGeometry {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) / r;
    pos.setXYZ(i, r * Math.sin(a), pos.getY(i), pos.getZ(i) + r * (1 - Math.cos(a)));
  }
  geo.computeVertexNormals();
  return geo;
}

const font = (px: number, mono = false): string => `${px}px ${mono ? 'ui-monospace, Menlo, monospace' : 'system-ui, sans-serif'}`;

/** Draws the static atlas cells (whiteboard, device and pod screens). */
function drawStatic(g: CanvasRenderingContext2D): void {
  // Whiteboard: an architecture diagram (client -> gateway -> services -> data), marker style.
  const [bx, by, bw, bh] = CELL.board;
  g.fillStyle = '#fbfaf6';
  g.fillRect(bx, by, bw, bh);
  g.lineWidth = 3;
  g.font = font(15);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const node = (x: number, y: number, w: number, label: string, color: string): void => {
    g.strokeStyle = color;
    g.strokeRect(bx + x - w / 2, by + y - 16, w, 32);
    g.fillStyle = '#2f3540';
    g.fillText(label, bx + x, by + y);
  };
  const arrow = (x0: number, y0: number, x1: number, y1: number): void => {
    g.strokeStyle = '#4a5160';
    g.beginPath();
    g.moveTo(bx + x0, by + y0);
    g.lineTo(bx + x1, by + y1);
    const a = Math.atan2(y1 - y0, x1 - x0);
    g.lineTo(bx + x1 - 10 * Math.cos(a - 0.4), by + y1 - 10 * Math.sin(a - 0.4));
    g.moveTo(bx + x1, by + y1);
    g.lineTo(bx + x1 - 10 * Math.cos(a + 0.4), by + y1 - 10 * Math.sin(a + 0.4));
    g.stroke();
  };
  node(60, 92, 90, 'İstemci', '#3d7bd9');
  node(190, 92, 100, 'API geçidi', '#d9822b');
  node(340, 44, 110, 'Kimlik', '#3c9a5f');
  node(340, 92, 110, 'Sipariş', '#3c9a5f');
  node(340, 140, 110, 'Model servis', '#8a5cc7');
  node(462, 92, 76, 'Veri', '#c2453d');
  arrow(105, 92, 140, 92);
  arrow(240, 84, 285, 50);
  arrow(240, 92, 285, 92);
  arrow(240, 100, 285, 136);
  for (const y of [44, 92, 140]) arrow(395, y, 424, 92);
  g.fillStyle = '#7a7f87';
  g.font = font(13);
  g.fillText('mimari v3 · olay güdümlü · p95 < 120 ms', bx + bw / 2, by + bh - 14);
  // Device screens: a phone app and a tablet dashboard.
  const app = (cell: Cell, wide: boolean): void => {
    const [x, y, w, h] = cell;
    g.fillStyle = '#f4f7fb';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#5b8fd6';
    g.fillRect(x, y, w, h * 0.16);
    const cols = wide ? 3 : 1;
    for (let r = 0; r < 4; r++) for (let c = 0; c < cols; c++) {
      g.fillStyle = ['#cfe0f5', '#f6d9b8', '#cdeccf', '#e6d5f3'][(r + c) % 4] ?? '#cfe0f5';
      g.fillRect(x + 8 + (c * (w - 16)) / cols, y + h * 0.22 + r * h * 0.19, (w - 16) / cols - 6, h * 0.15);
    }
  };
  app(CELL.phone, false);
  app(CELL.tablet, true);
  // Pod screens: a shared board of sticky notes.
  const [px, py, pw, ph] = CELL.pod;
  g.fillStyle = '#1d2a3a';
  g.fillRect(px, py, pw, ph);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = ['#ffe39a', '#a9e5c4', '#f6b8b0', '#b8d4f6'][i % 4] ?? '#ffe39a';
    g.fillRect(px + 10 + (i % 5) * 46, py + 10 + Math.floor(i / 5) * 40, 38, 30);
  }
}

/** Draws the animated cells (video wall and status LEDs) for time t (seconds). */
function drawLive(g: CanvasRenderingContext2D, t: number): void {
  const [x, y, w, h] = CELL.wall;
  const bg = g.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#0f2134');
  bg.addColorStop(1, '#132b40');
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  // Left: scrolling code.
  g.font = font(15, true);
  labWallCode(t, 10).forEach((line, i) => {
    g.fillStyle = ['#9fd3ff', '#ffd59a', '#b7f0c8', '#e3c8ff'][i % 4] ?? '#9fd3ff';
    g.fillText(line, x + 18, y + 26 + i * 19, 300);
  });
  // Middle: model training (loss falling, accuracy rising) up to the current step.
  const cx = x + 350;
  const cw = 360;
  const top = y + 30;
  const ch = h - 64;
  g.strokeStyle = '#3d5a78';
  g.lineWidth = 1;
  g.strokeRect(cx, top, cw, ch);
  const steps = 200;
  const now = Math.floor((t * 8) % steps);
  const line = (f: (s: number) => number, color: string): void => {
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    for (let s = 0; s <= now; s += 2) {
      const px = cx + (s / steps) * cw;
      const py = top + ch - Math.min(1, Math.max(0, f(s))) * ch;
      if (s === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  };
  line((s) => trainingLoss(s) / 2.4, '#ffb36b');
  line((s) => 0.97 - trainingLoss(s) / 2.6, '#6fe3b5');
  g.fillStyle = '#d8e6f3';
  g.font = font(15);
  g.fillText(`model eğitimi · adım ${now}/${steps} · kayıp ${trainingLoss(now).toFixed(3)}`, cx, y + 20);
  // Right: throughput bars and a build status line.
  const rx = x + 750;
  for (let i = 0; i < 8; i++) {
    const v = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.8));
    g.fillStyle = i % 2 ? '#5b9df0' : '#7fc4ff';
    g.fillRect(rx + i * 30, y + h - 34 - v * 120, 20, v * 120);
  }
  g.fillStyle = '#b7f0c8';
  g.fillText('derleme ✓ · testler 412/412', rx, y + 20);
  // Status LEDs: a soft breathing glow.
  for (const [cell, color] of [[CELL.ledGreen, '111, 227, 160'], [CELL.ledBlue, '120, 180, 255']] as const) {
    const [lx, ly, lw, lh] = cell;
    const a = 0.75 + 0.25 * Math.sin(t * 2.2 + lx);
    const r = g.createRadialGradient(lx + lw / 2, ly + lh / 2, 2, lx + lw / 2, ly + lh / 2, lw / 2);
    r.addColorStop(0, `rgba(${color}, ${a})`);
    r.addColorStop(1, 'rgba(10, 20, 30, 1)');
    g.fillStyle = r;
    g.fillRect(lx, ly, lw, lh);
  }
}

/** Display material: the atlas canvas in the browser (redrawn at LAB_WALL_HZ), plain light cyan elsewhere. */
function displayMaterial(k: Kit): { material: MeshBasicMaterial; tick: ((now: number) => void) | null } {
  const canvas = k.textures.wood && typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g = canvas?.getContext('2d') ?? null;
  if (!canvas || !g) return { material: new MeshBasicMaterial({ color: 0xbfe9ff, toneMapped: false }), tick: null };
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  g.fillStyle = '#0f2134';
  g.fillRect(0, 0, ATLAS_W, ATLAS_H);
  drawStatic(g);
  drawLive(g, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const due = createLabWallTicker(LAB_WALL_HZ);
  const t0 = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const tick = reduced
    ? null
    : (now: number): void => {
        if (!due(now)) return;
        drawLive(g, now - t0);
        tex.needsUpdate = true;
      };
  return { material: new MeshBasicMaterial({ color: 0xffffff, map: tex, toneMapped: false }), tick };
}

/** Rev 37 gallery finishes: bronze details, honed travertine floor, walnut tops. */
const BRASS = 0xa8783f;
const POLISHED = 0xece4d6;
const WALNUT = 0x6b4a33;

function star(r: number): ShapeGeometry {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    if (i === 0) s.moveTo(rr * Math.cos(a), rr * Math.sin(a));
    else s.lineTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  return new ShapeGeometry(s);
}

function rndLab(k: Kit, p: Paints, g: Group, materials: FloorMaterials): void {
  const disp: BufferGeometry[] = [];
  const shine: BufferGeometry[] = [];
  const brass = (w: number, h: number, d: number, x: number, y: number, z: number): void => {
    shine.push(painted(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), BRASS));
  };
  const screenAt = (geo: BufferGeometry, cell: Cell): void => {
    disp.push(inCell(geo, cell));
  };

  // Polished warm stone floor over the lab (north room and south-east room), brass inlays and a star at the entry.
  shine.push(painted(new BoxGeometry(5.63, 0.004, 5.15).translate(X(2.635), Y + 0.004, -2.875), POLISHED));
  shine.push(painted(new BoxGeometry(4.85, 0.004, 5.75).translate(X(3.025), Y + 0.004, 2.575), POLISHED));
  brass(5.63, 0.003, 0.04, X(2.635), Y + 0.006, -1.6);
  brass(4.85, 0.003, 0.04, X(3.025), Y + 0.006, -0.25);
  brass(0.04, 0.003, 5.7, X(0.62), Y + 0.006, 2.6);
  shine.push(painted(star(0.32).rotateX(-Math.PI / 2).translate(X(2.9), Y + 0.008, -0.9), BRASS));

  // Hero: curved LED video wall on the north glass, dark bezel, brass trims and a warm floor cove.
  const R = 6;
  const wallX = X(2.65);
  const wallZ = -5.3;
  const wy = Y + 0.15;
  screenAt(bend(new PlaneGeometry(4.6, 0.98, 32, 1), R).translate(wallX, wy + 0.5, wallZ), CELL.wall);
  k.place(g, bend(new BoxGeometry(4.74, 1.1, 0.06, 32, 1, 1), R), p.dark, wallX, wy + 0.5, wallZ - 0.045);
  for (const yy of [wy - 0.05, wy + 1.04]) shine.push(painted(bend(new BoxGeometry(4.78, 0.03, 0.07, 32, 1, 1), R).translate(wallX, yy, wallZ - 0.02), BRASS));
  k.place(g, bend(new BoxGeometry(4.5, 0.02, 0.05, 32, 1, 1), R), p.warm, wallX, Y + 0.01, wallZ + 0.16, 'none');

  // Whiteboard wall (architecture diagrams) on the partition to the nap pods, facing the lab.
  k.box(g, 0.1, 1.15, 2.55, 0.02, p.white, X(-0.25), Y, -4.175);
  screenAt(new PlaneGeometry(2.4, 0.84).rotateY(Math.PI / 2).translate(X(-0.193), Y + 0.68, -4.175), CELL.board);
  for (const yy of [Y + 0.24, Y + 1.1]) brass(0.025, 0.025, 2.46, X(-0.188), yy, -4.175);
  k.box(g, 0.07, 0.03, 2.0, 0, p.steel, X(-0.16), Y + 0.2, -4.175);
  planter(k, p, g, X(-0.5), -2.85, X(-0.1), -2.3);

  // Workstations: a long white desk with wide monitors and keyboards (seats face north).
  shine.push(painted(new BoxGeometry(1.6, 0.04, 0.5).translate(X(1.5), Y + 0.4, -2.95), WALNUT));
  for (const dx of [-0.74, 0.74]) k.box(g, 0.05, 0.38, 0.44, 0, p.steel, X(1.5 + dx), Y, -2.95);
  brass(1.6, 0.015, 0.015, X(1.5), Y + 0.405, -2.7);
  for (const lx of [1.1, 1.9]) {
    k.box(g, 0.56, 0.32, 0.03, 0.01, p.dark, X(lx), Y + 0.5, -3.1);
    k.box(g, 0.52, 0.28, 0.006, 0, p.screen, X(lx), Y + 0.52, -3.082, 'none');
    k.box(g, 0.04, 0.1, 0.04, 0, p.steel, X(lx), Y + 0.42, -3.1);
    k.box(g, 0.34, 0.015, 0.12, 0, p.offWhite, X(lx), Y + 0.42, -2.85);
  }

  // Prototype bench with a robot arm, a circuit board, a drone frame and a telemetry screen.
  k.box(g, 1.6, 0.05, 0.5, 0.02, p.white, X(4.3), Y + 0.38, -2.95);
  for (const dx of [-0.74, 0.74]) k.box(g, 0.05, 0.38, 0.44, 0, p.steel, X(4.3 + dx), Y, -2.95);
  k.box(g, 0.9, 0.006, 0.36, 0, p.book(3), X(4.15), Y + 0.43, -2.95);
  const ax = X(4.75);
  const az = -3.0;
  const top = Y + 0.43;
  k.cyl(g, 0.12, 0.13, 0.06, p.dark, ax, top, az, 20);
  k.cyl(g, 0.08, 0.09, 0.14, p.white, ax, top + 0.06, az, 16);
  const sh = new Vector3(ax, top + 0.24, az);
  const link = (from: Vector3, len: number, ang: number, w: number): Vector3 => {
    const to = from.clone().add(new Vector3(-Math.sin(ang) * len, Math.cos(ang) * len, 0));
    const seg = k.box(g, w, len, w, 0.02, p.white, (from.x + to.x) / 2, 0, az);
    seg.position.y = (from.y + to.y) / 2;
    seg.rotation.z = ang;
    return to;
  };
  k.ball(g, 0.075, p.book(0), sh.x, sh.y, sh.z);
  const elbow = link(sh, 0.42, 0.45, 0.075);
  k.ball(g, 0.065, p.book(0), elbow.x, elbow.y, elbow.z);
  const wrist = link(elbow, 0.34, 1.9, 0.06);
  k.ball(g, 0.045, p.dark, wrist.x, wrist.y, wrist.z);
  for (const dz of [-0.03, 0.03]) k.box(g, 0.02, 0.08, 0.015, 0, p.steel, wrist.x, wrist.y - 0.11, az + dz);
  k.box(g, 0.16, 0.012, 0.12, 0, p.book(3), wrist.x - 0.02, top, az);
  const drone = k.box(g, 0.3, 0.025, 0.04, 0, p.dark, X(3.85), top + 0.01, -2.9);
  drone.rotation.y = Math.PI / 4;
  const drone2 = k.box(g, 0.3, 0.025, 0.04, 0, p.dark, X(3.85), top + 0.01, -2.9);
  drone2.rotation.y = -Math.PI / 4;
  k.box(g, 0.36, 0.24, 0.03, 0.01, p.dark, X(4.3), top + 0.06, -3.15);
  k.box(g, 0.32, 0.2, 0.006, 0, p.screen, X(4.3), top + 0.08, -3.132, 'none');
  brass(1.6, 0.015, 0.015, X(4.3), Y + 0.415, -2.7);

  // Device lab wall: shelves of phones and tablets on the east wall, screens facing the lab.
  k.box(g, 0.06, 1.1, 2.7, 0, p.dark, X(5.4), Y + 0.05, 1.25);
  for (const yy of [0.25, 0.5, 0.75, 1.0]) {
    k.box(g, 0.18, 0.02, 2.6, 0, p.white, X(5.3), Y + yy, 1.25);
    let z = 0.05;
    for (let i = 0; i < 8; i++) {
      const tablet = i % 3 === 2;
      const w = tablet ? 0.2 : 0.075;
      const h = tablet ? 0.15 : 0.14;
      z += w / 2;
      k.box(g, 0.012, h + 0.012, w + 0.012, 0, p.dark, X(5.26), Y + yy + 0.02, z);
      screenAt(new PlaneGeometry(w, h).rotateY(-Math.PI / 2).translate(X(5.252), Y + yy + 0.026 + h / 2, z), tablet ? CELL.tablet : CELL.phone);
      z += w / 2 + 0.17;
    }
  }
  brass(0.02, 0.02, 2.7, X(5.21), Y + 1.12, 1.25);

  // Glass GPU cluster in the south-east corner: racks with soft status LEDs behind a brass-framed enclosure.
  k.box(g, 1.75, 1.15, 0.012, 0, p.glass, X(4.575), Y, 3.0, 'none');
  k.box(g, 0.012, 1.15, 2.45, 0, p.glass, X(3.7), Y, 4.225, 'none');
  for (const [lx, z] of [[3.7, 3.0], [5.42, 3.0], [3.7, 5.42]] as const) brass(0.04, 1.17, 0.04, X(lx), Y, z);
  brass(1.75, 0.03, 0.04, X(4.575), Y + 1.15, 3.0);
  brass(0.04, 0.03, 2.45, X(3.7), Y + 1.15, 4.225);
  k.box(g, 1.6, 0.006, 0.08, 0, p.screen, X(4.6), Y + 0.004, 4.2, 'none');
  for (const lx of [4.05, 4.6, 5.15]) {
    k.box(g, 0.46, 1.02, 0.6, 0.02, p.dark, X(lx), Y, 4.6);
    for (const yy of [0.3, 0.6]) k.box(g, 0.42, 0.012, 0.005, 0, p.steel, X(lx), Y + yy, 4.297);
    for (let r = 0; r < 5; r++) for (const dx of [-0.15, -0.09]) {
      const cell = (r + Math.round(lx * 10)) % 3 === 0 ? CELL.ledBlue : CELL.ledGreen;
      screenAt(new PlaneGeometry(0.035, 0.035).rotateY(Math.PI).translate(X(lx) + dx, Y + 0.15 + r * 0.17, 4.296), cell);
    }
  }

  // Collaboration pods: white shells lined with felt, a desk and a shared screen at the back.
  for (const lx of [1.9, 3.05]) {
    k.box(g, 1.1, 1.15, 0.12, 0.04, p.white, X(lx), Y, 5.33);
    for (const dx of [-0.5, 0.5]) {
      k.box(g, 0.1, 1.15, 2.0, 0.03, p.white, X(lx + dx), Y, 4.4);
      k.box(g, 0.012, 0.9, 1.8, 0, p.book(4), X(lx + dx * 0.88), Y + 0.15, 4.45);
      brass(0.11, 0.02, 0.02, X(lx + dx), Y + 1.15, 3.41);
    }
    shine.push(painted(new BoxGeometry(0.86, 0.04, 0.34).translate(X(lx), Y + 0.38, 4.88), WALNUT));
    k.box(g, 0.05, 0.36, 0.3, 0, p.steel, X(lx), Y, 4.88);
    screenAt(new PlaneGeometry(0.8, 0.3).rotateY(Math.PI).translate(X(lx), Y + 0.72, 5.265), CELL.pod);
  }

  // Seats at every lab spot, greenery.
  // One stool colour (a new seat colour would cost a draw call); pod stools get a felt cushion.
  for (const s of spotsOf(2, 'lab-bench')) {
    g.add(at(stool(k, BLUE ?? PALETTE.white), s.x, Y, s.z));
    if (LAB_STATIONS.get(s.id) === 'pod') k.box(g, 0.22, 0.03, 0.22, 0.01, p.book(4), s.x, Y + 0.33, s.z);
  }
  planter(k, p, g, X(1.4), -0.3, X(3.8), 0.15);
  g.add(at(plant(k, 1.3), X(5.2), Y, -4.42));

  // One display mesh (atlas) and one polished mesh for the whole lab.
  const { material, tick } = displayMaterial(k);
  materials.contents.push(material);
  const displays = new Mesh(merged(disp), material);
  displays.name = 'rnd-displays';
  displays.userData.shadow = 'none';
  if (tick) displays.onBeforeRender = () => tick(performance.now() / 1000);
  g.add(displays);
  const polished = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.18, metalness: 0.12, emissive: 0xffd9a0, emissiveIntensity: 0.06 });
  polished.userData.glow = { day: 0.06, night: 0.3 };
  k.glows.push(polished);
  materials.slab.push(polished);
  const shineMesh = new Mesh(merged(shine), polished);
  shineMesh.name = 'rnd-polished';
  shineMesh.userData.shadow = 'surface';
  shineMesh.receiveShadow = true;
  g.add(shineMesh);
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts) ?? new BoxGeometry(0.01, 0.01, 0.01);
  for (const p of parts) p.dispose();
  return out;
}

/** Furnishes one wing level (0, 1 or 2) into `group` with the floor's kit and materials. */
export function buildAmenities(k: Kit, floor: number, group: Group, materials: FloorMaterials): void {
  if (floor === 0) level0(k, group);
  else if (floor === 1) level1(k, group);
  else if (floor === 2) level2(k, group, materials);
}
