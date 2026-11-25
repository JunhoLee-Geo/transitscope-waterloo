# Phase 5 — interaction design, data integrity and verification

## Implemented

The existing application was refined, not rebuilt. A 350px desktop sidebar has keyboard-operable Overview, Layers and Compare tabs. Overview pairs coverage percentages with estimated populations. Compare offers within400%, within800%, estimated residents beyond800 and priority DA count, with ascending/descending/name ranking. Clicking a municipality selects and zooms; Reset selection restores regional scope. Extent changes the camera only, preserving the selected analytical scope.

Historical choropleth, restrained #B66D48 priority outlines and municipal boundaries are the clean default. DA boundaries and all November network layers default off. Stops use minimum zoom11 and zoom-dependent radius/stroke; there is no clustering. Explicit low-zoom hiding avoids making clusters look like frequency observations. Opacity sliders and Reset layers are implemented. The bottom-right legend uses collapsible thematic groups and two-column entries; mobile starts collapsed.

Search uses only existing municipalities, DAUIDs, stops and routes. Names are normalized once. Results prioritize exact IDs and support arrows/Enter/Escape, clear and no-result feedback. A route result combines its existing shape coordinates without inventing geometry. Selection highlights a separate GeoJSON source; search does not require turning the whole network on. Municipality filtering covers historical DAs and boarding stops. Routes and dissolved buffers remain labelled regional context; no clipping or newly recomputed population access is implied.

The unified toolbar has zoom, extent, north/tilt reset, fullscreen with a handled-denial message, and synchronized basemap selectors. Map sources, filters and state persist during background changes. Fullscreen was denied by the embedded browser during testing; the graceful fallback worked.

## Basemap decision

Current [CARTO terms](https://www.carto.com/legal/basemap-terms/) require a key, including the noncommercial allowance. Unauthenticated access to the old URL is not proof of permitted usage. This phase uses [OpenStreetMap Standard tiles](https://operations.osmfoundation.org/policies/tiles/) with visible attribution and ordinary browser caching/referrer behavior. Light desaturates/softens the same tiles; Standard uses their original appearance. Dark is explicitly an analysis background without street tiles or labels. No offline cache, prefetch or bulk downloader was added. Review provider policy and expected traffic before public hosting; no service availability guarantee is made.

Only background/raster paint and visibility change: MapLibre is not reconstructed and analytical sources are not reloaded. [MapLibre raster source documentation](https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/) describes this separate-source approach.

## Exports and saved evidence

- Selected attributes CSV: actual properties plus explicit dataset metadata. Strings use RFC4180 quoting and spreadsheet-formula neutralization. Identifiers remain strings, though spreadsheet applications may auto-format them on import.
- Municipality comparison CSV: all seven municipalities and all metrics, unrounded values, population year, historical date and method.
- Map PNG: reads the canvas during a render event and adds visible source attribution and dates. It does not include HTML panels/legend. Canvas/CORS restrictions are caught and reported. Always inspect an image before sharing; incomplete tile loading can affect what is visible at capture time.

Actual browser downloads were copied to docs/evidence/phase5-municipalities.csv, phase5-route19.csv and phase5-map-export.png. The PNG was opened and visually inspected: geographic content and attribution footer are present. It is an export sample, not a screenshot of the dashboard UI. Before/after UI screenshots were captured and inspected inline via browser tools; standalone UI screenshot files were not saved. Do not claim the PNG contains sidebar evidence.

## Actual browser observations

| Viewport | Result observed |
|---|---|
|1920×1080|Desktop overview, search, unified toolbar and compact legend rendered; PNG export completed.|
|1440×900|Layers tab, all five network toggles, opacity sliders and basemap selectors operated; route details/CSV worked.|
|1366×768|Three tabs and historical default rendered; comparison400% sorting and search operated. Panel content scrolls independently.|
|768×1024|Tablet drawer collapse and full map rendered; document dimensions matched viewport (no page overflow).|
|390×844|Mobile search/toolbar/map and initially collapsed legend rendered; page dimensions390×844; arrow-key tabs, comparison metrics, municipality search/reset worked.|

Specific checks:
- Region:587165population,766DAs,52priority;400m74.6%/437870;800m86.3%/506721 (rounded display).
- Wellesley search: the observed and validated values are **11318 population,19DAs,11priority,0.0% within400/800**. Reset restored regional values.
- Stop4236 Hazel / Columbia:28 scheduled departures,2.33/hour,Moderate,route19,date2026-11-24.
- DA35300040:1099population,99.5% within800,priorityNo; supported attributes remained readable.
- Route19 Hazel:search combined six existing shapes; CSV download contains shape_count6,service_date2026-11-24 and official source URL.
- No-result search displayed explicit feedback. ArrowDown/Enter selected suggestions. Keyboard arrows selected sidebar tabs. Clear search worked.
- All five transit layer toggles, both opacity controls, Reset layers, historical/priority controls and comparison ranking were exercised. Legend items tracked enabled themes; groups expand rather than adding a fixed internal scroll area.
- Standard, Light and Dark choices were exercised; selection/details and analytical layers persisted. Dark has no streets by design.
- Fullscreen denial produced an explanatory status rather than an uncaught error.
- Fresh final browser session reported no error/warning logs during the tested flows. An earlier hot-reload while markup was incomplete produced an initialization error; it was absent in the fresh completed application.

These are targeted checks, not exhaustive screen-reader/WCAG certification, low-end-device testing, or an instrumented FPS benchmark. Native browser download behavior and fullscreen permissions vary.

## Automated validation and performance

19 JavaScript tests passed: historical classification/popup, population-weighted aggregation, search and CSV escaping. Syntax checks and production build passed. Python regression and dataset hashes are recorded in final verification below. Search index construction and tests used the real exports; normalized lookup scans about3100features without network requests. Route geometries are reused, not simplified. Municipality comparison aggregates once after load; selection updates the affected DOM and filters. A single map instance and persistent raster source avoid reinitialization during basemap changes.

Main bundle remains about1.10MB (about308KB gzip), with MapLibre worker about547KB; Vite's size warning remains. No claim of a performance regression benchmark is made. New browser controls were usable in the tested session. Basemap tile availability remains external.

## Data and remaining limits

Historical date2026-09-09 is documented in the inspected source notebook06_service_frequency (see data-inventory.md); it is a recorded analysis date, not proof that the original GTFS archive is recovered. Actual public/data/transit/manifest.json confirms service_date2026-11-24,07:00–19:00,America/Toronto. Census population is2021. Historical high-frequency population is still unverified and not displayed. Straight-line proximity is not pedestrian network access; scheduled service is not live transit.

## Final deployment preparation (not performed)

1. Review original data redistribution terms and current tile-provider policy; choose a suitable provider for expected traffic.
2. Run npm ci, npm test, npm run check and npm run build with Node22.12+.
3. Smoke-test dist through npm run preview, including a GitHub Pages repository subpath. Vite base './' and BASE_URL data loading are retained.
4. Complete accessibility, cross-browser and download review; capture report-ready UI screenshots and write personal reflections.
5. When publication is explicitly requested, configure GitHub Pages to publish dist via an appropriate build workflow. No remote, deployment workflow, push or public publication was created in this phase.


### Final verification result
Final JavaScript tests19/19, Python tests14/14, expanded syntax checks and production build passed. SHA256 comparison found zero changed geographic export files. Original source repository git status remained clean. Python/Pillow image introspection was unavailable (Pillow is not installed); the PNG was instead opened successfully with the image viewing tool and visually inspected, without adding a dependency.
