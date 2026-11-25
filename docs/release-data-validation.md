# Release spatial data validation

Checked: 2026-11-25T09:58:28.283863+00:00

**Result: passed.** All spatial inputs remained unchanged.

RFC7946 GeoJSON longitude/latitude; reader identifies EPSG:4326. Numeric bounds and source transformations corroborate CRS; coordinates alone cannot prove a datum.

| Layer | Features | Geometry | CRS | SHA256 matches manifest |
|---|---:|---|---|---|
| da-accessibility.geojson | 766 | Polygon | EPSG:4326 | Yes |
| da-population.geojson | 766 | Polygon | EPSG:4326 | Yes |
| municipalities.geojson | 7 | Polygon | EPSG:4326 | Yes |
| priority-underserved.geojson | 52 | Polygon | EPSG:4326 | Yes |
| transit/coverage-400m.geojson | 1 | MultiPolygon | EPSG:4326 | Yes |
| transit/coverage-800m.geojson | 1 | MultiPolygon | EPSG:4326 | Yes |
| transit/high-frequency-400m.geojson | 1 | MultiPolygon | EPSG:4326 | Yes |
| transit/routes.geojson | 167 | LineString | EPSG:4326 | Yes |
| transit/stops.geojson | 2289 | Point | EPSG:4326 | Yes |

Every layer has nonempty valid geometry, unique feature IDs and longitude/latitude bounds in the Waterloo vicinity. Full null/blank counts, file hashes, bounds and environment versions are in the JSON report.

## Historical reconciliation

All preserved source attributes match the original GeoPackage by DAUID exactly. Reprojected geometry differences stay below0.1m (coordinate rounding, no simplification). Municipality population/coverage sums match both original and exported CSV totals within1e-7 residents. Rates are population-weighted, not averaged DA percentages.

| Metric | Observed | Rounded reference | Match |
|---|---:|---:|---|
| study_population | 587165.0 | 587165 | Yes |
| dissemination_areas | 766 | 766 | Yes |
| population_within_400m | 437869.9076950905 | 437870 | Yes |
| population_within_800m | 506721.03532822966 | 506721 | Yes |
| population_beyond_800m | 80443.96467177026 | 80444 | Yes |
| priority_das | 52 | 52 | Yes |

Fractional differences from rounded reference values are expected rounding, not discrepancies. Tiny source floating-point noise (negative beyond800 around2e-12 and percentage800 just above100) is preserved; validation uses1e-7 tolerance. Priority52DA IDs exactly match the documented <50% access and ≥500 beyond800 rule.

## Separate GTFS snapshot

Manifest and stop attributes agree on2026-11-24,07:00–19:00,America/Toronto. Archive hashes and ZIP integrity match. Independent stop-time grouping reproduces every exported stop departure count. All rates equal departures/12 and every frequency class matches its thresholds. Current400/800/high-frequency buffers are nested and include their relevant stops.

- bus: 2257 boarding stops; 80427 independently counted departures; all stop counts match.
- lrt: 32 boarding stops; 2135 independently counted departures; all stop counts match.

## Reproduce

Run `python scripts/validate_release.py --source-dir /path/to/original-analysis --archive-dir data/raw/gtfs-phase3` with requirements-data.txt dependencies. The default source directory is the local sibling work/source-repository checkout. Missing original files/archives fail explicitly; the validator never fabricates a successful comparison.

## Limitations

- Historical GTFS archive not recovered; high-frequency historical population coverage not verified.
- Straight-line buffer / uniform population-density assumptions remain; validation does not prove walking accessibility.
- Current GTFS is scheduled service, not live observations.
- Optional GTFS blank parent_station and route labels for zero-service stops are expected; all null/blank counts are reported.
- Original analysis repository has no software/data licence file in the inspected clone; redistribution requires separate rights review. This audit is not a legal determination.
- Current municipal outlines are contextual, not verified as historical or definitive legal boundaries.
