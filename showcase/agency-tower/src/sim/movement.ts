// Movement port of the workflow engine (spec 0002 §6 option A: engine → director → activity sim).
// The engine only asks "move unit to target", "is it there", "which leg is it in". This file holds
// the port and a timed stand-in used until T-5 provides waypoint navigation and the staff elevator
// behind the same interface. Pure and deterministic; it draws no random numbers.

export interface Target {
  floor: number;
  /** Named spot: `home:<id>`, `desk:<id>`, `handover:<id>`, `signing-desk`, `meeting-room`, `meeting-room:lead` (meeting lead at the whiteboard), `meeting-room:sign` (lane-3 signer at the sign table), `landing`. */
  spot: string;
}

/** Current movement leg (§7.5b); `still` when not moving. */
export type MovePhase = 'still' | 'walk' | 'call' | 'call-wait' | 'ride';

export interface Movement {
  /** Sends `unit` toward `target`, replacing any current move (re-pathed from where it is). */
  moveTo(unit: string, target: Target): void;
  isAt(unit: string, target: Target): boolean;
  phase(unit: string): MovePhase;
  /** Current floor; a rider counts on its destination floor (§7.6b). */
  floorOf(unit: string): number;
  /** Advances movement; `frozen` units hold (selection, REQ-17) except while riding (the cabin runs on). */
  step(dt: number, frozen: (unit: string) => boolean): void;
  snapshot(): unknown;
}

// Stand-in timings (seconds). Walk legs approximate a cross-floor walk at 1.2 u/s; the ride leg
// follows §7.5b: cabin-arrival wait (call gesture included) + 0.6 + clamp(0.6 × floors, 0.8, 3) + 0.6.
export const TIMED = {
  walkS: 6,
  nearWalkS: 1,
  callS: 0.5,
  callWaitS: 1.5,
  doorsS: 0.6,
} as const;

export const rideLegS = (floors: number): number => TIMED.doorsS + Math.min(Math.max(0.6 * floors, 0.8), 3) + TIMED.doorsS;

interface Leg {
  kind: Exclude<MovePhase, 'still'>;
  dur: number;
  /** Position after the leg. */
  floor: number;
  spot: string;
}

interface UnitPos {
  floor: number;
  spot: string;
  legs: Leg[];
  legT: number;
}

const owner = (spot: string): string | undefined => spot.split(':')[1];

export function createTimedMovement(homeFloors: ReadonlyMap<string, number>): Movement {
  const units = new Map<string, UnitPos>();
  for (const [id, floor] of homeFloors) units.set(id, { floor, spot: `home:${id}`, legs: [], legT: 0 });
  const get = (id: string): UnitPos => {
    const u = units.get(id);
    if (!u) throw new Error(`unknown unit ${id}`);
    return u;
  };
  const walkS = (a: string, b: string): number => (a === b ? 0 : owner(a) !== undefined && owner(a) === owner(b) ? TIMED.nearWalkS : TIMED.walkS);

  return {
    moveTo(id, t) {
      const u = get(id);
      u.legs = [];
      u.legT = 0;
      if (u.floor === t.floor) {
        if (u.spot !== t.spot) u.legs.push({ kind: 'walk', dur: walkS(u.spot, t.spot), floor: t.floor, spot: t.spot });
        return;
      }
      u.legs.push(
        { kind: 'walk', dur: walkS(u.spot, 'landing'), floor: u.floor, spot: 'landing' },
        { kind: 'call', dur: TIMED.callS, floor: u.floor, spot: 'landing' },
        { kind: 'call-wait', dur: TIMED.callWaitS, floor: u.floor, spot: 'landing' },
        { kind: 'ride', dur: rideLegS(Math.abs(t.floor - u.floor)), floor: t.floor, spot: 'landing' },
        { kind: 'walk', dur: walkS('landing', t.spot), floor: t.floor, spot: t.spot },
      );
    },
    isAt(id, t) {
      const u = get(id);
      return u.legs.length === 0 && u.floor === t.floor && u.spot === t.spot;
    },
    phase(id) {
      return get(id).legs[0]?.kind ?? 'still';
    },
    floorOf(id) {
      const u = get(id);
      const leg = u.legs[0];
      return leg && leg.kind === 'ride' ? leg.floor : u.floor;
    },
    step(dt, frozen) {
      for (const [id, u] of units) {
        let left = dt;
        while (u.legs.length && left > 0) {
          const leg = u.legs[0]!;
          if (leg.kind !== 'ride' && frozen(id)) break;
          const need = leg.dur - u.legT;
          if (left + 1e-9 < need) {
            u.legT += left;
            left = 0;
          } else {
            left -= Math.max(need, 0);
            u.floor = leg.floor;
            u.spot = leg.spot;
            u.legs.shift();
            u.legT = 0;
          }
        }
      }
    },
    snapshot() {
      return [...units].map(([id, u]) => ({ id, floor: u.floor, spot: u.spot, legT: u.legT, legs: u.legs.map((l) => ({ ...l })) }));
    },
  };
}
