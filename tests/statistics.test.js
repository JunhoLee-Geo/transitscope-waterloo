import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregateStatistics, municipalityStatistics } from '../src/statistics.js';

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
const data = read('da-accessibility.geojson');
const priorityIds = new Set(read('priority-underserved.geojson').features.map(f => f.properties.DAUID));
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const sample = properties => ({ type: 'FeatureCollection', features: [{ properties: { DAUID: '001', FullName: 'Example', Population: 100, pop_access_400: 20, pop_access_800: 80, ...properties } }] });

test('validated historical regional totals and exclusive population categories', () => {
  const s = aggregateStatistics(data, priorityIds);
  assert.equal(s.population, 587165); assert.equal(s.daCount, 766); assert.equal(s.priorityCount, 52);
  near(s.within400, 437869.9076950906); near(s.within800, 506721.0353282299);
  near(s.within400 + s.between400800 + s.beyond800, s.population);
  near(s.percent400 + s.percentBetween400800 + s.percentBeyond800, 100);
  near(s.percent800, s.within800 / s.population * 100);
});

test('municipality totals partition region and rates use population weighting', () => {
  const summaries = municipalityStatistics(data, priorityIds);
  const reference = read('municipality-summary.json');
  assert.equal(summaries.length, 7);
  assert.equal(summaries.reduce((sum, s) => sum + s.population, 0), 587165);
  assert.equal(summaries.reduce((sum, s) => sum + s.priorityCount, 0), 52);
  for (const row of summaries) {
    const saved = reference.find(p => p.FullName === row.name);
    assert.equal(row.population, saved.Population);
    near(row.within800, saved.Pop_Access_800);
    near(row.percent800, saved.Pop_Access_800 / saved.Population * 100);
    assert.deepEqual(aggregateStatistics(data, priorityIds, row.name), Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'name')));
  }
});

test('weighted rate differs from average DA percentages and does not mutate inputs', () => {
  const a = sample({ Population: 100, pop_access_400: 0, pop_access_800: 0 });
  a.features.push({ properties: { DAUID: '002', FullName: 'Example', Population: 900, pop_access_400: 900, pop_access_800: 900 } });
  const before = JSON.stringify(a);
  assert.equal(aggregateStatistics(a).percent800, 90);
  assert.equal(JSON.stringify(a), before);
});

test('missing data, duplicate IDs and substantial invalid estimates cannot become plausible totals', () => {
  for (const value of [undefined, null, '10', NaN, Infinity, -1]) assert.throws(() => aggregateStatistics(sample({ pop_access_400: value })));
  assert.throws(() => aggregateStatistics(sample({ pop_access_800: 101 })));
  assert.throws(() => aggregateStatistics(sample({ pop_access_400: 81 })));
  assert.throws(() => aggregateStatistics(sample({ FullName: '' })));
  const duplicate = sample({}); duplicate.features.push(duplicate.features[0]);
  assert.throws(() => aggregateStatistics(duplicate));
  assert.throws(() => aggregateStatistics(sample({}), []));
});

test('zero, unknown priority and empty selection remain distinct', () => {
  const zero = aggregateStatistics(sample({ Population: 0, pop_access_400: 0, pop_access_800: 0 }));
  assert.equal(zero.population, 0); assert.equal(zero.percent800, null); assert.equal(zero.priorityCount, null);
  const empty = aggregateStatistics(data, priorityIds, 'Unknown municipality');
  assert.equal(empty.daCount, 0); assert.equal(empty.population, null); assert.equal(empty.percent800, null); assert.equal(empty.priorityCount, 0);
  assert.equal(aggregateStatistics(sample({}), new Set()).priorityCount, 0);
});

test('only tiny floating-point boundary noise is normalized', () => {
  const s = aggregateStatistics(sample({ pop_access_400: -1e-12, pop_access_800: 100 + 1e-12 }));
  assert.equal(s.within400, 0); assert.equal(s.within800, 100); assert.equal(s.beyond800, 0);
  assert.throws(() => aggregateStatistics(sample({ pop_access_800: 100.0001 })));
});
