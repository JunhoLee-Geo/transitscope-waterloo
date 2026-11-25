# Phase 3 verification — 2026-11-24

## Automated checks completed

- `npm test`: 7 JavaScript tests passed (historical classification and popup regressions plus network legends and zero/missing values).
- `npm run check`: JavaScript syntax checks passed.
- `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"`: 14 tests passed, including calendar exceptions, 24+ hour times, window boundaries, terminal/pickup exclusions, duplicates, frequency expansion and class thresholds.
- `scripts/verify_gtfs_snapshot.py`: independent pandas aggregation matched all 2,257 bus and 32 LRT boarding stops, respectively 80,427 and 2,135 boardable departures.
- Reprocessing the fixed archives produced identical hashes for all six generated transit files. Spatial checks verified stops within 400 m coverage, 400 m within 800 m coverage, and high-frequency coverage within general 400 m coverage.
- Export validation: unique IDs, valid nonempty geometry, local geographic bounds, property/geometry round trip and unchanged input archive hashes. See gtfs-validation.md/json.
- `npm run build`: passed. Vite reports a bundle-size warning: main JS about 1.087 MB (303 KB gzip), plus MapLibre worker about 547 KB. This is not a build failure.
- Original source clone `git status --short`: empty; source repository unchanged.

## Browser observations

Production preview tested at http://127.0.0.1:4173 in the in-app browser. All five new datasets loaded: 2,289 stops, 167 route variants, and one dissolved feature for each buffer. Historical layers also loaded (766 DAs, 52 priority DAs, seven municipalities).

Observed controls for routes, stops, frequency colouring and all three buffers; dynamic legends updated. Route legend distinguishes purple bus geometry and teal ION geometry. Clicked Hazel / Columbia stop: 28 departures, 2.33 per hour, Moderate, date 2026-11-24. Independently checked against exported properties. Clicked route 8 Weber with stops hidden: route name, feed, service date and provider appeared. Historical DA popup remained functional. No errors or warnings were returned by the browser console capture.

The narrow layout renders the sidebar above the map. Popups use wrapped two-column fields and scroll for long content. Expanded attribution can occupy substantial map space on small screens; its native toggle collapses it. Rendering and interaction were usable in this session; no instrumented frame-rate, low-end-device benchmark, or exhaustive accessibility audit was performed.

## Scope and limitations

Historical GTFS recovery remains incomplete. Current official archives are a separate snapshot; they cannot verify historical high-frequency population access. General buffers include six boarding locations with no counted departures in the chosen window. Buffers represent planar proximity, not pedestrian routes. Frequency averages do not measure reliability or destinations.

Non-exact frequency service (`exact_times=0`) deliberately raises an unsupported-input error rather than inventing scheduled departure times. Current input archives have no frequencies.txt. The download helper is provided for future official snapshots; the full pipeline was validated against the acquired archived ZIPs. A future download will change the input and may require a different service date.

No public deployment, final dashboard redesign, current-population accessibility recomputation, or personal student learning completion is claimed.
