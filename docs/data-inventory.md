# Source data inventory and methodology audit

Inspected 2026-11-24. Primary source: [Waterloo-transit-accessibility](https://github.com/JunhoLee-Geo/Waterloo-transit-accessibility), commit `966a88ccde44994fa2e60060c2b7c332228528ed`. Inspection used a separate local read-only checkout; no changes were made to the original repository. All seven notebooks were read as notebook JSON, including code and relevant saved textual outputs. GeoPackage metadata and attribute tables were queried read-only with Node's SQLite support. The analysis was **not rerun**: raw inputs are absent and a usable Python environment was not available in this session.

## Committed data

Paths below are relative to the original repository. Counts are verified from the files, not inferred from the README.

| File / layer | Size | Records and geometry | CRS | Reuse decision |
| --- | ---: | --- | --- | --- |
| `data/processed/waterloo_da_population.gpkg` / `waterloo_da_population` | 1,007,616 bytes | 766 polygons; 766 unique DAUIDs | EPSG:26917 | Reuse as the population baseline; convert selected fields to WGS84 GeoJSON for the browser. |
| `data/processed/waterloo_accessibility.gpkg` / `da_accessibility` | 1,257,472 bytes for the whole file | 766 polygons; 766 unique DAUIDs | EPSG:26917 | Reuse existing proximity estimates and municipality assignment; no need to recompute them merely to display them. |
| Same GeoPackage / `priority_underserved` | Included above | 52 polygons; 52 unique DAUIDs | EPSG:26917 | Reuse the saved priority subset; verify IDs against the documented threshold before export. |
| `data/processed/municipality_accessibility.csv` | 617 bytes | Seven municipality rows; no geometry | Not applicable | Reuse as a table; convert to JSON for convenient browser loading. Contains proximity results and stop counts, **not frequency results**. |
| `figures/municipality_transit_accessibility.png` | Raster figure | Municipality proximity comparison | Not a spatial layer | Reference/report image only. |
| `figures/priority_underserved_areas.png` | Raster figure | Priority DA map | Not a spatial layer | Reference/report image only; do not digitize it into purported source geometry. |
| `figures/top10_underserved_das.png` | Raster figure | Ranked DA chart | Not a spatial layer | Reference/report image only. |
| `figures/proximity_vs_frequency_access.png` | Raster figure | Municipality frequency comparison | Not a spatial layer | Reference/report image; underlying frequency table is not committed. |

MapLibre does not natively load GeoPackage files. “Reuse” means preserving the existing analysis and exporting it, not passing the `.gpkg` file directly to MapLibre. No project spatial dataset is currently ready for direct GeoJSON loading; no analysis layers are loaded in phase 1.

## Attribute schema

Population layer: `fid` (SQLite primary key), `geom` (POLYGON), `DAUID` (TEXT), `DGUID` (TEXT), `LANDAREA` (REAL), `PRUID` (TEXT), `Population` (REAL).

Both accessibility layers have these fields plus `da_area`, `access_400_area`, `access_400_ratio`, `pop_access_400`, `access_800_area`, `access_800_ratio`, `pop_access_800`, `Pct_Access_400`, `Pct_Access_800`, `Pop_Beyond_800`, `FullName`, and `Pct_Beyond_800`. All added numerical fields are REAL; `FullName` is TEXT. Geometry area fields calculated in EPSG:26917 are square metres; ratios use 0–1 and `Pct_*` fields use 0–100. `LANDAREA` is an input Census field and is not the denominator used by the notebook; verify its source unit before presenting it.

CSV columns: `FullName, Population, Pop_Access_400, Pop_Access_800, Pct_Access_400, Pct_Access_800, Stop_Count`. CSV percentage columns are rounded to one decimal place. Use the population numerators and denominator, rather than averaging rounded percentages, when producing regional or filtered summaries.

`DAUID`, `DGUID`, and `stop_id` must remain strings during future imports/exports. Use `DAUID` as the stable feature identifier; do not rely on export-generated `fid` values.

## Results verified from committed tables

| Check | Observed result |
| --- | ---: |
| Total DA population in either baseline or accessibility layer | 587,165 |
| Estimated population within 400 m | 437,869.90769509046 |
| Estimated population within 800 m | 506,721.0353282297 |
| Estimated population beyond 800 m | 80,443.96467177027 |
| Priority DAs satisfying coverage <50% and beyond-800 m population ≥500 | 52 |
| Estimated beyond-800 m population in the saved priority subset | 49,712.36220502461 |
| Total population of the priority subset, including covered residents | 58,058 |

The proximity sums support the README's rounded 74.6% / 86.3% coverage results. The priority estimate of 49,712 is **not** the total population of those 52 DAs. All are historical analysis results; they do not describe live service.

Both GeoPackages pass SQLite `integrity_check`. The population layer has no null population or geometry values; the accessibility layer has no null geometry or municipality labels. Municipality DA counts are Cambridge 189, Kitchener 321, Waterloo 155, North Dumfries 17, Wellesley 19, Wilmot 29, and Woolwich 36. These checks do not establish polygon topology validity; run GeoPandas geometry validity checks before export.

Floating-point roundoff exists: minimum `Pop_Beyond_800` is about −2.27e−12 and maximum `Pct_Access_800` is 100.00000000000013. In the future export, check tolerances before clipping tiny errors to physical bounds. Preserve analytical precision and round only for presentation.

## Notebook findings

| Notebook | What its code does | Reproducibility observations |
| --- | --- | --- |
| `00_environment_test` | Imports analysis packages and creates a single illustrative Waterloo point. | Environment check only; the illustrative point is not a transit observation. |
| `01_gtfs_exploration` | Reads `stops.txt`, checks attributes, keeps `location_type == 0`, creates WGS84 points. | Saved output shows 2,260 total records, 2,246 boarding locations, and 14 stations; no stop file is exported. |
| `02_boundary_exploration` | Loads seven municipalities, overlays stops, transforms to EPSG:26917. | Municipal GeoJSON is missing from Git; notebook reports WGS84 bounds approximately [−80.86903, 43.26682, −80.18929, 43.68955]. |
| `03_census_exploration` | Starts with 1,149 bbox-selected DAs; initial intersection gives 791; final representative-point selection gives 766; joins population on DAUID; exports baseline GeoPackage. | Final DAs are selected by representative points, not clipped to the municipal union. Raw boundary and population files are missing. |
| `04_transit_accessibility` | Projects stops, unions 400/800 m buffers, intersects DA polygons, area-weights population, assigns municipality by representative point, exports DA/priority layers and CSV. | Zero-based cell 56 uses `label_points` before cell 57 defines it: a fresh sequential run can fail. Fix in a separate preparation workflow, not the original repository. Buffers and stops remain in memory and are not exported. |
| `05_visualization` | Reads saved analysis and produces three report figures. | Its priority map still needs the missing municipal boundary file. |
| `06_service_frequency` | Selects 2026-09-09 service, counts 07:00 ≤ departure time < 19:00 events, divides by 12, classifies frequency, calculates high-frequency coverage and saves a comparison figure. | `gtfs_path`, `trips`, and `stop_times` are referenced without initialization/loading in this notebook. A clean-kernel run is not self-contained. No frequency point, DA, or summary dataset is exported. |

Frequency saved outputs report 2,241 stops with daytime service: 380 Low (<2 events/hour), 1,461 Moderate (2–4 inclusive), and 400 High (>4). They report 164,777 estimated residents / 28.1% within 400 m of high-frequency stops. These figures are **saved notebook outputs, not independently reproduced in this audit**. The notebook aggregates all selected stop-time events and does not explicitly reapply `location_type == 0` to its frequency point table. Future preparation should validate the stop types and account for zero-service stops explicitly.

The frequency calendar code uses `calendar_dates.txt` additions (`exception_type == 1`) for the selected day. Saved output shows only additions and a date range of 2026-09-07 to 2026-12-20. This may suit that feed, but it is not a general GTFS calendar resolver. For a different feed, handle weekly `calendar.txt` service plus additions/removals and validate the chosen date. Do not silently substitute today's feed and label the results September 2026.

## Missing inputs and exports

| Needed dataset | How to obtain or regenerate | Important constraint |
| --- | --- | --- |
| Original static GTFS archive | Obtain the original September 2026 archive from the project author/local files; otherwise use the [official GRT open-data page](https://www.grt.ca/about-grt/open-data/) for an available feed. Expected original path: `data/raw/gtfs/`. | Exact historical archive/version/checksum is not committed. A newer feed requires a newly dated analysis, not a claim of exact reproduction. |
| Boarding stop GeoJSON | Read `stops.txt`; retain validated boarding locations; create Point geometry from longitude/latitude; join municipality and optional regenerated frequency. | Expected count 2,246 comes from saved original outputs, not a currently available stop dataset. |
| 400 m and 800 m coverage polygons | Rebuild from original validated stops in EPSG:26917; union overlaps; export each union to WGS84. | DA percentage attributes cannot recover the missing coverage geometry. These are straight-line coverage areas, not walking isochrones. |
| Municipal boundaries | Download seven polygons from the [Region's municipal layer](https://gis.regionofwaterloo.ca/wamap/rest/services/HousingCatalogue/MapServer/17), retaining `Municipality` and `FullName`; original path `data/raw/boundaries/waterloo_municipal_boundaries.geojson`. | Record retrieval date/CRS/licence and verify feature count; do not draw an approximate region polygon. Dissolving DAs is not a substitute for official municipal boundaries. |
| Original Census DA boundaries | Obtain [2021 DA boundary files](https://www150.statcan.gc.ca/n1/en/catalogue/92-169-X2021001); rebuild the input bbox selection and representative-point regional selection. Original path `data/raw/census/waterloo_da_bbox.geojson`. | Existing baseline GeoPackage already supports display without redownloading national boundaries. Original bbox-extraction procedure is not supplied. |
| Original Census population CSV | Locate the author's 2021 Census `DA.csv` or obtain an official Statistics Canada DA population product and explicitly map `DAuid` / `DApop_2021` to `DAUID` / `Population`. | The repository provides those column names but no exact population download URL/version. Do not assume a generic Census CSV has the same schema. Existing GeoPackage population can be reused. |
| Frequency stops / high-frequency buffer / DA estimates / municipality comparison | Make notebook 06's imports explicit in a separate script; resolve the selected service day; aggregate departures; preserve thresholds; export the intermediate and final products. | Mark zero service separately from missing data. Do not infer per-stop frequency from aggregate figures. |
| Browser-ready GeoJSON and summary JSON | Export selected fields from verified existing layers; reproject geometry to EPSG:4326 longitude/latitude; emit metadata alongside them. | No such web exports are currently committed. |

## Interpretation and provenance constraints

Population coverage assumes residents are uniformly distributed across each DA's full geometry. It is not an address-level count and can be misleading in large rural DAs. `da_area` is calculated polygon area, not the Census `LANDAREA` field. Municipalities are assigned using a representative point, so a DA extending across an edge is assigned wholly to one municipality. Keep this rule explicit in filtered statistics.

Buffers ignore paths, crossings, rivers, fences, gradients, and access restrictions. “Accessibility” here means estimated proximity to scheduled public transit, not verified wheelchair accessibility or destination travel time. Frequency counts combine routes/directions and are not headway or expected-wait estimates. The thresholds are project definitions, not official GRT categories. Census population is from 2021 while the saved service analysis uses September 2026.

The source contains pinned `requirements.txt`, but it has no committed raw-data manifest, exact GTFS archive checksum, or top-level licence file. Confirm source-data redistribution terms and attribution before publishing converted datasets. Preserve the source commit, filenames, download dates, analysis date/time window, CRS, transformations, and checksums in the future export manifest.
