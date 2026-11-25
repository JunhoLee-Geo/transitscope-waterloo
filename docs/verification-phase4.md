
# Phase 4 verification — 2026-11-24

## Automated checks
- JavaScript: 13/13 tests passed, including six new aggregation tests.
- JavaScript syntax checks passed for main, data, transit, dashboard, statistics and Vite configuration.
- Python regression suite: 14/14 tests passed.
- Production build passed. Existing large-bundle warning remains (main about 1.10 MB / 306 KB gzip, MapLibre worker about 547 KB); no performance benchmark is claimed.
- SHA256 comparison: zero changed exported GeoJSON files. Original analysis clone has clean git status.

## Browser checks actually performed
Local Vite at 127.0.0.1:5175 was inspected using the in-app browser. The sandbox-only server was inaccessible to that browser; running the same loopback preview outside the sandbox resolved it.

| Viewport | Observed result |
| --- | --- |
| 1920×1080 | Full-height map, persistent sidebar, KPI cards, floating legend and header rendered. Sidebar collapse expanded map width to 1920 CSS pixels. |
| 1440×900 | Layout rendered with no horizontal overflow (document scrollWidth 1440); map dimensions 1110×828. Municipality selection and dialogs worked. |
| 768×1024 | Collapsible overlay sidebar and readable route detail panel rendered; map stayed available. |
| 390×844 | Mobile header, full-width map and analytics drawer rendered; document scrollWidth390 and scrollHeight844, no page overflow. Wellesley displayed verified zero covered population. |

Functional observations: Waterloo selection and comparison button produced 121,436 population, 155 DAs, five priority DAs, 98,312 estimated within400 and112,008 within800. Wellesley displayed11,318 population,19DAs,11priority,zero within400/800. Region reset restored totals. Sidebar toggle resized the map. Route7 King opened details. Stop3869 Research & Technology Station showed24 departures/2.00 per hour/Moderate/date2026-11-24. DA35300040 displayed1,099 population and99.5% within800. Buffer toggles added matching legend entries; hiding historical layers removed their thematic legend entries. Zoom controls operated.

Methodology, Data Sources and About opened real dialogs. Enter activated About; Escape closed dialogs and returned focus to the triggering navigation button. Focus styling and native control semantics are implemented. These are targeted checks, not WCAG certification, exhaustive keyboard coverage or screen-reader testing.

Browser console was clear during normal navigation, filtering and feature tests. The native MapLibre fullscreen request was denied by the embedded browser (`not granted`); that control was removed rather than leaving an action that raises an uncaught error. Fullscreen remains pending for a browser-supported implementation. No public deployment performed.

Screenshots were inspected inline at each viewport, including the Phase3 before view. No standalone screenshot files were saved; use the academic evidence guide for report capture. No instrumented rendering/FPS benchmark or low-end device test was performed. Expanded attribution can take substantial space on mobile; its native disclosure is collapsible.

## Next phase
Implement supported fullscreen with graceful permission failure, screen-reader spatial alternatives and broader keyboard audit; benchmark network payload/rendering before optimizing; capture report-ready screenshots; resolve redistribution licensing before any later deployment. Historical GTFS and population-access caveats remain unchanged.
