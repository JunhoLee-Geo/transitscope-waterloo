# Official municipal reference snapshot

`municipalities.geojson` is the unmodified response retrieved on 2026-11-24 from the Region of Waterloo layer recorded in `municipalities-source.json`. The metadata includes the exact query URL and SHA-256. Keep this snapshot alongside the metadata to reproduce the current exports.

The service's source CRS is EPSG:26917; the query requests a GeoJSON response in EPSG:4326. These are current contextual municipal outlines, not a verified copy of the historical analysis boundary version. They do not replace the original DA municipality assignments or analytical results. The source cautions that its boundaries are pragmatic interpretations and not definitive legal boundaries.

To request a new snapshot, use the exact metadata `query_url`, save to a new filename, record its retrieval date and SHA-256, and pass that file and corresponding metadata to the preparation script. Do not silently overwrite this dated snapshot or keep its old hash/date for new data. Review attribution and redistribution terms before public deployment.
