# Phase 3 — final historical recovery and official GTFS acquisition

Checked 2026-11-24. The original historical GTFS was **not recovered**. The final bounded attempt revisited the known [Transitland September candidate](https://www.transit.land/data/feeds/f-dpwz-grandrivertransit~bus/versions/3038ff0a8cb884959e649df69d1a0c88f68bf9a8), checked official distribution and searched publicly indexed GTFS repositories. The version page could not be fetched; the Phase 2 account/access limitation remains. The public repository search surfaced catalogues and other agencies' releases, not a verified copy of the required GRT ZIP. This is not proof that no copy exists. No login, challenge bypass, account creation or message to GRT was performed.

The original published Git history was already checked in Phase 2: four commits contained no raw ZIP or GTFS tables. See [the earlier investigation](gtfs-recovery.md). Rather than spending further time on unavailable historical files, Phase 3 uses the official current endpoints as separately dated network inputs.

## Actual downloaded official archives

The [GRT open-data page](https://www.grt.ca/about-grt/open-data/) links to its [publishing tool](https://webapps.regionofwaterloo.ca/api/grt-routes/). Downloaded unchanged ZIPs are retained locally under `data/raw/gtfs-phase3/`. Hashes and UTC retrieval times are in `sources.json` and the generated transit manifest.

| Feed | Official URL | Download date | Calendar service span | Selected service date |
|---|---|---|---|---|
| Bus | https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/1 | 2026-11-24 | 2026-11-23–2026-12-20 | 2026-11-24 |
| ION LRT | https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/2 | 2026-11-24 | 2026-07-05–2028-07-03 | 2026-11-24 |

The service spans were inspected from calendar records; both feeds contain active service on the selected Tuesday. Neither includes `feed_info.txt`, so there is no declared feed version or feed-info validity interval to report. SHA-256 identifies the exact downloaded bytes. The bus ZIP differs from the September candidate SHA-1 and begins after the historical analysis day; it cannot reproduce that day. The LRT feed's longer calendar does not establish that it was used in the historical analysis.

Bus SHA-256: `e0a15429750a969756b78c8e84262aad7fcb16359321c9468a8335d787a0c3f1`.

LRT SHA-256: `9f872bb7bc6ca99029e6426a50e5a2167a96522f13ad97b92a8177b04a84b34c`.

Provider: Grand River Transit / Regional Municipality of Waterloo. Both agencies declare America/Toronto. The bus feed contains bus route types; ION route 301 is supplied separately. No overlapping route identity was found in the processed selected-date routes. Stop IDs are namespaced by feed, and station parent records are not counted as additional boarding points.

## Temporal interpretation

The historical DA percentages and priority subset remain unchanged. New network layers use the November snapshot and 2026-11-24 service day; no historical population was intersected with new buffers. The historical high-frequency population value 164,777 remains unverified and is not displayed as a verified statistic.

A future original-feed recovery can still use an authorized Transitland download or the author's preserved raw files. Validate archive identity, date range, records and regenerated results before changing historical-source status. A matching stop count alone is insufficient.

## Reuse and limitations

The official endpoints are mutable. Running the download script later may obtain a different feed and requires a new service date and separate provenance. Calendar end dates do not guarantee unchanged service until that date. Data is scheduled service, not real-time performance. Preserve the Region's attribution and review its linked open-data licence before publication. No website deployment occurred in this phase.
