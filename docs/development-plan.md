# TransitScope development plan

Phase 1 establishes a separate static web project and documents the existing evidence. The full analytics dashboard is intentionally outside this phase. The original analysis repository remains unchanged.

## Phase 1 — Foundation

- Audit the README, seven notebooks, committed GeoPackages, summary CSV, figures, and requirements.
- Record reusable fields, verified counts, missing raw inputs/exports, analysis assumptions, and clean-kernel execution issues in [data-inventory.md](data-inventory.md).
- Initialize a plain HTML/CSS/ES6 project with Vite and MapLibre GL JS.
- Display a basic, attributed basemap centred on Waterloo Region with navigation controls, a restrained light interface, and clear wording that transit layers are not loaded yet.
- Document setup, educational concepts, and personally pending learning activities in the README and learning log.
- Validate the production build, local HTTP serving, and browser rendering where available; record any limitations honestly.

Acceptance: a locally runnable base map, no invented analytical layers/statistics, no modification of the original repository, and an actionable data preparation plan. Exact validation evidence belongs in the learning log rather than being presumed by this plan.

## Phase 2 — Reproducible data preparation

1. Preserve the source commit and copy only required processed inputs into the new project's preparation workspace. Record checksums and attribution. Obtain official municipality geometry and the original GTFS archive if available.
2. Create a Python/GeoPandas environment. Keep analysis in EPSG:26917; export geometry to EPSG:4326 with longitude then latitude. Use `to_crs`, not a CRS-label override.
3. Export existing `da_accessibility` and `priority_underserved` layers first. Retain DAUID, municipality, population, coverage numerators/ratios, and priority status. Check geometry validity, unique IDs, nulls, finite values, and coverage bounds with numerical tolerance.
4. Convert municipality CSV to JSON with explicit units. Derive aggregate rates from summed covered population divided by summed population; do not average DA percentages.
5. Make GTFS processing self-contained in the new project: explicit file loading, string IDs, calendar resolution, boarding-location validation, missing/zero-service distinction, date/time window, and threshold metadata. Fix the notebook ordering/import issues in this new workflow only.
6. Regenerate stop points and dissolved 400/800 m coverage. Export frequency stops, high-frequency coverage, and DA/municipality frequency summaries only after their source inputs are verified.
7. Add a manifest containing source URLs, source commit, input hashes, download dates, Census year, GTFS service date, CRS, units, threshold definitions, and processing version. Make missing products explicit rather than generating substitutes.

Suggested future browser assets (not yet generated): `public/data/municipalities.geojson`, `da-accessibility.geojson`, `priority-underserved.geojson`, `transit-stops.geojson`, `coverage-400m.geojson`, `coverage-800m.geojson`, `municipality-summary.json`, and `manifest.json`. Frequency properties may be joined to stop features after validation; a separate frequency file is only needed if it makes loading clearer.

Acceptance: geographic bounds match Waterloo Region; 766 DA IDs and population 587,165 reconcile for the preserved historical baseline; 52 priority IDs match the threshold; totals reconcile with the source tables within floating-point tolerance. Original stop/frequency counts are comparison targets only when the same historical feed is available. A new feed must produce a separately dated analysis. Compare exported geometry visually with the GeoPackages in desktop GIS. Do not simplify geometry used for statistics; if display geometry needs simplification, retain the analytical master and document tolerances.

## Phase 3 — Map layers and interaction

- Load validated GeoJSON after the MapLibre style is ready. Define separate sources and visible layers for stops, coverage, DA choropleths, municipality outlines, and priority areas.
- Build layer visibility controls and legends from the same styling definitions so labels and map colours agree.
- Add popups using text nodes for data values; show units, source year/date, and estimated-population language.
- Implement municipality filtering consistently for layers, feature selection, and summary calculations. Derive map extent from official geometry. Test all seven municipalities and the regional reset.
- Provide loading, empty-data, and fetch-error states. Use relative asset URLs compatible with the GitHub Pages project path.

Acceptance: each control changes the intended layer, filters and statistics use matching selections, and no missing values appear as zero. Base-map and source attribution remain visible.

## Phase 4 — Analytics dashboard and accessible layout

- Add compact verified statistical cards, structured sidebar, and responsive mobile controls.
- Provide colour legends that are readable without colour alone, keyboard-operable controls, clear focus styles, and a textual statistics/table alternative to map exploration.
- Keep the distinction between stop proximity and scheduled frequency visible, with methods and limitations available beside results.
- Test narrow screens, keyboard navigation, slow/failing requests, zero-service municipalities, and unavailable WebGL. Measure asset size and load performance before introducing any additional technology.

Acceptance: the dashboard reproduces independently computed summaries, remains usable on desktop/mobile, and never implies route-level waiting times, walking-network coverage, or live service.

## Phase 5 — GitHub Pages and academic handoff

- Create a separate GitHub repository named `transitscope-waterloo` when deployment is requested. Do not push into the source analysis repository.
- Configure Vite's base for the chosen Pages URL, build static `dist/`, and add a Pages deployment workflow. Verify the actual deployed asset and GeoJSON URLs.
- Review basemap service terms and dataset redistribution/attribution before public deployment.
- Publish the methodology, source manifest, verification record, and limitations with the site.
- The student personally completes the learning activities, records their own reflections, and selects screenshots/explanations for the GDS 187 report. Agent-produced implementation is not evidence of personal tutorial completion.

Acceptance: a working public static URL, correct attribution and metadata, no server dependency, and a learning record clearly separating implementation evidence from the student's own observations.

## Phase 2 implementation update — 2026-11-24
Validated GeoJSON exports and the requested basic interactive layers are implemented. See data-validation.md for measured results and verification.md for tests. Historical GTFS remains an identified archive candidate, not a verified recovered input. Stop/frequency/buffer regeneration and the complete dashboard remain pending. Refer to gtfs-recovery.md for the concrete recovery path.


## Phase 3 implementation update — 2026-11-24
Official bus and LRT snapshot acquisition, reproducible GTFS processing, five transit GeoJSON layers, interactive controls/popups/legends and temporal provenance are implemented. See verification-phase3.md and scripts/GTFS.md. The historical archive remains unverified. Next: personally complete the learning checklist, obtain original historical inputs if historical reproduction is required, then separately scope population recomputation and the final dashboard/deployment.

## Phase 4 status
Dashboard UI and targeted responsive/browser checks are implemented. See verification-phase4.md. Fullscreen is omitted after the embedded browser denied it; standalone screenshot capture, broader accessibility audit and instrumented performance profiling remain follow-up work. Original datasets and Python pipelines were preserved. No deployment was performed.

## Phase 5 status
Advanced local search, tabbed analytics, comparison metrics, cartographic refinements, selection, CSV/PNG exports and basemap controls are implemented. See phase5-verification.md for actual checks and limitations. Deployment remains a future explicitly requested action; the current local preview is intentionally left running for the user.
