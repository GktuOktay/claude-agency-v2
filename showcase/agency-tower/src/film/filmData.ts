// The film job's scenario (filmScenario.json): validated with the same rules as the pool, kept out of the random
// pool. Only the film run adds it to the engine's scenario set, with random jobs off (sceneApp, `?film=1`).
import raw from './filmScenario.json';
import { loadStandaloneScenario, type Scenario, type ScenarioSet, type UnitFloors } from '../data/scenarios';

export const FILM_SCENARIO_RAW: unknown = raw;

export function loadFilmScenario(units: UnitFloors): Scenario | null {
  const r = loadStandaloneScenario(FILM_SCENARIO_RAW, units);
  return r.ok ? r.data : null;
}

/** The pool plus the film scenario (the engine and the director look scenarios up by id). */
export function withFilm(set: ScenarioSet, film: Scenario): ScenarioSet {
  return { laneWeights: set.laneWeights, scenarios: [...set.scenarios, film] };
}
