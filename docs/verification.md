# Phase 2 verification — 2026-11-24

## Automated checks

- `npm test`: 5 tests passed (class boundaries, missing/invalid values, bounds, identifier preservation, popup formatting/priority status).
- `npm run check`: JavaScript syntax checks passed.
- `.venv/Scripts/python.exe -m unittest discover -s tests -p test_prepare_data.py -v`: 7 tests passed, including rejected duplicate/blank IDs, missing CRS, nonfinite values and inconsistent population; valid polygon repair; metric displacement; staged failure preserving accepted output.
- Data preparation completed with 766 baseline DAs, 766 accessibility DAs, 52 priority DAs and 7 municipalities. No missing/empty/invalid source geometries or geometry repairs. All original attributes survived JSON round-trip exactly.
- Repeating the full preparation command produced identical SHA-256 hashes for all eight generated data/report files. Source hashes were unchanged and the original source checkout's `git status --porcelain` was empty.
- `npm run build`: production build passed. Vite retains its large-chunk advisory (~1.08 MB application JS before gzip, ~300 KB gzip, plus ~547 KB worker); no extra framework was added.

See [data-validation.md](data-validation.md) and [data-validation.json](data-validation.json) for exact statistical differences, field null/type information, source/export hashes, bounds and displacement measurements.

## Actual browser checks

The local production build was served at http://127.0.0.1:4173 during verification. These are observed results, not only code inspection:

- Page and all three displayed GeoJSON resources returned HTTP 200.
- Browser status reported `DA data: 766 loaded. Priority areas: 52 loaded. Municipal boundaries: 7 loaded.`
- Region-wide choropleth, DA outlines, orange-red priority outlines and municipal context rendered around Waterloo/Kitchener/Cambridge. Fit study area used actual GeoJSON bounds.
- Clicking DA `35300066` showed City of Waterloo; Census population 1,817; estimated within-400 m and within-800 m population 1,817 each; estimated beyond-800 m population 0; coverage 100.0%; priority No. These display values were checked against exported original values (1816.9999999999995, 4.547473508864641e-13 and 99.99999999999997 before presentation rounding).
- Cursor changed to pointer over an interactive DA; hover state is driven by stable DAUID. Popup content uses safe text nodes.
- All four visibility controls were exercised. Hiding all DA/priority layers cleared the popup and legend, and clicking the hidden features did not create a new popup. Municipal visibility could be changed independently.
- Before the municipal export was present, the app kept the DA and priority layers working, disabled the missing municipality control and showed an unavailable status. The caught JSON/fetch warning did not crash the map.
- With all final datasets present, production browser error/warning logs were empty after loading and interaction.
- Desktop layout and a narrow viewport were checked. In the narrow view the observed document width and scroll width were both 375 px, with a 375 × 506 px map canvas: no horizontal page overflow was observed. This is a basic responsive check, not a full accessibility audit.

## Issues found and addressed

During development on Windows, Vite's watcher encountered an EBUSY file lock while the Python workflow copied a reference input. The Vite config now excludes the Python environment, raw/reference/processed data directories and preparation scratch directories from source watching. Browser assets in public/data remain watched. Data preparation is best run before launching development; the production preview has no source watcher.

The first missing municipal request received Vite's HTML fallback rather than GeoJSON. The application caught the JSON failure, reported source unavailability and continued rendering the other layers. With the generated file present the request succeeds.

## Limits and next verification

- Historical GTFS ZIP identity is unconfirmed; no stops, frequency or buffer geometries were generated. The 164,777 high-frequency population target is not independently verifiable from available spatial datasets.
- Municipality geometry is a separately retrieved official snapshot; it is not established as the original historical boundary version.
- A full manual QGIS comparison, keyboard/screen-reader map alternative and broad device/browser audit remain student/future tasks. Browser popup checking sampled one real DA; automated preparation checks cover all attribute records.
- Network failure of the remote basemap and WebGL failure are handled in code but were not exhaustively simulated in this phase.
- No GitHub Pages deployment was performed. Basemap internet availability, dataset redistribution terms and attribution must be reviewed before publication.
- Temporary verification servers are stopped at handoff. Start the application using the README commands.

Phase 3 checks are recorded separately in [verification-phase3.md](verification-phase3.md).
