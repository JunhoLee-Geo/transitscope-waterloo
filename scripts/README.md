# Reproduce the Phase 2 spatial exports

Use Python 3.12 and the pinned `requirements-data.txt`. The project-local `.venv` created during implementation is disposable; do not distribute it. From the project root, with a working Python launcher:

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-data.txt
```

Alternatively, with uv installed:

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -r requirements-data.txt
```

Obtain a separate read-only source checkout. For a new machine, choose an unused directory:

```powershell
git clone https://github.com/JunhoLee-Geo/Waterloo-transit-accessibility.git data/raw/source-analysis
git -C data/raw/source-analysis checkout 966a88ccde44994fa2e60060c2b7c332228528ed
```

The script deliberately rejects a source repository that contains the output directory. `data/raw/source-analysis` is a separate nested checkout; it does not contain `public/data`.

Run with the preserved municipal response and its provenance:

```powershell
.venv/Scripts/python.exe scripts/prepare_data.py --source-dir data/raw/source-analysis --municipalities data/reference/municipalities.geojson --municipalities-source data/reference/municipalities-source.json
```

In this task workspace, the existing source checkout is `../../work/source-repository`, so that path can replace `data/raw/source-analysis`. The municipality snapshot is bundled under `data/reference/` for repeatability. It was retrieved from the Region's official ArcGIS service on 2026-11-24; the metadata records the query, CRS, hash and limitations. A fresh download may differ and must be treated as a new snapshot.

## What the script does

Reads the original GeoPackage layers and municipality CSV without overwriting them; validates CRS, geometry, duplicate/missing IDs, data types and analytical consistency; repairs invalid polygon geometry only where supported; transforms to EPSG:4326; tries reduced coordinate precision and retains more precision if needed to keep polygons valid. It serializes compact GeoJSON with original attributes, then validates the serialized geometry and exact attribute round-trip. All display displacement is measured in projected metres. Results are prepared in a staging directory before accepted exports are replaced.

Outputs include four GeoJSON layers, municipality-summary.json, manifest.json and docs/data-validation.json/md. No source fields are renamed. The population and accessibility baseline each contain 766 DAs; priority is a 52-feature subset. Those counts are observed historical results, not values inserted to make validation succeed. The report lists differences from rounded published targets. The high-frequency target has no independently verifiable spatial dataset and is explicitly unavailable.

## Tests

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"
npm test
```

See docs/data-validation.md and docs/verification.md for the actual run evidence. No raw GTFS processing or historical frequency reconstruction occurs in this script.
