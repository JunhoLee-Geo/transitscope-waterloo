const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en-CA').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const features = collection => collection?.features ?? [];
const typeOrder = { municipality: 0, da: 1, stop: 2, route: 3 };

// Normalize once at load time. Feature properties and identifier strings stay intact.
export function createSearchIndex({ municipalities, da, stops, routes } = {}) {
  const index = [];
  function add(type, id, label, feature, identifiers, names) {
    index.push({ id: `${type}:${id}`, label, type, feature,
      identifiers: identifiers.map(normalize).filter(Boolean),
      names: names.map(normalize).filter(Boolean),
    });
  }
  for (const feature of features(municipalities)) {
    const p = feature.properties;
    if (p?.FullName) add('municipality', p.FullName, p.FullName, feature, [], [p.FullName, p.Municipality, p.FullName.replace(/^(City|Township) of /, '')]);
  }
  for (const feature of features(da)) {
    const p = feature.properties;
    if (p?.DAUID) add('da', p.DAUID, `DA ${p.DAUID} · ${p.FullName}`, feature, [p.DAUID], [`DA ${p.DAUID}`]);
  }
  for (const feature of features(stops)) {
    const p = feature.properties;
    if (p?.stop_id) add('stop', `${p.feed_id}:${p.stop_id}`, `${p.stop_name} · ${p.stop_id} (${p.feed_id})`, feature, [p.stop_id], [p.stop_name, `stop ${p.stop_id}`]);
  }
  // A route can have several valid shapes. Search lists it once and retains all
  // shapes in a MultiLineString so selection fits the route rather than one branch.
  const routeGroups = new Map();
  for (const feature of features(routes)) {
    const p = feature.properties;
    if (!p?.route_id) continue;
    const key = `${p.feed_id}:${p.route_id}`;
    if (!routeGroups.has(key)) routeGroups.set(key, []);
    routeGroups.get(key).push(feature);
  }
  for (const [id, group] of routeGroups) {
    const p = group[0].properties;
    const coordinates = group.flatMap(f => f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : []);
    if (!coordinates.length) continue;
    const { shape_id, ...properties } = p;
    const feature = { type: 'Feature', id: `route:${id}`, properties: { ...properties, shape_count: group.length }, geometry: { type: 'MultiLineString', coordinates } };
    add('route', id, `Route ${p.route_short_name || p.route_id} · ${p.route_long_name || p.feed_id}`, feature,
      [p.route_id, p.route_short_name], [p.route_long_name, `route ${p.route_short_name || p.route_id}`]);
  }
  return index;
}

export function searchFeatures(index, query, limit = 8) {
  const q = normalize(query);
  if (!q || !Number.isInteger(limit) || limit < 1) return [];
  const terms = q.split(' ');
  function score(item) {
    if (item.identifiers.includes(q)) return 0;
    if (item.names.includes(q)) return 1;
    if (item.identifiers.some(id => id.startsWith(q))) return 2;
    if (item.names.some(name => name.startsWith(q))) return 3;
    if (item.names.some(name => terms.every(term => name.split(' ').some(word => word.startsWith(term))))) return 4;
    if (item.names.some(name => name.includes(q))) return 5;
    return Infinity;
  }
  return index.map(item => ({ item, score: score(item) })).filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || typeOrder[a.item.type] - typeOrder[b.item.type] || a.item.label.localeCompare(b.item.label, 'en-CA', { numeric: true }))
    .slice(0, limit).map(({ item }) => item);
}

let nextSearchId = 0;
export function mountSearch(container, initialIndex, onSelect) {
  const prefix = `local-search-${++nextSearchId}`;
  let index = initialIndex, results = [], active = -1;
  container.classList.add('feature-search');
  const label = document.createElement('label'); label.className = 'sr-only'; label.htmlFor = prefix; label.textContent = 'Search municipality, DA, stop or route';
  const input = document.createElement('input'); input.id = prefix; input.type = 'search'; input.autocomplete = 'off'; input.placeholder = 'Search place, DA, stop or route';
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', `${prefix}-results`);
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'search-clear'; clear.textContent = '×'; clear.setAttribute('aria-label', 'Clear search'); clear.hidden = true;
  const list = document.createElement('ul'); list.id = `${prefix}-results`; list.className = 'search-results'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Search suggestions'); list.hidden = true;
  const status = document.createElement('p'); status.className = 'search-status'; status.setAttribute('role', 'status'); status.hidden = true;
  container.replaceChildren(label, input, clear, list, status);
  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }
  function highlight() {
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) input.setAttribute('aria-activedescendant', `${prefix}-option-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }
  function choose(item) { input.value = item.label; clear.hidden = false; status.hidden = true; close(); onSelect(item); }
  function update() {
    clear.hidden = input.value.length === 0;
    results = searchFeatures(index, input.value);
    list.replaceChildren(); active = -1;
    for (const [i, item] of results.entries()) {
      const option = document.createElement('li'); option.id = `${prefix}-option-${i}`; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      const kind = document.createElement('small'); kind.textContent = item.type === 'da' ? 'Dissemination Area' : item.type;
      const text = document.createElement('span'); text.textContent = item.label; option.append(kind, text);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => choose(item)); list.append(option);
    }
    const hasQuery = normalize(input.value).length > 0;
    list.hidden = results.length === 0;
    input.setAttribute('aria-expanded', String(results.length > 0)); input.removeAttribute('aria-activedescendant');
    status.hidden = !hasQuery;
    status.textContent = results.length ? `${results.length} suggestions. Use arrow keys and Enter to select.` : hasQuery ? 'No matching municipality, DA, stop or route.' : '';
  }
  input.addEventListener('input', update);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); status.hidden = true; return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) update();
      if (results.length) { active = active < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1) : (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; highlight(); }
    } else if (event.key === 'Enter' && !list.hidden && results.length) {
      event.preventDefault(); choose(results[active < 0 ? 0 : active]);
    }
  });
  input.addEventListener('blur', () => { close(); status.hidden = true; });
  clear.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  return { setIndex(value) { index = value; if (input.value) update(); }, clear() { input.value = ''; update(); }, input };
}
