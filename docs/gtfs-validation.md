# Phase 3 GTFS validation

Selected service date: **2026-11-24**, 07:00–19:00 America/Toronto.

The source archives are official newly acquired snapshots, not verified historical inputs.

| Feed | Boarding stops | Active trips | Departures in window | High / Moderate / Low / No service | Route shapes |
|---|---:|---:|---:|---|---:|
| bus | 2257 | 4155 | 80427 | 372 / 1492 / 389 / 4 | 164 |
| lrt | 32 | 196 | 2135 | 30 / 0 / 0 / 2 | 3 |

| Output | Features | Bytes | Invalid geometries |
|---|---:|---:|---:|
| stops.geojson | 2289 | 1344430 | 0 |
| routes.geojson | 167 | 1001140 | 0 |
| coverage-400m.geojson | 1 | 753027 | 0 |
| coverage-800m.geojson | 1 | 205182 | 0 |
| high-frequency-400m.geojson | 1 | 472116 | 0 |

All coordinates are EPSG:4326. Buffer calculation uses EPSG:26917; full source coordinates are retained and JSON is compact. No analytical population results were changed. All exported IDs are unique and JSON attributes round-trip exactly. Checksums, optional-table presence, service filtering, 24+ times and omitted terminal/pickup rows are recorded in [gtfs-validation.json](gtfs-validation.json).

## Interpretation and limits

- Newly downloaded official snapshot; not the original historical accessibility input.
- Counts are boardable nonterminal scheduled departures, not realtime arrivals or destination-specific headways.
- pickup_type 1/2/3 excluded; terminal rows excluded. This differs from the original all-stop-event method.
- 07:00 inclusive to 19:00 exclusive, agency local service day America/Toronto; 24+ hours never wrap to the same morning.
- No calendar.txt, frequencies.txt or feed_info.txt in these downloaded feeds; service spans derive from calendar_dates.
- General buffers include all feed boarding locations, including zero-service stops; high-frequency buffer uses >4 departures/hour.
- Straight-line proximity ignores pedestrian barriers. No DA population statistics were recalculated or joined.
- Station parents are not independently counted; individual platforms are kept. Feeds and stop IDs remain namespaced.
- Non-exact frequency templates fail explicitly; expected-service estimation is not silently represented as scheduled service.
