import { aggregateStatistics, municipalityStatistics } from './statistics.js';
import { downloadCSV } from './export.js';
const $ = id => document.getElementById(id);
const count = v => v === null ? 'Unavailable' : new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(v);
const percentText = value => Number.isFinite(value) ? value.toFixed(1) + '%' : 'Unavailable';
let selectedAttributes = null;
export function showFeature(content, attributes = null) {
  $('feature-content').replaceChildren(content);
  $('feature-panel').hidden = false;
  $('feature-panel').scrollTop = 0;
  selectedAttributes = attributes;
  $('export-feature').disabled = !attributes;
}
export function closeFeature() { $('feature-panel').hidden = true; selectedAttributes = null; }
export function installDashboard(map) {
  const selector = $('municipality');
  let collection, priorities = null, municipalities, comparison = [];
  const state = { municipality: '', metric: 'percent800', sort: 'desc' };
  const collapse = collapsed => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    $('toggle-sidebar').setAttribute('aria-expanded', String(!collapsed));
    map.resize();
  };
  collapse(matchMedia('(max-width:800px)').matches);
  if(matchMedia('(max-width:520px)').matches) $('floating-legend').open=false;
  $('toggle-sidebar').onclick = () => collapse(!document.body.classList.contains('sidebar-collapsed'));
  $('close-sidebar').onclick = () => { collapse(true); $('toggle-sidebar').focus(); };
  $('close-feature').onclick = () => { closeFeature(); map.fire('clearselection'); };
  $('export-feature').onclick = () => { if (selectedAttributes) downloadCSV([selectedAttributes], 'transitscope-feature.csv'); };
  $('export-comparison').onclick = () => downloadCSV(comparison.map(row => ({ ...row, population_year: 2021, historical_analysis_date: '2026-09-09', method: 'area-weighted straight-line proximity' })), 'transitscope-municipalities.csv');
  const tabs = [...document.querySelectorAll('[role=tab]')];
  function activateTab(tab) {
    document.querySelector('.tab-content').scrollTop = 0;
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1;
      $(item.getAttribute('aria-controls')).hidden = !active;
    }
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => activateTab(tab);
    tab.onkeydown = event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); activateTab(tabs[next]); tabs[next].focus(); }
    };
  });
  const dialog = $('information-dialog');
  const provenance = document.createElement('div'); provenance.id = 'network-provenance'; provenance.hidden = true; document.body.append(provenance);
  document.querySelector('#sources-view').content.querySelector('#network-provenance').id = 'source-provenance';
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
    const view = button.dataset.view;
    if (view === 'explore') { dialog.close(); $('map').focus(); return; }
    $('dialog-title').textContent = button.textContent;
    $('dialog-content').replaceChildren($(view + '-view').content.cloneNode(true));
    if (view === 'sources') $('source-provenance').replaceChildren(...[...provenance.childNodes].map(n => n.cloneNode(true)));
    dialog.showModal();
  });
  $('close-dialog').onclick = () => dialog.close();
  function renderComparison() {
    const percent = state.metric.startsWith('percent');
    const sorted = [...comparison].sort((a, b) => state.sort === 'name' ? a.name.localeCompare(b.name) : (state.sort === 'desc' ? -1 : 1) * ((a[state.metric] ?? -1) - (b[state.metric] ?? -1)) || a.name.localeCompare(b.name));
    const max = percent ? 100 : Math.max(1, ...comparison.map(row => row[state.metric] ?? 0));
    $('comparison').replaceChildren();
    for (const item of sorted) {
      const button = document.createElement('button'); button.setAttribute('aria-pressed', String(item.name === state.municipality));
      const label = document.createElement('span'); label.className = 'bar-label';
      const name = document.createElement('span'), value = document.createElement('strong');
      name.textContent = item.name.replace(/^(City|Township) of /, '');
      value.textContent = item[state.metric] === null ? 'Unavailable' : percent ? item[state.metric].toFixed(1) + '%' : count(item[state.metric]);
      label.append(name, value);
      const track = document.createElement('span'); track.className = 'bar-track'; track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('span'); bar.style.width = ((item[state.metric] ?? 0) / max * 100) + '%'; track.append(bar);
      button.append(label, track); button.onclick = () => select(item.name); $('comparison').append(button);
    }
  }
  $('comparison-metric').onchange = event => { state.metric = event.target.value; renderComparison(); };
  $('comparison-sort').onchange = event => { state.sort = event.target.value; renderComparison(); };
  function render() {
    if (!collection) return;
    try {
      const s = aggregateStatistics(collection, priorities, state.municipality);
      $('scope-title').textContent = state.municipality.replace(/^(City|Township) of /, '') || 'Regional overview';
      $('map-scope').textContent = state.municipality || 'Waterloo Region';
      $('reset-selection').disabled = !state.municipality;
      $('kpis').replaceChildren();
      const metrics = [['Study population', count(s.population), '2021 Census'], ['DAs', count(s.daCount), 'Dissemination Areas'], ['Priority areas', count(s.priorityCount), 'Historical subset'], ['Within 400 m', percentText(s.percent400), count(s.within400) + ' estimated residents'], ['Within 800 m', percentText(s.percent800), count(s.within800) + ' estimated residents']];
      for (const [label, value, detail] of metrics) {
        const box = document.createElement('div'); box.className = 'kpi';
        const l = document.createElement('span'), v = document.createElement('strong'), note = document.createElement('small');
        l.textContent = label; v.textContent = value; note.textContent = detail; box.append(l, v, note); $('kpis').append(box);
      }
      $('breakdown').replaceChildren(); $('breakdown-bar').replaceChildren();
      for (const [label, value, percent, color] of [['Within 400 m', s.within400, s.percent400, '#087F8C'], ['400–800 m', s.between400800, s.percentBetween400800, '#78A9BA'], ['Beyond 800 m', s.beyond800, s.percentBeyond800, '#D9E1E8']]) {
        const li = document.createElement('li'), sw = document.createElement('i'), text = document.createElement('span'), metric = document.createElement('b');
        sw.style.background = color; text.textContent = label; metric.textContent = `${percentText(percent)} · ${count(value)}`; li.append(sw, text, metric); $('breakdown').append(li);
        const segment = document.createElement('span'); segment.style.width = (percent ?? 0) + '%'; segment.style.background = color; $('breakdown-bar').append(segment);
      }
      renderComparison();
    } catch (error) { $('kpis').textContent = 'Statistics unavailable: ' + error.message; $('comparison').textContent = 'Comparison unavailable.'; }
  }
  function select(name, { zoom = true } = {}) {
    state.municipality = name; selector.value = name; closeFeature(); map.fire('clearselection');
    const filter = name ? ['==', ['get', 'FullName'], name] : null;
    for (const id of ['da-accessibility-fill', 'da-boundaries-line', 'da-hover-line', 'priority-underserved-line', 'priority-hover-line']) if (map.getLayer(id)) map.setFilter(id, filter);
    if (map.getLayer('network-stops')) map.setFilter('network-stops', name ? ['==', ['get', 'municipality'], name] : null);
    if (map.getLayer('municipal-selection')) map.setFilter('municipal-selection', ['==', ['get', 'FullName'], name]);
    const selected = municipalities?.features.find(f => f.properties.FullName === name);
    if (zoom && selected) map.fire('municipalityselect', { feature: selected }); else if (zoom && !name) map.fire('regionselect');
    render();
  }
  selector.onchange = () => select(selector.value);
  $('reset-selection').onclick = () => select('');
  return {
    setUnavailable(message) {
      collection = null; comparison = [];
      selector.disabled = true; $('export-comparison').disabled = true;
      $('kpis').textContent = message;
      $('comparison').textContent = 'Comparison unavailable because historical population data did not load.';
      $('breakdown').replaceChildren(); $('breakdown-bar').replaceChildren();
    },
    refreshNetworkFilter() {
      if (map.getLayer('network-stops')) map.setFilter('network-stops', state.municipality ? ['==', ['get', 'municipality'], state.municipality] : null);
    },
    setData(data, priorityIds, boundaries) {
      let validatedComparison;
      try { validatedComparison = municipalityStatistics(data, priorityIds); }
      catch (error) { this.setUnavailable('Historical statistics could not be validated: ' + error.message); return; }
      collection = data; priorities = priorityIds; municipalities = boundaries;
      comparison = validatedComparison;
      selector.replaceChildren(new Option('Waterloo Region', ''));
      for (const item of comparison) selector.add(new Option(item.name, item.name));
      selector.disabled = false; $('export-comparison').disabled = false; render();
    }, select,
    municipalityAttributes(name) { return comparison.find(row => row.name === name); }
  };
}
