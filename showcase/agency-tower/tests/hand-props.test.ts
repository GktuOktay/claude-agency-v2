// Rev 43 B props: cup, dumbbell, tray, phone, marker as tiny shared InstancedMeshes placed at the robot's hand.
import { describe, it, expect } from 'vitest';
import { Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { createHandProps, HAND_LOCAL } from '../src/scene/handProps';
import { applyPose } from '../src/scene/pose';
import type { RobotParts } from '../src/scene/robot';

function robot(x: number): { group: Group; parts: RobotParts } {
  const group = new Group();
  group.position.set(x, 0, 0);
  group.scale.setScalar(1.4);
  const body = new Group();
  const head = new Group();
  const armL = new Group();
  armL.position.set(-0.145, 0.33, 0);
  const armR = new Group();
  armR.position.set(0.145, 0.33, 0);
  const legL = new Group();
  const legR = new Group();
  body.add(head, armL, armR);
  group.add(body, legL, legR);
  return { group, parts: { body, head, armL, armR, legL, legR } };
}

const pos = (m: InstancedMesh, i: number): Vector3 => {
  const t = new Matrix4();
  m.getMatrixAt(i, t);
  return new Vector3().setFromMatrixPosition(t);
};

describe('hand props (Rev 43 B)', () => {
  it('five shared instanced meshes, a handful of vertices each', () => {
    const hp = createHandProps(30);
    const meshes = hp.group.children.filter((c): c is InstancedMesh => c instanceof InstancedMesh);
    expect(meshes.map((m) => m.name).sort()).toEqual(['prop:cup', 'prop:dumbbell', 'prop:marker', 'prop:phone', 'prop:tray']);
    for (const m of meshes) expect(m.geometry.attributes.position?.count ?? 0).toBeLessThan(200);
    const capacity = meshes.reduce((n, m) => n + m.count * (m.geometry.attributes.position?.count ?? 0), 0);
    expect(capacity).toBeLessThan(15_000);
  });

  it('a cup sits at the right hand; a dumbbell in each hand; nothing drawn without an attach', () => {
    const root = new Group();
    const hp = createHandProps(4);
    root.add(hp.group);
    const a = robot(2);
    const b = robot(-3);
    root.add(a.group, b.group);
    applyPose(a.parts, 'sip', 0, 0);
    applyPose(b.parts, 'lift', 0, 0);
    root.updateMatrixWorld(true);
    hp.begin();
    hp.attach(a.group, a.parts, ['cup'], 0);
    hp.attach(b.group, b.parts, ['dumbbell'], 0);
    hp.end();
    const cup = hp.mesh('cup');
    const db = hp.mesh('dumbbell');
    expect(cup.count).toBe(1);
    expect(db.count).toBe(2);
    const hand = new Vector3(...HAND_LOCAL).applyMatrix4(a.parts.armR.matrixWorld);
    expect(pos(cup, 0).distanceTo(hand)).toBeLessThan(0.05);
    const hl = new Vector3(...HAND_LOCAL).applyMatrix4(b.parts.armL.matrixWorld);
    const hr = new Vector3(...HAND_LOCAL).applyMatrix4(b.parts.armR.matrixWorld);
    const got = [pos(db, 0), pos(db, 1)];
    expect(Math.min(...got.map((p) => p.distanceTo(hl)))).toBeLessThan(0.05);
    expect(Math.min(...got.map((p) => p.distanceTo(hr)))).toBeLessThan(0.05);
    hp.begin();
    hp.end();
    expect(cup.count).toBe(0);
    expect(db.count).toBe(0);
  });

  it('a hidden robot (another floor) shows no prop; capacity overflow drops props instead of throwing', () => {
    const root = new Group();
    const hp = createHandProps(1);
    root.add(hp.group);
    const a = robot(0);
    const floor = new Group();
    floor.visible = false;
    floor.add(a.group);
    root.add(floor);
    root.updateMatrixWorld(true);
    hp.begin();
    hp.attach(a.group, a.parts, ['phone'], 0);
    hp.end();
    expect(hp.mesh('phone').count).toBe(0);
    floor.visible = true;
    hp.begin();
    for (let i = 0; i < 5; i++) hp.attach(a.group, a.parts, ['phone'], 0);
    hp.end();
    expect(hp.mesh('phone').count).toBe(1);
  });
});
