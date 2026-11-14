// Break-specific card "Şu an" lines (KARARLAR Rev 38 polish): a robot on a break names where it is instead of
// the generic "Kahve molasında". A separate template set (tr.breakTpl); the AC-11 job-step map is unchanged.
import { describe, it, expect } from 'vitest';
import { BREAK_KEYS, breakKeyOf, breakLine, cardLines, type BreakKey } from '../src/ui/nowLine';
import { createActivitySim, type BreakMovement } from '../src/scene/activity';
import { VENUE_KINDS, venueOfSpot } from '../src/scene/breaks';
import { createAnchors } from '../src/scene/director';
import { AMENITY_SPOTS, floorY } from '../src/sim/layout';
import { createNavMovement } from '../src/sim/navMovement';
import { tr } from '../src/i18n/tr';
import { towerLayouts } from './directorHelpers';
import { unitFloors } from './workflowHelpers';

const EXPECTED: Record<BreakKey, string> = {
  gym: 'Spor salonunda',
  game: 'Oyun alanında',
  snack: "Snack bar'da",
  cafeteria: 'Yemekhanede öğle yemeğinde',
  terrace: 'Terasta',
  pods: 'Uyku kabininde dinleniyor',
  lab: "Ar-Ge'de",
  archive: 'Arşivde',
  tea: 'Çay molasında',
  coffee: 'Kahve molasında',
};

const spotOf = (venue: keyof typeof VENUE_KINDS) => {
  const s = AMENITY_SPOTS.find((x) => venueOfSpot(x) === venue);
  if (!s) throw new Error(`no spot for ${venue}`);
  return s;
};

describe('break "Şu an" templates', () => {
  it('has one template per venue plus the floor coffee and tea station', () => {
    expect([...BREAK_KEYS].sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const k of BREAK_KEYS) expect(breakLine(k)).toBe(EXPECTED[k]);
    for (const v of Object.keys(VENUE_KINDS)) expect(BREAK_KEYS).toContain(v);
    expect(tr.breakTpl.coffee).toBe(tr.nowTpl.coffee); // the station line matches the AC-11 coffee template
  });

  it('keys a campus break by its venue while going and staying; walking back shows the ambient line', () => {
    for (const v of Object.keys(VENUE_KINDS) as (keyof typeof VENUE_KINDS)[]) {
      expect(breakKeyOf({ spot: spotOf(v), phase: 'stay', kind: 'coffee' })).toBe(v);
      expect(breakKeyOf({ spot: spotOf(v), phase: 'go', kind: 'walk' })).toBe(v);
      expect(breakKeyOf({ spot: spotOf(v), phase: 'back', kind: 'walk' })).toBeNull();
    }
  });

  it('keys the floor station by the schedule slot: tea in the tea slot, coffee otherwise', () => {
    expect(breakKeyOf({ spot: null, phase: null, kind: 'coffee', period: 'tea' })).toBe('tea');
    expect(breakKeyOf({ spot: null, phase: null, kind: 'coffee', period: 'coffee' })).toBe('coffee');
    expect(breakKeyOf({ spot: null, phase: null, kind: 'coffee' })).toBe('coffee');
    expect(breakKeyOf({ spot: null, phase: null, kind: 'work', period: 'tea' })).toBeNull();
    expect(breakKeyOf({ spot: null, phase: null, kind: 'idle' })).toBeNull();
  });

  it('the card shows the break line instead of the generic coffee line; a job state wins', () => {
    expect(cardLines(null, 'coffee', null, undefined, undefined, 'gym')).toEqual({ now: 'Spor salonunda' });
    expect(cardLines(null, 'coffee', null, undefined, undefined, 'tea')).toEqual({ now: 'Çay molasında' });
    expect(cardLines(null, 'walk', null, undefined, undefined, null)).toEqual({ now: 'Yürüyor' });
    expect(cardLines(null, 'coffee', null)).toEqual({ now: 'Kahve molasında' });
    const st = { state: 'step-work', job: 3, step: 'spec', label: 'Spec yazılıyor' } as Parameters<typeof cardLines>[0];
    expect(cardLines(st, 'coffee', { n: 3, title: 'Kayıt formu', lane: 1 }, undefined, undefined, 'lab').now).toBe('Spec yazılıyor');
  });
});

describe('break phase from the activity sim', () => {
  it('reports go, stay and back for a campus break, null otherwise', () => {
    const anchors = createAnchors(towerLayouts());
    const specs = [...unitFloors().keys()].map((id) => {
      const d = anchors.deskOf(id)!;
      const y = floorY(d.floor);
      return { id, home: { x: d.place.home.x, y, z: d.place.home.z }, work: { x: d.place.seat.x, y, z: d.place.seat.z }, coffee: { x: d.place.coffee.x, y, z: d.place.coffee.z } };
    });
    const nav = createNavMovement({ units: unitFloors() });
    const mv: BreakMovement = {
      moveTo: (u, t) => nav.moveTo(u, t),
      isAt: (u, t) => nav.isAt(u, t),
      phase: (u) => nav.phase(u),
      renderPosition: (u, r) => nav.renderPosition(u, r),
    };
    const sim = createActivitySim(specs, 20261113, { campus: { movement: mv, floors: unitFloors(), chance: 1 } });
    expect(createActivitySim(specs, 1).breakPhase('scout')).toBeNull();
    const seen = new Set<string>();
    for (let i = 0; i < 6000 && seen.size < 3; i++) {
      sim.step(100);
      nav.step(0.1, () => false);
      for (const s of specs) {
        const ph = sim.breakPhase(s.id);
        if (ph === null) expect(sim.onBreak(s.id)).toBeNull();
        else {
          expect(sim.onBreak(s.id)).not.toBeNull();
          seen.add(ph);
          if (ph === 'stay') {
            const key = breakKeyOf({ spot: sim.onBreak(s.id), phase: ph, kind: sim.get(s.id).kind });
            expect(key).toBe(venueOfSpot(sim.onBreak(s.id)!));
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(['back', 'go', 'stay']);
  });
});
