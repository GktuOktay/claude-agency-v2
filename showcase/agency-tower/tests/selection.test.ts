import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot } from './helpers';
import { createSelectionFlow } from '../src/app/selection';
import { CameraRig, floorPose, rideDuration, OVERVIEW_DURATION, ZOOM_DURATION } from '../src/scene/camera';
import { createActivitySim } from '../src/scene/activity';
import { buildTower } from '../src/scene/model';
import { createCard } from '../src/ui/card';
import { createUnitList, sortUnits } from '../src/ui/unitList';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

const DT = 1 / 60;

function setup() {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  const data = r.data;
  const model = buildTower(data);
  const sim = createActivitySim(
    model.robots.map((x) => ({ id: x.unit.id, home: x.homePoint, work: x.workPoint, coffee: x.coffeePoint })),
    7,
  );
  const rig = new CameraRig();
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  const names = new Map(data.units.map((u) => [u.id, u.name]));
  let exitedOrg = 0;
  let cardRef: ReturnType<typeof createCard> | null = null;
  const flow = createSelectionFlow({
    rig,
    sim,
    model,
    getCard: () => cardRef as NonNullable<typeof cardRef>,
    exitOrg: () => void exitedOrg++,
  });
  const card = createCard(host, { resolveName: (id) => names.get(id) ?? id, onClose: () => flow.onCardClosed() });
  cardRef = card;
  const run = (maxSeconds = 10) => {
    let t = 0;
    while (rig.busy && t < maxSeconds) {
      rig.update(DT);
      t += DT;
    }
    return t;
  };
  const opener = document.createElement('button');
  document.body.append(opener);
  return { data, model, sim, rig, card, flow, run, opener, host, exited: () => exitedOrg };
}

describe('selection flow (AC-10)', () => {
  it('from overview: 1.2 s to the floor view, then 0.6 s zoom within 3.5 units, then the card opens; robot waves', () => {
    const s = setup();
    s.flow.select(s.data.units.find((u) => u.id === 'scout')!, s.opener);
    expect(s.sim.get('scout').kind).toBe('wave');
    expect(s.card.isOpen()).toBe(false);
    const t = s.run();
    expect(Math.abs(t - (OVERVIEW_DURATION + ZOOM_DURATION))).toBeLessThanOrEqual(DT * 3);
    expect(s.card.isOpen()).toBe(true);
    expect(s.host.textContent).toContain('scout');
    expect(s.rig.floor).toBe(3);
    expect(s.model.view).toEqual({ mode: 'floor', focusFloor: 3 });
  });

  it('zoom ends within 3.5 units of the robot', () => {
    const s = setup();
    const unit = s.data.units.find((u) => u.id === 'scout')!;
    s.flow.select(unit, s.opener);
    s.run();
    const a = s.sim.get('scout');
    expect(s.rig.position.distanceTo(new Vector3(a.x, a.y, a.z))).toBeLessThanOrEqual(3.5);
  });

  it('from another floor: ride duration then 0.6 s zoom', () => {
    const s = setup();
    s.rig.goToFloor(5);
    s.run();
    s.flow.select(s.data.units.find((u) => u.id === 'marketing')!, s.opener);
    const t = s.run();
    const expected = rideDuration(5) + ZOOM_DURATION;
    expect(Math.abs(t - expected)).toBeLessThanOrEqual(DT * 3);
    expect(s.card.isOpen()).toBe(true);
  });

  it('same floor: the 0.6 s zoom only', () => {
    const s = setup();
    s.rig.goToFloor(3);
    s.run();
    s.flow.select(s.data.units.find((u) => u.id === 'scout')!, s.opener);
    const t = s.run();
    expect(Math.abs(t - ZOOM_DURATION)).toBeLessThanOrEqual(DT * 2);
    expect(s.card.isOpen()).toBe(true);
  });

  it('closing returns to the floor view within 0.6 s, resumes the cycle and restores focus to the opener', () => {
    const s = setup();
    s.flow.select(s.data.units.find((u) => u.id === 'scout')!, s.opener);
    s.run();
    s.host.querySelector<HTMLButtonElement>('.card-close')?.click();
    expect(s.card.isOpen()).toBe(false);
    expect(document.activeElement).toBe(s.opener);
    expect(s.sim.get('scout').kind).not.toBe('wave');
    const t = s.run();
    expect(t).toBeLessThanOrEqual(0.6 + DT * 2);
    expect(s.rig.position.distanceTo(floorPose(3).pos)).toBeLessThan(0.01);
  });

  it('selecting while another card is open releases the first robot', () => {
    const s = setup();
    s.flow.select(s.data.units.find((u) => u.id === 'scout')!, s.opener);
    s.run();
    s.flow.select(s.data.units.find((u) => u.id === 'qa-engineer')!, s.opener);
    expect(s.sim.get('scout').kind).not.toBe('wave');
    expect(s.sim.get('qa-engineer').kind).toBe('wave');
    s.run();
    expect(s.rig.floor).toBe(2);
  });

  it('selecting from org mode leaves org mode', () => {
    const s = setup();
    s.flow.select(s.data.units.find((u) => u.id === 'scout')!, s.opener, { fromOrg: true });
    expect(s.exited()).toBe(1);
  });

  it('the card shows tools and model equal to the roster for every agent unit; every unit is selectable via the list', () => {
    const s = setup();
    const byName = new Map(roster.agents.map((a) => [a.name, a]));
    const list = createUnitList(s.data.units, (u, op) => s.flow.select(u, op));
    document.body.append(list.element);
    expect(list.element.querySelectorAll('button')).toHaveLength(s.data.units.length);
    for (const u of sortUnits(s.data.units)) {
      list.buttonFor(u.id)?.click();
      s.run();
      const text = s.host.querySelector('[role="dialog"]')?.textContent ?? '';
      const agent = byName.get(u.id);
      if (agent) {
        expect(text).toContain(agent.tools.join(', '));
        expect(text).toContain(agent.model ?? '—');
        expect(text).toContain(agent.description);
      }
      for (const label of ['Rol', 'Açıklama', 'Araçlar', 'Model', 'Bağlı olduğu']) expect(text).toContain(label);
    }
    expect(readFileSync(join(appRoot, 'index.html'), 'utf8')).toContain('<html lang="tr">');
  });
});
