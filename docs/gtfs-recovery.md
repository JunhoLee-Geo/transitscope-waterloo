# Historical GTFS recovery investigation

Investigation date: 2026-11-24. **A strong historical candidate was identified, but its ZIP was not recovered or verified against the original project.** No current feed has been substituted. Stop points, buffers and frequency layers remain unavailable in this phase.

## Evidence from the original project

The audited source commit is `966a88ccde44994fa2e60060c2b7c332228528ed`. A separate full-history mirror was downloaded for this investigation; the Phase 1 checkout and original repository were not modified.

The four commits visible in all fetched refs are `03c74ff` (initial analysis), `a031e6d`, `7433b0b`, and `966a88c`. `git log --all --name-only -- data/raw` returned no raw-data history; the object-name inventory contained no GTFS ZIP or raw stop/calendar files. The initial commit already ignores `data/raw/`. This is evidence about the published reachable history, not proof that the author has no local/archive copy.

Notebook 01 references `../data/raw/gtfs/stops.txt`. Notebook 06 references the same directory through `gtfs_path`, and records:

- Service analysis date: Wednesday **2026-09-09**.
- Analysis window: 07:00 inclusive to 19:00 exclusive, based on scheduled departure times.
- `calendar_dates.txt`: 5,060 rows, all recorded as service additions, spanning **2026-09-07 to 2026-12-20**.
- 51 active service IDs on the analysis day.
- `stops.txt`: 2,260 records, 12 columns; Notebook 01 identifies 2,246 boarding locations and 14 stations.
- Original raw ZIP name, archive checksum and `feed_version` are not documented.

These details come from source code and saved notebook output; the GTFS calculations were not rerun. [Original repository](https://github.com/JunhoLee-Geo/Waterloo-transit-accessibility/tree/966a88ccde44994fa2e60060c2b7c332228528ed).

## Official current distribution

The [GRT open-data page](https://www.grt.ca/about-grt/open-data/) links to the [Region's publishing tool](https://webapps.regionofwaterloo.ca/api/grt-routes/), which separates bus and LRT static feeds:

- Bus: `https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/1`
- LRT: `https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/2`

These are mutable current URLs, not date-pinned archives. The original README identifies the open-data landing page rather than a preserved download. No historical download selector was exposed by the official publishing page inspected. Current feed availability and service dates must be checked when starting a separately dated analysis. This investigation does not certify a current ZIP's contents.

## Historical archive candidate

[Transitland's version record](https://www.transit.land/data/feeds/f-dpwz-grandrivertransit~bus/versions/3038ff0a8cb884959e649df69d1a0c88f68bf9a8) identifies:

| Field | Archive metadata |
| --- | --- |
| Feed | `f-dpwz-grandrivertransit~bus` |
| SHA-1 | `3038ff0a8cb884959e649df69d1a0c88f68bf9a8` |
| Fetched | 2026-09-07 |
| Service span | 2026-09-07–2026-12-20 |
| Stops / routes | 2,260 / 52 |
| Producer URL | Official bus static feed above |

The matching service span and stop count make this a strong candidate, **not a confirmed byte-identical original input**. An indexed older version page also reports 5,060 calendar-date rows, consistent with the notebook. The current detail page requires an account for the remaining details; an attempted direct HTTP retrieval encountered an anti-bot challenge. No challenge was bypassed and no account was created.

Transitland documents historical ZIP access through account plans that include downloads and respect redistribution permissions. Its documentation offers an academic application route; plan wording differs between some pages, so verify entitlement in the account rather than assuming anonymous access. [Archive documentation](https://www.transit.land/data/feeds/archive/), [feed-version documentation](https://www.transit.land/documentation/concepts/static-gtfs-feed-versions/).

The [Mobility Database's former combined feed mdb-721](https://mobilitydatabase.org/feeds/gtfs/mdb-721) points to the old `GRT_GTFS.zip` producer URL and lists a February–April 2026 service period, not the required September period. Its [bus feed mdb-3150](https://mobilitydatabase.org/feeds/gtfs/mdb-3150) uses the current bus URL; the inspected indexed page reports download failure and no dataset-history rows. These are catalog observations with crawl dates that may lag live state. Neither supplied a verified September ZIP in this session.

## Recovery plan and acceptance criteria

1. Check the author's original project/download backups for `data/raw/gtfs/` or its ZIP. Preserve copies unchanged and calculate SHA-256 (and SHA-1 when comparing the archive candidate).
2. Obtain the specific Transitland candidate through an authorized account with appropriate historical-download access. Alternatively request the historical archive from GRT using the contact details on its official open-data page. No message has been sent on the user's behalf.
3. Compare file counts, stop coordinates/IDs, 2,260 stop records, 2,246 boarding locations, calendar span, 5,060 additions and 51 services on 2026-09-09. Counts alone cannot prove identical coordinates or schedules.
4. Resolve calendar service explicitly, including weekly calendars and exceptions where present. Make notebook inputs self-contained and fix the known order/initialization issues in a separate script.
5. Regenerate straight-line buffers in EPSG:26917 and compare population coverage and frequency results to committed outputs with documented tolerances. Investigate differences; do not adjust data to hit targets.
6. Only then publish historical stop/frequency/coverage layers with provenance, hashes and reference date. If no original match is established, label a candidate-based rerun as such.

Until recovery, the app can display committed DA accessibility attributes and priority polygons, but cannot reproduce historical stop points, 400/800 m union geometry, per-stop frequency, high-frequency coverage geometry or the 164,777 high-frequency population estimate. DA attributes do not contain enough information to reconstruct these missing geometries.

A newer bus/LRT feed can support a future separate analysis with its own service date, metadata, outputs and validation. Do not join its stop positions or frequencies to the historical 2026-09-09 results as though they share a source snapshot.

## Municipal boundary recovery

The [official Region ArcGIS layer 17](https://gis.regionofwaterloo.ca/wamap/rest/services/HousingCatalogue/MapServer/17) was successfully queried on 2026-11-24 with `where=1=1`, all fields, `outSR=4326`, and `f=geojson`. The returned FeatureCollection contains seven municipalities and attributes `OBJECTID`, `Municipality`, and `FullName`. The source layer metadata reports EPSG:26917; ArcGIS performed the requested WGS84 response transformation.

Raw response: `work/municipalities.geojson`; retrieval metadata and hash: `work/municipalities-source.json`. These scratch inputs were also preserved under project data/reference/ for reproducibility; the preparation pipeline creates the validated browser deliverable. The retrieved geometry is current context, **not proven to be the original notebook boundary snapshot**. Existing DA municipality assignments and analytical values must remain unchanged.

The layer's own description warns that these boundaries are pragmatic interpretations and may contain errors; they are not definitive legal boundaries. Preserve this limitation with source attribution. Region open-data licensing and attribution should be reviewed before public deployment.

