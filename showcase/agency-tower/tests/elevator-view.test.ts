// Staff cabin view adapter (spec 0002 REQ-14, §7.5b, AC-13): each frame the elevator simulation's
// cabin height, door opening and lit call buttons are copied onto model.staffCabin.
import { describe, expect, it } from 'vitest';
import { syncStaffCabin, syncStaffCabinFrom } from '../src/app/elevatorView';
import { createElevator } from '../src/sim/elevator';
import { createTimedMovement } from '../src/sim/movement';
import { createNavMovement } from '../src/sim/navMovement';
import { FLOOR_COUNT, floorY } from '../src/sim/layout';
import { buildTower, type TowerModel } from '../src/scene/model';
import { loadData } from '../src/data/loader';
import roster from '../src/data/roster.generated.json';
import hierarchy from '../src/data/hierarchy.json';

function model(): TowerModel {
  const r = loadData(roster, hierarchy);
  if (!r.ok) throw new Error('data');
  return buildTower(r.data);
}

describe('syncStaffCabin (REQ-14)', () => {
  it('copies cabin height, door opening and every floor call light from the elevator', () => {
    const el = createElevator({ startFloor: 0 });
    const m = model();
    el.call('qa-engineer', 2, 4);
    syncStaffCabin(el, m.staffCabin);
    for (let f = 0; f < FLOOR_COUNT; f++) expect(m.staffCabin.isCallLit(f), `floor ${f}`).toBe(f === 2);

    let sawTravel = false;
    let sawDoors = false;
    for (let i = 0; i < 200; i++) {
      el.step(0.05);
      syncStaffCabin(el, m.staffCabin);
      expect(m.staffCabin.getHeight()).toBeCloseTo(el.cabinY(), 9);
      expect(m.staffCabin.getDoorsOpen()).toBeCloseTo(el.doorOpen(), 9);
      for (let f = 0; f < FLOOR_COUNT; f++) expect(m.staffCabin.isCallLit(f)).toBe(el.callLit(f));
      if (el.cabinY() > floorY(0) + 0.01 && el.cabinY() < floorY(2) - 0.01) sawTravel = true;
      if (el.doorOpen() > 0.99) sawDoors = true;
    }
    expect(sawTravel).toBe(true);
    expect(sawDoors).toBe(true);
    expect(m.staffCabin.currentFloor()).toBe(el.state().floor);
  });

  it('syncStaffCabinFrom drives the cabin from nav movement and ignores the timed stand-in', () => {
    const units = new Map(hierarchy.units.map((u) => [u.id, u.floor]));
    const nav = createNavMovement({ units, cabinFloor: 2 });
    const m = model();
    expect(syncStaffCabinFrom(nav, m.staffCabin)).toBe(true);
    expect(m.staffCabin.getHeight()).toBeCloseTo(floorY(2), 9);
    const m2 = model();
    const before = m2.staffCabin.getHeight();
    expect(syncStaffCabinFrom(createTimedMovement(units), m2.staffCabin)).toBe(false);
    expect(m2.staffCabin.getHeight()).toBe(before);
  });

  it('turns a call light off once the call is served', () => {
    const el = createElevator({ startFloor: 0 });
    const m = model();
    el.call('qa-engineer', 1, 3);
    syncStaffCabin(el, m.staffCabin);
    expect(m.staffCabin.isCallLit(1)).toBe(true);
    for (let i = 0; i < 400 && el.callLit(1); i++) el.step(0.05);
    syncStaffCabin(el, m.staffCabin);
    expect(el.callLit(1)).toBe(false);
    expect(m.staffCabin.isCallLit(1)).toBe(false);
  });
});
