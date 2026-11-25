import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSearchIndex, searchFeatures } from '../src/search.js';

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'));
const input = { municipalities: read('municipalities.geojson'), da: read('da-accessibility.geojson'), stops: read('transit/stops.geojson'), routes: read('transit/routes.geojson') };
const index = createSearchIndex(input);

test('actual datasets index municipalities, DAs, stops and unique routes', () => {
  assert.equal(index.filter(i => i.type === 'municipality').length, 7);
  assert.equal(index.filter(i => i.type === 'da').length, 766);
  assert.equal(index.filter(i => i.type === 'stop').length, 2289);
  assert.equal(index.filter(i => i.type === 'route').length, 52);
  assert.equal(new Set(index.map(i => i.id)).size, index.length);
  assert.equal(searchFeatures(index, 'Waterloo')[0].type, 'municipality');
  assert.equal(searchFeatures(index, '35300742')[0].feature.properties.DAUID, '35300742');
  assert.equal(searchFeatures(index, '4236')[0].feature.properties.stop_name, 'Hazel / Columbia');
  assert.equal(searchFeatures(index, '301')[0].type, 'route');
});

test('normalization supports case, punctuation, diacritics and name token prefixes', () => {
  assert.equal(searchFeatures(index, 'HAZEL / COLUMBIA')[0].feature.properties.stop_name, 'Hazel / Columbia');
  assert.ok(searchFeatures(index, 'colum haz').some(i => i.feature.properties.stop_name === 'Hazel / Columbia'));
  const fixture = createSearchIndex({ stops: { features: [{ properties: { stop_id: '001', stop_name: 'École / King', feed_id: 'bus' } }] } });
  assert.equal(searchFeatures(fixture, 'ecole')[0].feature.properties.stop_id, '001');
  assert.equal(searchFeatures(fixture, '001')[0].feature.properties.stop_id, '001');
  assert.equal(searchFeatures(fixture, '1')[0].feature.properties.stop_id, '001');
});

test('route result retains every existing shape without mutating source properties', () => {
  const route = searchFeatures(index, '301')[0];
  const source = input.routes.features.filter(f => f.properties.feed_id === route.feature.properties.feed_id && f.properties.route_id === route.feature.properties.route_id);
  assert.equal(route.feature.geometry.type, 'MultiLineString');
  assert.equal(route.feature.geometry.coordinates.length, source.length);
  assert.equal(route.feature.properties.shape_count, source.length);
  assert.equal(route.feature.properties.shape_id, undefined);
  assert.ok(source[0].properties.shape_id);
  assert.deepEqual(route.feature.geometry.coordinates[0], source[0].geometry.coordinates);
});

test('blank, no-match and result-limit states are bounded and deterministic', () => {
  assert.deepEqual(searchFeatures(index, ''), []);
  assert.deepEqual(searchFeatures(index, '  /  '), []);
  assert.deepEqual(searchFeatures(index, 'no_such_feature_xyz'), []);
  assert.equal(searchFeatures(index, 'king', 3).length, 3);
  assert.deepEqual(searchFeatures(index, 'king', 0), []);
  assert.deepEqual(searchFeatures(index, 'king'), searchFeatures(index, 'king'));
  assert.deepEqual(createSearchIndex(), []);
});
