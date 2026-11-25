# Technical workflow

1. Preserve the original analysis checkout and record its commit and file hashes.
2. Read saved GeoPackage outputs with GeoPandas. Preserve DAUID strings and analytical attributes. Validate geometry and historical totals before exporting longitude/latitude GeoJSON.
3. Acquire the official bus and LRT feeds independently. Record download URLs, hashes, date and time zone. Apply service calendars/exceptions, exclude nonboardable terminal events, count scheduled departures in 07:00–19:00 and divide by 12 hours. Build buffers in EPSG:26917; transform output to EPSG:4326.
4. Vite copies public/data without server-side processing. JavaScript fetches relative to import.meta.env.BASE_URL, initializes GeoJSON sources and applies fill, line and circle styles.
5. Events update camera, highlight sources, filters and HTML. Population weighting uses summed covered population divided by summed population. It is not an average of DA percentages.
6. Run npm test, npm run check, npm run build, Python unit tests and scripts/validate_release.py. Review browser evidence and limitations.
7. GitHub Actions installs the lockfile with npm ci, tests, builds for /transitscope-waterloo/ and publishes dist through Pages. A local Vite server is not a public deployment.

See [the learning log](../learning-log.md) for actual code examples, [processing instructions](../../scripts/README.md) and [GTFS instructions](../../scripts/GTFS.md). Reacquisition may produce a different feed; archive hashes are essential to exact reproducibility. Missing inputs must fail explicitly.
