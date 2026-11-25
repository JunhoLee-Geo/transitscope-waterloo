export const INITIAL_STYLE = {
  version: 8,
  sources: { 'osm-streets': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' } },
  layers: [
    { id: 'analysis-background', type: 'background', paint: { 'background-color': '#F5F7FA' } },
    { id: 'street-basemap', type: 'raster', source: 'osm-streets', paint: { 'raster-saturation': -1, 'raster-opacity': 0.45 } }
  ]
};
export function installMapTools(map, resetLayers) {
  const $ = id => document.getElementById(id);
  const message = text => { $('tool-status').textContent = text; };
  $('export-map').onclick = () => {
    if (!map.loaded()) { message('The map is still loading. Wait for visible layers and tiles, then try PNG export again.'); return; }
    const button = $('export-map'); button.disabled = true;
    message('Preparing map image…');
    let completed = false;
    const finish = text => {
      if (completed) return false;
      completed = true; clearTimeout(timeout); map.off('render', capture);
      button.disabled = false; message(text); return true;
    };
    const capture = () => {
      try {
        const mapCanvas = map.getCanvas();
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(640, mapCanvas.width); canvas.height = mapCanvas.height + 146;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#F5F7FA'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mapCanvas, 0, 0);
        ctx.fillStyle = '#142B3D'; ctx.font = '16px sans-serif';
        const lines = ['TransitScope — ' + document.getElementById('map-scope').textContent,
          'Historical: 2021 Census / 9 Sep 2026 analysis. GTFS snapshot: 24 Nov 2026.',
          'Straight-line proximity; scheduled service, not live arrivals.',
          '© OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
          'Statistics Canada / Junho Lee; contains Region of Waterloo information under licence.',
          'Basemap: ' + $('basemap-toolbar').selectedOptions[0].text + '. UI panels are not included.'];
        lines.forEach((line, index) => ctx.fillText(line, 12, mapCanvas.height + 22 + index * 22, canvas.width - 24));
        canvas.toBlob(blob => {
          if (!blob) { finish('Image export unavailable. Use a browser screenshot with attribution.'); return; }
          if (!finish('Map PNG downloaded with attribution and dataset dates.')) return;
          const url = URL.createObjectURL(blob), link = document.createElement('a');
          link.href = url; link.download = 'transitscope-map.png'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
      } catch { finish('Image export blocked by canvas or cross-origin restrictions. Use a browser screenshot with attribution.'); }
    };
    const timeout = setTimeout(() => finish('Image export timed out. Retry when the map is visible, or use a screenshot with attribution.'), 15000);
    // Read within the render event; avoid an always-preserved WebGL drawing buffer.
    map.once('render', capture); map.triggerRepaint();
  };
  $('zoom-in').onclick = () => map.zoomIn({ duration: 0 });
  $('zoom-out').onclick = () => map.zoomOut({ duration: 0 });
  $('reset-orientation').onclick = () => map.jumpTo({ bearing: 0, pitch: 0 });
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else { message('Fullscreen is not supported by this browser.'); return; }
      message('');
    } catch { message('Fullscreen was not permitted by this browser. The map remains usable.'); }
  };
  document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement)); map.resize(); });
  function basemap(value) {
    if (!map.getLayer('street-basemap')) return;
    map.setLayoutProperty('street-basemap', 'visibility', value === 'dark' ? 'none' : 'visible');
    map.setPaintProperty('street-basemap', 'raster-saturation', value === 'light' ? -1 : 0);
    map.setPaintProperty('street-basemap', 'raster-opacity', value === 'light' ? 0.45 : 1);
    map.setPaintProperty('analysis-background', 'background-color', value === 'dark' ? '#142B3D' : '#F5F7FA');
    for (const id of ['da-boundaries-line', 'municipal-boundaries-line']) if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', value === 'dark' ? '#C1D0DB' : '#627786');
    $('basemap-toolbar').value = value; $('basemap-layers').value = value;
    message(value === 'dark' ? 'Dark analysis background: street tiles and labels are hidden.' : '');
  }
  for (const id of ['basemap-toolbar', 'basemap-layers']) $(id).onchange = event => basemap(event.target.value);
  $('reset-layers').onclick = () => { resetLayers(); basemap('light'); };
  const sliders = [['historical-opacity', ['da-accessibility-fill']], ['network-opacity', ['network-coverage400','network-coverage800','network-highcoverage']]];
  for (const [id, layers] of sliders) $(id).oninput = () => {
    $(id + '-value').textContent = $(id).value + '%';
    for (const layer of layers) if (map.getLayer(layer)) map.setPaintProperty(layer, 'fill-opacity', Number($(id).value) / 100);
  };
  return { basemap };
}
