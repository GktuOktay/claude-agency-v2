// Shared test helpers for the 0002 data and workflow tests.
import hierarchy from '../src/data/hierarchy.json';

/** Unit id → floor from the committed hierarchy. */
export function unitFloors(): Map<string, number> {
  return new Map(hierarchy.units.map((u) => [u.id, u.floor]));
}
