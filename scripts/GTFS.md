# Reproduce the Phase 3 network

Run from the project root using the existing Python environment and requirements-data.txt:

```powershell
.venv/Scripts/python.exe scripts/prepare_gtfs.py --sources data/raw/gtfs-phase3/sources.json --service-date 2026-11-24
.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py" -v
.venv/Scripts/python.exe scripts/verify_gtfs_snapshot.py
```

The last verifier is intentionally specific to the preserved 2026-11-24 snapshot. It independently uses Pandas filtering/grouping to reconcile **every** output stop count against the raw ZIP; it is not a general validator for other dates.

To acquire a future snapshot, use a new directory (never overwrite the archived inputs):

```powershell
.venv/Scripts/python.exe scripts/download_gtfs.py --output data/raw/gtfs-new-snapshot
.venv/Scripts/python.exe scripts/prepare_gtfs.py --sources data/raw/gtfs-new-snapshot/sources.json --service-date YYYY-MM-DD
```

Choose a date supported by actual calendar service. The download command uses the mutable official bus and LRT endpoints, so it cannot guarantee retrieval of the Phase 3 bytes later. For exact reproduction retain bus.zip, lrt.zip and sources.json from data/raw/gtfs-phase3. They are local deliverables but ignored by Git. Current browser exports are included in public/data/transit and do not require Python to display.

## Method

- Validate archive hashes, required tables, unique IDs and references. Treat IDs as strings and namespace them by feed.
- Resolve weekly service and then apply additions/removals from calendar_dates. Inspect both calendars; these particular feeds use calendar_dates only.
- Select 07:00 inclusive to 19:00 exclusive in the agency's local **service day**. Times >=24:00 retain their extended-hour values, not modulo 24. This is not a rolling civil-day analysis that adds previous-day overnight trips.
- Canonical event key is trip_id + numeric stop_sequence. Remove identical duplicate records; reject conflicting duplicates. A loop returning to the same stop can have multiple legitimate events at distinct sequences.
- Count standard-pickup, nonterminal departures. Exclude pickup_type 1,2,3 and the last stop of each trip. Do not count parent stations separately. All location_type 0 records (including blank-default 0) remain in the stop export, including zero-service stops.
- Use Low >0–<2, Moderate 2–4 inclusive, High >4 departures/hour; zero is a separate No service category. Thresholds match the original project, but this count excludes terminal/restricted pickup rows whereas the original counted all stop events. The classes are not GRT's official categories.
- Exact frequency templates (exact_times=1) expand departures with offsets for each stop; the template is not also counted. Overlapping frequency intervals are rejected. Non-exact service (exact_times=0/default) fails with an explicit message because scheduled times cannot be invented. Neither actual input includes frequencies.txt, so this limitation does not omit any current feed service. Future feeds using non-exact frequencies need a separately labelled expected-service method.
- Routes use source shapes associated with selected-date trips, preserving route variants. No route geometry is guessed from stop connectors. The selected bus day has 51 routes; ION adds one, represented by 167 route-shape features total.
- Municipality labels use the validated official boundary snapshot; ambiguous/outside locations become null. Source geometry is not clipped to DA polygons.
- Dissolve 400/800 m buffers around **all boarding locations** in EPSG:26917. The high-frequency layer is a 400 m union around High stops for the selected window. Zero-service points therefore occur in general proximity coverage, but not high-frequency coverage.
- Export EPSG:4326, check geometry/extent/IDs and exact property round-trip, stage files before replacement, retain checksums/provenance in manifest.json. Full coordinate precision is preserved; compact JSON avoids unnecessary whitespace. No new historical population estimates are calculated.

## Outputs

`public/data/transit/{stops,routes,coverage-400m,coverage-800m,high-frequency-400m}.geojson` and `manifest.json`. Stop properties include scheduled frequency, so a duplicate frequency geometry file is unnecessary. `docs/gtfs-validation.md/json` record actual checks and limitations.

Python inputs are separate from Vite/browser sources. Prepare data before starting development or rebuild after regeneration. Run `npm run build` to copy refreshed public files into the production output.
