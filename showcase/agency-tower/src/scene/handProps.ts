// Hand props (KARARLAR Rev 43 B): cup, dumbbell, tray, phone and marker as five tiny shared InstancedMeshes
// (one draw call each). Every frame the app attaches the props of each robot's action (src/scene/actions.ts)
// at its hand pivots; unused instances are not drawn (count). Budget: capacities sized to where each prop can
// appear, a few thousand vertices in total (build-budget.test.ts counts the full capacity).
import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three';
import { Sculptor, type Vec3 } from './outfits';
import type { HandProp } from './actions';
import type { RobotParts } from './robot';
import { AMENITY_SPOTS, type AmenitySpot } from '../sim/layout';

/** Palm of a robot hand in its arm pivot's frame (src/scene/robot.ts: hand at y -0.155). */
export const HAND_LOCAL: Vec3 = [0, -0.17, 0.02];
/** The tray in the body frame: in front of the chest, between both forward hands (pose 'tray-*'). */
const TRAY_LOCAL: Vec3 = [0, 0.27, 0.17];

const UNIT = {
  cyl8: new CylinderGeometry(1, 1, 1, 8),
  cyl6: new CylinderGeometry(1, 1, 1, 6, 1, true),
  box: new BoxGeometry(1, 1, 1),
} satisfies Record<string, BufferGeometry>;

function bake(fill: (s: Sculptor) => void): BufferGeometry {
  const s = new Sculptor();
  fill(s);
  const mesh = s.bake('p', () => new MeshStandardMaterial())[0];
  if (!mesh) throw new Error('hand props: empty geometry');
  (mesh.material as MeshStandardMaterial).dispose();
  return mesh.geometry;
}
const part = (s: Sculptor, shape: BufferGeometry, color: number, pos: Vec3, scale: Vec3, rot: Vec3 = [0, 0, 0]): void => s.add('p', 'base', shape, color, pos, scale, rot);

/** Prop geometry in robot pre-scale units, origin at the palm. */
const GEO: Record<HandProp, () => BufferGeometry> = {
  cup: () => bake((s) => part(s, UNIT.cyl8, 0xf4efe6, [0, 0.025, 0], [0.026, 0.06, 0.026])),
  dumbbell: () =>
    bake((s) => {
      part(s, UNIT.cyl6, 0x9aa3ad, [0, 0, 0], [0.008, 0.12, 0.008], [Math.PI / 2, 0, 0]);
      for (const z of [-0.05, 0.05]) part(s, UNIT.box, 0x2b2f36, [0, 0, z], [0.04, 0.04, 0.025]);
    }),
  tray: () =>
    bake((s) => {
      part(s, UNIT.box, 0x8a6a4a, [0, 0, 0], [0.22, 0.012, 0.15]);
      part(s, UNIT.cyl6, 0xf6f6f2, [-0.04, 0.012, 0], [0.045, 0.008, 0.045]);
      part(s, UNIT.cyl6, 0xd99a3c, [0.07, 0.03, 0.02], [0.018, 0.04, 0.018]);
    }),
  phone: () => bake((s) => part(s, UNIT.box, 0x1d2026, [0, 0.01, 0], [0.024, 0.046, 0.008])),
  marker: () => bake((s) => part(s, UNIT.cyl6, 0x2f6fd8, [0, -0.02, 0], [0.007, 0.06, 0.007])),
};

export interface HandProps {
  group: Group;
  mesh(kind: HandProp): InstancedMesh;
  /** Starts a frame: no prop is drawn until attached. */
  begin(): void;
  /** Places the props of one robot at its hands (`sip` 0..1 tilts the cup). Hidden robots are skipped. */
  attach(robot: Object3D, parts: RobotParts, props: readonly HandProp[], sip: number): void;
  /** Ends a frame: uploads the matrices and sets the drawn counts. */
  end(): void;
}

const visible = (o: Object3D): boolean => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

export function createHandProps(robotCount: number): HandProps {
  const group = new Group();
  group.name = 'hand-props';
  const n = Math.max(1, robotCount);
  const count = (k: AmenitySpot['kind'][]): number => AMENITY_SPOTS.filter((s) => k.includes(s.kind)).length;
  // Where each prop can appear: cups and phones on anyone; trays on the way to the cafeteria / terrace and at
  // the serving counter; dumbbells at the weight stations and mats (two each); markers at the lab whiteboard.
  const capacity: Record<HandProp, number> = {
    cup: n,
    phone: n,
    tray: Math.min(n, count(['dining', 'terrace', 'serving'])),
    dumbbell: 2 * Math.max(1, count(['weights', 'mat'])),
    marker: 2,
  };
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  const meshes = {} as Record<HandProp, InstancedMesh>;
  const used = {} as Record<HandProp, number>;
  for (const k of Object.keys(GEO) as HandProp[]) {
    const m = new InstancedMesh(GEO[k](), material, capacity[k]);
    m.name = `prop:${k}`;
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false; // instances span the whole tower
    m.castShadow = false;
    m.receiveShadow = false;
    meshes[k] = m;
    used[k] = 0;
    group.add(m);
  }

  const inv = new Matrix4();
  const m4 = new Matrix4();
  const pos = new Vector3();
  const q = new Quaternion();
  const scl = new Vector3();
  const tmpP = new Vector3();
  const tilt = new Quaternion();
  const AX = new Vector3(1, 0, 0);
  const robotQ = new Quaternion();
  const robotS = new Vector3();

  const put = (k: HandProp, p: Vector3, rot: Quaternion, s: Vector3): void => {
    const i = used[k];
    const mesh = meshes[k];
    if (i >= mesh.instanceMatrix.count) return; // over capacity: dropped, never thrown
    m4.compose(p, rot, s).premultiply(inv);
    mesh.setMatrixAt(i, m4);
    used[k] = i + 1;
  };
  const hand = (arm: Object3D): Vector3 => tmpP.set(HAND_LOCAL[0], HAND_LOCAL[1], HAND_LOCAL[2]).applyMatrix4(arm.matrixWorld);

  return {
    group,
    mesh: (k) => meshes[k],
    begin() {
      for (const k of Object.keys(used) as HandProp[]) used[k] = 0;
      group.updateWorldMatrix(true, false);
      inv.copy(group.matrixWorld).invert();
    },
    attach(robot, parts, props, sip) {
      if (props.length === 0 || !visible(robot)) return;
      robot.updateMatrixWorld(true);
      robot.matrixWorld.decompose(pos, robotQ, robotS);
      for (const k of props) {
        if (k === 'cup') {
          tilt.setFromAxisAngle(AX, -0.7 * sip);
          put(k, hand(parts.armR), q.copy(robotQ).multiply(tilt), robotS);
        } else if (k === 'phone') {
          put(k, hand(parts.armR), robotQ, robotS);
        } else if (k === 'tray') {
          put(k, tmpP.set(TRAY_LOCAL[0], TRAY_LOCAL[1], TRAY_LOCAL[2]).applyMatrix4(parts.body.matrixWorld), robotQ, robotS);
        } else {
          for (const arm of k === 'dumbbell' ? [parts.armL, parts.armR] : [parts.armR]) {
            arm.matrixWorld.decompose(pos, q, scl);
            put(k, hand(arm), q, scl);
          }
        }
      }
    },
    end() {
      for (const k of Object.keys(meshes) as HandProp[]) {
        const m = meshes[k];
        m.count = used[k];
        m.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
