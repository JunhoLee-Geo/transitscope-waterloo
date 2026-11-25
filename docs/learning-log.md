# Learning log

## 2026-11-24 — Phase 1 foundation

### Technical work completed by the coding agent

Inspected the source README, notebooks, committed datasets and figures inventory using a separate clone. Initialized a separate vanilla JavaScript/Vite project and basic MapLibre regional map. Prepared a data audit and staged development plan. Verification results are recorded separately in verification.md. No complete dashboard, analytical exports, Python notebook reruns or public deployment are claimed.

### How the map works

MapLibre GL JS is a browser mapping library that renders map sources through styled layers using WebGL. The camera controls the centre, zoom, bearing and pitch. In this prototype it requests CARTO's style JSON, then the referenced tile, glyph and sprite resources. Navigation controls update the camera; a scale control displays approximate map distance. Sources describe where data comes from; layers describe how to draw it. One source can support several layers, such as a DA fill and outline.

JavaScript initializes the map, listens for load/error and user events, and updates HTML status text. In a later phase it will fetch GeoJSON, add sources and layers after map load, inspect clicked feature properties for popups, and apply municipality filters. User-facing text from datasets should be inserted with textContent or safe DOM nodes rather than untrusted HTML.

### Desktop GIS and web GIS

Desktop GIS provides rich local editing, geoprocessing and analysis tools and can read many formats. A web GIS delivers an interactive, focused experience through a browser: users pan, filter, inspect and compare without installing GIS software. Here Python/GeoPandas will prepare and validate results offline; the static browser application will present those results. A web map does not itself prove the validity of its spatial analysis.

### Why GeoJSON

GeoJSON represents geometry and properties in readable JSON, so JavaScript can load and inspect it directly. Points fit stops; polygons and multipolygons fit DAs and coverage. It is suitable for a modest regional dataset and straightforward MapLibre integration. Unlike a GeoPackage it is not a multi-layer spatial database; create separate files for distinct themes. Large detailed polygon files can increase downloads and parsing cost, so measure actual sizes and simplify responsibly or consider vector tiles later.

### Coordinate systems

The analysis uses EPSG:26917 (NAD83 / UTM zone 17N), with metre units suitable for local buffers and areas. RFC 7946 GeoJSON uses WGS84 longitude/latitude coordinates in decimal degrees (longitude first). Use GeoPandas to_crs to transform projected coordinates before export. Simply assigning EPSG:4326 does not change numbers and would misplace features. Do not calculate a 400-metre buffer as 400 degrees. MapLibre normally displays the map in Web Mercator, but input GeoJSON remains longitude/latitude. Transformations do not remove the assumptions of straight-line buffers or uniform population distribution.

### Planned data flow

Authoritative inputs → GeoPandas validation and analysis in a suitable projected CRS → selected fields and optional display simplification → EPSG:4326 GeoJSON + metadata → Vite public/data → browser fetch → MapLibre source → styled fill/line/circle layers → feature inspection and filters.

The current phase ends at the basemap. This pipeline is a design, not a claim that data conversion has been completed.

### Decisions, challenges and limits

- Use Vite and ES modules with MapLibre only; no UI framework or backend is needed.
- Keep raw inputs separate from browser assets and retain source provenance.
- Keep all analytical controls out of Phase 1 rather than suggest nonexistent functionality.
- Source raw inputs and several intermediate outputs are absent. Exact historical GTFS reproduction needs the original feed.
- The audit found notebook state/order issues; see data-inventory.md before rerunning.
- Basemap resources depend on internet access; WebGL support is required.
- The Python launcher was unavailable. Data inspection used SQLite metadata and notebook contents, not a GeoPandas execution.

### Personal learning activities — still to be done by the student

These are suggested activities, not completed work or invented personal reflections.

- Run the project yourself and explain each file's role in your own words.
- Read MapLibre's quickstart, then identify the camera, style, source and layer concepts in the prototype.
- Inspect a real GeoJSON feature once data has been exported and explain its geometry/properties.
- Compare a DA in a desktop GIS with its eventual browser rendering.
- Transform a copy of a dataset from EPSG:26917 to EPSG:4326 and inspect the coordinate values.
- Explain why area-weighted population is an estimate, and find a plausible example where uniform density fails.
- Review the notebooks' service-date logic and explain why stop events are not the same as a route's waiting time.
- Record your own observations, difficulties and reflections after completing these tasks. Document any assistance according to course requirements.

### References

- https://maplibre.org/maplibre-gl-js/docs/
- https://vite.dev/guide/static-deploy.html
- https://geopandas.org/en/stable/docs/user_guide/projections.html
- https://datatracker.ietf.org/doc/html/rfc7946
- https://github.com/JunhoLee-Geo/Waterloo-transit-accessibility

### Verified integration lesson
MapLibre v6 uses named ES-module exports and needs an explicit bundled worker URL with Vite. Browser QA caught a missing worker even though the build passed; the official worker import fixed rendering. This demonstrates why a successful build alone does not establish that a map renders. See verification.md.


## 2026-11-24 — Phase 2: validated data and interactive layers

This entry records the coding agent's implementation. The earlier Phase 1 entry remains a historical record. See `data-validation.md` for generated measurements, `gtfs-recovery.md` for recovery evidence, and `verification.md` for final application checks. These records are not the student's personal reflections.

### GeoJSON structure

A FeatureCollection contains a `features` array. Each Feature has a `geometry` (Polygon or MultiPolygon here), `properties` (DAUID, population and accessibility attributes), and a stable identifier. Polygon coordinates are nested arrays of rings; the first ring is the exterior and subsequent rings are holes. Longitude precedes latitude. DAUID stays a string, not an arithmetic quantity. Inspect an actual exported feature rather than inventing example coordinates.

```js
const response = await fetch(`${import.meta.env.BASE_URL}data/da-accessibility.geojson`);
if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
const collection = await response.json();
console.log(collection.features[0].properties.DAUID);
```

This example illustrates loading, not a claim that browser fetching validates spatial accuracy. See the [GeoJSON specification](https://datatracker.ietf.org/doc/html/rfc7946).

### CRS transformation and geometry validation

The analysis source uses projected EPSG:26917. Transform a separate GeoDataFrame to EPSG:4326 for GeoJSON. Validate before and after conversion. Missing, empty and invalid geometries are distinct failures: a missing object has no geometry; an empty geometry contains no spatial extent; an invalid polygon may self-intersect. Repairs can alter geometry type or shape, so record the affected IDs and inspect the result. Never silently replace a polygon with an invented feature.

```python
layer = geopandas.read_file(source_path, layer="da_accessibility")
print(layer.crs)
missing = layer.geometry.isna()
empty = layer.geometry.is_empty
invalid = ~layer.geometry.is_valid & ~missing & ~empty
# Repair only invalid geometries; validate polygon types and changes afterward.
layer.loc[invalid, "geometry"] = layer.loc[invalid, "geometry"].make_valid()
web_layer = layer.to_crs("EPSG:4326")
```

The production script adds schema, duplicates, numeric, round-trip and source-preservation checks around these operations. `set_crs` labels existing numbers; `to_crs` transforms their coordinates. The conversion is not a recalculation of the historical accessibility measures. [GeoPandas transformation reference](https://geopandas.org/en/stable/docs/reference/api/geopandas.GeoDataFrame.to_crs.html); [geometry repair reference](https://geopandas.org/en/stable/docs/reference/api/geopandas.GeoSeries.make_valid.html).

### Optimization without changing analytical evidence

Compact JSON removes formatting overhead. Limiting coordinate precision can reduce downloads, but can collapse narrow features or change topology; verify serialized geometry afterward and retain greater precision when necessary. Avoid simplifying adjacent polygons independently without checking shared edges. Preserve all analytical attribute values and identifiers; do not recompute population estimates from display geometry. The validation report records actual file sizes and export decisions. Fewer bytes alone do not establish an acceptable map.

### MapLibre sources and layers

A source is the dataset; a layer specifies its visual representation. The DA source can serve both a choropleth fill and thin boundary lines. A line layer also draws priority outlines. A circle layer would suit verified stop points, but no stop circles should be created while locations are unavailable. Add layers after the map style is ready. Layer ordering determines what covers what.

```js
map.addSource('example-das', {
  type: 'geojson', data: collection, promoteId: 'DAUID'
});
map.addLayer({
  id: 'example-da-boundaries', type: 'line', source: 'example-das',
  paint: { 'line-color': '#6B7785', 'line-width': 0.5 }
});
map.setLayoutProperty('example-da-boundaries', 'visibility', 'none');
```

These names are instructional examples; consult the implementation for its actual IDs. [MapLibre style sources](https://maplibre.org/maplibre-style-spec/sources/); [layer specification](https://maplibre.org/maplibre-style-spec/layers/).

### Data-driven styling and choropleth classes

The selected measure is **estimated percentage of DA population within 800 metres of a stop**. The five classes are [0,20), [20,40), [40,60), [60,80), and [80,100]. A value of 20 belongs only to the second class; 100 belongs to the last. Missing data uses neutral grey, not the lowest class. The legend and styling must describe the same intervals. These are equal-interval display classes, not new analytical findings. High coverage does not mean frequent service.

MapLibre expressions read each feature's property to choose its fill colour. Tiny floating-point overshoot can be normalized for display within an explicit tolerance; the source values remain unchanged. Genuine out-of-range values need investigation. [MapLibre expressions](https://maplibre.org/maplibre-style-spec/expressions/).

### Events, hover and popups

An event listener runs a JavaScript function when an interaction occurs. Mouse movement can select a feature ID and update feature-state for highlighting. Clicks read the selected feature's supported attributes and construct a popup. Visibility controls change layer layout properties rather than replace the dataset. Clear hover and popup state when the relevant layers disappear.

```js
const heading = document.createElement('h3');
heading.textContent = `DA ${feature.properties.DAUID}`;
new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(heading).addTo(map);
```

Use DOM text rather than interpolating data into HTML. Population within/beyond buffers is area-weighted and should be labelled **estimated**, while Census total population is the reported DA total. Priority membership comes from the validated source subset. [MapLibre hover example](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/); [Popup API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/).

### Desktop GIS versus the implemented web workflow

In desktop GIS, inspect CRS, geometry, attribute tables and overlay alignment directly. Python makes preparation repeatable and testable. The browser renders exported results and supports focused inspection, but it does not replace source validation or rerun buffer analysis. Compare the same DAUID in a desktop attribute table, exported GeoJSON and browser popup to test that pipeline end to end.

### Personal learning activities still outstanding

- Run the preparation script yourself and explain each validation check.
- Open source and exported data in QGIS; inspect a rural DA, an urban DA and a priority DA.
- Trace one DAUID through its original attributes, GeoJSON properties and popup, noting rounding used only for display.
- Explain why a value of exactly 20% belongs to the second colour class and why missing data is not 0%.
- Toggle each layer and explain the distinction between data sources and rendered layers.
- Read the GTFS recovery report and explain why an available newer feed cannot prove historical service.
- Capture the evidence suggested in `academic-evidence.md`, then write your own observations and reflections. No tutorial completion or personal experience is claimed by this log.

### Phase 2 measured outcomes

The automated preparation ran successfully: 766 baseline DAs, 766 accessibility DAs, 52 priority DAs and 7 official contextual municipal polygons. No source geometry repairs were required. Coordinate precision reduction retained valid geometry with maximum measured displacement below 0.07 metres across these exports. All original attributes remained exact after JSON serialization. See data-validation.md for per-layer details; these are automated results, not personal student observations.

Five JavaScript tests and seven Python tests passed. Production browser checks confirmed loading, map positioning, popup values, layer controls and no error/warning logs with complete data. An absent municipal file was handled without losing the other layers. Historical GTFS remains a candidate recovery task; no service-frequency validation is claimed. The full evidence and limitations are in verification.md.

## Phase 3 — GTFS network integration (2026-11-24)

### Automated implementation versus personal learning

The coding agent acquired official ZIP snapshots, created the Python pipeline and map layers, and ran the recorded checks. This entry explains that implementation; it does not claim that the student completed tutorials, inspected schedules personally or formed any particular reflection. The student's activities remain listed below.

### GTFS structure and schedule analysis

GTFS is a collection of related text tables in a ZIP. Stops describe boarding locations; routes describe public lines; trips link routes and service IDs; stop_times lists ordered visits. Calendars determine operating dates, shapes provide line geometry, feed_info can provide publisher/version information, and frequencies can describe repeated service. These are relational records joined by identifiers, not independent map layers. The official [GTFS reference](https://gtfs.org/documentation/schedule/reference/) defines the format.

In this implementation, both actual feeds use calendar_dates instead of a weekly calendar. The pipeline first resolves active service IDs, filters trips, then reads their stop events. It preserves identifiers as strings and namespaces them with the feed ID so two sources cannot accidentally share a feature identity. Invalid references and conflicting duplicate event keys are rejected.

```python
active = active_services(calendar, calendar_dates, '2026-11-24')
selected_trips = trips[trips.service_id.isin(active)]
selected_events = stop_times[stop_times.trip_id.isin(selected_trips.trip_id)]
```

The window is 07:00 inclusive to 19:00 exclusive. `25:10:00` becomes 90,600 seconds, not 01:10 on the same service day. A civil-day overnight study would need a different explicit treatment of adjacent service days. Duplicate detection uses trip and stop sequence; a loop can legitimately revisit the same stop twice.

The network counts standard-pickup, nonterminal departures. Parent stations do not add departures to their child platforms. Zero-service stops stay visible in grey. The three positive-frequency thresholds follow the original project, but the event definition differs because terminal and restricted-pickup events are excluded. That methodological difference is documented instead of hidden.

Exact frequency templates are expanded by headway and stop-time offset without counting the template again. Overlapping intervals are rejected. Non-exact frequencies have no reliable exact departure times and produce an explicit unsupported-analysis error. Neither actual ZIP has frequencies.txt, so no actual service was dropped for that reason.

### Buffers and geographic units

```python
projected = stops.to_crs('EPSG:26917')
coverage = projected.geometry.buffer(400, quad_segs=32).union_all()
web_coverage = geopandas.GeoSeries([coverage], crs=26917).to_crs(4326)
```

The CRS supplies metre units for distance. Dissolving buffers prevents overlapping polygons from being treated as separate coverage areas. The 400/800 m general layers include all boarding locations; the high-frequency layer selects High stops first and uses 400 m. None is a walking-network isochrone. No DA population statistic was computed from these new geometries.

### Sources, rendering layers and expressions

A GeoJSON source contains data; circle, line and fill layers draw that data as points, routes and coverage. The new `network-*` sources are separate from historical DA sources. Multiple styling options can use the same stop source without changing its recorded departures.

```js
['match', ['get', 'frequency_class'],
 'High', '#087F8C', 'Moderate', '#4C78A8', 'Low', '#D99A36', '#8A939C']
```

The expression picks a colour from a verified property. Zoom expressions enlarge circles and route strokes as the user zooms in, retaining regional readability without making local stops too small to inspect.

```js
['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 16, 7]
```

Polygon fills are below lines and points, and basemap labels remain legible. Route geometry comes from selected-date trip shapes, not guessed links between stops. One route can have several geometry variants, so 167 route-shape features do not mean 167 public routes. See [MapLibre expressions](https://maplibre.org/maplibre-style-spec/expressions/) and [layer types](https://maplibre.org/maplibre-style-spec/layers/).

### Events, popups and dynamic legends

Checkbox change listeners update layer visibility; the legend is generated from the same active-layer state. Switching frequency colours off changes both the circles and the key. Hiding stops disables their frequency-colour control. Click handling checks visible stops first, routes second, then historical DAs, so a polygon does not capture a stop click. A small route hit tolerance improves thin-line interaction.

Popups build DOM text nodes from exported attributes. They show the service day and feed, not a generic label suggesting live observations. Missing values and zero are different states. The date/source panel remains available even when network layers are hidden. User interactions do not recalculate the underlying spatial analysis.

### Temporal consistency and provenance

Professional transportation mapping requires compatible time references as well as compatible CRSs. The current bus feed starts after the original September analysis date; using it to explain the old DA percentages would mix inputs. Here the new snapshot is clearly separated, with raw-file checksums, official URLs, retrieval dates, calendar spans and a selected service day. Hashes enable checking that repeated processing used the same archive. A later download from the same URL may be different.

In planning practice this supports defensible scenario comparison: a new network analysis can be created with explicit assumptions, but historical totals must not be relabelled as current results. Scheduled frequency is only one service measure; reliability, destinations, travel time and pedestrian barriers remain outside this prototype.

### Personal activities still to complete

- Read an actual stops/trips/stop_times record and trace the joins for one route.
- Compare the Hazel / Columbia stop popup with the exported stop properties and official timetable.
- Explain why parent stations, terminal visits and repeat visits need different counting rules.
- Trace a 24+ hour time and an exception-day example through the tests.
- Inspect a buffer in QGIS and identify a real pedestrian barrier it ignores.
- Toggle frequency, route and buffer layers and explain the legend changes.
- Explain why the 2021 Census, historical DA results and November GTFS represent different temporal evidence.
- Capture the requested evidence and write your own reflections after those activities. No personal completion is asserted here.

## Phase 4 — Professional Web GIS interface design (2026-11-24)

### Automated development and the student's work

The coding agent audited the existing application and documented the redesign in [phase4-audit.md](phase4-audit.md) and [phase4-design.md](phase4-design.md). These documents describe technical observations and design reasoning. They are not a record of tutorials completed by the student or of the student's personal reactions. Use the final Phase 4 verification record for implementation/test outcomes; the design specification alone does not prove a feature was tested.

### Information hierarchy and cartographic hierarchy

A GIS interface has two complementary hierarchies. Interface hierarchy determines which questions can be answered first: the selected area, its historical population estimates, then the detailed layers and evidence. Cartographic hierarchy determines what is most visible on the map: muted contextual streets, restrained polygon fills, readable labels and distinct feature selection. A larger title is not a substitute for either hierarchy.

The redesign places the map in the main workspace and moves detailed methodology and sources into functional views. A compact overview reduces the need to infer regional totals from hundreds of polygons. A floating legend remains near the map it explains. This pattern helps transportation planners interpret a spatial pattern without losing access to the method behind a number.

### Responsive layout and CSS design systems

Responsive design changes how controls share limited space. On desktop, a persistent approximately 330 px sidebar can coexist with a useful map. On mobile, a drawer allows the map to remain the main surface. Merely shrinking the desktop layout would produce tiny controls and illegible feature tables.

CSS custom properties give colours, spacing, borders and text sizes reusable names. Changing a shared value consistently updates the interface. These tokens separate visual decisions from repeated selectors. They do not replace cartographic classifications: an accessibility palette must still represent the intended ordered intervals.

A map canvas does not always resize automatically when a surrounding panel changes. Observing its container and calling `map.resize()` keeps the rendered map and hit detection aligned with the visible area. The browser's page layout and MapLibre's internal drawing surface are related but distinct systems.

### Application state and layer management

State includes the selected municipality, visible layers, frequency-colour preference, open information view and selected feature. The same state should drive controls, the map and explanatory labels. Otherwise a dropdown can say Waterloo while KPI cards still show the entire region.

Layer visibility changes the presentation of an existing source; it does not rerun Python spatial analysis. Filtering saved DA features by their historical municipality attribute likewise selects existing evidence. Newer regional route geometry and dissolved buffers must retain their separate date and context. Their presence on the same map is not proof that they generated the older DA estimates.

### Data-driven statistics and comparison

A stacked accessibility bar must use mutually exclusive populations: within 400 m, between 400 and 800 m, and beyond 800 m. Because the 800 m count includes the 400 m count, stacking both inclusive totals would double-count residents. The middle category is the difference between the two estimates.

Municipality rates are ratios of summed estimated accessible population to summed population. Averaging DA percentages would give a small DA the same influence as a large DA and can produce a misleading municipal rate. Keep source estimates unrounded for calculation and round only labels. Missing evidence must remain unavailable rather than becoming a zero that looks like a real result.

Small horizontal bars can be built with HTML and CSS while retaining text percentages and counts. A chart library is unnecessary for this simple comparison and would add transfer and maintenance cost. Professional GIS interfaces benefit from clear, auditable transformations more than decorative chart effects.

### Accessibility and professional UX

Native buttons, checkboxes and selects supply familiar keyboard behaviour. Every action still needs a meaningful label and visible focus. Dialogs/drawers require a close mechanism and intentional focus behaviour so a keyboard user can return to the map controls. Long feature information needs bounded scrolling and readable labels on a narrow screen.

Colour is supplemented by class names, percentages, outline explanations and counts. Clear loading, unavailable and empty states distinguish a source failure from a valid zero-service result. Reduced motion respects users who find animated transitions uncomfortable. These practices make the application useful to a wider audience, but a limited automated/browser check is not a claim of complete accessibility conformance.

### Personal activities still to complete

- Compare the Phase 3 and Phase 4 interface and identify one concrete improvement and one remaining trade-off.
- Calculate one municipality's weighted 800 m rate from its DA sums and compare it with the displayed result.
- Explain why the stacked bar subtracts within-400 m population from within-800 m population.
- Select a municipality, toggle layers and explain which data change and which remain regional context.
- Trace a control event through application state to the map filter or visibility update.
- Use only the keyboard to explore navigation, the analytics drawer, layer controls and a dialog; record any difficulties you actually encounter.
- Inspect the mobile layout and explain why the map needs a resize notification after panel changes.
- Read Methodology and Data Sources, then write your own explanation of the historical/current-data distinction.
- Capture evidence and write your own reflections after performing these activities. No completion is asserted here.

## Phase 4 — Web GIS interface design (automated implementation)

The implementation separates pure statistics from UI state and rendering. `statistics.js` calculates population-weighted values from validated DA attributes; `dashboard.js` keeps municipality selection consistent between the selector, charts, map filters and title. CSS variables define a reusable palette and panel surfaces. A responsive grid and overlay drawer keep the map visible across device sizes; ResizeObserver tells MapLibre to recalculate its canvas when panels change.

Information hierarchy places study scope and historical dates above numerical results. Cartographic hierarchy preserves meaningful choropleth and frequency colours, uses subdued basemap context, and keeps transit points above polygon fills. The legend reports only active thematic layers and separates dates. Semantic HTML, native dialogs, keyboard focus styling and written alternatives to charts support accessibility. A contextual detail panel limits map occlusion and accommodates long source labels.

Professional GIS applications need this distinction between application state, display formatting and analytical evidence: choosing a municipality changes the displayed scope, not the underlying analytical methodology. Current network geometry must not silently redefine historical population access.

Personal activities still to complete:
- Compare the old and new interfaces and record your own observations.
- Explain why population weighting differs from averaging DA percentages.
- Trace a municipality selection from event to state, map filter and DOM update.
- Use the application by keyboard and assess the experience yourself.
- Compare desktop and mobile layouts and explain the map resize behavior.
- Describe one cartographic tradeoff when several layers are visible.
- Capture evidence and write your own GDS 187 reflection. No personal completion is asserted here.

## Phase 5 — client-side GIS interaction (automated development)

Application state has distinct meanings: municipality controls the statistical scope and supported feature filters; visibility controls cartography; basemap controls background appearance; selection controls the detail panel and highlight. Extent reset changes the camera, while Reset selection changes analytical scope. This prevents a map-navigation action from silently relabelling a population result.

```js
const filter = name ? ['==', ['get', 'FullName'], name] : null;
map.setFilter('da-accessibility-fill', filter);
```

Filtering hides features for display; it does not alter or rerun the Python analysis. Municipality rates remain `sum(covered population) / sum(population) * 100`. Exclusive distance bands are within400, within800-minus-within400, and total-minus-within800. Comparison exports retain unrounded values.

Client-side search normalizes existing identifiers/names once and ranks exact IDs before partial names. It never sends queries to a geocoder. Separate highlight sources preserve the user's layer choices; aggregated route search results retain all original route shapes. Safe DOM text avoids interpreting data values as HTML.

```js
const index = createSearchIndex({ municipalities, da, stops, routes });
const results = searchFeatures(index, '4236', 8);
```

Zoom-dependent styling limits point clutter. This implementation hides individual stops below zoom11 rather than clustering. Clustering groups nearby points by screen/zoom scale and would require clear count/aggregation semantics; a cluster's size must not be confused with a stop's departure frequency. No clustering implementation or personal clustering tutorial is claimed.

Dynamic legend groups reflect active themes and distinguish dates. The small-screen legend starts collapsed, while sidebar tabs keep layer controls reachable without scrolling past all statistics. Keyboard-operable tabs and search use ARIA state, arrow keys and native controls. Written percentages/counts supplement colour. Actual screen-reader testing remains future work.

Performance decisions: one MapLibre instance, unchanged full-accuracy GeoJSON, normalized in-memory search index, cached municipality aggregation, filters instead of per-selection data downloads, and background-only updates for basemap switching. PNG export reads within a render event rather than permanently preserving the drawing buffer, then adds attribution. Cross-origin failures are caught; exported images still need inspection.

Data provenance remains visible: historical2021population/September2026analysis is distinct from the November2026GTFS. CSVs carry dates; PNGs include source credits. CARTO terms were rechecked and the keyless configuration was replaced with OSM-backed streets plus an explicitly street-free dark background. Provider terms are part of responsible web GIS design.

Personal learning activities still to perform:
- Trace a search result through selection, highlighting, camera movement and details.
- Explain the difference between resetting extent and resetting analytical scope.
- Compare weighted municipality rates with a deliberately unweighted example.
- Inspect CSV and PNG exports and write your own assessment of their limitations.
- Test a tab/search workflow using only a keyboard and assess small-screen usability.
- Compare zoom-based point hiding with clustering and justify an appropriate use case.
- Write your own outreach reflection; automated implementation/testing is not evidence that you completed a tutorial.

## Phase 6 — release validation and static hosting

Completed by the coding agent: source reconciliation for all nine GeoJSON layers, 24 JavaScript and 14 Python regression tests, syntax/build verification, five viewport inspections, licensing/source notices and a GitHub Pages workflow. The outreach package indexes evidence and distinguishes current tests from earlier browser checks. See docs/outreach-report/final-qa-report.md for actual deployment status and gaps.

The application uses `map.once('style.load', async () => { ... })` in src/main.js so external basemap tile completion does not gate analysis loading. Each historical source catches its own error; `Promise.allSettled` allows the others to remain usable. GTFS completion updates the existing search index and municipality filter. This is fault isolation, not a guarantee that third-party tiles are always available.

An actual source/layer pair in src/main.js illustrates MapLibre architecture:

```js
map.addSource('da-accessibility', {
  type: 'geojson', data, attribution: 'Statistics Canada / Junho Lee'
});
map.addLayer({
  id: 'da-accessibility-fill', type: 'fill', source: 'da-accessibility',
  paint: {
    'fill-color': fillColorExpression(),
    'fill-opacity': 0.62,
    'fill-outline-color': 'rgba(0,0,0,0)'
  }
});
```

The source contains features; a layer determines how those features look. A fill expression classifies a population percentage, producing a choropleth. It does not recompute spatial coverage. A separate highlight source and feature-state hover styling avoid rewriting analytical values. JavaScript fetches JSON and uses its properties for safe DOM text, local search, filters and weighted summaries; MapLibre uses WebGL and a worker to render the geometry.

Static hosting publishes prebuilt HTML/CSS/JS and prepared data. No Python process runs on GitHub Pages. Vite's base is `/transitscope-waterloo/` in GitHub Actions and relative locally; data URLs use BASE_URL. A successful local build alone is not evidence of a working public deployment. The deployed URL and actual assets must be checked.

Validation compares original attributes and independent GTFS event counts rather than forcing expected totals. Sub-millimetre projection slivers are measured and checked against explicit distance/area tolerances. Hashes establish file identity, not scientific truth. Professional transport planning requires both reproducibility and a clear account of uniform-density, straight-line proximity and scheduled-service assumptions.

Personal activities still pending: reproduce a validation, explain one failure-handling test, inspect the live site and source/data requests, capture report-ready screenshots and write an honest first-person reflection describing assistance. No tutorial completion or independent learning outcome is asserted by this log.
