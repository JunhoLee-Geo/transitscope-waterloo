# Data sources and dates

| Source | Role | Date/provenance | Limits |
|---|---|---|---|
| JunhoLee-Geo/Waterloo-transit-accessibility | Saved historical DA results and source notebooks | Commit 966a88ccde44994fa2e60060c2b7c332228528ed; analysis date September 9, 2026 documented in notebook | Original historical GTFS archive not recovered |
| Statistics Canada | DA population and boundaries underlying analysis | 2021 Census | Uniform population density assumed when allocating coverage |
| GRT / Region of Waterloo | Bus and ION GTFS, routes, stops and derived buffers | Downloaded November 24, 2026; selected service November 24, 07:00–19:00 America/Toronto | Scheduled service only; newer than historical analysis |
| Region of Waterloo boundary service | Seven municipal contextual outlines | Retrieved November 24, 2026 | Current context, not definitive legal or historical boundaries |
| OpenStreetMap contributors | External street raster tiles | Requested when viewing Light/Standard | Availability and tile policy apply; Dark has no streets |

Exact URLs, hashes and processing parameters are in public/data/manifest.json and public/data/transit/manifest.json. See [inventory](../data-inventory.md), [release validation](../release-data-validation.md), [references](references.md), and [separate licensing terms](../../LICENSE.md). Raw GTFS archives are excluded from Git; processed exports remain available for the static site.
