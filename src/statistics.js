// Aggregation uses saved historical DA population estimates, never GTFS stop counts.
// At most 1e-7 residents of floating-point boundary noise is normalized per DA.
// Larger violations, absent values and duplicate IDs fail instead of yielding partial totals.
const TOLERANCE = 1e-7;

function rows(collection) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('Statistics require a DA FeatureCollection.');
  }
  const ids = new Set();
  return collection.features.map(feature => {
    const p = feature.properties;
    if (typeof p?.DAUID !== 'string' || !p.DAUID || ids.has(p.DAUID)) throw new Error('Statistics require unique DAUID values.');
    ids.add(p.DAUID);
    if (typeof p.FullName !== 'string' || !p.FullName.trim()) throw new Error(`Missing municipality for DA ${p.DAUID}.`);
    const values = ['Population', 'pop_access_400', 'pop_access_800'].map(key => {
      const value = p[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -TOLERANCE) throw new Error(`Invalid ${key} for DA ${p.DAUID}.`);
      return Math.max(0, value);
    });
    const [population, raw400, raw800] = values;
    if (raw800 > population + TOLERANCE || raw400 > raw800 + TOLERANCE) throw new Error(`Non-nested accessibility estimates for DA ${p.DAUID}.`);
    const within800 = Math.min(population, raw800);
    return { id: p.DAUID, name: p.FullName, population, within400: Math.min(within800, raw400), within800 };
  });
}

function aggregate(selected, priorityIds) {
  if (priorityIds !== null && !(priorityIds instanceof Set)) throw new Error('Priority IDs must be a Set or null when unavailable.');
  const result = {
    daCount: selected.length,
    priorityCount: priorityIds === null ? null : selected.filter(row => priorityIds.has(row.id)).length,
    population: null, within400: null, within800: null, between400800: null, beyond800: null,
    percent400: null, percent800: null, percentBetween400800: null, percentBeyond800: null,
  };
  if (!selected.length) return result;
  for (const key of ['population', 'within400', 'within800']) result[key] = selected.reduce((sum, row) => sum + row[key], 0);
  result.between400800 = result.within800 - result.within400;
  result.beyond800 = result.population - result.within800;
  if (result.population > 0) {
    result.percent400 = result.within400 / result.population * 100;
    result.percent800 = result.within800 / result.population * 100;
    result.percentBetween400800 = result.between400800 / result.population * 100;
    result.percentBeyond800 = result.beyond800 / result.population * 100;
  }
  return result;
}

export function aggregateStatistics(collection, priorityIds = null, municipality = '') {
  if (typeof municipality !== 'string') throw new Error('Municipality must be its exact saved name or an empty string for the region.');
  return aggregate(rows(collection).filter(row => !municipality || row.name === municipality), priorityIds);
}

export function municipalityStatistics(collection, priorityIds = null) {
  const validated = rows(collection);
  return [...new Set(validated.map(row => row.name))].sort((a, b) => a.localeCompare(b, 'en-CA'))
    .map(name => ({ name, ...aggregate(validated.filter(row => row.name === name), priorityIds) }));
}
