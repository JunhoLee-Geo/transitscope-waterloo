import * as maplibregl from 'maplibre-gl';

export const FREQUENCY_COLORS = { High: '#087F8C', Moderate: '#4C78A8', Low: '#D99A36', 'No service': '#8A939C' };
export const NETWORK_LAYERS = [
  { key: 'stops', file: 'stops', type: 'circle', label: 'Transit stops', checked: false },
  { key: 'routes', file: 'routes', type: 'line', label: 'Routes on selected service date', checked: false },
  { key: 'coverage400', file: 'coverage-400m', type: 'fill', label: '400 m stop proximity', color: '#8B66AD', checked: false },
  { key: 'coverage800', file: 'coverage-800m', type: 'fill', label: '800 m stop proximity', color: '#549B83', checked: false },
  { key: 'highcoverage', file: 'high-frequency-400m', type: 'fill', label: 'High-frequency stops · 400 m', color: '#087F8C', checked: false },
];

export function frequencyExpression(enabled) {
  return enabled ? ['match', ['get', 'frequency_class'], ...Object.entries(FREQUENCY_COLORS).flat(), '#8A939C'] : '#344D61';
}
export function transitRows(properties, isStop) {
  const p = properties;
  if (!isStop) return [ ['Route', `${p.route_short_name || p.route_id} · ${p.route_long_name || ''}`], ['Feed', p.feed_id], ['Service date', p.service_date], ['Provider', p.provider] ];
  return [ ['Stop ID / feed', `${p.stop_id} / ${p.feed_id}`], ['Municipality', p.municipality || 'Not assigned'],
    ['Scheduled boardable departures', p.scheduled_departures ?? 'Unavailable'],
    ['Departures per hour (average)', Number.isFinite(p.departures_per_hour) ? p.departures_per_hour.toFixed(2) : 'Unavailable'],
    ['Service class', p.frequency_class], ['Routes in time window', p.route_labels || 'None'],
    ['Service date', p.service_date], ['Time window', `${p.window_start}–${p.window_end} (end excluded)`], ['Provider', p.provider] ];
}
export function legendEntries(active, frequency) {
  const entries = [];
  if (active.stops) {
    if (frequency) for (const [label, color] of Object.entries(FREQUENCY_COLORS)) entries.push({ label: `${label}: ${ {High:'>4/hour',Moderate:'2–4/hour',Low:'>0–<2/hour','No service':'0 in window'}[label] }`, color });
    else entries.push({ label: 'Boarding stop location', color: '#344D61' });
  }
  if (active.routes) entries.push({ label: 'Bus route geometry', color: '#585C89' }, { label: 'ION light rail geometry', color: '#087F8C' });
  for (const layer of NETWORK_LAYERS.filter(l => l.type === 'fill')) if (active[layer.key]) entries.push({label:layer.label,color:layer.color});
  return entries;
}

export function installTransit(map, onSelectionChange, showFeature) {
  const controls = {}, loaded = {}, active = {}, collections = {};
  let popup, hovered;
  const panel = document.querySelector('#network-controls');
  const status = document.querySelector('#network-status');
  const frequency = document.querySelector('#toggle-frequency');
  for (const layer of NETWORK_LAYERS) {
    const label = document.createElement('label');
    const input = document.createElement('input'); input.type = 'checkbox'; input.disabled = true; input.id = `network-${layer.key}`;
    label.append(input, document.createTextNode(layer.label)); panel.append(label); controls[layer.key] = input;
    input.addEventListener('change', () => {
      active[layer.key] = input.checked;
      map.setLayoutProperty(`network-${layer.key}`, 'visibility', input.checked ? 'visible' : 'none');
      clear(); onSelectionChange(); renderLegend();
    });
  }
  function renderLegend() {
    const list = document.querySelector('#network-legend'); list.replaceChildren();
    for (const item of legendEntries(active, frequency.checked)) {
      const row = document.createElement('li'), swatch = document.createElement('span');
      swatch.className = 'swatch'; swatch.style.backgroundColor = item.color;
      row.append(swatch, document.createTextNode(item.label)); list.append(row);
    }
    document.querySelector('#network-legend-section').hidden = list.children.length === 0;
    frequency.disabled = !loaded.stops || !active.stops;
  }
  frequency.addEventListener('change', () => { map.setPaintProperty('network-stops', 'circle-color', frequencyExpression(frequency.checked)); renderLegend(); });
  function clear() {
    popup?.remove();
    if (hovered) map.setFeatureState(hovered, { hover: false });
    hovered = null;
  }
  function hit(event) {
    for (const key of ['stops','routes']) {
      if (!active[key] || !map.getLayer(`network-${key}`)) continue;
      const target = key === 'routes' ? [[event.point.x-4,event.point.y-4],[event.point.x+4,event.point.y+4]] : event.point;
      const features = map.queryRenderedFeatures(target, {layers:[`network-${key}`]});
      if (features.length) return {feature:features[0], key};
    }
    return null;
  }
  function hover(event) {
    if (hovered) map.setFeatureState(hovered, {hover:false});
    hovered = null;
    const found = hit(event);
    if (!found) return false;
    hovered = { source:found.feature.source, id:found.feature.id };
    map.setFeatureState(hovered, {hover:true}); map.getCanvas().style.cursor='pointer'; return true;
  }
  function click(event) {
    const found = hit(event);
    if (!found) { popup?.remove(); return false; }
    clear();
    return present(found.feature, found.key, event.lngLat);
  }
  function present(feature, key, lngLat) {
    const props = feature.properties;
    const box = document.createElement('section'); box.className = 'da-popup';
    const title = document.createElement('h2'); title.textContent = key === 'stops' ? props.stop_name : 'Transit route';
    const dl = document.createElement('dl');
    for (const [label,value] of transitRows(props, key === 'stops')) {
      const dt=document.createElement('dt'), dd=document.createElement('dd'); dt.textContent=label; dd.textContent=value ?? 'Unavailable'; dl.append(dt,dd);
    }
    const note=document.createElement('p'); note.textContent='New official GTFS snapshot. Scheduled service, not real-time arrivals or the original historical DA analysis. Terminal and restricted-pickup events excluded.';
    box.append(title,dl,note); if(showFeature){showFeature(box, { ...props, dataset: 'GTFS network 2026-11-24' }); map.fire('featureselected',{feature});return true;} popup = new maplibregl.Popup({maxWidth:'360px'}).setLngLat(lngLat).setDOMContent(box).addTo(map); return true;
  }
  function order() {
    const before = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
    for (const id of ['da-accessibility-fill','network-coverage800','network-coverage400','network-highcoverage','da-boundaries-line','municipal-boundaries-line','priority-underserved-line','network-routes','da-hover-line','priority-hover-line','network-stops','municipal-selection']) {
      if (map.getLayer(id)) map.moveLayer(id,before);
    }
  }
  async function load() {
    const info = document.querySelector('#network-provenance');
    let manifest;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/transit/manifest.json`,{signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manifest=await response.json();
      if (!manifest.service_date || !Array.isArray(manifest.feeds)) throw new Error('Invalid provenance');
      info.replaceChildren();
      const timing=document.createElement('p'); timing.textContent=`Network service date: ${manifest.service_date} · ${manifest.window_start}–${manifest.window_end} ${manifest.timezone}.`;
      info.append(timing);
      for (const feed of manifest.feeds) {
        const p=document.createElement('p'); p.textContent=`${feed.feed_id.toUpperCase()} · downloaded ${feed.download_date} · calendar span ${feed.calendar_service_span.start}–${feed.calendar_service_span.end}.`;
        info.append(p);
      }
      const note=document.createElement('p'); note.textContent='These buffers and network layers are a separate snapshot. They do not reproduce or update the historical population accessibility results. General buffers include zero-service boarding locations. Classes use boardable nonterminal departures.'; info.append(note);
    } catch (error) { status.textContent='Transit layers unavailable: provenance could not load. Reload to retry.'; console.warn('Transit metadata:',error.message); return; }
    await Promise.allSettled(NETWORK_LAYERS.map(async layer => {
      const id=`network-${layer.key}`;
      try {
        const response=await fetch(`${import.meta.env.BASE_URL}data/transit/${layer.file}.geojson`,{signal:AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid GeoJSON');
        if (!data.features.length) { loaded[layer.key]='empty'; return; }
        collections[layer.key] = data;
        map.addSource(id,{type:'geojson',data,attribution:'Contains information provided by the Regional Municipality of Waterloo under licence'});
        let paint;
        if (layer.type === 'circle') paint = { 'circle-color':frequencyExpression(frequency.checked), 'circle-radius':['interpolate',['linear'],['zoom'],11,2,14,3.5,18,6], 'circle-stroke-color':['case',['boolean',['feature-state','hover'],false],'#172A3A','#ffffff'], 'circle-stroke-width':['interpolate',['linear'],['zoom'],11,0.3,16,0.8] };
        else if (layer.type === 'line') paint={'line-color':['match',['get','feed_id'],'lrt','#087F8C','#585C89'],'line-width':['interpolate',['linear'],['zoom'],8,1,13,2.5,17,4],'line-opacity':0.85};
        else paint={'fill-color':layer.color,'fill-opacity':0.25,'fill-outline-color':layer.color};
        map.addLayer({id,type:layer.type,source:id,...(layer.key==='stops'?{minzoom:11}:{}),layout:{visibility:layer.checked?'visible':'none'},paint});
        controls[layer.key].disabled=false; controls[layer.key].checked=layer.checked; active[layer.key]=layer.checked; loaded[layer.key]=data.features.length; order();
      } catch (error) { loaded[layer.key]='unavailable'; console.warn(`Transit ${layer.key}:`,error.message); }
      finally { status.textContent=NETWORK_LAYERS.map(l=>`${l.label}: ${loaded[l.key] ?? 'loading'}`).join(' · '); renderLegend(); }
    }));
  }
  return {load,click,hover,clear,order,collections,present};
}


