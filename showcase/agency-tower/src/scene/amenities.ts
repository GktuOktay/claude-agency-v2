// Campus wing amenities (KARARLAR rev 31): cafeteria, snack bar and terrace (level 0); gym and game room
// (level 1); nap pods, R&D lab and the project archive (level 2); greenery on every level. Procedural
// geometry with the floor's kit; repeats are instanced (green-wall leaves, archive boxes). Positions follow
// the footprints in src/sim/layout.ts (wingFurniture) so the nav graph keeps clear of everything.
import { BoxGeometry, CanvasTexture, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SphereGeometry, SRGBColorSpace, Vector3, type BufferGeometry, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, bistroTable, fridge, plant, stool, type Kit } from './furniture';
import type { FloorMaterials } from './model';
import { AMENITY_SPOTS, FLOOR_TOP, wingX, type AmenityKind } from '../sim/layout';

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
function greenWall(k: Kit, p: Paints, parent: Group, x: number, z0: number, z1: number, name: string): void {
  k.box(parent, 0.08, 1.1, z1 - z0, 0, p.leafDark, x, Y, (z0 + z1) / 2);
  const cols = Math.round((z1 - z0) / 0.32);
  const rows = 5;
  const leaves = new InstancedMesh(new IcosahedronGeometry(0.14, 0), k.m(0xffffff, { roughness: 0.85 }), cols * rows);
  const m = new Matrix4();
  const q = new Quaternion();
  const tones = [new Color(PALETTE.leaf), new Color(PALETTE.leafDark), new Color(0x86b86a), new Color(0x5f9157)];
  let i = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const s = 0.8 + ((c * 7 + r * 3) % 5) * 0.1;
      m.compose(new Vector3(x + 0.08, Y + 0.15 + r * 0.22 + (c % 2) * 0.08, z0 + 0.16 + c * 0.32), q, new Vector3(s * 0.7, s, s));
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
  planter(k, p, g, X(-0.5), -5.45, X(-0.1), -2.3);
  // R&D lab: screen wall on the north glass, prototype stands, two lab benches with kit, lab stools.
  k.box(g, 4.6, 0.95, 0.08, 0, p.dark, X(2.75), Y + 0.15, -5.4);
  k.box(g, 4.4, 0.8, 0.012, 0, p.screen, X(2.75), Y + 0.22, -5.35, 'none');
  for (let i = 0; i < 6; i++) k.box(g, 0.5, 0.05 + (i % 3) * 0.12, 0.006, 0, p.warm, X(0.9 + i * 0.72), Y + 0.32, -5.34, 'none');
  [1.2, 2.5, 3.8].forEach((lx, i) => {
    k.box(g, 0.36, 0.5, 0.36, 0.02, p.white, X(lx), Y, -4.3);
    if (i === 0) {
      k.box(g, 0.24, 0.04, 0.24, 0, p.dark, X(lx), Y + 0.56, -4.3);
      for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]] as const) k.cyl(g, 0.06, 0.06, 0.01, p.book(0), X(lx) + dx, Y + 0.6, -4.3 + dz, 12);
    } else if (i === 1) {
      k.ball(g, 0.14, p.book(3), X(lx), Y + 0.64, -4.3);
    } else {
      k.cyl(g, 0.03, 0.03, 0.3, p.steel, X(lx), Y + 0.5, -4.3, 8);
      k.box(g, 0.2, 0.04, 0.04, 0, p.book(4), X(lx) + 0.08, Y + 0.8, -4.3);
    }
  });
  for (const [lx0, lx1] of [[1.0, 2.6], [3.2, 4.8]] as const) {
    const cx = X((lx0 + lx1) / 2);
    k.box(g, lx1 - lx0, 0.05, 0.6, 0.02, p.white, cx, Y + 0.4, -3.0);
    for (const dx of [-(lx1 - lx0) / 2 + 0.08, (lx1 - lx0) / 2 - 0.08]) k.box(g, 0.05, 0.4, 0.5, 0, p.steel, cx + dx, Y, -3.0);
    k.box(g, 0.4, 0.26, 0.03, 0, p.dark, cx - 0.35, Y + 0.48, -3.15);
    k.cyl(g, 0.05, 0.07, 0.22, p.steel, cx + 0.3, Y + 0.45, -3.1, 8);
    for (const dx of [0.0, 0.12]) k.cyl(g, 0.03, 0.03, 0.1, p.glass, cx + dx, Y + 0.45, -2.85, 10, 'none');
  }
  for (const s of spotsOf(2, 'lab-bench')) g.add(at(stool(k, BLUE ?? PALETTE.white), s.x, Y, s.z));
  // Prototype showroom (south-east): stands with glass vitrines.
  const stands: readonly (readonly [number, number, number])[] = [[2.6, 1.6, 0], [4.0, 3.2, 3], [2.6, 4.6, 4]];
  for (const [lx, z, c] of stands) {
    k.box(g, 0.5, 0.45, 0.5, 0.03, p.white, X(lx), Y, z);
    k.box(g, 0.46, 0.4, 0.46, 0, p.glass, X(lx), Y + 0.45, z, 'none');
    k.ball(g, 0.1, p.book(c), X(lx), Y + 0.58, z);
  }
  planter(k, p, g, X(4.6), 4.6, X(5.4), 5.4);
  planter(k, p, g, X(4.6), 0.0, X(5.4), 0.8);
  g.add(at(plant(k, 1.3), X(1.6), Y, 4.9));
  archive(k, p, g, materials);
}

/** Furnishes one wing level (0, 1 or 2) into `group` with the floor's kit and materials. */
export function buildAmenities(k: Kit, floor: number, group: Group, materials: FloorMaterials): void {
  if (floor === 0) level0(k, group);
  else if (floor === 1) level1(k, group);
  else if (floor === 2) level2(k, group, materials);
}
