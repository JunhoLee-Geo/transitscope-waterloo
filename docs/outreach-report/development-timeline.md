# Development record

This is a phase-based implementation record, not a personal time sheet. Repository evidence was assembled November 24–25, 2026. Earlier documents retain their phase-specific status; the final QA report supersedes their deployment status.

| Phase | Completed work and technologies | Decision, challenge and solution | Evidence and remaining limits |
|---|---|---|---|
| 1 | Inspected original repository, notebooks and outputs; initialized Vite/MapLibre | Kept original repository unchanged; separated application from analysis | ../data-inventory.md, ../development-plan.md; historical GTFS missing |
| 2 | GeoPandas export and validation of DA population/accessibility, priority and municipal geometry | Preserve analytical attributes; transform EPSG:26917 to EPSG:4326 | scripts/prepare_data.py, ../data-validation.md; uniform-density assumption remains |
| 3 | Official bus/LRT GTFS acquisition, date filtering, departure classes, route shapes, dissolved buffers | Calendar exceptions and restricted pickup/terminal events matter; separate newer network from historical estimates | scripts/prepare_gtfs.py, ../gtfs-validation.md; scheduled rather than live service |
| 4 | HTML/CSS dashboard, weighted KPIs, municipality comparison, dialogs and responsive drawer | Sidebar hierarchy and date labels prevent confusion between analytical periods | ../phase4-design.md, ../verification-phase4.md; no screen-reader certification |
| 5 | Search, selection/highlight, CSV/PNG exports, opacity and basemap controls | Reuse map sources; escape CSV formulas; replace unsuitable keyless basemap configuration | ../phase5-verification.md, ../evidence/; exports exclude HTML panels |
| 6 | Release data reconciliation, regression tests, reliability fixes, documentation and Pages workflow | Start analytics on style readiness; isolate data failures; restore PNG controls on timeout | ../release-data-validation.md, final-qa-report.md, .github/workflows/deploy.yml; public deployment status recorded separately |

Paths beginning scripts/ or .github/ are relative to the project root. No personal reflection is inferred from this work.
