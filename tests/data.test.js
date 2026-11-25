import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS_CLASSES, MISSING_COLOR, accessibilityColor, displayPercent, featureBounds, prepareDACollection, popupRows, formatPopulation } from '../src/data.js';

test('classification assigns each boundary once, including 100%', () => {
  for (const [value, index] of [[0,0],[19.999,0],[20,1],[39.999,1],[40,2],[60,3],[79.999,3],[80,4],[100,4]]) assert.equal(accessibilityColor(value), ACCESS_CLASSES[index].color);
});
test('missing/invalid values are grey; only floating-point noise is normalized', () => {
  for (const value of [null,undefined,'20',NaN,Infinity,-1,101]) assert.equal(accessibilityColor(value), MISSING_COLOR);
  assert.equal(displayPercent(100.00000000000013),100);
  assert.equal(displayPercent(-1e-12),0);
});
const collection = {type:'FeatureCollection',features:[{type:'Feature',properties:{DAUID:'001',Pct_Access_800:100.00000000000013},geometry:{type:'Polygon',coordinates:[[[-80.6,43.4],[-80.4,43.4],[-80.4,43.5],[-80.6,43.4]]]}}]};
test('bounds are computed from geometry and reject absent/projected data', () => {
  assert.deepEqual(featureBounds(collection),[[-80.6,43.4],[-80.4,43.5]]);
  assert.throws(()=>featureBounds({type:'FeatureCollection',features:[]}));
  assert.throws(()=>featureBounds({type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[500000,4800000]]]}}]}));
});
test('runtime display fields preserve original data and identifiers', () => {
  const prepared = prepareDACollection(collection);
  assert.equal(prepared.features[0].id,'001');
  assert.equal(prepared.features[0].properties._display_access_800,100);
  assert.equal(prepared.features[0].properties.Pct_Access_800,100.00000000000013);
  assert.equal(collection.features[0].properties._display_access_800,undefined);
  assert.throws(()=>prepareDACollection({...collection,features:[...collection.features,...collection.features]}));
});
test('popup values distinguish missing from zero and unknown priority', () => {
  assert.equal(formatPopulation(null),'Not available'); assert.equal(formatPopulation(0),'0');
  assert.equal(formatPopulation(-2.27e-12),'0'); assert.equal(formatPopulation(1234.6),'1,235');
  const props={DAUID:'001',Population:0,Pct_Access_800:0};
  assert.equal(popupRows(props,new Set(['001'])).at(-1)[1],'Yes');
  assert.equal(popupRows(props,new Set()).at(-1)[1],'No');
  assert.match(popupRows(props,null).at(-1)[1],/Not available/);
  assert.equal(popupRows(props,null).find(row=>row[0].endsWith('(%)'))[1],'0.0%');
});
