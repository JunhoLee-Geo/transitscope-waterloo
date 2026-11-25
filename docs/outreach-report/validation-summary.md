# Validation summary

Fresh release validation on November 25, 2026 passed for all nine published GeoJSON files. Inputs were not modified. [Machine-readable evidence](../release-data-validation.json) contains hashes, counts, bounds, missing-value counts and measured differences; [human-readable report](../release-data-validation.md) explains reconciliation.

Historical values match the original GeoPackage attributes by DAUID. Observed population is 587,165 across 766 DAs, with 437,869.907695 estimated within 400 m, 506,721.035328 within 800 m and 80,443.964672 beyond 800 m. Rounded display values match reference values. All 52 priority IDs satisfy the recorded rule. Municipality aggregation uses population weighting.

The separate GTFS export contains 2,289 boarding stops and 167 route-shape features. Independent archive-based counts reproduce 80,427 bus and 2,135 LRT departures. Frequency classes use departures/12: High >4; Moderate 2–4; Low >0–<2; No service 0.

All geometry is nonempty and valid; transformations and coordinate bounds corroborate EPSG:4326 output. Buffer nesting uses explicit 1 mm distance and 0.001 square metre area tolerances after reprojection. The measured high-frequency sliver outside the general 400 m buffer is approximately 0.00000022 square metres, a numeric precision effect; no geographic repair or fabricated geometry was introduced.

JavaScript: 24/24 tests passed; Python: 14/14 tests passed; syntax and production build passed. These checks establish consistency, not the accuracy of uniform-density assumptions or actual pedestrian access. Historical high-frequency population coverage remains unverified and is not presented as a validated KPI.
