import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installMapTools } from '../src/map-tools.js';
import { ACCESS_CLASSES, MISSING_COLOR, fillColorExpression, featureBounds, prepareDACollection, popupRows } from '../src/data.js';

function toolsHarness(t, { loaded = true, drawError = false } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { disabled: false, textContent: '', value: 'light', selectedOptions: [{ text: 'Light' }], setAttribute() {} });
    return elements.get(id);
  };
  let render, blobCallback, downloads = 0;
  const timers = [];
  const document = {
    getElementById: element, addEventListener() {}, documentElement: {},
    createElement(tag) {
      if (tag === 'canvas') return {
        getContext: () => ({ fillRect() {}, fillText() {}, drawImage() { if (drawError) throw new Error('Tainted canvas'); } }),
        toBlob: callback => { blobCallback = callback; },
      };
      return { click() { downloads++; } };
    }
  };
  const previous = globalThis.document; globalThis.document = document;
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  t.mock.method(globalThis, 'setTimeout', callback => { const token = { callback, cleared: false }; timers.push(token); return token; });
  t.mock.method(globalThis, 'clearTimeout', token => { if (token) token.cleared = true; });
  const map = {
    loaded: () => loaded, getCanvas: () => ({ width: 500, height: 300 }),
    once(type, callback) { assert.equal(type, 'render'); render = callback; },
    off(type, callback) { if (render === callback) render = null; }, triggerRepaint() {},
    getLayer: () => true, setLayoutProperty() {}, setPaintProperty() {}, resize() {},
  };
  installMapTools(map, () => {});
  return { element, timers, render: () => render?.(), blob: value => blobCallback(value), downloads: () => downloads };
}

test('PNG refuses incomplete maps rather than exporting a loading frame', t => {
  const h = toolsHarness(t, { loaded: false }); h.element('export-map').onclick();
  assert.match(h.element('tool-status').textContent, /still loading/);
  assert.equal(h.element('export-map').disabled, false); assert.equal(h.timers.length, 0);
});

test('PNG render timeout restores the button and detaches pending capture', t => {
  const h = toolsHarness(t); h.element('export-map').onclick();
  assert.equal(h.element('export-map').disabled, true);
  h.timers[0].callback(); h.render();
  assert.equal(h.element('export-map').disabled, false);
  assert.match(h.element('tool-status').textContent, /timed out/); assert.equal(h.downloads(), 0);
});

test('PNG cross-origin failure restores the button with a useful fallback', t => {
  const h = toolsHarness(t, { drawError: true }); h.element('export-map').onclick(); h.render();
  assert.equal(h.element('export-map').disabled, false);
  assert.match(h.element('tool-status').textContent, /cross-origin/); assert.equal(h.timers[0].cleared, true);
});

test('late PNG encoding completion cannot download after export timeout', t => {
  const h = toolsHarness(t); h.element('export-map').onclick(); h.render(); h.timers[0].callback();
  h.blob(new Blob(['image']));
  assert.equal(h.downloads(), 0); assert.match(h.element('tool-status').textContent, /timed out/);
});

test('historical analytics starts on style readiness without street load or GTFS completion', async () => {
  let mapInstance, releaseTransit, displayed, searchCount = 0, networkFilterRefreshed = false;
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, append() {}, addEventListener() {}, setAttribute() {}, disabled: true });
    return elements.get(id);
  };
  class FakeMap {
    constructor() { mapInstance = this; this.handlers = {}; this.layers = new Map(); this.sources = new Map(); }
    addControl() {}
    on(type, callback) { this.handlers[type] = callback; }
    once(type, callback) { this.handlers[type] = callback; }
    getCanvas() { return element('canvas'); }
    addSource(id, data) { this.sources.set(id, data); }
    addLayer(layer) { this.layers.set(layer.id, layer); }
    getLayer(id) { return this.layers.get(id); }
    setLayoutProperty() {} fitBounds() {} moveLayer() {}
    getStyle() { return { layers: [...this.layers.values()] }; }
  }
  const entry = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.env.BASE_URL', "''");
  const context = {
    document: { querySelector: element, createElement: () => ({ style: {}, append() {} }) },
    maplibregl: { Map: FakeMap, ScaleControl: class {}, AttributionControl: class {}, setWorkerUrl() {} }, workerUrl: '',
    ACCESS_CLASSES, MISSING_COLOR, fillColorExpression, featureBounds, prepareDACollection, popupRows,
    INITIAL_STYLE: {}, installMapTools() {}, closeFeature() {}, showFeature() {},
    installDashboard: () => ({ setData(data) { displayed = data; }, setUnavailable() {}, refreshNetworkFilter() { networkFilterRefreshed = true; } }),
    installTransit: () => ({ load: () => new Promise(resolve => { releaseTransit = resolve; }), order() {}, collections: {} }),
    createSearchIndex: ({ da }) => da?.features ?? [],
    mountSearch: () => ({ input: {}, setIndex(index) { searchCount = index.length; } }),
    ResizeObserver: class { observe() {} }, AbortSignal, console,
    fetch: async url => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../public/' + url, import.meta.url), 'utf8')) }),
  };
  vm.runInNewContext(entry, context);
  assert.equal(mapInstance.handlers.load, undefined, 'No dependence on external tile load');
  assert.equal(typeof mapInstance.handlers['style.load'], 'function');
  const initialization = mapInstance.handlers['style.load']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(displayed.features.length, 766);
  assert.equal(searchCount, 766);
  assert.equal(networkFilterRefreshed, false, 'GTFS is still pending');
  releaseTransit(); await initialization;
  assert.equal(networkFilterRefreshed, true);
});
