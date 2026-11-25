import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ACCESS_CLASSES, MISSING_COLOR, fillColorExpression, featureBounds, prepareDACollection, popupRows } from './data.js';
import { installTransit } from './transit.js';
import { installDashboard, showFeature, closeFeature } from './dashboard.js';
import { INITIAL_STYLE, installMapTools } from './map-tools.js';
import { createSearchIndex, mountSearch } from './search.js';
maplibregl.setWorkerUrl(workerUrl);

const status = document.querySelector('#map-status');
const reset = document.querySelector('#reset-view');
const controls = Object.fromEntries(['accessibility', 'da-boundaries', 'priority', 'municipalities'].map(id => [id, document.querySelector(`#toggle-${id}`)]));
const layerGroups = { accessibility: ['da-accessibility-fill'], 'da-boundaries': ['da-boundaries-line'], priority: ['priority-underserved-line'], municipalities: ['municipal-boundaries-line'] };
const legend = document.querySelector('#access-legend');
for (const item of [...ACCESS_CLASSES, { label: 'Missing / invalid value', color: MISSING_COLOR }]) {
  const row = document.createElement('li');
  const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.backgroundColor = item.color;
  const label = document.createElement('span'); label.textContent = item.label;
  row.append(swatch, label); legend.append(row);
}

async function loadGeoJSON(filename) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${filename}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const collection = await response.json();
  featureBounds(collection);
  return collection;
}
function popupContent(properties, priorityIds) {
  const container = document.createElement('section'); container.className = 'da-popup';
  const title = document.createElement('h2'); title.textContent = 'Dissemination Area'; container.append(title);
  const list = document.createElement('dl');
  for (const [name, value] of popupRows(properties, priorityIds)) {
    const term = document.createElement('dt'); term.textContent = name;
    const definition = document.createElement('dd'); definition.textContent = value;
    list.append(term, definition);
  }
  const note = document.createElement('p'); note.textContent = 'Historical: 2021 Census; schedule analysis 9 September 2026. Source: Statistics Canada / saved Junho Lee analysis. Coverage estimates assume uniform population within each DA and use straight-line proximity. Values are rounded for display.';
  container.append(list);
  const total=properties.Population, covered400=properties.pop_access_400, covered800=properties.pop_access_800;
  if(Number.isFinite(total)&&total>0&&Number.isFinite(covered400)&&Number.isFinite(covered800)){
    const chart=document.createElement('div');chart.className='da-coverage';const bar=document.createElement('div');bar.className='stacked-bar';bar.setAttribute('aria-hidden','true');
    for(const [value,color] of [[covered400,'#087F8C'],[covered800-covered400,'#78A9BA'],[total-covered800,'#D9E1E8']]){const segment=document.createElement('span');segment.style.width=Math.max(0,value/total*100)+'%';segment.style.background=color;bar.append(segment);}
    const caption=document.createElement('p');caption.textContent=`Within400: ${(covered400/total*100).toFixed(1)}% · 400–800: ${Math.max(0,(covered800-covered400)/total*100).toFixed(1)}% · Beyond800: ${Math.max(0,(total-covered800)/total*100).toFixed(1)}%`;chart.append(bar,caption);container.append(chart);
  }
  container.append(note); return container;
}

try {
  const map = new maplibregl.Map({ container: 'map', style: INITIAL_STYLE, center: [-80.5, 43.45], zoom: 9.3, maxZoom: 18, attributionControl: false });

  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
  const dashboard = installDashboard(map);

  let daData, municipalData;
  let studyBounds;
  let priorityIds = null;
  let hovered = null;
  let popup;
  let basemapError = false;
  const states = { da: 'loading', priority: 'loading', municipalities: 'loading' };
  const renderStatus = () => {
    status.textContent = `DA data: ${states.da}. Priority areas: ${states.priority}. Municipal boundaries: ${states.municipalities}.${basemapError ? ' Some map resources failed; check your connection.' : ''}`;
  };
  const clearHover = () => {
    if (hovered) map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
    hovered = null; map.getCanvas().style.cursor = '';
  };
  const transit = installTransit(map, () => { popup?.remove(); clearHover(); closeFeature(); map.fire('clearselection'); }, showFeature);
  const visibleInteractionLayers = () => Object.entries(layerGroups)
    .filter(([id]) => !controls[id].disabled && controls[id].checked)
    .flatMap(([, layers]) => layers).filter(id => map.getLayer(id));
  for (const [id, control] of Object.entries(controls)) {
    control.addEventListener('change', () => {
      for (const layer of layerGroups[id]) map.setLayoutProperty(layer, 'visibility', control.checked ? 'visible' : 'none');
      clearHover(); popup?.remove(); transit.clear(); closeFeature();
      map.fire('clearselection');
      document.querySelector('#boundary-key').hidden = !controls.municipalities.checked;
      document.querySelector('#legend-section').hidden = !controls.accessibility.checked || controls.accessibility.disabled;
      document.querySelector('#priority-key').hidden = !controls.priority.checked || controls.priority.disabled;
    });
  }
  const enable = id => { controls[id].disabled = false; controls[id].checked = id !== 'da-boundaries'; if(id==='da-boundaries')map.setLayoutProperty('da-boundaries-line','visibility','none'); };
  reset.addEventListener('click', () => { if (studyBounds) map.fitBounds(studyBounds, { padding: 35, duration: 0 }); });
  installMapTools(map, () => {
    for(const [id, control] of Object.entries(controls)) if(!control.disabled){control.checked=id!=='da-boundaries';control.dispatchEvent(new Event('change'));}
    for(const control of document.querySelectorAll('#network-controls input'))if(!control.disabled){control.checked=false;control.dispatchEvent(new Event('change'));}
    document.querySelector('#toggle-frequency').checked=true;
    if(map.getLayer('network-stops'))document.querySelector('#toggle-frequency').dispatchEvent(new Event('change'));
    for(const [id,value] of [['historical-opacity',62],['network-opacity',25]]){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));}
  });
  map.on('error', () => { basemapError = true; renderStatus(); });
  // Style readiness is sufficient for local GeoJSON; unavailable street tiles
  // must not hold the analytical application behind the map's load event.
  map.once('style.load', async () => {
    map.addSource('selected-feature',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'selected-polygon',type:'line',source:'selected-feature',filter:['in',['geometry-type'],['literal',['Polygon','MultiPolygon','LineString','MultiLineString']]],paint:{'line-color':'#DD9C29','line-width':3}});
    map.addLayer({id:'selected-point',type:'circle',source:'selected-feature',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':9,'circle-color':'#DD9C29','circle-opacity':0.3,'circle-stroke-color':'#8A5700','circle-stroke-width':2}});
    const search = mountSearch(document.querySelector('#search-container'), [], selectSearch);
    search.input.disabled = true;
    search.input.placeholder = 'Loading local search…';
    const updateSearch = () => {
      const index = createSearchIndex({municipalities:municipalData,da:daData,stops:transit.collections.stops,routes:transit.collections.routes});
      search.setIndex(index);
      search.input.disabled = !index.length;
      search.input.placeholder = index.length ? 'Search place, DA, stop or route' : 'Search unavailable — reload to retry';
    };
    const transitLoading = transit.load();
    // Each source has its own failure state; an unavailable municipal file cannot hide valid DA data.
    await Promise.allSettled([
      (async () => {
        try {
          const data = prepareDACollection(await loadGeoJSON('da-accessibility.geojson')); daData=data;
          studyBounds = featureBounds(data);
          map.addSource('da-accessibility', { type: 'geojson', data, attribution: 'Statistics Canada / Junho Lee' });
          map.addLayer({ id: 'da-accessibility-fill', type: 'fill', source: 'da-accessibility', paint: { 'fill-color': fillColorExpression(), 'fill-opacity': 0.62, 'fill-outline-color': 'rgba(0,0,0,0)' } });
          map.addLayer({ id: 'da-boundaries-line', type: 'line', source: 'da-accessibility', paint: { 'line-color': '#657581', 'line-width': ['interpolate',['linear'],['zoom'],8,0.2,14,0.7], 'line-opacity': 0.45 } });
          map.addLayer({ id: 'da-hover-line', type: 'line', source: 'da-accessibility', paint: { 'line-color': '#182C3C', 'line-width': 2.5, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0] } });
          enable('accessibility'); enable('da-boundaries'); reset.disabled = false; document.querySelector('#historical-opacity').disabled=false;
          document.querySelector('#legend-section').hidden = false;
          states.da = `${data.features.length} loaded`; map.fitBounds(studyBounds, { padding: 35, duration: 0 });
        } catch (error) { states.da = 'unavailable — reload to retry'; console.warn('DA data could not load:', error.message); }
        renderStatus();
      })(),
      (async () => {
        try {
          const data = prepareDACollection(await loadGeoJSON('priority-underserved.geojson'));
          priorityIds = new Set(data.features.map(feature => feature.properties.DAUID));
          map.addSource('priority-underserved', { type: 'geojson', data, attribution: 'Statistics Canada / Junho Lee' });
          map.addLayer({ id: 'priority-underserved-line', type: 'line', source: 'priority-underserved', paint: { 'line-color': '#B66D48', 'line-width': ['interpolate',['linear'],['zoom'],8,0.65,12,1.1,16,1.7] } });
          map.addLayer({ id: 'priority-hover-line', type: 'line', source: 'priority-underserved', paint: { 'line-color': '#182C3C', 'line-width': 3.5, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0] } });
          enable('priority'); document.querySelector('#priority-key').hidden = false;
          states.priority = `${data.features.length} loaded`;
        } catch (error) { states.priority = 'unavailable — reload to retry'; console.warn('Priority data could not load:', error.message); }
        renderStatus();
      })(),
      (async () => {
        try {
          const data = await loadGeoJSON('municipalities.geojson'); municipalData=data;
          map.addSource('municipalities', { type: 'geojson', data, attribution: 'Region of Waterloo' });
          map.addLayer({ id: 'municipal-boundaries-line', type: 'line', source: 'municipalities', paint: { 'line-color': '#384D5C', 'line-width': 1.6, 'line-dasharray': [4, 2] } });
          map.addLayer({id:'municipal-selection',type:'line',source:'municipalities',filter:['==',['get','FullName'],''],paint:{'line-color':'#087F8C','line-width':3}});
          enable('municipalities'); states.municipalities = `${data.features.length} loaded`;
        } catch (error) { states.municipalities = 'unavailable — source file not loaded'; console.warn('Municipal data could not load:', error.message); }
        renderStatus();
      })(),
    ]);
    // Network timing must not determine cartographic stacking.
    transit.order();
    if(daData) dashboard.setData(daData,priorityIds,municipalData);
    else dashboard.setUnavailable('Historical population data could not load. Reload to retry; available network layers can still be explored.');
    updateSearch();
    await transitLoading;
    dashboard.refreshNetworkFilter();
    updateSearch();
    document.querySelector('#network-opacity').disabled=!map.getLayer('network-coverage400');
    // Network layers may finish after a user has already selected a local DA.
    map.moveLayer('selected-polygon'); map.moveLayer('selected-point');
  });
  map.on('mousemove', event => {
    clearHover();
    if (transit.hover(event)) return;
    const layers = visibleInteractionLayers();
    const feature = layers.length ? map.queryRenderedFeatures(event.point, { layers })[0] : null;
    clearHover();
    if (feature) { hovered = { source: feature.source, id: feature.id }; map.setFeatureState(hovered, { hover: true }); map.getCanvas().style.cursor = 'pointer'; }
  });
  map.getCanvas().addEventListener('mouseleave', clearHover);
  map.on('click', event => {
    if (transit.click(event)) { popup?.remove(); return; }
    const layers = visibleInteractionLayers();
    const feature = layers.length ? map.queryRenderedFeatures(event.point, { layers })[0] : null;
    if (!feature) return;
    popup?.remove();
    if(feature.source==='municipalities'){dashboard.select(feature.properties.FullName);const box=document.createElement('section');box.className='da-popup';const title=document.createElement('h2');title.textContent=feature.properties.FullName;const note=document.createElement('p');note.textContent='Official municipal boundary snapshot retrieved 24 November 2026. Historical population-weighted statistics for this municipality are shown in Analytics. These outlines are contextual, not definitive legal boundaries.';box.append(title,note);showFeature(box,{...feature.properties,...dashboard.municipalityAttributes(feature.properties.FullName),population_year:2021,analysis_date:'2026-09-09'});}else{showFeature(popupContent(feature.properties, priorityIds),{...feature.properties,population_year:2021,analysis_date:'2026-09-09'});}
    highlight(feature);
  });
  map.on('municipalityselect', event=>{transit.clear();map.fitBounds(featureBounds({type:'FeatureCollection',features:[event.feature]}),{padding:55,duration:0});});
  map.on('regionselect',()=>{if(studyBounds)map.fitBounds(studyBounds,{padding:35,duration:0});});

  function highlight(feature){if(map.getSource('selected-feature'))map.getSource('selected-feature').setData({type:'FeatureCollection',features:[feature]});}
  map.on('featureselected',event=>highlight(event.feature));
  map.on('clearselection',()=>{if(map.getSource('selected-feature'))map.getSource('selected-feature').setData({type:'FeatureCollection',features:[]});});
  function selectSearch(item){
    const feature=item.feature, p=feature.properties;
    if(item.type==='municipality'){
      dashboard.select(p.FullName);const box=document.createElement('section');box.className='da-popup';const h=document.createElement('h2');h.textContent=p.FullName;const note=document.createElement('p');note.textContent='Historical municipality statistics are shown in Overview. Boundary snapshot: Region of Waterloo, 24 November 2026; contextual, not definitive legal boundaries.';box.append(h,note);showFeature(box,{...p,...dashboard.municipalityAttributes(p.FullName),population_year:2021,analysis_date:'2026-09-09'});
    }else{
      dashboard.select(p.FullName || p.municipality || '',{zoom:false});
      if(item.type==='da')showFeature(popupContent(p,priorityIds),{...p,population_year:2021,analysis_date:'2026-09-09'});
      else transit.present(feature,item.type==='stop'?'stops':'routes');
      const coords=[];function visit(value){if(typeof value[0]==='number')coords.push(value);else value.forEach(visit);}visit(feature.geometry.coordinates);
      if(item.type==='stop')map.jumpTo({center:coords[0],zoom:15});
      else{const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]);map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:65,maxZoom:15,duration:0});}
    }
    highlight(feature);
  }
  new ResizeObserver(() => map.resize()).observe(document.querySelector('main'));
} catch (error) {
  status.textContent = 'The map could not start. Check WebGL support and reload.';
  console.error('Map initialization failed:', error);
}


